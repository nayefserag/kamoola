import { Injectable } from '@nestjs/common';
import { ArabicMadaraBasePlugin } from './arabic-madara-base.plugin';

/**
 * Scraper plugin for Mangalek (https://mangalek.top)
 * Arabic manga site using WordPress Madara theme.
 */
@Injectable()
export class MangalekPlugin extends ArabicMadaraBasePlugin {
  readonly sourceName = 'mangalek';
  readonly baseUrl: string;

  constructor() {
    super(MangalekPlugin.name);
    this.baseUrl = process.env.MANGALEK_BASE_URL || 'https://mangalek.top';
    this.initClient();
  }
}
