import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Library } from 'lucide-react';
import { useMangaList } from '@/hooks/useMangaQueries';
import MangaGrid from '@/components/manga/MangaGrid';
import FilterPanel from '@/components/shared/FilterPanel';
import Pagination from '@/components/shared/Pagination';

function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const genres   = searchParams.getAll('genres');
  const status   = searchParams.get('status')   || '';
  const sort     = searchParams.get('sort')     || 'popular';
  const language = searchParams.get('language') || '';
  const page     = parseInt(searchParams.get('page') || '1', 10);

  const { data, isLoading } = useMangaList({
    genres:   genres.length > 0 ? genres : undefined,
    status:   status   || undefined,
    language: language || undefined,
    sort,
    page,
    limit: 24,
  });

  const handleApplyFilters = useCallback(
    (filters: { genres: string[]; status: string; sort: string; language: string }) => {
      const params = new URLSearchParams();
      filters.genres.forEach((g) => params.append('genres', g));
      if (filters.status)   params.set('status',   filters.status);
      if (filters.sort)     params.set('sort',     filters.sort);
      if (filters.language) params.set('language', filters.language);
      params.set('page', '1');
      setSearchParams(params);
    },
    [setSearchParams]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', String(newPage));
      setSearchParams(params);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [searchParams, setSearchParams]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8"
    >
      <div className="flex items-center gap-3 mb-7">
        <span className="w-1 h-7 rounded-full bg-accent block shrink-0" />
        <h1 className="text-2xl font-bold text-textPrimary flex items-center gap-2">
          <Library className="w-6 h-6 text-accent" />
          Browse Manga
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filter Panel */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-24">
            <FilterPanel
              selectedGenres={genres}
              selectedStatus={status}
              selectedSort={sort}
              selectedLanguage={language}
              onApply={handleApplyFilters}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {data && !isLoading && (
            <p className="text-sm text-textSecondary mb-5">
              Showing{' '}
              <span className="text-textPrimary font-medium">{data.data.length}</span>{' '}
              of{' '}
              <span className="text-textPrimary font-medium">{data.total}</span> results
              {language && (
                <span>
                  {' '}·{' '}
                  <span className="text-accent font-medium">
                    {language === 'ar' ? '🇸🇦 Arabic' : language === 'en' ? '🇬🇧 English' : language}
                  </span>
                </span>
              )}
              {genres.length > 0 && (
                <span>
                  {' '}in{' '}
                  <span className="text-textPrimary">{genres.join(', ')}</span>
                </span>
              )}
            </p>
          )}

          <MangaGrid manga={data?.data || []} loading={isLoading} skeletonCount={24} />

          {data && (
            <Pagination
              currentPage={data.page}
              totalPages={data.totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default BrowsePage;
