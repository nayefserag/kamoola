import { Injectable } from '@nestjs/common';
import { ArabicMadaraBasePlugin } from './arabic-madara-base.plugin';

/**
 * Mangalek — Arabic manga scanlation site on the Madara WordPress theme.
 *
 * The `.top` domain has been unreliable (parked at times). Use the
 * MANGALEK_BASE_URL env var to override if the site moves.
 *
 * Because this extends ArabicMadaraBasePlugin, a failed fetch returns
 * an empty list rather than throwing — so the scraper will log and move on.
 */
@Injectable()
export class MangalekPlugin extends ArabicMadaraBasePlugin {
  readonly sourceName = 'mangalek';
  readonly baseUrl: string;

  constructor() {
    super('MangalekPlugin');
    this.baseUrl = process.env.MANGALEK_BASE_URL || 'https://mangalek.top';
    this.initClient();
  }
}
