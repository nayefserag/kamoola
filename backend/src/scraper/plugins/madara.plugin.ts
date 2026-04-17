import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  IScraperPlugin,
  MangaResult,
  ChapterResult,
  PageResult,
} from '../interfaces/scraper-plugin.interface';

// manhuaplus.top — NetTruyen-style site (NOT Madara). Cloudflare-protected.
// Use got-scraping for browser TLS fingerprinting with axios fallback.
@Injectable()
export class MadaraPlugin implements IScraperPlugin {
  readonly sourceName = 'madara';
  readonly baseUrl: string;

  private readonly logger = new Logger(MadaraPlugin.name);
  private readonly client: AxiosInstance;
  private gotScrapingPromise: Promise<any> | undefined;

  constructor() {
    this.baseUrl = process.env.MADARA_BASE_URL || 'https://manhuaplus.top';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: `${this.baseUrl}/`,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
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

  private async fetchHtml(path: string): Promise<string> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    try {
      const gotScraping = await this.getGotScraping();
      const res = await gotScraping({
        url,
        timeout: { request: 60000 },
        headerGeneratorOptions: {
          browsers: [{ name: 'chrome', minVersion: 120 }],
          devices: ['desktop'],
          operatingSystems: ['windows'],
          locales: ['en-US'],
        },
      });
      return res.body as string;
    } catch (err: any) {
      this.logger.warn(
        `got-scraping failed for ${url}, falling back to axios: ${err.message}`,
      );
      const res = await this.client.get(url);
      return res.data as string;
    }
  }

  private resolveUrl(href: string): string {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    if (href.startsWith('//')) return `https:${href}`;
    if (href.startsWith('/')) return `${this.baseUrl}${href}`;
    return `${this.baseUrl}/${href}`;
  }

  private mapStatus(s?: string): MangaResult['status'] | undefined {
    if (!s) return undefined;
    const l = s.toLowerCase();
    if (l.includes('ongoing') || l.includes('updating')) return 'ongoing';
    if (l.includes('completed') || l.includes('finished')) return 'completed';
    if (l.includes('hiatus') || l.includes('on hold')) return 'hiatus';
    if (l.includes('cancel') || l.includes('dropped')) return 'cancelled';
    return undefined;
  }

  async getLatestManga(page: number): Promise<MangaResult[]> {
    // Try common URL patterns for NetTruyen / ManhuaPlus-style layouts
    const urls = [
      `/all-manga/${page + 1}/?sort=latest-updated`,
      `/all-manga/?sort=latest-updated&page=${page + 1}`,
      `/manga-list?sort=latest-updated&page=${page + 1}`,
      `/latest-manga/page/${page + 1}`,
      `/?page=${page + 1}`,
    ];

    for (const url of urls) {
      try {
        const html = await this.fetchHtml(url);
        const results = this.parseListing(html);
        if (results.length > 0) {
          this.logger.debug(`getLatestManga page ${page}: found ${results.length} via ${url}`);
          return results;
        }
      } catch (err: any) {
        this.logger.warn(`${url} failed: ${err.message}`);
      }
    }

    return [];
  }

  private parseListing(html: string): MangaResult[] {
    const $ = cheerio.load(html);
    const results: MangaResult[] = [];
    const seen = new Set<string>();

    // Primary selectors for NetTruyen-style cards
    $(
      'div.item.item-follow, div.item-manga, div.manga-item, ' +
      'div.page-item-detail, div.row div.item, div.c-tabs-item__content',
    ).each((_i, el) => {
      const $el = $(el);
      const $a = $el.find('div.image a, a.h-title, h3 a, a').first();
      const href = $a.attr('href') ?? '';
      const title =
        $a.attr('title') ??
        $el.find('p.title a, h3.h-title a, h3 a, .post-title a').text().trim() ??
        $el.find('img').attr('alt') ??
        '';
      const cover =
        $el.find('img').attr('data-original') ??
        $el.find('img').attr('data-src') ??
        $el.find('img').attr('src') ??
        '';

      if (title && href && !seen.has(href)) {
        seen.add(href);
        results.push({
          title,
          coverImage: this.resolveUrl(cover),
          sourceUrl: this.resolveUrl(href),
        });
      }
    });

    // Fallback: find manga detail links
    if (results.length === 0) {
      $('a[href*="/manga/"], a[href*="/all-manga/"]').each((_i, el) => {
        const $a = $(el);
        const href = $a.attr('href') || '';
        if (!href || seen.has(href)) return;
        if (/chapter/i.test(href)) return;
        const $img = $a.find('img').first();
        const title = (
          $a.attr('title') ||
          $img.attr('alt') ||
          $a.text().trim()
        ).trim();
        if (!title || title.length < 2) return;
        const cover = $img.attr('data-original') || $img.attr('src') || '';
        seen.add(href);
        results.push({
          title,
          coverImage: this.resolveUrl(cover),
          sourceUrl: this.resolveUrl(href),
        });
      });
    }

    return results;
  }

