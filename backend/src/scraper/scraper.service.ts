import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ScraperRegistryService } from './scraper-registry.service';
import { MangaResult, IScraperPlugin } from './interfaces/scraper-plugin.interface';
import { MangaService } from '../manga/manga.service';
import { ChapterService } from '../chapter/chapter.service';
import { LogService } from './log.service';

export interface ScrapeSummary {
  mangaCount: number;
  chapterCount: number;
  errors: string[];
  duration: number;
}

export interface ScraperStatus {
  isRunning: boolean;
  stopRequested: boolean;
  lastRunAt: Date | null;
  errors: string[];
}

@Injectable()
export class ScraperService {
  private isRunning = false;
  private stopRequested = false;
  private lastRunAt: Date | null = null;
  private errors: string[] = [];

  constructor(
    private readonly registry: ScraperRegistryService,
    @Inject(forwardRef(() => MangaService))
    private readonly mangaService: MangaService,
    @Inject(forwardRef(() => ChapterService))
    private readonly chapterService: ChapterService,
    private readonly logService: LogService,
  ) {}

  getStatus(): ScraperStatus {
    return {
      isRunning: this.isRunning,
      stopRequested: this.stopRequested,
      lastRunAt: this.lastRunAt,
      errors: [...this.errors],
    };
  }

  stop() {
    if (!this.isRunning) return { message: 'No scrape running' };
    this.stopRequested = true;
    this.logService.warn('Stop requested — will halt after current item completes', 'Scraper');
    return { message: 'Stop signal sent' };
  }

  async runFullScrape(source?: string): Promise<ScrapeSummary> {
    if (this.isRunning) {
      throw new Error('A scrape is already in progress');
    }

    this.isRunning = true;
    this.stopRequested = false;
    this.errors = [];
    const startTime = Date.now();
    let mangaCount = 0;
    let chapterCount = 0;

    this.logService.info(`Full scrape started${source ? ` — source: ${source}` : ' — all sources'}`, 'Scraper');

    try {
      const plugins = source
        ? [this.registry.getPlugin(source)].filter(Boolean) as IScraperPlugin[]
        : this.registry.getAllPlugins();

      if (plugins.length === 0) {
        throw new Error(source ? `No plugin found for source: ${source}` : 'No plugins registered');
      }

      for (const plugin of plugins) {
        if (this.stopRequested) {
          this.logService.warn('Scrape stopped by user request', 'Scraper');
          break;
        }

        this.logService.info(`Starting scrape: ${plugin.sourceName}`, plugin.sourceName);

        try {
          const allManga: MangaResult[] = [];
          const seenUrls = new Set<string>();

          for (let page = 0; page < 500; page++) {
            if (this.stopRequested) break;

            try {
              const mangaList = await plugin.getLatestManga(page);
              if (mangaList.length === 0) break;
              let added = 0;
              for (const m of mangaList) {
                if (seenUrls.has(m.sourceUrl)) continue;
                seenUrls.add(m.sourceUrl);
                allManga.push(m);
                added++;
              }
              if (added === 0) break;
            } catch (error: any) {
              const msg = `${plugin.sourceName}: Failed page ${page}: ${error.message}`;
              this.logService.error(msg, plugin.sourceName);
              this.errors.push(msg);
              break;
            }
          }

          this.logService.info(`${plugin.sourceName}: Found ${allManga.length} manga`, plugin.sourceName);

          for (const manga of allManga) {
            if (this.stopRequested) break;

            try {
              const savedManga = await this.mangaService.upsert({
                ...manga,
                source: plugin.sourceName,
                language: manga.language || 'en',
              });
              mangaCount++;

              try {
                const chapters = await plugin.getChapterList(manga.sourceUrl);
                for (const chapter of chapters) {
                  if (this.stopRequested) break;
                  try {
                    await this.chapterService.upsert({
                      mangaId: savedManga.id || savedManga._id,
                      chapterNumber: chapter.chapterNumber,
                      title: chapter.title,
                      sourceUrl: chapter.sourceUrl,
                      publishedAt: chapter.publishedAt,
                      source: plugin.sourceName,
                      language: chapter.language || manga.language || 'en',
                    });
                    chapterCount++;
                  } catch (error: any) {
                    const msg = `${plugin.sourceName}: Chapter ${chapter.chapterNumber} upsert failed for "${manga.title}": ${error.message}`;
                    this.logService.error(msg, plugin.sourceName);
                    this.errors.push(msg);
                  }
                }
              } catch (error: any) {
                const msg = `${plugin.sourceName}: Chapter fetch failed for "${manga.title}": ${error.message}`;
                this.logService.error(msg, plugin.sourceName);
                this.errors.push(msg);
              }
            } catch (error: any) {
              const msg = `${plugin.sourceName}: Manga upsert failed "${manga.title}": ${error.message}`;
              this.logService.error(msg, plugin.sourceName);
              this.errors.push(msg);
            }
          }

          this.logService.success(`${plugin.sourceName}: Scrape complete`, plugin.sourceName);
        } catch (error: any) {
          const msg = `${plugin.sourceName}: Plugin failed: ${error.message}`;
          this.logService.error(msg, plugin.sourceName);
          this.errors.push(msg);
        }
      }
    } finally {
      this.isRunning = false;
      this.lastRunAt = new Date();
    }

    const duration = Date.now() - startTime;
    this.logService.success(
      `Full scrape done in ${(duration / 1000).toFixed(1)}s — ${mangaCount} manga, ${chapterCount} chapters, ${this.errors.length} errors`,
      'Scraper',
    );

    return { mangaCount, chapterCount, errors: [...this.errors], duration };
  }

