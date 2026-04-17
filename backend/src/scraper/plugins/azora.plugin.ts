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

  constructor() {
    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Origin: 'https://azoramoon.com',
      Referer: 'https://azoramoon.com/',
    };
    this.client = axios.create({ baseURL: this.baseUrl, timeout: 15000, headers: commonHeaders });
    this.apiClient = axios.create({ baseURL: this.apiBase, timeout: 15000, headers: commonHeaders });
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
      title: post.postTitle || 'Unknown',
      description: post.postContent
        ? post.postContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        : undefined,
      coverImage: post.featuredImage || undefined,
      sourceUrl: `${this.baseUrl}/series/${slug}`,
      status: this.mapStatus(post.seriesStatus),
      author: post.author || undefined,
      genres: Array.isArray(post.genres) && post.genres.length > 0
        ? post.genres.map((g: any) => g.name || g).filter(Boolean)
        : undefined,
      language: 'ar',
    };
  }

  async getLatestManga(page: number): Promise<MangaResult[]> {
    try {
      const { data } = await this.apiClient.get('/api/query', {
        params: { perPage: 20, page: page + 1, orderBy: 'updatedAt', orderDirection: 'desc' },
      });
      return (data.posts ?? []).map((p: any) => this.mapPost(p));
    } catch (err: any) {
      this.logger.error(`getLatestManga page ${page} failed: ${err.message}`);
      return [];
    }
  }

  async searchManga(query: string, page: number): Promise<MangaResult[]> {
    try {
      const { data } = await this.apiClient.get('/api/query', {
        params: { searchTerm: query, perPage: 20, page: page + 1 },
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
      const { data } = await this.apiClient.get('/api/query', {
        params: { searchTerm: slug, perPage: 1 },
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
      const { data } = await this.apiClient.get('/api/query', {
        params: { searchTerm: slug, perPage: 1 },
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
      const { data } = await this.client.get(chapterUrl);
      const $ = cheerio.load(data);
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
