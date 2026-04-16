import { Injectable, Logger } from '@nestjs/common';
import { IScraperPlugin } from './interfaces/scraper-plugin.interface';
import { MangaDexPlugin } from './plugins/mangadex.plugin';
import { MangaKakalotPlugin } from './plugins/mangakakalot.plugin';
import { AsuraScansPlugin } from './plugins/asurascans.plugin';
import { MadaraPlugin } from './plugins/madara.plugin';
import { OlympusStaffPlugin } from './plugins/olympustaff.plugin';

@Injectable()
export class ScraperRegistryService {
  private readonly logger = new Logger(ScraperRegistryService.name);
  private readonly plugins = new Map<string, IScraperPlugin>();

  constructor(
    private readonly mangaDexPlugin: MangaDexPlugin,
    private readonly mangaKakalotPlugin: MangaKakalotPlugin,
    private readonly asuraScansPlugin: AsuraScansPlugin,
    private readonly madaraPlugin: MadaraPlugin,
    private readonly olympusStaffPlugin: OlympusStaffPlugin,
  ) {
    this.register(mangaDexPlugin);
    this.register(mangaKakalotPlugin);
    this.register(asuraScansPlugin);
    this.register(madaraPlugin);
    this.register(olympusStaffPlugin);
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
