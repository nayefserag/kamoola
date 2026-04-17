import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { LogService } from './log.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { ScraperRegistryService } from './scraper-registry.service';

class TriggerScrapeDto {
  source?: string;
}

@Controller('scraper')
export class ScraperController {
  constructor(
    private readonly scraperService: ScraperService,
    private readonly logService: LogService,
    private readonly schedulerService: SchedulerService,
    private readonly registryService: ScraperRegistryService,
  ) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  async triggerScrape(@Body() body: TriggerScrapeDto) {
    // Fire and forget — return immediately so Vercel doesn't timeout
    this.scraperService.runFullScrape(body.source).catch(() => {});
    return { message: 'Scrape started', source: body.source || 'all' };
  }

  @Post('check-updates')
  @HttpCode(HttpStatus.OK)
  async checkUpdates() {
    this.scraperService.checkForUpdates().catch(() => {});
    return { message: 'Update check started' };
  }

  @Post('stop')
  @HttpCode(HttpStatus.OK)
  stopScrape() {
    return this.scraperService.stop();
  }

  @Get('status')
  getStatus() {
    return {
      scraper: this.scraperService.getStatus(),
      jobs: this.schedulerService.getJobStatuses(),
    };
  }

  @Get('logs')
  getLogs(@Query('since') since?: string) {
    return {
      logs: this.logService.getSince(since),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('logs/clear')
  @HttpCode(HttpStatus.OK)
  clearLogs() {
    this.logService.clear();
    this.logService.info('Logs cleared', 'System');
    return { message: 'Logs cleared' };
  }

  @Get('sources')
  getSources() {
    const ARABIC = new Set(['olympustaff', 'mangalek', 'azora', 'mangaswat', 'gmanga']);
    const plugins = this.registryService.getAllPlugins().map((p) => ({
      name: p.sourceName,
      baseUrl: p.baseUrl,
      language: ARABIC.has(p.sourceName) ? 'ar' : 'en',
    }));
    return { sources: plugins };
  }
}
