import apiClient from './client';
import type { Manga, Chapter, PaginatedResponse, MangaFilters } from '@/types/manga';

const SORT_MAP: Record<string, string> = {
  popular: 'views',
  latest: 'updatedAt',
  az: 'title',
  rating: 'rating',
};

export async function getMangaList(
  params: MangaFilters = {}
): Promise<PaginatedResponse<Manga>> {
  const { sort, ...rest } = params;
  const apiParams: Record<string, unknown> = { ...rest };
  if (sort) {
    apiParams.sortBy = SORT_MAP[sort] || sort;
  }
  const { data } = await apiClient.get('/manga', { params: apiParams });
  return data;
}

export async function getPopularManga(limit: number = 10): Promise<Manga[]> {
  const { data } = await apiClient.get('/manga/popular', { params: { limit } });
  return data;
}

export async function getLatestManga(limit: number = 18): Promise<Manga[]> {
  const { data } = await apiClient.get('/manga/latest', { params: { limit } });
  return data;
}

export async function getMangaById(id: string): Promise<Manga> {
  const { data } = await apiClient.get(`/manga/${id}`);
  return data;
}

export async function getMangaChapters(
  mangaId: string,
  page: number = 1,
  limit: number = 50
): Promise<PaginatedResponse<Chapter>> {
  const { data } = await apiClient.get(`/manga/${mangaId}/chapters`, {
    params: { page, limit },
  });
  return data;
}

export async function getChapterById(id: string): Promise<Chapter> {
  const { data } = await apiClient.get(`/chapters/${id}`);
  return data;
}

export async function searchManga(
  query: string,
  page: number = 1,
  limit: number = 24
): Promise<PaginatedResponse<Manga>> {
  const { data } = await apiClient.get('/manga/search', {
    params: { q: query, page, limit },
  });
  return data;
}

export function getProxiedImageUrl(imageUrl: string, source: string): string {
  const baseURL = import.meta.env.VITE_API_URL || '/api';
  return `${baseURL}/proxy?url=${encodeURIComponent(imageUrl)}&source=${encodeURIComponent(source)}`;
}
