import { Link } from 'react-router-dom';
import { BookOpen, Clock } from 'lucide-react';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import type { Chapter } from '@/types/manga';

interface ChapterListProps {
  chapters: Chapter[];
  mangaId: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString();
}

function ChapterList({ chapters, mangaId }: ChapterListProps) {
  const { getProgress } = useReadingProgress();
  const progress = getProgress(mangaId);

  const sorted = [...chapters].sort(
    (a, b) => b.chapterNumber - a.chapterNumber
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-textSecondary">
        <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No chapters available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sorted.map((chapter) => {
        const isCurrentChapter = progress?.chapterId === chapter._id;

        return (
          <Link
            key={chapter._id}
            to={`/manga/${mangaId}/read/${chapter._id}`}
            className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors group ${
              isCurrentChapter
                ? 'bg-accent/10 border border-accent/30'
                : 'hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`text-sm font-medium shrink-0 ${
                  isCurrentChapter ? 'text-accent' : 'text-textPrimary'
                }`}
              >
                Ch. {chapter.chapterNumber}
              </span>
              {chapter.title && (
                <span className="text-sm text-textSecondary truncate">
                  {chapter.title}
                </span>
              )}
              {isCurrentChapter && (
                <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-medium shrink-0">
                  Reading - Page {progress.page}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-textSecondary shrink-0 ml-2">
              <Clock className="w-3 h-3" />
              <span>{formatDate(chapter.publishedAt || chapter.createdAt)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default ChapterList;
