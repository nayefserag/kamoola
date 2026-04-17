import { Injectable, Logger } from '@nestjs/common';
import {
  IScraperPlugin,
  MangaResult,
  ChapterResult,
  PageResult,
} from '../interfaces/scraper-plugin.interface';

/**
 * mangalek.top is currently a parked/dead domain.
 * Plugin returns empty results until the site is restored.
 */
@Injectable()
export class MangalekPlugin implements IScraperPlugin {
  readonly sourceName = 'mangalek';
  readonly baseUrl = 'https://mangalek.top';

  private readonly logger = new Logger(MangalekPlugin.name);

  async getLatestManga(_page: number): Promise<MangaResult[]> {
    this.logger.warn('mangalek.top is a parked domain — skipping');
    return [];
  }
  async searchManga(_query: string, _page: number): Promise<MangaResult[]> { return []; }
  async getMangaDetail(sourceUrl: string): Promise<MangaResult> {
    throw new Error(`mangalek.top is offline: ${sourceUrl}`);
  }
  async getChapterList(_sourceUrl: string): Promise<ChapterResult[]> { return []; }
  async getPageList(_chapterUrl: string): Promise<PageResult[]> { return []; }
}
