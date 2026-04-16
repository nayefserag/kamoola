import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MangaDocument = HydratedDocument<Manga>;

@Schema({ timestamps: true })
export class Manga {
  @Prop({ required: true })
  title!: string;

  @Prop([String])
  alternativeTitles!: string[];

  @Prop()
  author!: string;

  @Prop()
  artist!: string;

  @Prop([String])
  genres!: string[];

  @Prop({
    enum: ['ongoing', 'completed', 'hiatus', 'cancelled'],
    default: 'ongoing',
  })
  status!: string;

  @Prop()
  description!: string;

  @Prop()
  coverImage!: string;

  @Prop({ default: 'en' })
  language!: string;

  @Prop()
  source!: string;

  @Prop({ unique: true, required: true })
  sourceUrl!: string;

  @Prop({ default: 0 })
  rating!: number;

  @Prop({ default: 0 })
  views!: number;

  @Prop()
  lastScrapedAt!: Date;

  @Prop()
  latestChapter!: number;
}

export const MangaSchema = SchemaFactory.createForClass(Manga);

MangaSchema.index(
  { title: 'text' },
  { default_language: 'none', language_override: 'none' },
);
MangaSchema.index({ genres: 1 });
MangaSchema.index({ source: 1 });
MangaSchema.index({ language: 1 });
