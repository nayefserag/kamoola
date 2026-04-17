import { Module, forwardRef } from '@nestjs/common';
import { MangaDexPlugin } from './plugins/mangadex.plugin';
import { MangaKakalotPlugin } from './plugins/mangakakalot.plugin';
import { AsuraScansPlugin } from './plugins/asurascans.plugin';
import { MadaraPlugin } from './plugins/madara.plugin';
import { OlympusStaffPlugin } from './plugins/olympustaff.plugin';
import { MangalekPlugin } from './plugins/mangalek.plugin';
import { AzoraPlugin } from './plugins/azora.plugin';
import { MangaSwatPlugin } from './plugins/mangaswat.plugin';
import { GMangaPlugin } from './plugins/gmanga.plugin';
import { ScraperRegistryService } from './scraper-registry.service';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { ProxyController } from './proxy.controller';
import { LogService } from './log.service';
import { MangaModule } from '../manga/manga.module';
import { ChapterModule } from '../chapter/chapter.module';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [
    forwardRef(() => MangaModule),
    forwardRef(() => ChapterModule),
    forwardRef(() => SchedulerModule),
  ],
  controllers: [ScraperController, ProxyController],
  providers: [
    MangaDexPlugin,
    MangaKakalotPlugin,
    AsuraScansPlugin,
    MadaraPlugin,
    OlympusStaffPlugin,
    MangalekPlugin,
    AzoraPlugin,
    MangaSwatPlugin,
    GMangaPlugin,
    ScraperRegistryService,
    ScraperService,
    LogService,
  ],
  exports: [ScraperService, ScraperRegistryService, LogService],
})
export class ScraperModule {}
