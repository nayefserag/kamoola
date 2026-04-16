import { useCallback } from 'react';
import type { ReadingProgress } from '@/types/manga';

const STORAGE_KEY = 'kamoola-reading-progress';

function getAllProgressFromStorage(): Record<string, ReadingProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveAllProgress(progress: Record<string, ReadingProgress>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    console.error('Failed to save reading progress');
  }
}

export function useReadingProgress() {
  const getProgress = useCallback(
    (mangaId: string): ReadingProgress | null => {
      const all = getAllProgressFromStorage();
      return all[mangaId] || null;
    },
    []
  );

  const saveProgress = useCallback(
    (mangaId: string, chapterId: string, chapterNumber: number, page: number) => {
      const all = getAllProgressFromStorage();
      all[mangaId] = {
        chapterId,
        chapterNumber,
        page,
        updatedAt: new Date().toISOString(),
      };
      saveAllProgress(all);
    },
    []
  );

  const getAllProgress = useCallback((): Record<string, ReadingProgress> => {
    return getAllProgressFromStorage();
  }, []);

  const clearProgress = useCallback((mangaId: string) => {
    const all = getAllProgressFromStorage();
    delete all[mangaId];
    saveAllProgress(all);
  }, []);

  return { getProgress, saveProgress, getAllProgress, clearProgress };
}
