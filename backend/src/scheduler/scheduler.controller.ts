import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ScraperService } from '../scraper/scraper.service';

@Controller('scheduler')
export class SchedulerController {
  private readonly logger = new Logger(SchedulerController.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly scraperService: ScraperService,
  ) {}

  /**
   * GET /scheduler/status
   * Returns information about all scheduled jobs: next run, last run, results, errors.
   */
  @Get('status')
  getStatus() {
    const jobs = this.schedulerService.getJobStatuses();
    const scraperStatus = this.scraperService.getStatus();

    return {
      scraper: scraperStatus,
      jobs,
    };
  }

  /**
   * POST /scheduler/trigger/daily
   * Manually trigger the daily chapter check.
   * Returns 409 if a scrape is already in progress.
   */
  @Post('trigger/daily')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerDailyCheck() {
    this.logger.log('Manual trigger: daily chapter check');

    const scraperStatus = this.scraperService.getStatus();
    if (scraperStatus.isRunning) {
      throw new ConflictException(
        'A scrape operation is already in progress. Please wait for it to finish.',
      );
    }

    // Fire and forget - the job handles its own error logging
    this.schedulerService.handleDailyChapterCheck().catch((error) => {
      this.logger.error(
        `Manually triggered daily check failed unexpectedly: ${error.message}`,
        error.stack,
      );
    });

    return {
      message: 'Daily chapter check has been triggered.',
      triggeredAt: new Date().toISOString(),
    };
  }

  /**
   * POST /scheduler/trigger/weekly
   * Manually trigger the weekly full scrape.
   * Returns 409 if a scrape is already in progress.
   */
  @Post('trigger/weekly')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerWeeklyScrape() {
    this.logger.log('Manual trigger: weekly full scrape');

    const scraperStatus = this.scraperService.getStatus();
    if (scraperStatus.isRunning) {
      throw new ConflictException(
        'A scrape operation is already in progress. Please wait for it to finish.',
      );
    }

    // Fire and forget - the job handles its own error logging
    this.schedulerService.handleWeeklyFullScrape().catch((error) => {
      this.logger.error(
        `Manually triggered weekly scrape failed unexpectedly: ${error.message}`,
        error.stack,
      );
    });

    return {
      message: 'Weekly full scrape has been triggered.',
      triggeredAt: new Date().toISOString(),
    };
  }
}
