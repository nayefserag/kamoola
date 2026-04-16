import { useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useChapter, useMangaChapters } from '@/hooks/useMangaQueries';
import Reader from '@/components/reader/Reader';

function ReaderPage() {
  const { mangaId, chapterId } = useParams<{
    mangaId: string;
    chapterId: string;
  }>();
  const navigate = useNavigate();

  const { data: chapter, isLoading, error } = useChapter(chapterId!);
  const { data: chaptersData } = useMangaChapters(mangaId!, 1);

  // Get sorted chapters list for navigation
  const sortedChapters = useMemo(() => {
    if (!chaptersData?.data) return [];
    return [...chaptersData.data].sort(
      (a, b) => a.chapterNumber - b.chapterNumber
    );
  }, [chaptersData]);

  const currentIndex = useMemo(() => {
    return sortedChapters.findIndex((ch) => ch._id === chapterId);
  }, [sortedChapters, chapterId]);

  const hasPrevChapter = currentIndex > 0;
  const hasNextChapter = currentIndex < sortedChapters.length - 1;

  const goToPrevChapter = useCallback(() => {
    if (hasPrevChapter) {
      const prevChapter = sortedChapters[currentIndex - 1];
      navigate(`/manga/${mangaId}/read/${prevChapter._id}`);
    }
  }, [hasPrevChapter, sortedChapters, currentIndex, mangaId, navigate]);

  const goToNextChapter = useCallback(() => {
    if (hasNextChapter) {
      const nextChapter = sortedChapters[currentIndex + 1];
      navigate(`/manga/${mangaId}/read/${nextChapter._id}`);
    }
  }, [hasNextChapter, sortedChapters, currentIndex, mangaId, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-accent animate-spin" />
          <p className="text-textSecondary text-sm">Loading chapter...</p>
        </div>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-accent" />
          <h2 className="text-xl font-bold text-textPrimary">
            Chapter not found
          </h2>
          <p className="text-textSecondary text-sm max-w-sm">
            This chapter may have been removed or is temporarily unavailable.
          </p>
          <button
            onClick={() => navigate(`/manga/${mangaId}`)}
            className="inline-flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Manga
          </button>
        </div>
      </div>
    );
  }

  return (
    <Reader
      chapter={chapter}
      mangaId={mangaId!}
      mangaSource={chapter.sourceUrl ? new URL(chapter.sourceUrl).hostname : ''}
      onNextChapter={goToNextChapter}
      onPrevChapter={goToPrevChapter}
      hasNextChapter={hasNextChapter}
      hasPrevChapter={hasPrevChapter}
    />
  );
}

export default ReaderPage;
