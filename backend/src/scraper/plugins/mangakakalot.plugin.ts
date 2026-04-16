import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  IScraperPlugin,
  MangaResult,
  ChapterResult,
  PageResult,
} from '../interfaces/scraper-plugin.interface';

@Injectable()
export class MangaKakalotPlugin implements IScraperPlugin {
  readonly sourceName = 'mangakakalot';
  readonly baseUrl: string;

  private readonly logger = new Logger(MangaKakalotPlugin.name);
  private readonly client: AxiosInstance;

  constructor() {
    this.baseUrl = process.env.MANGAKAKALOT_BASE_URL || 'https://mangakakalot.gg';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        Referer: `${this.baseUrl}/`,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
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

  async getLatestManga(page: number): Promise<MangaResult[]> {
    try {
      const url = `/manga-list/latest-update?page=${page + 1}`;
      const response = await this.client.get(url);
      const $ = cheerio.load(response.data);
      const results: MangaResult[] = [];

      $('div.content-genres-item, div.list-story-item').each((_i, el) => {
        const $el = $(el);
        const linkEl = $el.find('a.genres-item-img, a.story-item-img').first();
        const href = linkEl.attr('href') || '';
        const title =
          linkEl.attr('title') ||
          $el.find('h3 a, .genres-item-name, .story-item-title').text().trim();
        const coverImage =
          $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';

        if (title && href) {
          results.push({
            title,
            coverImage: this.resolveUrl(coverImage),
            sourceUrl: this.resolveUrl(href),
          });
        }
      });

      return results;
    } catch (error: any) {
      this.handleError('getLatestManga', error);
      return [];
    }
  }

  async searchManga(query: string, page: number): Promise<MangaResult[]> {
    try {
      const encodedQuery = encodeURIComponent(query).replace(/%20/g, '_');
      const url = `/search/story/${encodedQuery}?page=${page + 1}`;
      const response = await this.client.get(url);
      const $ = cheerio.load(response.data);
      const results: MangaResult[] = [];

      $('div.search-story-item, div.story_item').each((_i, el) => {
        const $el = $(el);
        const linkEl = $el.find('a.item-img, a.story_item_img').first();
        const href = linkEl.attr('href') || '';
        const title =
          linkEl.attr('title') ||
          $el.find('h3 a, .item-title').text().trim();
        const coverImage =
          $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';

        if (title && href) {
          results.push({
            title,
            coverImage: this.resolveUrl(coverImage),
            sourceUrl: this.resolveUrl(href),
          });
        }
      });

      return results;
    } catch (error: any) {
      this.handleError('searchManga', error);
      return [];
    }
  }

  async getMangaDetail(sourceUrl: string): Promise<MangaResult> {
    try {
      const response = await this.client.get(sourceUrl);
      const $ = cheerio.load(response.data);

      const title = $(
        'h1.manga-info-text, h1, div.manga-info-top h1, ul.manga-info-text li h1',
      )
        .first()
        .text()
        .trim();

      const coverImage =
        $('div.manga-info-pic img, div.story-info-left img').attr('src') ||
        $('div.manga-info-pic img, div.story-info-left img').attr('data-src') ||
        '';

      const altTitlesText = $(
        'td:contains("Alternative"), li:contains("Alternative")',
      )
        .first()
        .text()
        .replace(/Alternative\s*:?\s*/i, '')
        .trim();
      const alternativeTitles = altTitlesText
        ? altTitlesText
            .split(/[;,]/)
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;

      let author: string | undefined;
      $('td:contains("Author"), li:contains("Author")').each((_i, el) => {
        const text = $(el).text();
        if (/author/i.test(text)) {
          author = $(el).find('a').text().trim() || text.replace(/Author\s*:?\s*/i, '').trim();
        }
      });

      const genres: string[] = [];
      $('td:contains("Genres") a, li:contains("Genres") a').each((_i, el) => {
        const genre = $(el).text().trim();
        if (genre) genres.push(genre);
      });

      let statusText = '';
      $('td:contains("Status"), li:contains("Status")').each((_i, el) => {
        const text = $(el).text();
        if (/status/i.test(text)) {
          statusText = text.replace(/Status\s*:?\s*/i, '').trim().toLowerCase();
        }
      });

      const statusMap: Record<string, MangaResult['status']> = {
        ongoing: 'ongoing',
        completed: 'completed',
        hiatus: 'hiatus',
        cancelled: 'cancelled',
      };
      const status = statusMap[statusText] || undefined;

      const description = $(
        'div#noidungm, div.panel-story-info-description, div.manga-info-desc',
      )
        .first()
        .text()
        .replace(/Description\s*:?\s*/i, '')
        .trim();

      return {
        title: title || 'Unknown',
        alternativeTitles,
        author,
        genres: genres.length > 0 ? genres : undefined,
        status,
        description: description || undefined,
        coverImage: this.resolveUrl(coverImage),
        sourceUrl,
      };
    } catch (error: any) {
      this.handleError('getMangaDetail', error);
      throw new Error(`Failed to get manga detail: ${error.message}`);
    }
  }

  async getChapterList(sourceUrl: string): Promise<ChapterResult[]> {
    try {
      const response = await this.client.get(sourceUrl);
      const $ = cheerio.load(response.data);
      const chapters: ChapterResult[] = [];

      $(
        'div.chapter-list div.row a, ul.row-content-chapter li a, div.manga-info-chapter div.row span a',
      ).each((_i, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const text = $el.text().trim();
        const chapterMatch = text.match(/chapter\s+([\d.]+)/i);
        if (!chapterMatch) return;

        const chapterNumber = parseFloat(chapterMatch[1]);
        if (isNaN(chapterNumber)) return;

        const $row = $el.closest('div.row, li');
        const dateText = $row.find('span:last-child, span.chapter-time').text().trim();
        const publishedAt = this.parseDate(dateText);

        chapters.push({
          chapterNumber,
          title: text,
          sourceUrl: this.resolveUrl(href),
          publishedAt,
        });
      });

      return chapters;
    } catch (error: any) {
      this.handleError('getChapterList', error);
      return [];
    }
  }

  async getPageList(chapterUrl: string): Promise<PageResult[]> {
    try {
      const response = await this.client.get(chapterUrl);
      const $ = cheerio.load(response.data);
      const pages: PageResult[] = [];

      $('div.container-chapter-reader img').each((i, el) => {
        const $img = $(el);
        const imageUrl =
          $img.attr('data-src') || $img.attr('src') || '';
        if (imageUrl) {
          pages.push({
            pageNumber: i + 1,
            imageUrl: this.resolveUrl(imageUrl.trim()),
          });
        }
      });

      return pages;
    } catch (error: any) {
      this.handleError('getPageList', error);
      return [];
    }
  }

  private parseDate(dateText: string): Date | undefined {
    if (!dateText) return undefined;

    // Handle relative dates like "5 hours ago", "2 days ago"
    const relativeMatch = dateText.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2].toLowerCase();
      const now = new Date();
      const msMap: Record<string, number> = {
        minute: 60 * 1000,
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000,
      };
      return new Date(now.getTime() - amount * (msMap[unit] || 0));
    }

    // Try standard date parsing
    const parsed = new Date(dateText);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private handleError(method: string, error: any): void {
    if (error.response?.status === 403 || error.response?.status === 503) {
      this.logger.warn(
        `${method}: Possible Cloudflare block (HTTP ${error.response.status})`,
      );
    } else {
      this.logger.error(`${method} failed: ${error.message}`);
    }
  }
}
