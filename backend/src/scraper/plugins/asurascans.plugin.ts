import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  IScraperPlugin,
  MangaResult,
  ChapterResult,
  PageResult,
} from '../interfaces/scraper-plugin.interface';

const API_BASE = 'https://api.asurascans.com';
const SITE_BASE = 'https://asurascans.com';
const LIMIT = 20;

@Injectable()
export class AsuraScansPlugin implements IScraperPlugin {
  readonly sourceName = 'asurascans';
  readonly baseUrl = SITE_BASE;

  private readonly logger = new Logger(AsuraScansPlugin.name);
  private readonly api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE,
      timeout: 15000,
      headers: {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        origin: SITE_BASE,
        referer: `${SITE_BASE}/`,
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
      },
    });
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    return cheerio.load(`<div>${html}</div>`)('div').text().trim();
  }

  private mapStatus(s?: string): MangaResult['status'] | undefined {
    if (!s) return undefined;
    const map: Record<string, MangaResult['status']> = {
      ongoing: 'ongoing',
      completed: 'completed',
      hiatus: 'hiatus',
      dropped: 'cancelled',
      cancelled: 'cancelled',
    };
    return map[s.toLowerCase()] ?? undefined;
  }

  private seriesApiUrl(id: number | string) {
    return `${API_BASE}/api/series/${id}`;
  }

  private mapSeries(item: any): MangaResult {
    return {
      title: item.title || 'Unknown',
      alternativeTitles: item.alt_titles?.length ? item.alt_titles : undefined,
      author: item.author || undefined,
      artist: item.artist || undefined,
      description: item.description ? this.stripHtml(item.description) : undefined,
      coverImage: item.cover || undefined,
      genres: item.genres?.map((g: any) => g.name as string).filter(Boolean) || undefined,
      status: this.mapStatus(item.status),
      // Store the REST API URL so getMangaDetail / getChapterList can re-use it
      sourceUrl: this.seriesApiUrl(item.id),
    };
  }

  async getLatestManga(page: number): Promise<MangaResult[]> {
    try {
      const { data } = await this.api.get('/api/series', {
        params: { sort: 'latest', order: 'desc', limit: LIMIT, offset: page * LIMIT },
      });
      return (data.data ?? []).map((item: any) => this.mapSeries(item));
    } catch (err: any) {
      this.logger.error(`getLatestManga page ${page} failed: ${err.message}`);
      return [];
    }
  }

  async searchManga(query: string, page: number): Promise<MangaResult[]> {
    try {
      const { data } = await this.api.get('/api/series', {
        params: { name: query, limit: LIMIT, offset: page * LIMIT },
      });
      return (data.data ?? []).map((item: any) => this.mapSeries(item));
    } catch (err: any) {
      this.logger.error(`searchManga "${query}" page ${page} failed: ${err.message}`);
      return [];
    }
  }

  async getMangaDetail(sourceUrl: string): Promise<MangaResult> {
    try {
      const path = sourceUrl.replace(API_BASE, '');
      const { data } = await this.api.get(path);
      // API may return { data: {...} } or the object directly
      const item = data.data ?? data;
      return this.mapSeries(item);
    } catch (err: any) {
      this.logger.error(`getMangaDetail ${sourceUrl} failed: ${err.message}`);
      throw new Error(`AsuraScans getMangaDetail failed: ${err.message}`);
    }
  }

  async getChapterList(sourceUrl: string): Promise<ChapterResult[]> {
    try {
      const path = sourceUrl.replace(API_BASE, '') + '/chapters';
      const { data } = await this.api.get(path, {
        params: { limit: 1000, order: 'desc' },
      });
      const list: any[] = data.data ?? data.chapters ?? data ?? [];
      return list
        .map((ch: any) => {
          const num = parseFloat(ch.number ?? ch.chapter_number ?? '');
          if (isNaN(num)) return null;
          return {
            chapterNumber: num,
            title: ch.title || undefined,
            // Store chapter ID in the URL for getPageList
            sourceUrl: `${API_BASE}/api/chapter/${ch.id}`,
            publishedAt: ch.published_at ? new Date(ch.published_at) : undefined,
          } as ChapterResult;
        })
        .filter(Boolean) as ChapterResult[];
    } catch (err: any) {
      this.logger.error(`getChapterList ${sourceUrl} failed: ${err.message}`);
      return [];
    }
  }

  async getPageList(chapterUrl: string): Promise<PageResult[]> {
    try {
      const path = chapterUrl.replace(API_BASE, '');
      const { data } = await this.api.get(path);
      const payload = data.data ?? data;
      const images: any[] =
        payload.images ?? payload.pages ?? payload.chapter_images ?? [];

      if (images.length > 0) {
        return images.map((img: any, i: number) => ({
          pageNumber: img.order ?? img.page ?? i + 1,
          imageUrl: typeof img === 'string' ? img : (img.url ?? img.src ?? img.image ?? ''),
        }));
      }

      // If chapter endpoint returns a redirect/HTML reader URL, scrape it
      const readerUrl = payload.reader_url ?? payload.url ?? '';
      if (readerUrl) {
        return this.scrapeReaderPage(readerUrl);
      }

      return [];
    } catch (err: any) {
      this.logger.error(`getPageList ${chapterUrl} failed: ${err.message}`);
      return [];
    }
  }

  private async scrapeReaderPage(url: string): Promise<PageResult[]> {
    try {
      const { data: html } = await axios.get(url, {
        timeout: 15000,
        headers: {
          Referer: `${SITE_BASE}/`,
          'User-Agent': this.api.defaults.headers['user-agent'] as string,
        },
      });
      const $ = cheerio.load(html);

      // Try __NEXT_DATA__ first
      const raw = $('script#__NEXT_DATA__').html();
      if (raw) {
        const nextData = JSON.parse(raw);
        const pp = nextData?.props?.pageProps ?? {};
        const imgs: any[] =
          pp?.chapter?.images ?? pp?.images ?? pp?.pages ?? [];
        if (imgs.length > 0) {
          return imgs.map((img: any, i: number) => ({
            pageNumber: img.order ?? i + 1,
            imageUrl: typeof img === 'string' ? img : (img.url ?? ''),
          }));
        }
      }

      // Fallback: look for reader images in HTML
      const pages: PageResult[] = [];
      $('div[class*="reader"] img, div[class*="chapter"] img').each((i, el) => {
        const src =
          $(el).attr('data-src') ??
          $(el).attr('src') ??
          '';
        if (src && !src.includes('loading') && !src.includes('pixel')) {
          pages.push({ pageNumber: i + 1, imageUrl: src.trim() });
        }
      });
      return pages;
    } catch (err: any) {
      this.logger.error(`scrapeReaderPage ${url} failed: ${err.message}`);
      return [];
    }
  }
}
