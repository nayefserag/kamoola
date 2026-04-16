import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Library } from 'lucide-react';
import { useMangaList } from '@/hooks/useMangaQueries';
import MangaGrid from '@/components/manga/MangaGrid';
import FilterPanel from '@/components/shared/FilterPanel';
import Pagination from '@/components/shared/Pagination';
import Sidebar from '@/components/layout/Sidebar';

function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const genres = searchParams.getAll('genres');
  const status = searchParams.get('status') || '';
  const sort = searchParams.get('sort') || 'popular';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const { data, isLoading } = useMangaList({
    genres: genres.length > 0 ? genres : undefined,
    status: status || undefined,
    sort,
    page,
    limit: 24,
  });

  const handleApplyFilters = useCallback(
    (filters: { genres: string[]; status: string; sort: string }) => {
      const params = new URLSearchParams();
      filters.genres.forEach((g) => params.append('genres', g));
      if (filters.status) params.set('status', filters.status);
      if (filters.sort) params.set('sort', filters.sort);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Library className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-bold text-textPrimary">Browse Manga</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filter Panel - sidebar on desktop, collapsible on mobile */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-20">
            <FilterPanel
              selectedGenres={genres}
              selectedStatus={status}
              selectedSort={sort}
              onApply={handleApplyFilters}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Results info */}
          {data && !isLoading && (
            <p className="text-sm text-textSecondary mb-4">
              Showing {data.data.length} of {data.total} results
              {genres.length > 0 && (
                <span>
                  {' '}
                  in{' '}
                  <span className="text-textPrimary">{genres.join(', ')}</span>
                </span>
              )}
            </p>
          )}

          <MangaGrid
            manga={data?.data || []}
            loading={isLoading}
            skeletonCount={24}
          />

          {data && (
            <Pagination
              currentPage={data.page}
              totalPages={data.totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default BrowsePage;
