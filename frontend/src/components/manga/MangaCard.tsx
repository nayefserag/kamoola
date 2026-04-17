import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, BookOpen, ImageOff } from 'lucide-react';
import { getProxiedImageUrl } from '@/api/manga';
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
    <Link to={`/manga/${manga._id}`} className="block group">
      <motion.div
        className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-2 cursor-pointer"
        whileHover={{ y: -6, scale: 1.03 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
      >
        {/* Cover image */}
        {!imgError && coverUrl ? (
          <>
            {!imgLoaded && <div className="absolute inset-0 skeleton" />}
            <img
              src={coverUrl}
              alt={manga.title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
            <ImageOff className="w-8 h-8 text-textSecondary opacity-40" />
          </div>
        )}

        {/* Permanent bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Hover glow ring */}
        <motion.div
          className="absolute inset-0 rounded-xl"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          style={{ boxShadow: 'inset 0 0 0 2px rgba(230,57,70,0.7)' }}
        />

        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
          {manga.latestChapter > 0 && (
            <span className="flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
              <BookOpen className="w-2.5 h-2.5" />
              {manga.latestChapter}
            </span>
          )}
          <span
            className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm ${
              manga.status === 'ongoing'
                ? 'bg-emerald-500/80 text-white'
                : manga.status === 'completed'
                ? 'bg-blue-500/80 text-white'
                : 'bg-black/60 text-textSecondary'
            }`}
          >
            {manga.status}
          </span>
        </div>

        {/* Bottom info — always visible */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {manga.rating > 0 && (
            <div className="flex items-center gap-1 mb-1.5">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-[11px] font-semibold text-yellow-300">
                {manga.rating.toFixed(1)}
              </span>
            </div>
          )}
          <h3 className="text-[13px] font-bold text-white line-clamp-2 leading-snug drop-shadow-md group-hover:text-accent transition-colors duration-200">
            {manga.title}
          </h3>
        </div>
      </motion.div>
    </Link>
  );
}

export default MangaCard;
