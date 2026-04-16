import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Manga, MangaSchema } from './schemas/manga.schema';
import { MangaService } from './manga.service';
import { MangaController } from './manga.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Manga.name, schema: MangaSchema }]),
  ],
  controllers: [MangaController],
  providers: [MangaService],
  exports: [MangaService],
})
export class MangaModule {}
