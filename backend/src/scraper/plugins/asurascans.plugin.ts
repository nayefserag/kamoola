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
 * AsuraScans — the site moved from asurascans.com to asuracomic.net.
 * It's a Next.js app; we parse the __NEXT_DATA__ JSON blob from each
 * rendered page. Cloudflare-protected, so we use got-scraping.
 *
 * URL patterns:
 *   Listing:  /series?page=N
 *   Detail:   /series/<slug>
 *   Chapter:  /series/<slug>/chapter/<n>
 */

const DEFAULT_BASE = 'https://asuracomic.net';

@Injectable()
export class AsuraScansPlugin implements IScraperPlugin {
  readonly sourceName = 'asurascans';
  readonly baseUrl: string;

  private readonly logger = new Logger(AsuraScansPlugin.name);
  private readonly client: AxiosInstance;
  private gotScrapingPromise: Promise<any> | undefined;

  constructor() {
    this.baseUrl = process.env.ASURASCANS_BASE_URL || DEFAULT_BASE;
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

  private stripHtml(html: string): string {
    if (!html) return '';
    return cheerio.load(`<div>${html}</div>`)('div').text().trim();
  }

  private mapStatus(s?: string): MangaResult['status'] | undefined {
    if (!s) return undefined;
    const l = s.toLowerCase().trim();
    if (l.includes('ongoing')) return 'ongoing';
    if (l.includes('completed') || l.includes('finished')) return 'completed';
    if (l.includes('hiatus') || l.includes('season end') || l.includes('on hold')) return 'hiatus';
    if (l.includes('dropped') || l.includes('cancel')) return 'cancelled';
    return undefined;
  }

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

  private mapSeries(item: any): MangaResult | null {
    if (!item) return null;
    const title = item.title || item.name || item.seriesTitle || '';
    if (!title) return null;
    const slug = item.slug || item.series_slug || item.id || '';
    const cover =
      item.cover ||
      item.thumbnail ||
      item.coverImage ||
      item.image ||
      item.poster ||
      '';
    const genres = (item.genres || item.categories || [])
      .map((g: any) => (typeof g === 'string' ? g : g.name || g.title || ''))
      .filter(Boolean);

    return {
      title,
      alternativeTitles: item.alternative_titles || item.alt_titles || undefined,
      author: item.author || undefined,
      artist: item.artist || undefined,
      description: item.description
        ? this.stripHtml(item.description)
        : undefined,
      coverImage: cover ? this.resolveUrl(cover) : undefined,
      genres: genres.length > 0 ? genres : undefined,
      status: this.mapStatus(item.status),
      sourceUrl: slug
        ? `${this.baseUrl}/series/${slug}`
        : this.resolveUrl(item.url || ''),
    };
  }

  async getLatestManga(page: number): Promise<MangaResult[]> {
    const urls = [
      `/series?page=${page + 1}`,
      `/series?page=${page + 1}&order=update`,
      `/?page=${page + 1}`,
      `/manga?page=${page + 1}`,
    ];

    for (const url of urls) {
      try {
        const html = await this.fetchHtml(url);

        // __NEXT_DATA__ — try multiple shapes
        const data = this.extractNextData(html);
        if (data) {
          const collected = this.walkForSeriesList(data);
          if (collected.length > 0) {
            this.logger.debug(
              `getLatestManga page ${page}: ${collected.length} via JSON on ${url}`,
            );
            return collected;
          }
        }

        // HTML scraping fallback
        const scraped = this.scrapeListingHtml(html);
        if (scraped.length > 0) {
          this.logger.debug(
            `getLatestManga page ${page}: ${scraped.length} via HTML on ${url}`,
          );
          return scraped;
        }
      } catch (err: any) {
        this.logger.warn(`${url} failed: ${err.message}`);
      }
    }

    this.logger.warn(`getLatestManga page ${page}: all URLs returned empty`);
    return [];
  }

  /**
   * Recursively walk a Next.js pageProps tree looking for a series/manga list.
   * AsuraScans shifts the shape between releases so we scan broadly.
   * We accept an array if a majority of its items look series-shaped.
   */
  private walkForSeriesList(obj: any, depth = 0): MangaResult[] {
    if (!obj || depth > 8) return [];

    if (Array.isArray(obj) && obj.length > 2) {
      const seriesLike = obj.filter(
        (item: any) =>
          item &&
          typeof item === 'object' &&
          (item.title || item.name || item.seriesTitle) &&
          (item.slug || item.series_slug || item.id || item.url),
      );
      // Accept if >= 70% of items look like series
      if (seriesLike.length >= obj.length * 0.7 && seriesLike.length >= 3) {
        const mapped = seriesLike
          .map((item: any) => this.mapSeries(item))
          .filter(Boolean) as MangaResult[];
        if (mapped.length > 0) return mapped;
      }
    }

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      for (const key of Object.keys(obj)) {
        const found = this.walkForSeriesList(obj[key], depth + 1);
        if (found.length > 0) return found;
      }
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = this.walkForSeriesList(item, depth + 1);
        if (found.length > 0) return found;
      }
    }

