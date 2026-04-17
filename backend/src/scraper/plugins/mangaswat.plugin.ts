import { Injectable, Logger } from '@nestjs/common';
import {
  IScraperPlugin,
  MangaResult,
  ChapterResult,
  PageResult,
} from '../interfaces/scraper-plugin.interface';

// mangaswat.com is a parked domain (Parklogic) — returns empty until restored.
@Injectable()
export class MangaSwatPlugin implements IScraperPlugin {
  readonly sourceName = 'mangaswat';
  readonly baseUrl = 'https://mangaswat.com';

  private readonly logger = new Logger(MangaSwatPlugin.name);

  async getLatestManga(_page: number): Promise<MangaResult[]> {
    this.logger.warn('mangaswat.com is a parked domain — skipping');
    return [];
  }
  async searchManga(_query: string, _page: number): Promise<MangaResult[]> { return []; }
  async getMangaDetail(sourceUrl: string): Promise<MangaResult> {
    throw new Error(`mangaswat.com is offline: ${sourceUrl}`);
  }
  async getChapterList(_sourceUrl: string): Promise<ChapterResult[]> { return []; }
  async getPageList(_chapterUrl: string): Promise<PageResult[]> { return []; }
}
