import { Injectable } from '@nestjs/common';
import { ArabicMadaraBasePlugin } from './arabic-madara-base.plugin';

/**
 * Scraper plugin for MangaSwat / Swat Manga (https://mangaswat.com)
 * Arabic manga site using WordPress Madara theme.
 * Also accessible via meshmanga.com / swatmanga.me
 */
@Injectable()
export class MangaSwatPlugin extends ArabicMadaraBasePlugin {
  readonly sourceName = 'mangaswat';
  readonly baseUrl: string;

  constructor() {
    super(MangaSwatPlugin.name);
    this.baseUrl = process.env.MANGASWAT_BASE_URL || 'https://mangaswat.com';
    this.initClient();
  }
}
