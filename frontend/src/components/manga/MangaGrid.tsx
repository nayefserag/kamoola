import { motion, type Variants } from 'framer-motion';
import MangaCard from './MangaCard';
import SkeletonCard from '@/components/shared/SkeletonCard';
import type { Manga } from '@/types/manga';

interface MangaGridProps {
  manga: Manga[];
  loading: boolean;
  skeletonCount?: number;
}

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

function MangaGrid({ manga, loading, skeletonCount = 18 }: MangaGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!manga || manga.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-textSecondary text-lg">No manga found</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5"
    >
      {manga.map((m) => (
        <motion.div key={m._id} variants={item}>
          <MangaCard manga={m} />
        </motion.div>
      ))}
    </motion.div>
  );
}

export default MangaGrid;
