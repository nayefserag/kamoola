import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  IScraperPlugin,
  MangaResult,
  ChapterResult,
  PageResult,
} from '../interfaces/scraper-plugin.interface';

@Injectable()
export class MangaDexPlugin implements IScraperPlugin {
  readonly sourceName = 'mangadex';
  readonly baseUrl = 'https://api.mangadex.org';

  private readonly logger = new Logger(MangaDexPlugin.name);
  private readonly client: AxiosInstance;
  private lastRequestTime = 0;

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
    });
  }

  /**
   * Returns the list of languages to fetch from MangaDex.
   * Configurable via MANGADEX_LANGUAGES env var (comma-separated).
   * Defaults to English and Arabic.
   */
  private getLanguages(): string[] {
    const envLangs = process.env.MANGADEX_LANGUAGES;
    if (envLangs) {
      return envLangs.split(',').map((l) => l.trim()).filter(Boolean);
    }
    return ['en', 'ar'];
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < 200) {
      await new Promise((resolve) => setTimeout(resolve, 200 - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private extractRelationship(
    relationships: any[],
    type: string,
  ): any | undefined {
    return relationships?.find((r: any) => r.type === type);
  }

  private mapMangaStatus(
    status: string | undefined,
  ): 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | undefined {
    const statusMap: Record<
      string,
      'ongoing' | 'completed' | 'hiatus' | 'cancelled'
    > = {
      ongoing: 'ongoing',
      completed: 'completed',
      hiatus: 'hiatus',
      cancelled: 'cancelled',
    };
    return status ? statusMap[status] : undefined;
  }

  private parseMangaFromResponse(manga: any): MangaResult {
    const attrs = manga.attributes;
    const relationships = manga.relationships || [];

    const title =
      attrs.title?.en ||
      attrs.title?.ja ||
      attrs.title?.['ja-ro'] ||
      Object.values(attrs.title || {})[0] ||
      'Unknown';

    const altTitles: string[] = (attrs.altTitles || [])
      .map((alt: any) => Object.values(alt)[0] as string)
      .filter(Boolean);

    const authorRel = this.extractRelationship(relationships, 'author');
    const artistRel = this.extractRelationship(relationships, 'artist');
    const coverRel = this.extractRelationship(relationships, 'cover_art');

    const authorName = authorRel?.attributes?.name;
    const artistName = artistRel?.attributes?.name;
    const coverFilename = coverRel?.attributes?.fileName;

    const coverImage = coverFilename
      ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFilename}.512.jpg`
      : undefined;

    const description =
      attrs.description?.en || Object.values(attrs.description || {})[0] || '';

    const genres = (attrs.tags || [])
      .filter((tag: any) => tag.attributes?.group === 'genre')
      .map(
        (tag: any) =>
          tag.attributes?.name?.en || Object.values(tag.attributes?.name)[0],
      )
      .filter(Boolean);

    return {
      title: title as string,
      alternativeTitles: altTitles.length > 0 ? altTitles : undefined,
      author: authorName,
      artist: artistName,
      genres: genres.length > 0 ? genres : undefined,
      status: this.mapMangaStatus(attrs.status),
      description: description as string,
      coverImage,
      sourceUrl: `https://mangadex.org/title/${manga.id}`,
    };
  }

  async getLatestManga(page: number): Promise<MangaResult[]> {
    try {
      const languages = this.getLanguages();
      await this.rateLimit();
      const response = await this.client.get('/manga', {
        params: {
          'order[latestUploadedChapter]': 'desc',
          'includes[]': ['cover_art', 'author', 'artist'],
          limit: 20,
          offset: page * 20,
          'availableTranslatedLanguage[]': languages,
          'contentRating[]': ['safe', 'suggestive'],
        },
      });

      return (response.data.data || []).map((manga: any) =>
        this.parseMangaFromResponse(manga),
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch latest manga page ${page}: ${error.message}`,
      );
      return [];
    }
  }

  async searchManga(query: string, page: number): Promise<MangaResult[]> {
    try {
      const languages = this.getLanguages();
      await this.rateLimit();
      const response = await this.client.get('/manga', {
        params: {
          title: query,
          'order[relevance]': 'desc',
          'includes[]': ['cover_art', 'author', 'artist'],
          limit: 20,
          offset: page * 20,
          'availableTranslatedLanguage[]': languages,
          'contentRating[]': ['safe', 'suggestive'],
        },
      });

      return (response.data.data || []).map((manga: any) =>
        this.parseMangaFromResponse(manga),
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to search manga "${query}" page ${page}: ${error.message}`,
      );
      return [];
    }
  }

  async getMangaDetail(sourceUrl: string): Promise<MangaResult> {
    const mangaId = this.extractMangaId(sourceUrl);
    try {
      await this.rateLimit();
      const response = await this.client.get(`/manga/${mangaId}`, {
        params: {
          'includes[]': ['cover_art', 'author', 'artist'],
        },
      });

      return this.parseMangaFromResponse(response.data.data);
    } catch (error: any) {
      this.logger.error(
        `Failed to get manga detail for ${sourceUrl}: ${error.message}`,
      );
      throw new Error(`Failed to get manga detail: ${error.message}`);
    }
  }

  async getChapterList(sourceUrl: string): Promise<ChapterResult[]> {
    const mangaId = this.extractMangaId(sourceUrl);
    const allChapters: ChapterResult[] = [];
    let offset = 0;
    const limit = 100;
    const languages = this.getLanguages();

    try {
      while (true) {
        await this.rateLimit();
        const response = await this.client.get(`/manga/${mangaId}/feed`, {
          params: {
            'translatedLanguage[]': languages,
            'order[chapter]': 'desc',
            limit,
            offset,
            'contentRating[]': ['safe', 'suggestive'],
          },
        });

        const chapters = response.data.data || [];
        if (chapters.length === 0) break;

        for (const ch of chapters) {
          const attrs = ch.attributes;
          const chapterNum = parseFloat(attrs.chapter);
          if (isNaN(chapterNum)) continue;

          allChapters.push({
            chapterNumber: chapterNum,
            title: attrs.title || undefined,
            sourceUrl: `https://mangadex.org/chapter/${ch.id}`,
            publishedAt: attrs.publishAt
              ? new Date(attrs.publishAt)
              : undefined,
            language: attrs.translatedLanguage || 'en',
          });
        }

        if (chapters.length < limit) break;
        offset += limit;
      }

      return allChapters;
    } catch (error: any) {
      this.logger.error(
        `Failed to get chapter list for ${sourceUrl}: ${error.message}`,
      );
      return [];
    }
  }

  async getPageList(chapterUrl: string): Promise<PageResult[]> {
    const chapterId = this.extractChapterId(chapterUrl);
    try {
      await this.rateLimit();
      const response = await this.client.get(
        `/at-home/server/${chapterId}`,
      );

      const { baseUrl } = response.data;
      const { hash, data } = response.data.chapter;

      return (data as string[]).map((filename: string, index: number) => ({
        pageNumber: index + 1,
        imageUrl: `${baseUrl}/data/${hash}/${filename}`,
      }));
    } catch (error: any) {
      this.logger.error(
        `Failed to get page list for ${chapterUrl}: ${error.message}`,
      );
      return [];
    }
  }

  private extractMangaId(sourceUrl: string): string {
    const match = sourceUrl.match(
      /mangadex\.org\/title\/([a-f0-9-]+)/i,
    );
    if (match) return match[1];

    // Fallback: treat the whole thing as an ID if it looks like a UUID
    const uuidMatch = sourceUrl.match(
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
    );
    if (uuidMatch) return uuidMatch[1];

    throw new Error(`Cannot extract manga ID from URL: ${sourceUrl}`);
  }

  private extractChapterId(chapterUrl: string): string {
    const match = chapterUrl.match(
      /mangadex\.org\/chapter\/([a-f0-9-]+)/i,
    );
    if (match) return match[1];

    const uuidMatch = chapterUrl.match(
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
    );
    if (uuidMatch) return uuidMatch[1];

    throw new Error(`Cannot extract chapter ID from URL: ${chapterUrl}`);
  }
}