    return [];
  }

  private scrapeListingHtml(html: string): MangaResult[] {
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
      const title =
        $a.find('span.block').first().text().trim() ||
        $a.attr('title') ||
        $img.attr('alt') ||
        $a.text().trim();

      if (!title || title.length < 2) return;
      seen.add(slug);

      const cover = ($img.attr('src') || $img.attr('data-src') || '').trim();

      results.push({
        title,
        coverImage: cover ? this.resolveUrl(cover) : undefined,
        sourceUrl: this.resolveUrl(href),
      });
    });

    return results;
  }

  async searchManga(query: string, page: number): Promise<MangaResult[]> {
    try {
      const url = `/series?name=${encodeURIComponent(query)}&page=${page + 1}`;
      const html = await this.fetchHtml(url);

      const data = this.extractNextData(html);
      if (data) {
        const pp = data?.props?.pageProps || {};
        const list =
          pp?.series?.data ||
          pp?.series ||
          pp?.results ||
          pp?.data ||
          [];
        if (Array.isArray(list) && list.length > 0) {
          return list
            .map((item: any) => this.mapSeries(item))
            .filter(Boolean) as MangaResult[];
        }
      }

      return this.scrapeListingHtml(html);
    } catch (err: any) {
      this.logger.error(`searchManga "${query}" page ${page} failed: ${err.message}`);
      return [];
    }
  }

  async getMangaDetail(sourceUrl: string): Promise<MangaResult> {
    try {
      const html = await this.fetchHtml(sourceUrl);

      const data = this.extractNextData(html);
      if (data) {
        const pp = data?.props?.pageProps || {};
        const item = pp?.series || pp?.comic || pp?.manga || pp?.data || null;
        const mapped = this.mapSeries(item);
        if (mapped) {
          return { ...mapped, sourceUrl };
        }
      }

      // HTML fallback
      const $ = cheerio.load(html);
      const title =
        $('span.text-xl.font-bold').first().text().trim() ||
        $('h1').first().text().trim() ||
        $('meta[property="og:title"]').attr('content')?.trim() ||
        'Unknown';
      const coverImage =
        $('div.flex img').first().attr('src') ||
        $('meta[property="og:image"]').attr('content') ||
        '';
      const description = $('span.font-medium.text-sm.text-\\[\\#A2A2A2\\]')
        .first()
        .text()
        .trim();

      return {
        title,
        description: description || undefined,
        coverImage: coverImage ? this.resolveUrl(coverImage) : undefined,
        sourceUrl,
      };
    } catch (err: any) {
      this.logger.error(`getMangaDetail ${sourceUrl} failed: ${err.message}`);
      throw new Error(`AsuraScans getMangaDetail failed: ${err.message}`);
    }
  }

  async getChapterList(sourceUrl: string): Promise<ChapterResult[]> {
    try {
      const html = await this.fetchHtml(sourceUrl);

      const data = this.extractNextData(html);
      if (data) {
        const pp = data?.props?.pageProps || {};
        const chapterSource =
          pp?.chapters ||
          pp?.series?.chapters ||
          pp?.comic?.chapters ||
          pp?.data?.chapters ||
          [];
        if (Array.isArray(chapterSource) && chapterSource.length > 0) {
          const out: ChapterResult[] = [];
          for (const ch of chapterSource) {
            const num = parseFloat(
              String(ch.chapter_number ?? ch.number ?? ch.name ?? ''),
            );
            if (isNaN(num)) continue;
            const slug = ch.slug || ch.chapter_slug || String(num);
            const url = ch.url
              ? this.resolveUrl(ch.url)
              : `${sourceUrl.replace(/\/$/, '')}/chapter/${slug}`;
            out.push({
              chapterNumber: num,
              title: ch.name || ch.title || undefined,
              sourceUrl: url,
              publishedAt: ch.published_at || ch.date
                ? new Date(ch.published_at || ch.date)
                : undefined,
            });
          }
          if (out.length > 0) return out;
        }
      }

      // HTML fallback — parse chapter list box
      const $ = cheerio.load(html);
      const chapters: ChapterResult[] = [];
      $('a[href*="/chapter/"]').each((_i, el) => {
        const $a = $(el);
        const href = ($a.attr('href') || '').split(/[?#]/)[0];
        const text = $a.text().trim();
        const m = text.match(/chapter\s*([\d.]+)/i) || href.match(/chapter\/([\d.]+)/i);
        if (!m) return;
        const num = parseFloat(m[1]);
        if (isNaN(num)) return;
        chapters.push({
          chapterNumber: num,
          title: text || undefined,
          sourceUrl: this.resolveUrl(href),
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

      const data = this.extractNextData(html);
      if (data) {
        const pp = data?.props?.pageProps || {};
        const images: any[] =
          pp?.chapter?.images ||
          pp?.images ||
          pp?.pages ||
          pp?.chapter?.pages ||
          [];
        if (Array.isArray(images) && images.length > 0) {
          return images.map((img: any, i: number) => ({
            pageNumber: img.order ?? img.page ?? i + 1,
            imageUrl:
              typeof img === 'string'
                ? img
                : img.url || img.src || img.image || '',
          }));
        }
      }

      // HTML fallback
      const $ = cheerio.load(html);
      const pages: PageResult[] = [];
      $('div[class*="reader"] img, div[class*="chapter"] img, img.rounded-none').each((i, el) => {
        const src = $(el).attr('data-src') || $(el).attr('src') || '';
        if (src && !src.includes('loading') && !src.includes('pixel') && !src.includes('data:image/gif')) {
          pages.push({ pageNumber: i + 1, imageUrl: src.trim() });
        }
      });
      return pages;
    } catch (err: any) {
      this.logger.error(`getPageList ${chapterUrl} failed: ${err.message}`);
      return [];
    }
  }
}
