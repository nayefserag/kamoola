import { Module, forwardRef } from '@nestjs/common';
import { MangaDexPlugin } from './plugins/mangadex.plugin';
import { MangaKakalotPlugin } from './plugins/mangakakalot.plugin';
import { AsuraScansPlugin } from './plugins/asurascans.plugin';
import { MadaraPlugin } from './plugins/madara.plugin';
import { OlympusStaffPlugin } from './plugins/olympustaff.plugin';
import { ScraperRegistryService } from './scraper-registry.service';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { ProxyController } from './proxy.controller';

// These modules will be provided by the application
// Adjust the import paths to match your project structure
import { MangaModule } from '../manga/manga.module';
import { ChapterModule } from '../chapter/chapter.module';

@Module({
  imports: [
    forwardRef(() => MangaModule),
    forwardRef(() => ChapterModule),
  ],
  controllers: [ScraperController, ProxyController],
  providers: [
    MangaDexPlugin,
    MangaKakalotPlugin,
    AsuraScansPlugin,
    MadaraPlugin,
    OlympusStaffPlugin,
    ScraperRegistryService,
    ScraperService,
  ],
  exports: [ScraperService, ScraperRegistryService],
})
export class ScraperModule {}
