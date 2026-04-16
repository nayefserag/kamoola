import { Injectable, Logger } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { ScraperService } from '../scraper/scraper.service';

interface JobRunRecord {
  lastRunAt: Date | null;
  lastResult: Record<string, unknown> | null;
  lastError: string | null;
  isRunning: boolean;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  private readonly jobRecords: Record<string, JobRunRecord> = {
    dailyChapterCheck: {
      lastRunAt: null,
      lastResult: null,
      lastError: null,
      isRunning: false,
    },
    weeklyFullScrape: {
      lastRunAt: null,
      lastResult: null,
      lastError: null,
      isRunning: false,
    },
  };

  constructor(
    private readonly scraperService: ScraperService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  /**
   * Daily at midnight (12:00 AM UTC) - Check for new chapters on existing manga.
   */
  @Cron('0 0 * * *', { name: 'dailyChapterCheck', timeZone: 'UTC' })
  async handleDailyChapterCheck(): Promise<void> {
    const jobName = 'dailyChapterCheck';
    this.logger.log('Starting daily chapter check...');

    if (this.jobRecords[jobName].isRunning) {
      this.logger.warn(
        'Daily chapter check is already running. Skipping this invocation.',
      );
      return;
    }

    const scraperStatus = this.scraperService.getStatus();
    if (scraperStatus.isRunning) {
      this.logger.warn('Scraper is already running. Skipping daily check.');
      return;
    }

    this.jobRecords[jobName].isRunning = true;
    this.jobRecords[jobName].lastError = null;

    try {
      const result = await this.scraperService.checkForUpdates();
      this.jobRecords[jobName].lastResult = { ...result };
      this.jobRecords[jobName].lastRunAt = new Date();

      this.logger.log(
        `Daily check complete. New chapters found: ${result.chapterCount}. Errors: ${result.errors.length}`,
      );

      if (result.errors.length > 0) {
        result.errors.forEach((err: string) =>
          this.logger.error(`Scrape error: ${err}`),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.jobRecords[jobName].lastError = message;
      this.jobRecords[jobName].lastRunAt = new Date();
      this.logger.error(`Daily chapter check failed: ${message}`, stack);
    } finally {
      this.jobRecords[jobName].isRunning = false;
    }
  }

  /**
   * Weekly full scrape - discover new manga titles (every Sunday at 3:00 AM UTC).
   */
  @Cron('0 3 * * 0', { name: 'weeklyFullScrape', timeZone: 'UTC' })
  async handleWeeklyFullScrape(): Promise<void> {
    const jobName = 'weeklyFullScrape';
    this.logger.log('Starting weekly full scrape...');

    if (this.jobRecords[jobName].isRunning) {
      this.logger.warn(
        'Weekly full scrape is already running. Skipping this invocation.',
      );
      return;
    }

    const scraperStatus = this.scraperService.getStatus();
    if (scraperStatus.isRunning) {
      this.logger.warn('Scraper is already running. Skipping weekly scrape.');
      return;
    }

    this.jobRecords[jobName].isRunning = true;
    this.jobRecords[jobName].lastError = null;

    try {
      const result = await this.scraperService.runFullScrape();
      this.jobRecords[jobName].lastResult = { ...result };
      this.jobRecords[jobName].lastRunAt = new Date();

      this.logger.log(
        `Weekly scrape complete. Manga: ${result.mangaCount}, Chapters: ${result.chapterCount}, Errors: ${result.errors.length}`,
      );

      if (result.errors.length > 0) {
        result.errors.forEach((err: string) =>
          this.logger.error(`Scrape error: ${err}`),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.jobRecords[jobName].lastError = message;
      this.jobRecords[jobName].lastRunAt = new Date();
      this.logger.error(`Weekly full scrape failed: ${message}`, stack);
    } finally {
      this.jobRecords[jobName].isRunning = false;
    }
  }

  /**
   * Returns status information about all scheduled jobs including next run
   * times resolved from the SchedulerRegistry.
   */
  getJobStatuses(): Record<string, unknown>[] {
    const statuses: Record<string, unknown>[] = [];

    for (const [jobName, record] of Object.entries(this.jobRecords)) {
      let nextRunAt: string | null = null;

      try {
        const cronJob = this.schedulerRegistry.getCronJob(jobName);
        const nextDate = cronJob.nextDate();
        nextRunAt = nextDate.toISO();
      } catch {
        // Job may not be registered yet during startup
      }

      statuses.push({
        jobName,
        nextRunAt,
        lastRunAt: record.lastRunAt?.toISOString() ?? null,
        lastResult: record.lastResult,
        lastError: record.lastError,
        isRunning: record.isRunning,
      });
    }

    return statuses;
  }
}
