export interface Manga {
  _id: string;
  title: string;
  alternativeTitles: string[];
  author: string;
  artist: string;
  genres: string[];
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  description: string;
  coverImage: string;
  language: string;
  source: string;
  sourceUrl: string;
  rating: number;
  views: number;
  latestChapter: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  _id: string;
  mangaId: string;
  chapterNumber: number;
  title: string;
  pages: Page[];
  sourceUrl: string;
  publishedAt: string;
  createdAt: string;
}

export interface Page {
  pageNumber: number;
  imageUrl: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MangaFilters {
  genres?: string[];
  status?: string;
  sort?: string;
  language?: string;
  page?: number;
  limit?: number;
}

export interface ReadingProgress {
  chapterId: string;
  chapterNumber: number;
  page: number;
  updatedAt: string;
}
