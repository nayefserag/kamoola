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
export class MadaraPlugin implements IScraperPlugin {
  readonly sourceName = 'madara';
  readonly baseUrl: string;

  private readonly logger = new Logger(MadaraPlugin.name);
  private readonly client: AxiosInstance;

  constructor() {
    this.baseUrl = process.env.MADARA_BASE_URL || 'https://manhuaplus.top';
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

  private mapStatus(
    statusText: string | undefined,
  ): MangaResult['status'] | undefined {
    if (!statusText) return undefined;
    const lower = statusText.toLowerCase().trim();
    if (lower.includes('ongoing') || lower.includes('updating')) return 'ongoing';
    if (lower.includes('completed') || lower.includes('finished')) return 'completed';
    if (lower.includes('hiatus') || lower.includes('on hold')) return 'hiatus';
    if (lower.includes('cancelled') || lower.includes('dropped')) return 'cancelled';
    return undefined;
  }

  async getLatestManga(page: number): Promise<MangaResult[]> {
    try {
      const url = `/page/${page + 1}/?m_orderby=latest`;
      const response = await this.client.get(url);
      const $ = cheerio.load(response.data);
      const results: MangaResult[] = [];

      $('div.page-item-detail, div.manga-item').each((_i, el) => {
        const $el = $(el);
        const linkEl = $el.find('a').first();
        const href = linkEl.attr('href') || '';
        const title =
          $el.find('h3 a, h5 a, .post-title a').text().trim() ||
          linkEl.attr('title') ||
          '';
        const coverImage =
          $el.find('img').attr('data-src') ||
          $el.find('img').attr('src') ||
          '';

        if (title && href) {
          results.push({
            title,
            coverImage: this.resolveUrl(coverImage.trim()),
            sourceUrl: this.resolveUrl(href),
          });
        }
      });

      return results;
    } catch (error: any) {
      this.logger.error(`getLatestManga page ${page} failed: ${error.message}`);
      return [];
    }
  }

  async searchManga(query: string, page: number): Promise<MangaResult[]> {
    try {
      const url = `/page/${page + 1}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
      const response = await this.client.get(url);
      const $ = cheerio.load(response.data);
      const results: MangaResult[] = [];

      $('div.c-tabs-item__content, div.row c-tabs-item__content').each(
        (_i, el) => {
          const $el = $(el);
          const linkEl = $el.find('.post-title a, h3 a').first();
          const href = linkEl.attr('href') || '';
          const title = linkEl.text().trim();
          const coverImage =
            $el.find('img').attr('data-src') ||
            $el.find('img').attr('src') ||
            '';

          if (title && href) {
            results.push({
              title,
              coverImage: this.resolveUrl(coverImage.trim()),
              sourceUrl: this.resolveUrl(href),
            });
          }
        },
      );

      return results;
    } catch (error: any) {
      this.logger.error(
        `searchManga "${query}" page ${page} failed: ${error.message}`,
      );
      return [];
    }
  }

  async getMangaDetail(sourceUrl: string): Promise<MangaResult> {
    try {
      const response = await this.client.get(sourceUrl);
      const $ = cheerio.load(response.data);

      const title =
        $('h1.post-title').text().trim() ||
        $('div.post-title h1').text().trim() ||
        $('h1').first().text().trim();

      const coverImage =
        $('div.summary_image img').attr('data-src') ||
        $('div.summary_image img').attr('src') ||
        '';

      const description = $('div.summary__content')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      const genres: string[] = [];
      $('div.genres-content a').each((_i, el) => {
        const genre = $(el).text().trim();
        if (genre) genres.push(genre);
      });

      const author =
        $('div.author-content a').text().trim() || undefined;
      const artist =
        $('div.artist-content a').text().trim() || undefined;

      let statusText = '';
      $('div.post-status div.summary-content, div.post-status div.post-content_item').each(
        (_i, el) => {
          const $el = $(el);
          const label = $el.prev().text().trim().toLowerCase();
          if (label.includes('status')) {
            statusText = $el.text().trim();
          }
        },
      );
      // Alternative status selector
      if (!statusText) {
        $('div.post-content_item').each((_i, el) => {
          const $el = $(el);
          const heading = $el.find('.summary-heading').text().trim().toLowerCase();
          if (heading.includes('status')) {
            statusText = $el.find('.summary-content').text().trim();
          }
        });
      }

      const altTitlesText = $('div.post-content_item')
        .filter((_i, el) => {
          const heading = $(el).find('.summary-heading').text().toLowerCase();
          return heading.includes('alternative') || heading.includes('other name');
        })
        .find('.summary-content')
        .text()
        .trim();

      const alternativeTitles = altTitlesText
        ? altTitlesText
            .split(/[;,]/)
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;

      return {
        title: title || 'Unknown',
        alternativeTitles:
          alternativeTitles && alternativeTitles.length > 0
            ? alternativeTitles
            : undefined,
        author,
        artist,
        genres: genres.length > 0 ? genres : undefined,
        status: this.mapStatus(statusText),
        description: description || undefined,
        coverImage: coverImage ? this.resolveUrl(coverImage.trim()) : undefined,
        sourceUrl,
      };
    } catch (error: any) {
      this.logger.error(
        `getMangaDetail for ${sourceUrl} failed: ${error.message}`,
      );
      throw new Error(`Failed to get manga detail: ${error.message}`);
    }
  }

  async getChapterList(sourceUrl: string): Promise<ChapterResult[]> {
    try {
      // First, try AJAX endpoint to load all chapters
      const chapters = await this.fetchChaptersViaAjax(sourceUrl);
      if (chapters.length > 0) return chapters;

      // Fallback: scrape from the manga page directly
      return this.scrapeChaptersFromPage(sourceUrl);
    } catch (error: any) {
      this.logger.error(
        `getChapterList for ${sourceUrl} failed: ${error.message}`,
      );
      return [];
    }
  }

  private async fetchChaptersViaAjax(
    sourceUrl: string,
  ): Promise<ChapterResult[]> {
    try {
      // Extract manga slug/ID for the AJAX request
      const mangaPath = sourceUrl
        .replace(this.baseUrl, '')
        .replace(/^\/manga\//, '')
        .replace(/\/$/, '');

      const ajaxUrl = `${this.baseUrl}/manga/${mangaPath}/ajax/chapters/`;
      const response = await this.client.post(ajaxUrl, null, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      // Alternative: admin-ajax.php endpoint
      if (!response.data || response.status !== 200) {
        const formData = new URLSearchParams();
        formData.append('action', 'manga_get_chapters');
        formData.append('manga', mangaPath);

        const ajaxResponse = await this.client.post(
          '/wp-admin/admin-ajax.php',
          formData.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest',
            },
          },
        );

        return this.parseChaptersHtml(ajaxResponse.data);
      }

      return this.parseChaptersHtml(response.data);
    } catch (error: any) {
      this.logger.debug(
        `AJAX chapter fetch failed, will try page scrape: ${error.message}`,
      );
      return [];
    }
  }

  private parseChaptersHtml(html: string): ChapterResult[] {
    const $ = cheerio.load(html);
    const chapters: ChapterResult[] = [];

    $('ul.main li.wp-manga-chapter a, li.wp-manga-chapter a').each(
      (_i, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const text = $el.text().trim();
        const chapterMatch = text.match(/chapter\s+([\d.]+)/i);
        if (!chapterMatch) return;

        const chapterNumber = parseFloat(chapterMatch[1]);
        if (isNaN(chapterNumber)) return;

        const $li = $el.closest('li');
        const dateText =
          $li.find('span.chapter-release-date, span.chapter-release-date i').text().trim();
        const publishedAt = this.parseDate(dateText);

        chapters.push({
          chapterNumber,
          title: text,
          sourceUrl: this.resolveUrl(href),
          publishedAt,
        });
      },
    );

    return chapters;
  }

  private async scrapeChaptersFromPage(
    sourceUrl: string,
  ): Promise<ChapterResult[]> {
    const response = await this.client.get(sourceUrl);
    return this.parseChaptersHtml(response.data);
  }

  async getPageList(chapterUrl: string): Promise<PageResult[]> {
    try {
      const response = await this.client.get(chapterUrl);
      const $ = cheerio.load(response.data);
      const pages: PageResult[] = [];

      $('div.reading-content img').each((i, el) => {
        const $img = $(el);
        // Check data-src first (lazy loading), then src
        let imageUrl =
          $img.attr('data-src')?.trim() ||
          $img.attr('src')?.trim() ||
          '';

        // Skip placeholder/loading images
        if (
          !imageUrl ||
          imageUrl.includes('loading') ||
          imageUrl.includes('pixel') ||
          imageUrl.includes('data:image/gif')
        ) {
          return;
        }

        pages.push({
          pageNumber: i + 1,
          imageUrl: this.resolveUrl(imageUrl),
        });
      });

      return pages;
    } catch (error: any) {
      this.logger.error(
        `getPageList for ${chapterUrl} failed: ${error.message}`,
      );
      return [];
    }
  }

  private parseDate(dateText: string): Date | undefined {
    if (!dateText) return undefined;

    // Handle relative dates
    const relativeMatch = dateText.match(
      /(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i,
    );
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

    const parsed = new Date(dateText);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }
}
