import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ImageOff } from 'lucide-react';
import { getProxiedImageUrl } from '@/api/manga';
import StatusBadge from '@/components/shared/StatusBadge';
import type { Manga } from '@/types/manga';

interface MangaCardProps {
  manga: Manga;
}

function MangaCard({ manga }: MangaCardProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const coverUrl = manga.coverImage
    ? getProxiedImageUrl(manga.coverImage, manga.source)
    : '';

  return (
    <Link
      to={`/manga/${manga._id}`}
      className="group flex flex-col gap-2 cursor-pointer"
    >
      {/* Cover Image */}
      <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface">
        {!imgError && coverUrl ? (
          <>
            {!imgLoaded && <div className="absolute inset-0 skeleton" />}
            <img
              src={coverUrl}
              alt={manga.title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full bg-surface">
            <ImageOff className="w-8 h-8 text-textSecondary" />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Latest chapter badge */}
        {manga.latestChapter > 0 && (
          <div className="absolute top-2 left-2 bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            Ch. {manga.latestChapter}
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <StatusBadge status={manga.status} />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-textPrimary line-clamp-2 group-hover:text-accent transition-colors leading-tight">
        {manga.title}
      </h3>

      {/* Rating */}
      {manga.rating > 0 && (
        <div className="flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-xs text-textSecondary">
            {manga.rating.toFixed(1)}
          </span>
        </div>
      )}
    </Link>
  );
}

export default MangaCard;
