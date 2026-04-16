import { Injectable, NotFoundException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chapter, ChapterDocument } from './schemas/chapter.schema';
import { ScraperRegistryService } from '../scraper/scraper-registry.service';

@Injectable()
export class ChapterService {
  private readonly logger = new Logger(ChapterService.name);

  constructor(
    @InjectModel(Chapter.name)
    private readonly chapterModel: Model<ChapterDocument>,
    @Inject(forwardRef(() => ScraperRegistryService))
    private readonly scraperRegistry: ScraperRegistryService,
  ) {}

  async findByManga(mangaId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const filter = { mangaId: new Types.ObjectId(mangaId) };

    const [data, total] = await Promise.all([
      this.chapterModel
        .find(filter)
        .sort({ chapterNumber: -1 })
        .skip(skip)
        .limit(limit)
        .select('-pages')
        .lean()
        .exec(),
      this.chapterModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    const chapter = await this.chapterModel.findById(id).lean().exec();

    if (!chapter) {
      throw new NotFoundException(`Chapter with ID "${id}" not found`);
    }

    // If pages are empty, fetch them on-demand from the source
    if (!chapter.pages || chapter.pages.length === 0) {
      this.logger.log(`Fetching pages on-demand for chapter ${chapter.chapterNumber} (source: ${chapter.source})`);
      try {
        const plugin = this.scraperRegistry.getPlugin(chapter.source);
        if (plugin && chapter.sourceUrl) {
          const pages = await plugin.getPageList(chapter.sourceUrl);
          if (pages.length > 0) {
            // Save pages to DB so we don't fetch again
            await this.chapterModel.findByIdAndUpdate(id, { pages }).exec();
            return { ...chapter, pages };
          }
        }
      } catch (error: any) {
        this.logger.error(`Failed to fetch pages on-demand: ${error.message}`);
      }
    }

    return chapter;
  }

  async upsert(data: Partial<Chapter> & { sourceUrl: string; mangaId: any; chapterNumber: number }) {
    return this.chapterModel
      .findOneAndUpdate(
        { mangaId: data.mangaId, chapterNumber: data.chapterNumber },
        { $setOnInsert: data },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )
      .lean()
      .exec();
  }

  async getLatestChapter(mangaId: string): Promise<number> {
    const chapter = await this.chapterModel
      .findOne({ mangaId: new Types.ObjectId(mangaId) })
      .sort({ chapterNumber: -1 })
      .select('chapterNumber')
      .lean()
      .exec();

    return chapter?.chapterNumber ?? 0;
  }
}
