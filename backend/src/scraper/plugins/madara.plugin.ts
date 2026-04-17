import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  IScraperPlugin,
  MangaResult,
  ChapterResult,
  PageResult,
} from '../interfaces/scraper-plugin.interface';

// manhuaplus.top — NetTruyen-style site (NOT Madara)
@Injectable()
export class MadaraPlugin implements IScraperPlugin {
  readonly sourceName = 'madara';
  readonly baseUrl = 'https://manhuaplus.top';

  private readonly logger = new Logger(MadaraPlugin.name);
  private readonly client: AxiosInstance;

  constructor() {
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
    try {
      // manhuaplus uses 1-indexed pages with sort=latest-updated
      const { data } = await this.client.get(`/all-manga/${page + 1}/?sort=latest-updated`);
      const $ = cheerio.load(data);
      const results: MangaResult[] = [];

      $('div.item.item-follow').each((_i, el) => {
        const $el = $(el);
        const $a = $el.find('div.image a').first();
        const href = $a.attr('href') ?? '';
        const title = $a.attr('title') ?? $el.find('p.title a').first().text().trim();
        const cover =
          $el.find('img').attr('data-original') ??
          $el.find('img').attr('src') ??
          '';

        if (title && href) {
          results.push({
            title,
            coverImage: this.resolveUrl(cover),
            sourceUrl: this.resolveUrl(href),
          });
        }
      });

      return results;
    } catch (err: any) {
      this.logger.error(`getLatestManga page ${page} failed: ${err.message}`);
      return [];
    }
  }

  async searchManga(query: string, page: number): Promise<MangaResult[]> {
    try {
      const { data } = await this.client.get(`/all-manga/${page + 1}/?search=${encodeURIComponent(query)}`);
      const $ = cheerio.load(data);
      const results: MangaResult[] = [];

      $('div.item.item-follow').each((_i, el) => {
        const $el = $(el);
        const $a = $el.find('div.image a').first();
        const href = $a.attr('href') ?? '';
        const title = $a.attr('title') ?? '';
        const cover = $el.find('img').attr('data-original') ?? $el.find('img').attr('src') ?? '';
        if (title && href) results.push({ title, coverImage: this.resolveUrl(cover), sourceUrl: this.resolveUrl(href) });
      });

      return results;
    } catch (err: any) {
      this.logger.error(`searchManga "${query}" page ${page} failed: ${err.message}`);
      return [];
    }
  }

  async getMangaDetail(sourceUrl: string): Promise<MangaResult> {
    try {
      const { data } = await this.client.get(sourceUrl);
      const $ = cheerio.load(data);

      const title = $('h1.title-detail, h1.manga-title, h1').first().text().trim();
      const cover =
        $('div.col-image img').attr('data-original') ??
        $('div.col-image img').attr('src') ??
        $('div.book_info img').attr('src') ?? '';

      const description = $('div.detail-content p, div.manga-summary').first().text().trim();

      const genres: string[] = [];
      $('li.kind a, div.genres a').each((_i, el) => {
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
        title: title || 'Unknown',
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
      const { data } = await this.client.get(sourceUrl);
      const $ = cheerio.load(data);
      const chapters: ChapterResult[] = [];

      $('div.list-chapter li.row, ul.list-chapter li').each((_i, el) => {
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
      const { data } = await this.client.get(chapterUrl);
      const $ = cheerio.load(data);
      const pages: PageResult[] = [];

      $('div.page-chapter img, div.reading-detail img').each((i, el) => {
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
