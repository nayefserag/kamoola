import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ScraperRegistryService } from './scraper-registry.service';
import { MangaResult, IScraperPlugin } from './interfaces/scraper-plugin.interface';
import { MangaService } from '../manga/manga.service';
import { ChapterService } from '../chapter/chapter.service';

export interface ScrapeSummary {
  mangaCount: number;
  chapterCount: number;
  errors: string[];
  duration: number;
}

export interface ScraperStatus {
  isRunning: boolean;
  lastRunAt: Date | null;
  errors: string[];
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private isRunning = false;
  private lastRunAt: Date | null = null;
  private errors: string[] = [];

  constructor(
    private readonly registry: ScraperRegistryService,
    @Inject(forwardRef(() => MangaService))
    private readonly mangaService: MangaService,
    @Inject(forwardRef(() => ChapterService))
    private readonly chapterService: ChapterService,
  ) {}

  getStatus(): ScraperStatus {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      errors: [...this.errors],
    };
  }

  async runFullScrape(source?: string): Promise<ScrapeSummary> {
    if (this.isRunning) {
      throw new Error('A scrape is already in progress');
    }

    this.isRunning = true;
    this.errors = [];
    const startTime = Date.now();
    let mangaCount = 0;
    let chapterCount = 0;

    try {
      const plugins = source
        ? [this.registry.getPlugin(source)].filter(Boolean) as IScraperPlugin[]
        : this.registry.getAllPlugins();

      if (plugins.length === 0) {
        throw new Error(
          source
            ? `No plugin found for source: ${source}`
            : 'No plugins registered',
        );
      }

      for (const plugin of plugins) {
        this.logger.log(`Starting scrape for source: ${plugin.sourceName}`);

        try {
          // Fetch latest manga from first 5 pages
          const allManga: MangaResult[] = [];
          for (let page = 0; page < 5; page++) {
            try {
              const mangaList = await plugin.getLatestManga(page);
              if (mangaList.length === 0) break;
              allManga.push(...mangaList);
            } catch (error: any) {
              const errMsg = `${plugin.sourceName}: Failed to fetch page ${page}: ${error.message}`;
              this.logger.error(errMsg);
              this.errors.push(errMsg);
            }
          }

          this.logger.log(
            `${plugin.sourceName}: Found ${allManga.length} manga entries`,
          );

          // Upsert each manga and its chapters
          for (const manga of allManga) {
            try {
              const savedManga = await this.mangaService.upsert({
                ...manga,
                source: plugin.sourceName,
              });
              mangaCount++;

              // Fetch and upsert chapters
              try {
                const chapters = await plugin.getChapterList(manga.sourceUrl);
                for (const chapter of chapters) {
                  try {
                    await this.chapterService.upsert({
                      mangaId: savedManga.id || savedManga._id,
                      chapterNumber: chapter.chapterNumber,
                      title: chapter.title,
                      sourceUrl: chapter.sourceUrl,
                      publishedAt: chapter.publishedAt,
                      source: plugin.sourceName,
                    });
                    chapterCount++;
                  } catch (error: any) {
                    const errMsg = `${plugin.sourceName}: Failed to upsert chapter ${chapter.chapterNumber} for "${manga.title}": ${error.message}`;
                    this.logger.error(errMsg);
                    this.errors.push(errMsg);
                  }
                }
              } catch (error: any) {
                const errMsg = `${plugin.sourceName}: Failed to fetch chapters for "${manga.title}": ${error.message}`;
                this.logger.error(errMsg);
                this.errors.push(errMsg);
              }
            } catch (error: any) {
              const errMsg = `${plugin.sourceName}: Failed to upsert manga "${manga.title}": ${error.message}`;
              this.logger.error(errMsg);
              this.errors.push(errMsg);
            }
          }

          this.logger.log(
            `${plugin.sourceName}: Completed scrape`,
          );
        } catch (error: any) {
          const errMsg = `${plugin.sourceName}: Plugin scrape failed: ${error.message}`;
          this.logger.error(errMsg);
          this.errors.push(errMsg);
        }
      }
    } finally {
      this.isRunning = false;
      this.lastRunAt = new Date();
    }

    const duration = Date.now() - startTime;

    this.logger.log(
      `Full scrape completed in ${duration}ms: ${mangaCount} manga, ${chapterCount} chapters, ${this.errors.length} errors`,
    );

    return {
      mangaCount,
      chapterCount,
      errors: [...this.errors],
      duration,
    };
  }

  async checkForUpdates(): Promise<ScrapeSummary> {
    if (this.isRunning) {
      throw new Error('A scrape is already in progress');
    }

    this.isRunning = true;
    this.errors = [];
    const startTime = Date.now();
    let mangaCount = 0;
    let chapterCount = 0;

    try {
      const allManga = await this.mangaService.findAllRaw();
      this.logger.log(
        `Checking for updates across ${allManga.length} manga entries`,
      );

      for (const manga of allManga) {
        try {
          const source = manga.source as string;
          const plugin = this.registry.getPlugin(source);
          if (!plugin) {
            this.logger.warn(
              `No plugin found for source "${source}", skipping "${manga.title}"`,
            );
            continue;
          }

          const sourceUrl = manga.sourceUrl as string;
          const latestChapterInDb = await this.chapterService.getLatestChapter(
            manga.id || manga._id,
          );

          const chapters = await plugin.getChapterList(sourceUrl);
          const newChapters = chapters.filter(
            (ch) => ch.chapterNumber > latestChapterInDb,
          );

          if (newChapters.length > 0) {
            this.logger.log(
              `${source}: Found ${newChapters.length} new chapters for "${manga.title}"`,
            );
            mangaCount++;

            for (const chapter of newChapters) {
              try {
                await this.chapterService.upsert({
                  mangaId: manga.id || manga._id,
                  chapterNumber: chapter.chapterNumber,
                  title: chapter.title,
                  sourceUrl: chapter.sourceUrl,
                  publishedAt: chapter.publishedAt,
                  source,
                });
                chapterCount++;
              } catch (error: any) {
                const errMsg = `${source}: Failed to upsert chapter ${chapter.chapterNumber} for "${manga.title}": ${error.message}`;
                this.logger.error(errMsg);
                this.errors.push(errMsg);
              }
            }
          }
        } catch (error: any) {
          const errMsg = `Failed to check updates for "${manga.title}": ${error.message}`;
          this.logger.error(errMsg);
          this.errors.push(errMsg);
        }
      }
    } finally {
      this.isRunning = false;
      this.lastRunAt = new Date();
    }

    const duration = Date.now() - startTime;

    this.logger.log(
      `Update check completed in ${duration}ms: ${mangaCount} manga updated, ${chapterCount} new chapters, ${this.errors.length} errors`,
    );

    return {
      mangaCount,
      chapterCount,
      errors: [...this.errors],
      duration,
    };
  }
}