  async checkForUpdates(): Promise<ScrapeSummary> {
    if (this.isRunning) {
      throw new Error('A scrape is already in progress');
    }

    this.isRunning = true;
    this.stopRequested = false;
    this.errors = [];
    const startTime = Date.now();
    let mangaCount = 0;
    let chapterCount = 0;

    this.logService.info('Chapter update check started', 'Scraper');

    try {
      const allManga = await this.mangaService.findAllRaw();
      this.logService.info(`Checking updates for ${allManga.length} manga`, 'Scraper');

      for (const manga of allManga) {
        if (this.stopRequested) {
          this.logService.warn('Update check stopped by user request', 'Scraper');
          break;
        }

        try {
          const source = manga.source as string;
          const plugin = this.registry.getPlugin(source);
          if (!plugin) {
            this.logService.warn(`No plugin for source "${source}", skipping "${manga.title}"`, 'Scraper');
            continue;
          }

          const sourceUrl = manga.sourceUrl as string;
          const latestInDb = await this.chapterService.getLatestChapter(manga.id || manga._id);
          const chapters = await plugin.getChapterList(sourceUrl);
          const newChapters = chapters.filter((ch) => ch.chapterNumber > latestInDb);

          if (newChapters.length > 0) {
            this.logService.info(`${source}: ${newChapters.length} new chapters for "${manga.title}"`, source);
            mangaCount++;

            for (const chapter of newChapters) {
              if (this.stopRequested) break;
              try {
                await this.chapterService.upsert({
                  mangaId: manga.id || manga._id,
                  chapterNumber: chapter.chapterNumber,
                  title: chapter.title,
                  sourceUrl: chapter.sourceUrl,
                  publishedAt: chapter.publishedAt,
                  source,
                  language: chapter.language || (manga as any).language || 'en',
                });
                chapterCount++;
              } catch (error: any) {
                const msg = `${source}: Chapter upsert failed for "${manga.title}": ${error.message}`;
                this.logService.error(msg, source);
                this.errors.push(msg);
              }
            }
          }
        } catch (error: any) {
          const msg = `Update check failed for "${manga.title}": ${error.message}`;
          this.logService.error(msg, 'Scraper');
          this.errors.push(msg);
        }
      }
    } finally {
      this.isRunning = false;
      this.lastRunAt = new Date();
    }

    const duration = Date.now() - startTime;
    this.logService.success(
      `Update check done in ${(duration / 1000).toFixed(1)}s — ${mangaCount} manga updated, ${chapterCount} new chapters, ${this.errors.length} errors`,
      'Scraper',
    );

    return { mangaCount, chapterCount, errors: [...this.errors], duration };
  }
}
