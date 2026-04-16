export interface MangaResult {
  title: string;
  alternativeTitles?: string[];
  author?: string;
  artist?: string;
  genres?: string[];
  status?: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  description?: string;
  coverImage?: string;
  sourceUrl: string;
}

export interface ChapterResult {
  chapterNumber: number;
  title?: string;
  sourceUrl: string;
  publishedAt?: Date;
}

export interface PageResult {
  pageNumber: number;
  imageUrl: string;
}

export interface IScraperPlugin {
  readonly sourceName: string;
  readonly baseUrl: string;
  getLatestManga(page: number): Promise<MangaResult[]>;
  searchManga(query: string, page: number): Promise<MangaResult[]>;
  getMangaDetail(sourceUrl: string): Promise<MangaResult>;
  getChapterList(sourceUrl: string): Promise<ChapterResult[]>;
  getPageList(chapterUrl: string): Promise<PageResult[]>;
}
