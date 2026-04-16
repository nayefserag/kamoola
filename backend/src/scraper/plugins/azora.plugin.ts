import { Injectable } from '@nestjs/common';
import { ArabicMadaraBasePlugin } from './arabic-madara-base.plugin';

/**
 * Scraper plugin for Azora Manga (https://azoramoon.com)
 * Arabic manga site using WordPress Madara theme.
 */
@Injectable()
export class AzoraPlugin extends ArabicMadaraBasePlugin {
  readonly sourceName = 'azora';
  readonly baseUrl: string;

  constructor() {
    super(AzoraPlugin.name);
    this.baseUrl = process.env.AZORA_BASE_URL || 'https://azoramoon.com';
    this.initClient();
  }
}
