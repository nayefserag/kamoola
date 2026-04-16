import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ChapterDocument = HydratedDocument<Chapter>;

@Schema({ timestamps: true })
export class Chapter {
  @Prop({ type: Types.ObjectId, ref: 'Manga', required: true, index: true })
  mangaId!: Types.ObjectId;

  @Prop({ required: true })
  chapterNumber!: number;

  @Prop()
  title!: string;

  @Prop([
    {
      pageNumber: { type: Number },
      imageUrl: { type: String },
    },
  ])
  pages!: Array<{ pageNumber: number; imageUrl: string }>;

  @Prop({ unique: true })
  sourceUrl!: string;

  @Prop()
  publishedAt!: Date;

  @Prop()
  source!: string;

  @Prop({ default: 'en' })
  language!: string;
}

export const ChapterSchema = SchemaFactory.createForClass(Chapter);

ChapterSchema.index({ mangaId: 1, chapterNumber: 1 }, { unique: true });