  async searchManga(query: string, page: number): Promise<MangaResult[]> {
    try {
      const url = `/all-manga/${page + 1}/?search=${encodeURIComponent(query)}`;
      const html = await this.fetchHtml(url);
      return this.parseListing(html);
    } catch (err: any) {
      this.logger.error(`searchManga "${query}" page ${page} failed: ${err.message}`);
      return [];
    }
  }

  async getMangaDetail(sourceUrl: string): Promise<MangaResult> {
    try {
      const html = await this.fetchHtml(sourceUrl);
      const $ = cheerio.load(html);

      const title =
        $('h1.title-detail, h1.manga-title, h1').first().text().trim() ||
        $('meta[property="og:title"]').attr('content')?.trim() ||
        'Unknown';
      const cover =
        $('div.col-image img').attr('data-original') ??
        $('div.col-image img').attr('src') ??
        $('div.book_info img').attr('src') ??
        $('meta[property="og:image"]').attr('content') ??
        '';

      const description = $('div.detail-content p, div.manga-summary, div.summary-content')
        .first()
        .text()
        .trim();

      const genres: string[] = [];
      $('li.kind a, div.genres a, div.genres-content a').each((_i, el) => {
        const g = $(el).text().trim();
        if (g) genres.push(g);
      });

      let statusText = '';
      $('li.status p.col-xs-8').each((_i, el) => { statusText = $(el).text().trim(); });
      if (!statusText) {
        $('p.status').each((_i, el) => { statusText = $(el).text().trim(); });
      }

      const author = $('li.author a, p.author a').first().text().trim() || undefined;

      return {
        title,
        author: author || undefined,
        genres: genres.length > 0 ? genres : undefined,
        status: this.mapStatus(statusText),
        description: description || undefined,
        coverImage: cover ? this.resolveUrl(cover) : undefined,
        sourceUrl,
      };
    } catch (err: any) {
      this.logger.error(`getMangaDetail ${sourceUrl} failed: ${err.message}`);
      throw new Error(`madara getMangaDetail failed: ${err.message}`);
    }
  }

  async getChapterList(sourceUrl: string): Promise<ChapterResult[]> {
    try {
      const html = await this.fetchHtml(sourceUrl);
      const $ = cheerio.load(html);
      const chapters: ChapterResult[] = [];

      $('div.list-chapter li.row, ul.list-chapter li, ul.wp-manga-chapter li, li.wp-manga-chapter').each((_i, el) => {
        const $el = $(el);
        const $a = $el.find('a').first();
        const href = $a.attr('href') ?? '';
        const text = $a.text().trim();
        const match = text.match(/(?:chapter|chap|ch)[.\s-]*(\d+(?:\.\d+)?)/i);
        if (!match) return;
        const num = parseFloat(match[1]);
        if (isNaN(num)) return;

        const dateText = $el.find('span').last().text().trim();
        chapters.push({
          chapterNumber: num,
          title: text || undefined,
          sourceUrl: this.resolveUrl(href),
          publishedAt: dateText ? new Date(dateText) : undefined,
        });
      });

      return chapters;
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

      $('div.page-chapter img, div.reading-detail img, div.reading-content img').each((i, el) => {
        const $img = $(el);
        const src =
          $img.attr('data-original') ??
          $img.attr('data-src') ??
          $img.attr('src') ?? '';
        if (src && !src.includes('loading') && !src.includes('data:image/gif')) {
          pages.push({ pageNumber: i + 1, imageUrl: this.resolveUrl(src.trim()) });
        }
      });

      return pages;
    } catch (err: any) {
      this.logger.error(`getPageList ${chapterUrl} failed: ${err.message}`);
      return [];
    }
  }
}
