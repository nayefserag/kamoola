import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Manga, MangaDocument } from './schemas/manga.schema';
import { FilterMangaDto } from './dto/filter-manga.dto';

@Injectable()
export class MangaService {
  constructor(
    @InjectModel(Manga.name) private readonly mangaModel: Model<MangaDocument>,
  ) {}

  async findAll(query: FilterMangaDto) {
    const { page, limit, genres, status, search, sortBy } = query;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<MangaDocument> = {};

    if (genres && genres.length > 0) {
      filter.genres = { $in: genres };
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const sortOrder: Record<string, 1 | -1> = {};
    if (search && !sortBy) {
      sortOrder.score = { $meta: 'textScore' } as unknown as 1;
    } else {
      const field = sortBy || 'updatedAt';
      sortOrder[field] = field === 'title' ? 1 : -1;
    }

    const [data, total] = await Promise.all([
      this.mangaModel
        .find(filter)
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.mangaModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllRaw() {
    return this.mangaModel.find().lean().exec();
  }

  async findPopular(limit: number = 10) {
    return this.mangaModel
      .find()
      .sort({ views: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findLatest(limit: number = 10) {
    return this.mangaModel
      .find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findById(id: string) {
    const manga = await this.mangaModel
      .findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true })
      .lean()
      .exec();

    if (!manga) {
      throw new NotFoundException(`Manga with ID "${id}" not found`);
    }

    return manga;
  }

  async search(query: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const filter: FilterQuery<MangaDocument> = {
      $text: { $search: query },
    };

    const [data, total] = await Promise.all([
      this.mangaModel
        .find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.mangaModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async upsert(data: Partial<Manga> & { sourceUrl: string }) {
    return this.mangaModel
      .findOneAndUpdate({ sourceUrl: data.sourceUrl }, data, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      })
      .lean()
      .exec();
  }
}
