import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  IScraperPlugin,
  MangaResult,
  ChapterResult,
  PageResult,
} from '../interfaces/scraper-plugin.interface';

/**
 * Scraper plugin for OlympusStaff / Team-X (https://olympustaff.com)
 * Arabic manga translation site.
 *
 * URL patterns:
 *   - Listing:  /series  or  /series?page=N
 *   - Detail:   /series/<slug>
 *   - Chapter:  /series/<slug>/<chapter-slug>
 *
 * The site may expose a __NEXT_DATA__ blob (Next.js) or a custom API.
 * We try JSON-based extraction first, then fall back to HTML scraping.
 */
@Injectable()
export class OlympusStaffPlugin implements IScraperPlugin {
  readonly sourceName = 'olympustaff';
  readonly baseUrl: string;

  private readonly logger = new Logger(OlympusStaffPlugin.name);
  private readonly client: AxiosInstance;

  constructor() {
    this.baseUrl =
      process.env.OLYMPUSTAFF_BASE_URL || 'https://olympustaff.com';
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

  private resolveUrl(href: string): string {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    if (href.startsWith('//')) return `https:${href}`;
    if (href.startsWith('/')) return `${this.baseUrl}${href}`;
    return `${this.baseUrl}/${href}`;
  }

  /**
   * Attempt to extract __NEXT_DATA__ JSON payload from a rendered page.
   * Returns null when the script tag is missing (not a Next.js page).
   */
  private extractNextData(html: string): any | null {
    const $ = cheerio.load(html);
    const scriptEl = $('script#__NEXT_DATA__');
    if (!scriptEl.length) return null;
    try {
      return JSON.parse(scriptEl.html() || '{}');
    } catch {
      return null;
    }
  }

  /**
   * Some sites embed JSON inside a generic <script> tag or
   * use a window.__DATA__ / window.__INITIAL_STATE__ pattern.
   */
  private extractEmbeddedJson(html: string): any | null {
    // Pattern 1: __NEXT_DATA__
    const nextData = this.extractNextData(html);
    if (nextData) return nextData;

    // Pattern 2: window.__DATA__ or similar
    const patterns = [
      /window\.__DATA__\s*=\s*(\{[\s\S]*?\});/,
      /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/,
      /window\.__NUXT__\s*=\s*(\{[\s\S]*?\});/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  private mapStatus(
    statusText: string | undefined,
  ): MangaResult['status'] | undefined {
    if (!statusText) return undefined;
    const lower = statusText.toLowerCase().trim();

    // Arabic status keywords
    if (lower.includes('مستمر') || lower.includes('ongoing') || lower.includes('مستمرة'))
      return 'ongoing';
    if (lower.includes('مكتمل') || lower.includes('completed') || lower.includes('منتهية'))
      return 'completed';
    if (lower.includes('متوقف') || lower.includes('hiatus') || lower.includes('معلق'))
      return 'hiatus';
    if (lower.includes('ملغ') || lower.includes('cancelled') || lower.includes('dropped'))
      return 'cancelled';

    return undefined;
  }

  private extractChapterNumber(text: string): number | null {
    // Match patterns like "الفصل 123", "Chapter 45", "ch 67.5", "فصل 12"
    const match = text.match(
      /(?:الفصل|فصل|chapter|ch\.?)\s*([\d.]+)/i,
    );
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? null : num;
    }
    // Fallback: bare number at end
    const numMatch = text.match(/([\d.]+)\s*$/);
    if (numMatch) {
      const num = parseFloat(numMatch[1]);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    return cheerio
      .load(`<div>${html}</div>`)('div')
      .text()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseDate(dateText: string): Date | undefined {
    if (!dateText) return undefined;

    // Relative dates (English)
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

    // Arabic relative dates: "منذ 3 أيام", "منذ ساعة"
    const arRelative = dateText.match(
      /منذ\s+(\d+)?\s*(دقيقة|ساعة|يوم|أيام|أسبوع|شهر|سنة)/,
    );
    if (arRelative) {
      const amount = arRelative[1] ? parseInt(arRelative[1], 10) : 1;
      const unitMap: Record<string, number> = {
        'دقيقة': 60 * 1000,
        'ساعة': 60 * 60 * 1000,
        'يوم': 24 * 60 * 60 * 1000,
        'أيام': 24 * 60 * 60 * 1000,
        'أسبوع': 7 * 24 * 60 * 60 * 1000,
        'شهر': 30 * 24 * 60 * 60 * 1000,
        'سنة': 365 * 24 * 60 * 60 * 1000,
      };
      const ms = unitMap[arRelative[2]] || 0;
      return new Date(Date.now() - amount * ms);
    }

    const parsed = new Date(dateText);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }

  // ---------------------------------------------------------------------------
  // IScraperPlugin implementation
  // ---------------------------------------------------------------------------

  async getLatestManga(page: number): Promise<MangaResult[]> {
    try {
      const url = `/series?page=${page + 1}`;
      const response = await this.client.get(url);
      const html = response.data;

      // Try JSON-based extraction first
      const jsonData = this.extractEmbeddedJson(html);
      if (jsonData) {
        const results = this.extractMangaListFromJson(jsonData);
        if (results.length > 0) return results;
      }

      // Fallback: HTML scraping
      return this.scrapeListingPage(html);
    } catch (error: any) {
      this.logger.error(`getLatestManga page ${page} failed: ${error.message}`);
      return [];
    }
  }

  async searchManga(query: string, page: number): Promise<MangaResult[]> {
    try {
      // Try search endpoint patterns common on these sites
      const searchUrls = [
        `/series?name=${encodeURIComponent(query)}&page=${page + 1}`,
        `/series?search=${encodeURIComponent(query)}&page=${page + 1}`,
        `/search?q=${encodeURIComponent(query)}&page=${page + 1}`,
      ];

      for (const url of searchUrls) {
        try {
          const response = await this.client.get(url);
          const html = response.data;

          const jsonData = this.extractEmbeddedJson(html);
          if (jsonData) {
            const results = this.extractMangaListFromJson(jsonData);
            if (results.length > 0) return results;
          }

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
      const response = await this.client.get(sourceUrl);
      const html = response.data;

      // Try JSON extraction
      const jsonData = this.extractEmbeddedJson(html);
      if (jsonData) {
        const result = this.extractMangaDetailFromJson(jsonData, sourceUrl);
        if (result) return result;
      }

      // Fallback: HTML scraping
      return this.scrapeMangaDetail(html, sourceUrl);
    } catch (error: any) {
      this.logger.error(
        `getMangaDetail for ${sourceUrl} failed: ${error.message}`,
      );
      throw new Error(`Failed to get manga detail: ${error.message}`);
    }
  }

  async getChapterList(sourceUrl: string): Promise<ChapterResult[]> {
    try {
      const response = await this.client.get(sourceUrl);
      const html = response.data;

      // Try JSON extraction
      const jsonData = this.extractEmbeddedJson(html);
      if (jsonData) {
        const chapters = this.extractChaptersFromJson(jsonData, sourceUrl);
        if (chapters.length > 0) return chapters;
      }

      // Fallback: HTML scraping
      return this.scrapeChapterList(html, sourceUrl);
    } catch (error: any) {
      this.logger.error(
        `getChapterList for ${sourceUrl} failed: ${error.message}`,
      );
      return [];
    }
  }

  async getPageList(chapterUrl: string): Promise<PageResult[]> {
    try {
      const response = await this.client.get(chapterUrl);
      const html = response.data;

      // Try JSON extraction
      const jsonData = this.extractEmbeddedJson(html);
      if (jsonData) {
        const pages = this.extractPagesFromJson(jsonData);
        if (pages.length > 0) return pages;
      }

      // Fallback: HTML scraping
      return this.scrapePageList(html);
    } catch (error: any) {
      this.logger.error(
        `getPageList for ${chapterUrl} failed: ${error.message}`,
      );
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // JSON-based extraction (Next.js / embedded data)
  // ---------------------------------------------------------------------------

  private extractMangaListFromJson(data: any): MangaResult[] {
    // Navigate through possible structures
    const pageProps = data?.props?.pageProps || data || {};
    const seriesList =
      pageProps?.series ||
      pageProps?.data ||
      pageProps?.mangas ||
      pageProps?.comics ||
      pageProps?.results ||
      [];

    if (!Array.isArray(seriesList)) return [];

    return seriesList
      .map((item: any) => {
        const title =
          item.title || item.name || item.comic_title || item.manga_title || '';
        const slug = item.slug || item.series_slug || item.id || '';
        const coverImage =
          item.thumbnail ||
          item.cover ||
          item.image ||
          item.poster ||
          item.coverImage ||
          '';

        if (!title) return null;

        return {
          title,
          coverImage: coverImage ? this.resolveUrl(coverImage) : undefined,
          sourceUrl: slug
            ? `${this.baseUrl}/series/${slug}`
            : this.resolveUrl(item.url || ''),
          genres: this.extractGenres(item),
          status: this.mapStatus(item.status),
          language: 'ar',
        } as MangaResult;
      })
      .filter(Boolean) as MangaResult[];
  }

  private extractMangaDetailFromJson(
    data: any,
    sourceUrl: string,
  ): MangaResult | null {
    const pageProps = data?.props?.pageProps || data || {};
    const comic =
      pageProps?.comic ||
      pageProps?.series ||
      pageProps?.manga ||
      pageProps?.data ||
      {};

    const title =
      comic.title || comic.name || comic.comic_title || comic.manga_title;
    if (!title) return null;

    const description =
      comic.description || comic.summary || comic.synopsis || '';
    const coverImage =
      comic.thumbnail ||
      comic.cover ||
      comic.image ||
      comic.poster ||
      comic.coverImage ||
      '';

    const altTitles: string[] = [];
    const altSrc =
      comic.alternative_titles ||
      comic.alt_titles ||
      comic.other_names ||
      comic.alternativeTitles;
    if (typeof altSrc === 'string') {
      altTitles.push(
        ...altSrc
          .split(/[;,،]/)
          .map((t: string) => t.trim())
          .filter(Boolean),
      );
    } else if (Array.isArray(altSrc)) {
      altTitles.push(...altSrc.filter(Boolean));
    }

    return {
      title,
      alternativeTitles: altTitles.length > 0 ? altTitles : undefined,
      author: comic.author || comic.comic_author || undefined,
      artist: comic.artist || comic.comic_artist || undefined,
      genres: this.extractGenres(comic),
      status: this.mapStatus(comic.status),
      description: this.stripHtml(description) || undefined,
      coverImage: coverImage ? this.resolveUrl(coverImage) : undefined,
      sourceUrl,
      language: 'ar',
    };
  }

  private extractChaptersFromJson(
    data: any,
    mangaSourceUrl: string,
  ): ChapterResult[] {
    const pageProps = data?.props?.pageProps || data || {};
    const comic =
      pageProps?.comic ||
      pageProps?.series ||
      pageProps?.manga ||
      pageProps?.data ||
      {};
    const chapterData =
      comic.chapters ||
      comic.chapter_list ||
      pageProps?.chapters ||
      [];

    if (!Array.isArray(chapterData)) return [];

    return chapterData
      .map((ch: any) => {
        const chNum =
          ch.chapter_number != null
            ? parseFloat(String(ch.chapter_number))
            : ch.number != null
              ? parseFloat(String(ch.number))
              : this.extractChapterNumber(
                  ch.name || ch.title || ch.chapter || '',
                );
        if (chNum == null || isNaN(chNum)) return null;

        const slug = ch.slug || ch.chapter_slug || '';
        let chapterUrl = '';
        if (slug) {
          // Append chapter slug to the manga URL
          const mangaPath = mangaSourceUrl.replace(this.baseUrl, '');
          chapterUrl = `${this.baseUrl}${mangaPath}/${slug}`;
        } else if (ch.url) {
          chapterUrl = this.resolveUrl(ch.url);
        }

        return {
          chapterNumber: chNum,
          title: ch.name || ch.title || undefined,
          sourceUrl: chapterUrl,
          publishedAt:
            ch.created_at || ch.published_at || ch.date
              ? new Date(ch.created_at || ch.published_at || ch.date)
              : undefined,
          language: 'ar',
        } as ChapterResult;
      })
      .filter(Boolean) as ChapterResult[];
  }

  private extractPagesFromJson(data: any): PageResult[] {
    const pageProps = data?.props?.pageProps || data || {};
    const chapter =
      pageProps?.chapter ||
      pageProps?.data ||
      pageProps ||
      {};
    const images =
      chapter.images ||
      chapter.pages ||
      chapter.chapter_images ||
      chapter.content?.images ||
      chapter.chapterImages ||
      [];

    if (!Array.isArray(images) || images.length === 0) return [];

    return images.map((img: any, index: number) => {
      const url =
        typeof img === 'string'
          ? img
          : img.url || img.src || img.image || img.link || '';
      return {
        pageNumber: img.order || img.page || img.pageNumber || index + 1,
        imageUrl: this.resolveUrl(url),
      };
    });
  }

  private extractGenres(item: any): string[] | undefined {
    const src = item.genres || item.categories || item.tags || item.genre || [];
    const genres = (Array.isArray(src) ? src : [])
      .map((g: any) =>
        typeof g === 'string' ? g : g.name || g.title || g.label || '',
      )
      .filter(Boolean);
    return genres.length > 0 ? genres : undefined;
  }

  // ---------------------------------------------------------------------------
  // HTML scraping fallbacks
  // ---------------------------------------------------------------------------

  private scrapeListingPage(html: string): MangaResult[] {
    const $ = cheerio.load(html);
    const results: MangaResult[] = [];

    // Broad selectors covering common card patterns
    $(
      'div.series-card, div.manga-card, div.comic-card, ' +
      'div.listupd div.bs, div.manga-item, ' +
      'a[href*="/series/"], div.novel-item',
    ).each((_i, el) => {
      const $el = $(el);
      const linkEl = $el.is('a') ? $el : $el.find('a[href*="/series/"]').first();
      const href = linkEl.attr('href') || '';
      const title =
        $el.find('h3, h2, h4, .series-title, .manga-title, .title').text().trim() ||
        linkEl.attr('title') ||
        $el.find('img').attr('alt') ||
        '';
      const coverImage =
        $el.find('img').attr('data-src') ||
        $el.find('img').attr('src') ||
        '';

      if (title && href && href.includes('/series/')) {
        results.push({
          title,
          coverImage: coverImage ? this.resolveUrl(coverImage.trim()) : undefined,
          sourceUrl: this.resolveUrl(href),
          language: 'ar',
        });
      }
    });

    // If the broad selectors found nothing, try picking up any link to /series/*
    if (results.length === 0) {
      const seen = new Set<string>();
      $('a[href*="/series/"]').each((_i, el) => {
        const href = $(el).attr('href') || '';
        // Only links to manga detail pages (not the listing itself)
        if (!href || href === '/series' || href === '/series/') return;
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

  private scrapeMangaDetail(html: string, sourceUrl: string): MangaResult {
    const $ = cheerio.load(html);

    const title =
      $('h1').first().text().trim() ||
      $('h2.series-title, h2.manga-title').first().text().trim() ||
      'Unknown';

    const coverImage =
      $('div.summary_image img, div.series-cover img, div.thumb img, img.manga-cover')
        .first()
        .attr('data-src') ||
      $('div.summary_image img, div.series-cover img, div.thumb img, img.manga-cover')
        .first()
        .attr('src') ||
      // Try og:image meta tag
      $('meta[property="og:image"]').attr('content') ||
      '';

    const description =
      $('div.summary__content, div.description, div.synopsis, p.description')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

    const genres: string[] = [];
    $('div.genres a, span.genre a, a.genre-tag, div.tags a').each((_i, el) => {
      const genre = $(el).text().trim();
      if (genre) genres.push(genre);
    });

    let statusText = '';
    // Look for status in common locations
    $('span:contains("الحالة"), span:contains("Status"), div:contains("الحالة")').each(
      (_i, el) => {
        const $el = $(el);
        const nextText = $el.next().text().trim() || $el.parent().text().trim();
        if (nextText && !statusText) {
          statusText = nextText.replace(/.*(?:الحالة|Status)\s*:?\s*/i, '').trim();
        }
      },
    );

    let author: string | undefined;
    $('span:contains("المؤلف"), span:contains("Author")').each((_i, el) => {
      const nextText = $(el).next().text().trim();
      if (nextText) author = nextText;
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
  }

  private scrapeChapterList(
    html: string,
    mangaSourceUrl: string,
  ): ChapterResult[] {
    const $ = cheerio.load(html);
    const chapters: ChapterResult[] = [];

    // Common selectors for chapter lists
    $(
      'div.chapters-list a, ul.chapter-list li a, ' +
      'div.chapter-item a, a.chapter-link, ' +
      'div.eplister ul li a, ul.clstyle li a',
    ).each((_i, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const text = $el.text().trim();
      const chNum = this.extractChapterNumber(text);
      if (chNum == null) return;

      const $parent = $el.closest('li, div');
      const dateText =
        $parent.find('span.date, span.chapter-date, time').text().trim() ||
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

    // Broader fallback: any link whose text matches a chapter pattern
    if (chapters.length === 0) {
      $('a').each((_i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (!href || !text) return;

        const chNum = this.extractChapterNumber(text);
        if (chNum == null) return;

        // Make sure it's a chapter link (contains the manga path)
        const mangaPath = mangaSourceUrl.replace(this.baseUrl, '');
        if (!href.includes(mangaPath) && !href.includes('/chapter')) return;

        chapters.push({
          chapterNumber: chNum,
          title: text,
          sourceUrl: this.resolveUrl(href),
          language: 'ar',
        });
      });
    }

    return chapters;
  }

  private scrapePageList(html: string): PageResult[] {
    const $ = cheerio.load(html);
    const pages: PageResult[] = [];

    // Common image container selectors for manga readers
    $(
      'div.reading-content img, div.chapter-content img, ' +
      'div.reader-area img, div.container-chapter-reader img, ' +
      'div#readerarea img, div.entry-content img, ' +
      'img.chapter-img, img.reader-img',
    ).each((i, el) => {
      const $img = $(el);
      const imageUrl =
        $img.attr('data-src')?.trim() ||
        $img.attr('src')?.trim() ||
        '';

      // Skip placeholder/loading images
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
  }
}
