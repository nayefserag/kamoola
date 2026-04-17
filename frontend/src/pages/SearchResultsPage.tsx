import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, BookOpen } from 'lucide-react';
import { useSearchManga } from '@/hooks/useMangaQueries';
import MangaGrid from '@/components/manga/MangaGrid';
import Pagination from '@/components/shared/Pagination';
import SearchBar from '@/components/shared/SearchBar';

function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const { data, isLoading } = useSearchManga(query, page);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8"
    >
      {/* Search header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold text-textPrimary">
            Search Results
          </h1>
        </div>

        {/* Show search bar on this page too */}
        <div className="max-w-md">
          <SearchBar />
        </div>

        {query && (
          <p className="mt-4 text-sm text-textSecondary">
            {isLoading ? (
              'Searching...'
            ) : data ? (
              <>
                Found{' '}
                <span className="text-textPrimary font-medium">
                  {data.total}
                </span>{' '}
                results for{' '}
                <span className="text-accent font-medium">"{query}"</span>
              </>
            ) : (
              <>
                Showing results for{' '}
                <span className="text-accent font-medium">"{query}"</span>
              </>
            )}
          </p>
        )}
      </div>

      {/* No query state */}
      {!query && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-textSecondary mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-medium text-textPrimary mb-2">
            Search for Manga
          </h2>
          <p className="text-textSecondary text-sm max-w-sm mx-auto">
            Enter a title, author, or genre in the search bar above to find
            manga.
          </p>
        </div>
      )}

      {/* No results state */}
      {query && !isLoading && data && data.data.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-textSecondary mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-medium text-textPrimary mb-2">
            No results found
          </h2>
          <p className="text-textSecondary text-sm max-w-sm mx-auto mb-6">
            We couldn't find any manga matching "{query}". Try a different
            search term.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <p className="text-xs text-textSecondary w-full mb-2">
              Suggestions:
            </p>
            {['Action', 'Romance', 'Fantasy', 'Shounen', 'Comedy'].map(
              (suggestion) => (
                <a
                  key={suggestion}
                  href={`/search?q=${encodeURIComponent(suggestion)}`}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface text-textSecondary hover:text-textPrimary hover:bg-white/10 border border-gray-700 transition-colors"
                >
                  {suggestion}
                </a>
              )
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {query && (
        <>
          <MangaGrid
            manga={data?.data || []}
            loading={isLoading}
            skeletonCount={24}
          />

          {data && data.totalPages > 1 && (
            <Pagination
              currentPage={data.page}
              totalPages={data.totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </motion.div>
  );
}

export default SearchResultsPage;
