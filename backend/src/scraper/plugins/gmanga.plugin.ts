import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
// gmanga.org is Cloudflare-protected — use got-scraping for browser TLS fingerprinting
import {
  IScraperPlugin,
  MangaResult,
  ChapterResult,
  PageResult,
} from '../interfaces/scraper-plugin.interface';

/**
 * Scraper plugin for GMANGA (https://gmanga.org)
 * One of the largest Arabic manga aggregator sites.
 *
 * GMANGA is a custom PHP-based platform (not Madara) with its own
 * internal API. We try the JSON API first, then fall back to HTML scraping.
 *
 * URL patterns:
 *   - Listing:  /mangas  or  /mangas?page=N
 *   - Detail:   /mangas/<id>/<slug>
 *   - Chapter:  /mangas/<id>/<slug>/<chapter-id>
 */
@Injectable()
export class GMangaPlugin implements IScraperPlugin {
  readonly sourceName = 'gmanga';
  readonly baseUrl: string;

  private readonly logger = new Logger(GMangaPlugin.name);
  private readonly client: AxiosInstance;
  private gotScrapingPromise: Promise<any> | undefined;

  constructor() {
    this.baseUrl = process.env.GMANGA_BASE_URL || 'https://gmanga.org';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        Referer: `${this.baseUrl}/`,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.5',
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
          locales: ['ar-SA', 'en-US'],
        },
      });
      return res.body as string;
    } catch (err: any) {
      this.logger.warn(`got-scraping failed for ${url}, falling back to axios: ${err.message}`);
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

  private mapStatus(
    statusText: string | undefined,
  ): MangaResult['status'] | undefined {
    if (!statusText) return undefined;
    const lower = statusText.toLowerCase().trim();

    if (lower.includes('مستمر') || lower.includes('ongoing')) return 'ongoing';
    if (lower.includes('مكتمل') || lower.includes('completed') || lower.includes('منتهية'))
      return 'completed';
    if (lower.includes('متوقف') || lower.includes('hiatus')) return 'hiatus';
    if (lower.includes('ملغ') || lower.includes('cancelled')) return 'cancelled';

    return undefined;
  }

  private extractChapterNumber(text: string): number | null {
    const match = text.match(/(?:الفصل|فصل|chapter|ch\.?)\s*([\d.]+)/i);
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? null : num;
    }
    const numMatch = text.match(/([\d.]+)/);
    if (numMatch) {
      const num = parseFloat(numMatch[1]);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  private parseDate(dateText: string): Date | undefined {
    if (!dateText) return undefined;

    const arRelative = dateText.match(
      /منذ\s+(\d+)?\s*(دقيقة|دقائق|ساعة|ساعات|يوم|أيام|أسبوع|أسابيع|شهر|أشهر|سنة|سنوات)/,
    );
    if (arRelative) {
      const amount = arRelative[1] ? parseInt(arRelative[1], 10) : 1;
      const unitMap: Record<string, number> = {
        'دقيقة': 60_000, 'دقائق': 60_000,
        'ساعة': 3_600_000, 'ساعات': 3_600_000,
        'يوم': 86_400_000, 'أيام': 86_400_000,
        'أسبوع': 604_800_000, 'أسابيع': 604_800_000,
        'شهر': 2_592_000_000, 'أشهر': 2_592_000_000,
        'سنة': 31_536_000_000, 'سنوات': 31_536_000_000,
      };
      return new Date(Date.now() - amount * (unitMap[arRelative[2]] || 0));
    }

    const enRelative = dateText.match(
      /(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i,
    );
    if (enRelative) {
      const amount = parseInt(enRelative[1], 10);
      const msMap: Record<string, number> = {
        minute: 60_000, hour: 3_600_000, day: 86_400_000,
        week: 604_800_000, month: 2_592_000_000, year: 31_536_000_000,
      };
      return new Date(Date.now() - amount * (msMap[enRelative[2].toLowerCase()] || 0));
    }

    const parsed = new Date(dateText);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }

  // ---------------------------------------------------------------------------
  // JSON API helpers — GMANGA may expose internal API endpoints
  // ---------------------------------------------------------------------------

  /**
   * Try to call GMANGA's internal API for manga listings.
   * Pattern: POST /api/mangas or GET /api/mangas?page=N
   */
  private async tryApiListing(page: number): Promise<MangaResult[] | null> {
    const apiUrls = [
      { method: 'get' as const, url: `/api/mangas?page=${page + 1}` },
      { method: 'post' as const, url: '/api/mangas', data: { page: page + 1 } },
    ];

    for (const req of apiUrls) {
      try {
        const response =
          req.method === 'post'
            ? await this.client.post(req.url, req.data, {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest',
                },
              })
            : await this.client.get(req.url, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
              });

        if (response.data && typeof response.data === 'object') {
          const items =
            response.data.data ||
            response.data.mangas ||
            response.data.results ||
            response.data;
          if (Array.isArray(items) && items.length > 0) {
            return items
              .map((item: any) => this.mapApiManga(item))
              .filter(Boolean) as MangaResult[];
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  private mapApiManga(item: any): MangaResult | null {
    const title =
      item.title || item.name || item.arabic_title || item.manga_title || '';
    if (!title) return null;

    const id = item.id || item.manga_id || '';
    const slug = item.slug || item.manga_slug || '';
    let sourceUrl = '';
    if (id && slug) {
      sourceUrl = `${this.baseUrl}/mangas/${id}/${slug}`;
    } else if (id) {
      sourceUrl = `${this.baseUrl}/mangas/${id}`;
    } else if (item.url) {
      sourceUrl = this.resolveUrl(item.url);
    }

    const coverImage =
      item.cover || item.thumbnail || item.image || item.poster || '';

    const genres = (item.categories || item.genres || item.tags || [])
      .map((g: any) => (typeof g === 'string' ? g : g.name || g.title || ''))
      .filter(Boolean);

    return {
      title,
      coverImage: coverImage ? this.resolveUrl(coverImage) : undefined,
      sourceUrl,
      genres: genres.length > 0 ? genres : undefined,
      status: this.mapStatus(item.status),
      language: 'ar',
    };
  }

  // ---------------------------------------------------------------------------
  // IScraperPlugin
  // ---------------------------------------------------------------------------

  async getLatestManga(page: number): Promise<MangaResult[]> {
    try {
      // Try API first
      const apiResults = await this.tryApiListing(page);
      if (apiResults && apiResults.length > 0) return apiResults;

      // Fallback: HTML scrape
      const url = `/mangas?page=${page + 1}`;
      const html = await this.fetchHtml(url);
      return this.scrapeListingPage(html);
    } catch (error: any) {
      this.logger.error(`getLatestManga page ${page} failed: ${error.message}`);
      return [];
    }
  }

  async searchManga(query: string, page: number): Promise<MangaResult[]> {
    try {
      // Try API search
      try {
        const response = await this.client.post(
          '/api/mangas/search',
          { title: query, page: page + 1 },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
          },
        );
        const items =
          response.data?.data ||
          response.data?.mangas ||
          response.data?.results ||
          response.data;
        if (Array.isArray(items) && items.length > 0) {
          return items
            .map((item: any) => this.mapApiManga(item))
            .filter(Boolean) as MangaResult[];
        }
      } catch {
        // API search not available, fall through
      }

      // HTML search fallback
      const searchUrls = [
        `/mangas?q=${encodeURIComponent(query)}&page=${page + 1}`,
        `/search?q=${encodeURIComponent(query)}&page=${page + 1}`,
      ];

      for (const url of searchUrls) {
        try {
          const html = await this.fetchHtml(url);
          const results = this.scrapeListingPage(html);
          if (results.length > 0) return results;
        } catch {
          continue;
        }
      }

      return [];
    } catch (error: any) {
      this.logger.error(
        `searchManga "${query}" page ${page} failed: ${error.message}`,
      );
      return [];
    }
  }

  async getMangaDetail(sourceUrl: string): Promise<MangaResult> {
    try {
      const html = await this.fetchHtml(sourceUrl);
      const $ = cheerio.load(html);

      const title =
        $('h1').first().text().trim() ||
        $('h2.manga-title, h2.series-title').first().text().trim() ||
        'Unknown';

      const coverImage =
        $('div.manga-cover img, div.series-cover img, div.thumb img')
          .first()
          .attr('data-src') ||
        $('div.manga-cover img, div.series-cover img, div.thumb img')
          .first()
          .attr('src') ||
        $('meta[property="og:image"]').attr('content') ||
        '';

      const description = $(
        'div.manga-summary, div.description, div.synopsis, ' +
        'div.manga-content p, div.manga-description',
      )
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      const genres: string[] = [];
      $(
        'div.manga-genres a, span.genre a, a.genre-tag, ' +
        'div.manga-categories a, div.tags a',
      ).each((_i, el) => {
        const genre = $(el).text().trim();
        if (genre) genres.push(genre);
      });

      let author: string | undefined;
      $(
        'span:contains("المؤلف"), span:contains("Author"), ' +
        'div.manga-author, span.author',
      ).each((_i, el) => {
        const text = $(el).next().text().trim() || $(el).text().trim();
        const cleaned = text.replace(/.*(?:المؤلف|Author)\s*:?\s*/i, '').trim();
        if (cleaned && !author) author = cleaned;
      });

      let statusText = '';
      $(
        'span:contains("الحالة"), span:contains("Status"), ' +
        'div.manga-status, span.status',
      ).each((_i, el) => {
        const text = $(el).next().text().trim() || $(el).text().trim();
        const cleaned = text.replace(/.*(?:الحالة|Status)\s*:?\s*/i, '').trim();
        if (cleaned && !statusText) statusText = cleaned;
      });

      return {
        title,
        author,
        genres: genres.length > 0 ? genres : undefined,
        status: this.mapStatus(statusText),
        description: description || undefined,
        coverImage: coverImage ? this.resolveUrl(coverImage.trim()) : undefined,
        sourceUrl,
        language: 'ar',
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
      const html = await this.fetchHtml(sourceUrl);
      const $ = cheerio.load(html);
      const chapters: ChapterResult[] = [];

      // Try embedded JSON data first
      $('script').each((_i, el) => {
        const scriptContent = $(el).html() || '';
        if (
          scriptContent.includes('chapters') &&
          (scriptContent.includes('chapter_number') ||
            scriptContent.includes('chapterNumber'))
        ) {
          try {
            // Look for JSON array of chapters in script tags
            const jsonMatch = scriptContent.match(
              /(?:chapters|chapterList)\s*[:=]\s*(\[[\s\S]*?\])/,
            );
            if (jsonMatch) {
              const chapterData = JSON.parse(jsonMatch[1]);
              for (const ch of chapterData) {
                const num = parseFloat(
                  ch.chapter_number || ch.number || ch.chapterNumber || '',
                );
                if (isNaN(num)) continue;
                chapters.push({
                  chapterNumber: num,
                  title: ch.title || ch.name || undefined,
                  sourceUrl: ch.url
                    ? this.resolveUrl(ch.url)
                    : `${sourceUrl}/${ch.slug || ch.id || num}`,
                  publishedAt: ch.created_at || ch.date
                    ? new Date(ch.created_at || ch.date)
                    : undefined,
                  language: 'ar',
                });
              }
            }
          } catch {
            // JSON parse failed, continue to HTML scraping
          }
        }
      });

      if (chapters.length > 0) return chapters;

      // HTML scraping fallback
      $(
        'div.chapter-list a, ul.chapters-list a, ' +
        'div.manga-chapters a, a.chapter-link, ' +
        'table.chapters-table a, div.chapters a',
      ).each((_i, el) => {
        const $el = $(el);
        const href = $el.attr('href') || '';
        const text = $el.text().trim();
        const chNum = this.extractChapterNumber(text);
        if (chNum == null) return;

        const $parent = $el.closest('li, tr, div');
        const dateText =
          $parent.find('span.date, time, .chapter-date').text().trim() ||
          $parent.find('time').attr('datetime') ||
          '';

        chapters.push({
          chapterNumber: chNum,
          title: text || undefined,
          sourceUrl: this.resolveUrl(href),
          publishedAt: this.parseDate(dateText),
          language: 'ar',
        });
      });

      return chapters;
    } catch (error: any) {
      this.logger.error(
        `getChapterList for ${sourceUrl} failed: ${error.message}`,
      );
      return [];
    }
  }

  async getPageList(chapterUrl: string): Promise<PageResult[]> {
    try {
      const html = await this.fetchHtml(chapterUrl);
      const $ = cheerio.load(html);
      const pages: PageResult[] = [];

      // Try embedded JSON page data first
      $('script').each((_i, el) => {
        const content = $(el).html() || '';
        if (content.includes('pages') || content.includes('images')) {
          try {
            const match = content.match(
              /(?:pages|images|chapterImages)\s*[:=]\s*(\[[\s\S]*?\])/,
            );
            if (match) {
              const imageData = JSON.parse(match[1]);
              for (let i = 0; i < imageData.length; i++) {
                const img = imageData[i];
                const url = typeof img === 'string' ? img : img.url || img.src || img.image || '';
                if (url) {
                  pages.push({
                    pageNumber: i + 1,
                    imageUrl: this.resolveUrl(url),
                  });
                }
              }
            }
          } catch {
            // continue
          }
        }
      });

      if (pages.length > 0) return pages;

      // HTML scraping fallback
      $(
        'div.reading-content img, div.chapter-content img, ' +
        'div.reader-area img, div.chapter-pages img, ' +
        'div#readerarea img, img.chapter-img',
      ).each((i, el) => {
        const $img = $(el);
        const imageUrl =
          $img.attr('data-src')?.trim() ||
          $img.attr('src')?.trim() ||
          '';

        if (
          !imageUrl ||
          imageUrl.includes('loading') ||
          imageUrl.includes('pixel') ||
          imageUrl.includes('data:image/gif') ||
          imageUrl.includes('logo') ||
          imageUrl.includes('icon')
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

  // ---------------------------------------------------------------------------
  // HTML scraping
  // ---------------------------------------------------------------------------

  private scrapeListingPage(html: string): MangaResult[] {
    const $ = cheerio.load(html);
    const results: MangaResult[] = [];

    $(
      'div.manga-card, div.manga-item, div.series-card, ' +
      'div.manga-list-item, a.manga-link, div.novel-item',
    ).each((_i, el) => {
      const $el = $(el);
      const linkEl = $el.is('a')
        ? $el
        : $el.find('a[href*="/mangas/"]').first() || $el.find('a').first();
      const href = linkEl.attr('href') || '';
      const title =
        $el.find('h3, h2, h4, .manga-title, .title').text().trim() ||
        linkEl.attr('title') ||
        $el.find('img').attr('alt') ||
        '';
      const coverImage =
        $el.find('img').attr('data-src') ||
        $el.find('img').attr('src') ||
        '';

      if (title && href) {
        results.push({
          title,
          coverImage: coverImage ? this.resolveUrl(coverImage.trim()) : undefined,
          sourceUrl: this.resolveUrl(href),
          language: 'ar',
        });
      }
    });

    // Broader fallback
    if (results.length === 0) {
      const seen = new Set<string>();
      $('a[href*="/mangas/"]').each((_i, el) => {
        const href = $(el).attr('href') || '';
        if (!href || href === '/mangas' || href === '/mangas/') return;
        const fullUrl = this.resolveUrl(href);
        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        const title =
          $(el).attr('title') ||
          $(el).text().trim() ||
          $(el).find('img').attr('alt') ||
          '';
        const coverImage =
          $(el).find('img').attr('data-src') ||
          $(el).find('img').attr('src') ||
          '';

        if (title && title.length > 1) {
          results.push({
            title,
            coverImage: coverImage
              ? this.resolveUrl(coverImage.trim())
              : undefined,
            sourceUrl: fullUrl,
            language: 'ar',
          });
        }
      });
    }

    return results;
  }
}
