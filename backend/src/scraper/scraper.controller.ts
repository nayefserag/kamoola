import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ScraperService } from './scraper.service';

class TriggerScrapeDto {
  source?: string;
}

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  async triggerScrape(@Body() body: TriggerScrapeDto) {
    const summary = await this.scraperService.runFullScrape(body.source);
    return {
      message: 'Scrape completed',
      data: summary,
    };
  }

  @Post('check-updates')
  @HttpCode(HttpStatus.OK)
  async checkUpdates() {
    const summary = await this.scraperService.checkForUpdates();
    return {
      message: 'Update check completed',
      data: summary,
    };
  }

  @Get('status')
  getStatus() {
    return {
      data: this.scraperService.getStatus(),
    };
  }
}
