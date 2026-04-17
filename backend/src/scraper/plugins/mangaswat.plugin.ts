import { Injectable } from '@nestjs/common';
import { ArabicMadaraBasePlugin } from './arabic-madara-base.plugin';

/**
 * MangaSwat — Arabic manga scanlation site on the Madara WordPress theme.
 *
 * Historically the .com domain has been unreliable. Use the
 * MANGASWAT_BASE_URL env var to override if the site moves.
 *
 * A failed fetch returns an empty list via the base class,
 * so the scraper will log and skip.
 */
@Injectable()
export class MangaSwatPlugin extends ArabicMadaraBasePlugin {
  readonly sourceName = 'mangaswat';
  readonly baseUrl: string;

  constructor() {
    super('MangaSwatPlugin');
    this.baseUrl = process.env.MANGASWAT_BASE_URL || 'https://mangaswat.com';
    this.initClient();
  }
}
