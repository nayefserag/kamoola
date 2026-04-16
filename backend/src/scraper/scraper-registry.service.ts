import { Injectable, Logger } from '@nestjs/common';
import { IScraperPlugin } from './interfaces/scraper-plugin.interface';
import { MangaDexPlugin } from './plugins/mangadex.plugin';
import { MangaKakalotPlugin } from './plugins/mangakakalot.plugin';
import { AsuraScansPlugin } from './plugins/asurascans.plugin';
import { MadaraPlugin } from './plugins/madara.plugin';
import { OlympusStaffPlugin } from './plugins/olympustaff.plugin';
import { MangalekPlugin } from './plugins/mangalek.plugin';
import { AzoraPlugin } from './plugins/azora.plugin';
import { MangaSwatPlugin } from './plugins/mangaswat.plugin';
import { GMangaPlugin } from './plugins/gmanga.plugin';

@Injectable()
export class ScraperRegistryService {
  private readonly logger = new Logger(ScraperRegistryService.name);
  private readonly plugins = new Map<string, IScraperPlugin>();

  constructor(
    // English sources
    private readonly mangaDexPlugin: MangaDexPlugin,
    private readonly mangaKakalotPlugin: MangaKakalotPlugin,
    private readonly asuraScansPlugin: AsuraScansPlugin,
    private readonly madaraPlugin: MadaraPlugin,
    // Arabic sources
    private readonly olympusStaffPlugin: OlympusStaffPlugin,
    private readonly mangalekPlugin: MangalekPlugin,
    private readonly azoraPlugin: AzoraPlugin,
    private readonly mangaSwatPlugin: MangaSwatPlugin,
    private readonly gMangaPlugin: GMangaPlugin,
  ) {
    // English
    this.register(mangaDexPlugin);
    this.register(mangaKakalotPlugin);
    this.register(asuraScansPlugin);
    this.register(madaraPlugin);
    // Arabic
    this.register(olympusStaffPlugin);
    this.register(mangalekPlugin);
    this.register(azoraPlugin);
    this.register(mangaSwatPlugin);
    this.register(gMangaPlugin);
  }

  private register(plugin: IScraperPlugin): void {
    this.plugins.set(plugin.sourceName, plugin);
    this.logger.log(
      `Registered scraper plugin: ${plugin.sourceName} (${plugin.baseUrl})`,
    );
  }

  getPlugin(name: string): IScraperPlugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): IScraperPlugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }
}
