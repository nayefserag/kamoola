import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  IScraperPlugin,
  MangaResult,
  ChapterResult,
  PageResult,
} from '../interfaces/scraper-plugin.interface';

// azoramoon.com — Next.js SSR site with REST API at api.azoramoon.com
// API: GET https://api.azoramoon.com/api/query?perPage=N&page=N&orderBy=...
// Chapter images: scraped from SSR reader page HTML
@Injectable()
export class AzoraPlugin implements IScraperPlugin {
  readonly sourceName = 'azora';
  readonly baseUrl = 'https://azoramoon.com';
  private readonly apiBase = 'https://api.azoramoon.com';

  private readonly logger = new Logger(AzoraPlugin.name);
  private readonly client: AxiosInstance;
  private readonly apiClient: AxiosInstance;
  private gotScrapingPromise: Promise<any> | undefined;

  constructor() {
    const commonHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Origin: 'https://azoramoon.com',
      Referer: 'https://azoramoon.com/',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'ar,en;q=0.9',
    };
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: commonHeaders,
    });
    this.apiClient = axios.create({
      baseURL: this.apiBase,
      timeout: 15000,
      headers: commonHeaders,
    });
  }

  private async getGotScraping(): Promise<any> {
    if (!this.gotScrapingPromise) {
      this.gotScrapingPromise = (
        new Function('return import("got-scraping")') as () => Promise<any>
      )().then((mod) => mod.gotScraping);
    }
    return this.gotScrapingPromise;
  }

  private async fetchJson(url: string, params?: Record<string, any>): Promise<any> {
    const qs = params
      ? '?' +
        Object.entries(params)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    const fullUrl = (url.startsWith('http') ? url : `${this.apiBase}${url}`) + qs;

    // Try got-scraping first (handles Cloudflare), then axios
    try {
      const gotScraping = await this.getGotScraping();
      const res = await gotScraping({
        url: fullUrl,
        timeout: { request: 30000 },
        headerGeneratorOptions: {
          browsers: [{ name: 'chrome', minVersion: 120 }],
          devices: ['desktop'],
          operatingSystems: ['windows'],
          locales: ['ar-SA', 'en-US'],
        },
      });
      return JSON.parse(res.body as string);
    } catch (gotErr: any) {
      this.logger.warn(
        `got-scraping failed for ${fullUrl}, falling back to axios: ${gotErr.message}`,
      );
      const res = await this.apiClient.get(url, { params });
      return res.data;
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    const full = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    try {
      const gotScraping = await this.getGotScraping();
      const res = await gotScraping({
        url: full,
        timeout: { request: 30000 },
        headerGeneratorOptions: {
          browsers: [{ name: 'chrome', minVersion: 120 }],
          devices: ['desktop'],
          operatingSystems: ['windows'],
          locales: ['ar-SA', 'en-US'],
        },
      });
      return res.body as string;
    } catch (err: any) {
      this.logger.warn(`got-scraping failed for ${full}: ${err.message}`);
      const res = await this.client.get(url);
      return res.data as string;
    }
  }

  private mapStatus(s: string | undefined): MangaResult['status'] | undefined {
    if (!s) return undefined;
    const l = s.toUpperCase();
    if (l === 'ONGOING') return 'ongoing';
    if (l === 'COMPLETED') return 'completed';
    if (l === 'HIATUS' || l === 'ON_HOLD') return 'hiatus';
    if (l === 'CANCELLED' || l === 'DROPPED') return 'cancelled';
    return undefined;
  }

  private mapPost(post: any): MangaResult {
    const slug = post.slug ?? '';
    return {
      title: post.postTitle || post.title || 'Unknown',
      description: post.postContent
        ? post.postContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        : undefined,
      coverImage: post.featuredImage || post.cover || undefined,
      sourceUrl: `${this.baseUrl}/series/${slug}`,
      status: this.mapStatus(post.seriesStatus || post.status),
      author: post.author || undefined,
      genres:
        Array.isArray(post.genres) && post.genres.length > 0
          ? post.genres.map((g: any) => g.name || g).filter(Boolean)
          : undefined,
      language: 'ar',
    };
  }

  private scrapeSeriesHtml(html: string): MangaResult[] {
    const $ = cheerio.load(html);
    const results: MangaResult[] = [];
    const seen = new Set<string>();

    $('a[href*="/series/"]').each((_i, el) => {
      const $a = $(el);
      const href = ($a.attr('href') || '').split(/[?#]/)[0];
      const m = href.match(/\/series\/([^\/]+)\/?$/);
      if (!m) return;
      const slug = m[1];
      if (seen.has(slug)) return;

      const $img = $a.find('img').first();
      const title = (
        $a.attr('title') ||
        $img.attr('alt') ||
        $a.find('h3, h2').text().trim() ||
        ''
      ).trim();
      if (!title || title.length < 2) return;
      seen.add(slug);

      const cover = ($img.attr('src') || $img.attr('data-src') || '').trim();
      results.push({
        title,
        coverImage: cover || undefined,
        sourceUrl: `${this.baseUrl}/series/${slug}`,
        language: 'ar',
      });
    });

    return results;
  }

  async getLatestManga(page: number): Promise<MangaResult[]> {
    // Primary: REST API
    try {
      const data = await this.fetchJson('/api/query', {
        perPage: 20,
        page: page + 1,
        orderBy: 'updatedAt',
        orderDirection: 'desc',
      });
      const posts = data?.posts ?? data?.data ?? [];
      if (Array.isArray(posts) && posts.length > 0) {
        return posts.map((p: any) => this.mapPost(p));
      }
    } catch (err: any) {
      this.logger.warn(`API query failed: ${err.message}`);
    }

    // Fallback: scrape the listing page
    try {
      const html = await this.fetchHtml(`/series?page=${page + 1}`);
      return this.scrapeSeriesHtml(html);
    } catch (err: any) {
      this.logger.error(`getLatestManga page ${page} failed: ${err.message}`);
      return [];
    }
  }

  async searchManga(query: string, page: number): Promise<MangaResult[]> {
    try {
      const data = await this.fetchJson('/api/query', {
        searchTerm: query,
        perPage: 20,
        page: page + 1,
      });
      return (data.posts ?? []).map((p: any) => this.mapPost(p));
    } catch (err: any) {
      this.logger.error(`searchManga "${query}" page ${page} failed: ${err.message}`);
      return [];
    }
  }

  async getMangaDetail(sourceUrl: string): Promise<MangaResult> {
    try {
      const slug = sourceUrl.replace(`${this.baseUrl}/series/`, '').replace(/\/$/, '');
      const data = await this.fetchJson('/api/query', {
        searchTerm: slug,
        perPage: 1,
      });
      const post = data.posts?.[0];
      if (!post) throw new Error('Post not found');
      return { ...this.mapPost(post), sourceUrl };
    } catch (err: any) {
      this.logger.error(`getMangaDetail ${sourceUrl} failed: ${err.message}`);
      throw new Error(`azora getMangaDetail failed: ${err.message}`);
    }
  }

  async getChapterList(sourceUrl: string): Promise<ChapterResult[]> {
    try {
      const slug = sourceUrl.replace(`${this.baseUrl}/series/`, '').replace(/\/$/, '');
      const data = await this.fetchJson('/api/query', {
        searchTerm: slug,
        perPage: 1,
      });
      const post = data.posts?.[0];
      if (!post || !Array.isArray(post.chapters)) return [];

      return (post.chapters as any[])
        .map((ch) => ({
          chapterNumber: parseFloat(ch.number) || 0,
          title: ch.title || undefined,
          sourceUrl: `${this.baseUrl}/series/${post.slug}/${ch.slug}`,
          publishedAt: ch.createdAt ? new Date(ch.createdAt) : undefined,
          language: 'ar',
        }))
        .filter((c) => !isNaN(c.chapterNumber));
    } catch (err: any) {
      this.logger.error(`getChapterList ${sourceUrl} failed: ${err.message}`);
      return [];
    }
  }

  async getPageList(chapterUrl: string): Promise<PageResult[]> {
    try {
      const html = await this.fetchHtml(chapterUrl);
      const $ = cheerio.load(html);
      const pages: PageResult[] = [];
      const seen = new Set<string>();

      $('img').each((_i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (src.includes('storage.azoramoon.com/WP-manga/data/') && !seen.has(src)) {
          seen.add(src);
          pages.push({ pageNumber: seen.size, imageUrl: src });
        }
      });

      return pages;
    } catch (err: any) {
      this.logger.error(`getPageList ${chapterUrl} failed: ${err.message}`);
      return [];
    }
  }
}
