import { useQuery } from '@tanstack/react-query';
import {
  getPopularManga,
  getLatestManga,
  getMangaList,
  getMangaById,
  getMangaChapters,
  getChapterById,
  searchManga,
} from '@/api/manga';
import type { MangaFilters } from '@/types/manga';

export function usePopularManga(limit: number = 10) {
  return useQuery({
    queryKey: ['manga', 'popular', limit],
    queryFn: () => getPopularManga(limit),
  });
}

export function useLatestManga(limit: number = 18) {
  return useQuery({
    queryKey: ['manga', 'latest', limit],
    queryFn: () => getLatestManga(limit),
  });
}

export function useMangaList(filters: MangaFilters) {
  return useQuery({
    queryKey: ['manga', 'list', filters],
    queryFn: () => getMangaList(filters),
    keepPreviousData: true,
  } as any);
}

export function useMangaDetail(id: string) {
  return useQuery({
    queryKey: ['manga', 'detail', id],
    queryFn: () => getMangaById(id),
    enabled: !!id,
  });
}

export function useMangaChapters(mangaId: string, page: number = 1) {
  return useQuery({
    queryKey: ['manga', 'chapters', mangaId, page],
    queryFn: () => getMangaChapters(mangaId, page),
    enabled: !!mangaId,
    keepPreviousData: true,
  } as any);
}

export function useChapter(id: string) {
  return useQuery({
    queryKey: ['chapter', id],
    queryFn: () => getChapterById(id),
    enabled: !!id,
  });
}

export function useSearchManga(query: string, page: number = 1) {
  return useQuery({
    queryKey: ['manga', 'search', query, page],
    queryFn: () => searchManga(query, page),
    enabled: !!query,
    keepPreviousData: true,
  } as any);
}
