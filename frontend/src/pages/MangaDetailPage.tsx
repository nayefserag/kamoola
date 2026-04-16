import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Star,
  Eye,
  User,
  Palette,
  BookOpen,
  Clock,
  ImageOff,
  Loader2,
} from 'lucide-react';
import { useMangaDetail, useMangaChapters } from '@/hooks/useMangaQueries';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import { getProxiedImageUrl } from '@/api/manga';
import ChapterList from '@/components/manga/ChapterList';
import StatusBadge from '@/components/shared/StatusBadge';
import Pagination from '@/components/shared/Pagination';

function MangaDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 shrink-0">
          <div className="aspect-[3/4] rounded-lg skeleton" />
        </div>
        <div className="flex-1 space-y-4">
          <div className="h-8 w-3/4 rounded skeleton" />
          <div className="h-4 w-1/2 rounded skeleton" />
          <div className="h-4 w-1/3 rounded skeleton" />
          <div className="h-20 w-full rounded skeleton" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-6 w-16 rounded-full skeleton" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MangaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [chapterPage, setChapterPage] = useState(1);
  const [imgError, setImgError] = useState(false);

  const { data: manga, isLoading: mangaLoading, error: mangaError } = useMangaDetail(id!);
  const { data: chaptersData, isLoading: chaptersLoading } = useMangaChapters(id!, chapterPage);
  const { getProgress } = useReadingProgress();

  const progress = id ? getProgress(id) : null;

  if (mangaLoading) return <MangaDetailSkeleton />;

  if (mangaError || !manga) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-xl font-bold text-textPrimary mb-2">Manga not found</h2>
        <p className="text-textSecondary mb-4">
          The manga you're looking for doesn't exist or has been removed.
        </p>
        <Link
          to="/browse"
          className="inline-flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors"
        >
          Browse Manga
        </Link>
      </div>
    );
  }

  const coverUrl = manga.coverImage
    ? getProxiedImageUrl(manga.coverImage, manga.source)
    : '';

  const firstChapterId =
    chaptersData?.data && chaptersData.data.length > 0
      ? [...chaptersData.data].sort((a, b) => a.chapterNumber - b.chapterNumber)[0]._id
      : null;

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return String(views);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* Cover Image */}
        <div className="w-full md:w-64 shrink-0">
          <div className="aspect-[3/4] rounded-lg overflow-hidden bg-surface">
            {!imgError && coverUrl ? (
              <img
                src={coverUrl}
                alt={manga.title}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <ImageOff className="w-12 h-12 text-textSecondary" />
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary mb-2">
            {manga.title}
          </h1>

          {manga.alternativeTitles && manga.alternativeTitles.length > 0 && (
            <p className="text-sm text-textSecondary mb-3">
              {manga.alternativeTitles.join(' / ')}
            </p>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-sm">
            <div className="flex items-center gap-1.5 text-textSecondary">
              <User className="w-4 h-4" />
              <span>
                Author:{' '}
                <span className="text-textPrimary">{manga.author}</span>
              </span>
            </div>
            {manga.artist && manga.artist !== manga.author && (
              <div className="flex items-center gap-1.5 text-textSecondary">
                <Palette className="w-4 h-4" />
                <span>
                  Artist:{' '}
                  <span className="text-textPrimary">{manga.artist}</span>
                </span>
              </div>
            )}
            <StatusBadge status={manga.status} />
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {manga.rating > 0 && (
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-medium text-textPrimary">
                  {manga.rating.toFixed(1)}
                </span>
              </div>
            )}
            {manga.views > 0 && (
              <div className="flex items-center gap-1.5 text-textSecondary">
                <Eye className="w-4 h-4" />
                <span className="text-sm">{formatViews(manga.views)} views</span>
              </div>
            )}
            {manga.latestChapter > 0 && (
              <div className="flex items-center gap-1.5 text-textSecondary">
                <BookOpen className="w-4 h-4" />
                <span className="text-sm">{manga.latestChapter} chapters</span>
              </div>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-textSecondary leading-relaxed mb-5 max-w-2xl">
            {manga.description || 'No description available.'}
          </p>

          {/* Genres */}
          {manga.genres && manga.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {manga.genres.map((genre) => (
                <Link
                  key={genre}
                  to={`/browse?genres=${encodeURIComponent(genre)}`}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-surface text-textSecondary hover:text-textPrimary hover:bg-white/10 border border-gray-700 transition-colors"
                >
                  {genre}
                </Link>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {progress ? (
              <Link
                to={`/manga/${manga._id}/read/${progress.chapterId}`}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Continue Ch. {progress.chapterNumber} - Page {progress.page}
              </Link>
            ) : firstChapterId ? (
              <Link
                to={`/manga/${manga._id}/read/${firstChapterId}`}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Start Reading
              </Link>
            ) : null}

            {progress && firstChapterId && (
              <Link
                to={`/manga/${manga._id}/read/${firstChapterId}`}
                className="inline-flex items-center gap-2 bg-surface hover:bg-white/10 text-textPrimary font-medium px-6 py-3 rounded-lg border border-gray-700 transition-colors"
              >
                Read from Chapter 1
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Chapter List */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-textPrimary flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            Chapters
          </h2>
          {chaptersData && (
            <span className="text-sm text-textSecondary">
              {chaptersData.total} chapters
            </span>
          )}
        </div>

        <div className="bg-surface rounded-lg border border-gray-800 overflow-hidden">
          {chaptersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
          ) : (
            <>
              <ChapterList
                chapters={chaptersData?.data || []}
                mangaId={manga._id}
              />
              {chaptersData && chaptersData.totalPages > 1 && (
                <div className="border-t border-gray-800 p-4">
                  <Pagination
                    currentPage={chaptersData.page}
                    totalPages={chaptersData.totalPages}
                    onPageChange={(p) => {
                      setChapterPage(p);
                      document
                        .querySelector('#chapter-list')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MangaDetailPage;
