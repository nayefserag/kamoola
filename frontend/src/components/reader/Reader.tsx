import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  BookOpen,
  List,
  Loader2,
  ImageOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getProxiedImageUrl } from '@/api/manga';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import type { Chapter } from '@/types/manga';

type ReadingMode = 'single' | 'longstrip';

interface ReaderProps {
  chapter: Chapter;
  mangaId: string;
  mangaSource?: string;
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
  hasNextChapter?: boolean;
  hasPrevChapter?: boolean;
}

function ReaderImage({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const MAX_ATTEMPTS = 4;

  const handleError = () => {
    if (attempt < MAX_ATTEMPTS - 1) {
      const delay = 500 * (attempt + 1);
      setTimeout(() => setAttempt((a) => a + 1), delay);
    } else {
      setError(true);
    }
  };

  const retryManually = () => {
    setError(false);
    setLoaded(false);
    setAttempt((a) => a + 1);
  };

  // Cache-bust on retries so browser + CDN re-fetch.
  const finalSrc = attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}_r=${attempt}`;

  return (
    <div className={`relative ${className}`}>
      {!loaded && !error && (
        <div className="flex items-center justify-center min-h-[200px] bg-surface/50">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      )}
      {error ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] bg-surface/50 gap-2">
          <ImageOff className="w-8 h-8 text-textSecondary" />
          <p className="text-xs text-textSecondary">Failed to load image</p>
          <button
            onClick={retryManually}
            className="text-xs text-accent hover:underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <img
          key={attempt}
          src={finalSrc}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={`w-full transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
          }`}
        />
      )}
    </div>
  );
}

function Reader({
  chapter,
  mangaId,
  mangaSource = '',
  onNextChapter,
  onPrevChapter,
  hasNextChapter = false,
  hasPrevChapter = false,
}: ReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [mode, setMode] = useState<ReadingMode>('longstrip');
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const navigate = useNavigate();
  const { saveProgress } = useReadingProgress();
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const pages = chapter.pages.sort((a, b) => a.pageNumber - b.pageNumber);
  const totalPages = pages.length;

  // Save progress on page change
  useEffect(() => {
    if (mangaId && chapter._id) {
      saveProgress(mangaId, chapter._id, chapter.chapterNumber, currentPage + 1);
    }
  }, [currentPage, mangaId, chapter._id, chapter.chapterNumber, saveProgress]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && mode === 'single') {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [showControls, mode]);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 0 && page < totalPages) {
        setCurrentPage(page);
      } else if (page >= totalPages && hasNextChapter) {
        onNextChapter?.();
      } else if (page < 0 && hasPrevChapter) {
        onPrevChapter?.();
      }
    },
    [totalPages, hasNextChapter, hasPrevChapter, onNextChapter, onPrevChapter]
  );

  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);
  const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (mode !== 'single') return;

      switch (e.key) {
        case 'ArrowRight':
        case 'd':
        case 'D':
          nextPage();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          prevPage();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, nextPage, prevPage]);

  // Handle fullscreen change
  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  // Click zones for single page mode
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'single') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const ratio = x / width;

    if (ratio < 0.3) {
      prevPage();
    } else if (ratio > 0.7) {
      nextPage();
    } else {
      setShowControls((prev) => !prev);
    }
  };

  const getImageUrl = (imageUrl: string) => {
    return mangaSource
      ? getProxiedImageUrl(imageUrl, mangaSource)
      : imageUrl;
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen bg-black flex flex-col"
    >
      {/* Top Controls Bar */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-gray-800 transition-transform duration-300 ${
          showControls ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 h-14">
          {/* Left: Back + Chapter info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/manga/${mangaId}`)}
              className="p-2 text-textSecondary hover:text-textPrimary transition-colors"
              aria-label="Back to manga"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-textPrimary">
                Chapter {chapter.chapterNumber}
              </p>
              {chapter.title && (
                <p className="text-xs text-textSecondary truncate max-w-[200px]">
                  {chapter.title}
                </p>
              )}
            </div>
          </div>

          {/* Center: Page counter (single mode) */}
          {mode === 'single' && (
            <div className="text-sm text-textSecondary">
              <span className="text-textPrimary font-medium">
                {currentPage + 1}
              </span>{' '}
              / {totalPages}
            </div>
          )}

          {/* Right: Controls */}
          <div className="flex items-center gap-1">
            {/* Prev Chapter */}
            <button
              onClick={onPrevChapter}
              disabled={!hasPrevChapter}
              className="p-2 text-textSecondary hover:text-textPrimary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous chapter"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Next Chapter */}
            <button
              onClick={onNextChapter}
              disabled={!hasNextChapter}
              className="p-2 text-textSecondary hover:text-textPrimary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next chapter"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-700 mx-1" />

            {/* Mode toggle */}
            <button
              onClick={() =>
                setMode((prev) => (prev === 'single' ? 'longstrip' : 'single'))
              }
              className="p-2 text-textSecondary hover:text-textPrimary transition-colors"
              title={
                mode === 'single'
                  ? 'Switch to long strip'
                  : 'Switch to single page'
              }
            >
              {mode === 'single' ? (
                <List className="w-5 h-5" />
              ) : (
                <BookOpen className="w-5 h-5" />
              )}
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-textSecondary hover:text-textPrimary transition-colors"
              title="Toggle fullscreen"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Reader Content */}
      <div
        className={`flex-1 ${showControls ? 'pt-14' : ''}`}
        onClick={mode === 'longstrip' ? () => setShowControls((p) => !p) : undefined}
      >
        {mode === 'longstrip' ? (
          /* Long Strip Mode */
          <div className="max-w-3xl mx-auto reader-longstrip">
            {pages.map((page) => (
              <ReaderImage
                key={page.pageNumber}
                src={getImageUrl(page.imageUrl)}
                alt={`Page ${page.pageNumber}`}
              />
            ))}

            {/* End of chapter */}
            <div className="flex flex-col items-center gap-4 py-12">
              <p className="text-textSecondary text-sm">
                End of Chapter {chapter.chapterNumber}
              </p>
              <div className="flex gap-3">
                {hasPrevChapter && (
                  <button
                    onClick={onPrevChapter}
                    className="flex items-center gap-2 px-4 py-2 bg-surface text-textPrimary rounded-lg hover:bg-white/10 transition-colors text-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous Chapter
                  </button>
                )}
                {hasNextChapter && (
                  <button
                    onClick={onNextChapter}
                    className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm"
                  >
                    Next Chapter
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Single Page Mode */
          <div
            className="flex items-center justify-center min-h-[calc(100vh-56px)] cursor-pointer select-none"
            onClick={handlePageClick}
          >
            {pages[currentPage] && (
              <ReaderImage
                src={getImageUrl(pages[currentPage].imageUrl)}
                alt={`Page ${currentPage + 1}`}
                className="max-h-screen"
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom page slider for single mode */}
      {mode === 'single' && showControls && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-sm border-t border-gray-800 px-4 py-3">
          <input
            type="range"
            min={0}
            max={totalPages - 1}
            value={currentPage}
            onChange={(e) => setCurrentPage(Number(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <div className="flex justify-between text-xs text-textSecondary mt-1">
            <span>1</span>
            <span>{totalPages}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reader;
