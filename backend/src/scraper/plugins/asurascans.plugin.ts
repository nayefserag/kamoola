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
export class AsuraScansPlugin implements IScraperPlugin {
  readonly sourceName = 'asurascans';
  readonly baseUrl: string;

  private readonly logger = new Logger(AsuraScansPlugin.name);
  private readonly client: AxiosInstance;

  constructor() {
    this.baseUrl = process.env.ASURASCANS_BASE_URL || 'https://asuracomic.net';
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

  private extractNextData(html: string): any {
    const $ = cheerio.load(html);
    const scriptEl = $('script#__NEXT_DATA__');
    if (!scriptEl.length) {
      throw new Error('__NEXT_DATA__ script not found on page');
    }
    return JSON.parse(scriptEl.html() || '{}');
  }

  private resolveUrl(href: string): string {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    if (href.startsWith('//')) return `https:${href}`;
    if (href.startsWith('/')) return `${this.baseUrl}${href}`;
    return `${this.baseUrl}/${href}`;
  }

  private decodeImageUrl(url: string): string {
    if (!url) return '';
    // Handle Base64-encoded image URLs
    if (url.startsWith('data:')) return url;
    try {
      const decoded = Buffer.from(url, 'base64').toString('utf-8');
      if (decoded.startsWith('http')) return decoded;
    } catch {
      // Not Base64 encoded, return as-is
    }
    return url;
  }

  private mapStatus(
    status: string | undefined,
  ): MangaResult['status'] | undefined {
    if (!status) return undefined;
    const lower = status.toLowerCase().trim();
    const statusMap: Record<string, MangaResult['status']> = {
      ongoing: 'ongoing',
      completed: 'completed',
      hiatus: 'hiatus',
      cancelled: 'cancelled',
      dropped: 'cancelled',
      'on hold': 'hiatus',
    };
    return statusMap[lower] || undefined;
  }

  async getLatestManga(page: number): Promise<MangaResult[]> {
    try {
      const url = `/series?page=${page + 1}&order=update`;
      const response = await this.client.get(url);
      const nextData = this.extractNextData(response.data);
      const pageProps = nextData?.props?.pageProps || {};
      const series = pageProps?.series || pageProps?.data || [];

      if (Array.isArray(series)) {
        return series.map((item: any) => this.mapSeriesItem(item));
      }

      // Fallback: try HTML scraping if __NEXT_DATA__ doesn't have the series list
      return this.scrapeListingPage(response.data);
    } catch (error: any) {
      this.logger.error(`getLatestManga page ${page} failed: ${error.message}`);
      return [];
    }
  }

  async searchManga(query: string, page: number): Promise<MangaResult[]> {
    try {
      const url = `/series?page=${page + 1}&name=${encodeURIComponent(query)}`;
      const response = await this.client.get(url);
      const nextData = this.extractNextData(response.data);
      const pageProps = nextData?.props?.pageProps || {};
      const series = pageProps?.series || pageProps?.data || [];

      if (Array.isArray(series)) {
        return series.map((item: any) => this.mapSeriesItem(item));
      }

      return this.scrapeListingPage(response.data);
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
      const nextData = this.extractNextData(response.data);
      const pageProps = nextData?.props?.pageProps || {};
      const comic =
        pageProps?.comic || pageProps?.series || pageProps?.data || {};

      const title =
        comic.title || comic.name || comic.comic_title || 'Unknown';
      const description =
        comic.description || comic.summary || comic.comic_description || '';
      const coverImage = this.decodeImageUrl(
        comic.thumbnail || comic.cover || comic.image || '',
      );

      const genres: string[] = (
        comic.genres ||
        comic.categories ||
        comic.tags ||
        []
      ).map((g: any) => (typeof g === 'string' ? g : g.name || g.title || ''));

      const altTitles: string[] = [];
      if (comic.alternative_titles) {
        if (typeof comic.alternative_titles === 'string') {
          altTitles.push(
            ...comic.alternative_titles
              .split(/[;,]/)
              .map((t: string) => t.trim())
              .filter(Boolean),
          );
        } else if (Array.isArray(comic.alternative_titles)) {
          altTitles.push(...comic.alternative_titles);
        }
      }

      return {
        title,
        alternativeTitles: altTitles.length > 0 ? altTitles : undefined,
        author: comic.author || comic.comic_author || undefined,
        artist: comic.artist || comic.comic_artist || undefined,
        genres: genres.filter(Boolean).length > 0 ? genres.filter(Boolean) : undefined,
        status: this.mapStatus(
          comic.status || comic.comic_status,
        ),
        description: this.stripHtml(description) || undefined,
        coverImage: coverImage ? this.resolveUrl(coverImage) : undefined,
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
      const response = await this.client.get(sourceUrl);
      const nextData = this.extractNextData(response.data);
      const pageProps = nextData?.props?.pageProps || {};
      const comic =
        pageProps?.comic || pageProps?.series || pageProps?.data || {};
      const chapterData =
        comic.chapters ||
        comic.chapter_list ||
        pageProps?.chapters ||
        [];

      if (!Array.isArray(chapterData)) return [];

      return chapterData
        .map((ch: any) => {
          const chNum = parseFloat(
            ch.chapter_number ||
              ch.number ||
              ch.chapter ||
              this.extractChapterNumber(ch.name || ch.title || ''),
          );
          if (isNaN(chNum)) return null;

          const slug = ch.slug || ch.chapter_slug || '';
          const chapterUrl = slug
            ? this.resolveUrl(
                sourceUrl.replace(this.baseUrl, '') + `/${slug}`,
              )
            : ch.url
              ? this.resolveUrl(ch.url)
              : '';

          return {
            chapterNumber: chNum,
            title: ch.name || ch.title || undefined,
            sourceUrl: chapterUrl,
            publishedAt: ch.created_at || ch.published_at
              ? new Date(ch.created_at || ch.published_at)
              : undefined,
          } as ChapterResult;
        })
        .filter(Boolean) as ChapterResult[];
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
      const nextData = this.extractNextData(response.data);
      const pageProps = nextData?.props?.pageProps || {};

      // Try to get pages from __NEXT_DATA__
      const chapter =
        pageProps?.chapter || pageProps?.data || pageProps || {};
      const images =
        chapter.images ||
        chapter.pages ||
        chapter.chapter_images ||
        chapter.content?.images ||
        [];

      if (Array.isArray(images) && images.length > 0) {
        return images.map((img: any, index: number) => {
          const url = typeof img === 'string' ? img : img.url || img.src || img.image || '';
          return {
            pageNumber: img.order || img.page || index + 1,
            imageUrl: this.resolveUrl(this.decodeImageUrl(url)),
          };
        });
      }

      // Fallback: scrape images from HTML
      const $ = cheerio.load(response.data);
      const pages: PageResult[] = [];

      $('div.reading-content img, div.chapter-content img, img.wp-manga-chapter-img').each(
        (i, el) => {
          const $img = $(el);
          const imageUrl =
            $img.attr('data-src') || $img.attr('src') || '';
          if (imageUrl && !imageUrl.includes('loading') && !imageUrl.includes('pixel')) {
            pages.push({
              pageNumber: i + 1,
              imageUrl: this.resolveUrl(this.decodeImageUrl(imageUrl.trim())),
            });
          }
        },
      );

      return pages;
    } catch (error: any) {
      this.logger.error(
        `getPageList for ${chapterUrl} failed: ${error.message}`,
      );
      return [];
    }
  }

  private mapSeriesItem(item: any): MangaResult {
    const title = item.title || item.name || item.comic_title || 'Unknown';
    const slug = item.slug || item.comic_slug || '';
    const coverImage = this.decodeImageUrl(
      item.thumbnail || item.cover || item.image || '',
    );

    return {
      title,
      coverImage: coverImage ? this.resolveUrl(coverImage) : undefined,
      sourceUrl: slug
        ? `${this.baseUrl}/series/${slug}`
        : this.resolveUrl(item.url || ''),
      genres: item.genres
        ? item.genres.map((g: any) =>
            typeof g === 'string' ? g : g.name || '',
          ).filter(Boolean)
        : undefined,
      status: this.mapStatus(item.status),
    };
  }

  private scrapeListingPage(html: string): MangaResult[] {
    const $ = cheerio.load(html);
    const results: MangaResult[] = [];

    $('div.series-card, div.comic-item, a.series-link').each((_i, el) => {
      const $el = $(el);
      const linkEl = $el.is('a') ? $el : $el.find('a').first();
      const href = linkEl.attr('href') || '';
      const title = $el.find('h3, h2, .series-title').text().trim() || linkEl.attr('title') || '';
      const coverImage =
        $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';

      if (title && href) {
        results.push({
          title,
          coverImage: this.resolveUrl(this.decodeImageUrl(coverImage)),
          sourceUrl: this.resolveUrl(href),
        });
      }
    });

    return results;
  }

  private extractChapterNumber(text: string): string {
    const match = text.match(/(?:chapter|ch\.?)\s*([\d.]+)/i);
    return match ? match[1] : '';
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    return cheerio
      .load(`<div>${html}</div>`)('div')
      .text()
      .trim();
  }
}
