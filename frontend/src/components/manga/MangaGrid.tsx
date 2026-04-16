import MangaCard from './MangaCard';
import SkeletonCard from '@/components/shared/SkeletonCard';
import type { Manga } from '@/types/manga';

interface MangaGridProps {
  manga: Manga[];
  loading: boolean;
  skeletonCount?: number;
}

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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
      {manga.map((item) => (
        <MangaCard key={item._id} manga={item} />
      ))}
    </div>
  );
}

export default MangaGrid;
