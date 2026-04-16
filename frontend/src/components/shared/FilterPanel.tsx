import { useState, useEffect } from 'react';
import { Filter, ChevronDown, X } from 'lucide-react';

const GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Isekai',
  'Martial Arts',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Seinen',
  'Shoujo',
  'Shounen',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
  'Tragedy',
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'hiatus', label: 'Hiatus' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'latest', label: 'Latest Updates' },
  { value: 'az', label: 'A - Z' },
  { value: 'rating', label: 'Highest Rated' },
];

interface FilterPanelProps {
  selectedGenres: string[];
  selectedStatus: string;
  selectedSort: string;
  onApply: (filters: {
    genres: string[];
    status: string;
    sort: string;
  }) => void;
}

function FilterPanel({
  selectedGenres,
  selectedStatus,
  selectedSort,
  onApply,
}: FilterPanelProps) {
  const [genres, setGenres] = useState<string[]>(selectedGenres);
  const [status, setStatus] = useState(selectedStatus);
  const [sort, setSort] = useState(selectedSort || 'popular');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setGenres(selectedGenres);
    setStatus(selectedStatus);
    setSort(selectedSort || 'popular');
  }, [selectedGenres, selectedStatus, selectedSort]);

  const toggleGenre = (genre: string) => {
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleApply = () => {
    onApply({ genres, status, sort });
  };

  const handleReset = () => {
    setGenres([]);
    setStatus('');
    setSort('popular');
    onApply({ genres: [], status: '', sort: 'popular' });
  };

  const hasFilters = genres.length > 0 || status !== '' || sort !== 'popular';

  return (
    <div className="bg-surface rounded-lg p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-textPrimary font-semibold text-sm mb-3"
      >
        <span className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-accent" />
          Filters
          {hasFilters && (
            <span className="bg-accent text-white text-xs px-1.5 py-0.5 rounded-full">
              {genres.length + (status ? 1 : 0)}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="space-y-4">
          {/* Sort */}
          <div>
            <label className="block text-xs text-textSecondary font-medium mb-1.5 uppercase tracking-wider">
              Sort By
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full bg-background border border-gray-700 rounded-lg px-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-accent"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-textSecondary font-medium mb-1.5 uppercase tracking-wider">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-background border border-gray-700 rounded-lg px-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-accent"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Genres */}
          <div>
            <label className="block text-xs text-textSecondary font-medium mb-1.5 uppercase tracking-wider">
              Genres
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    genres.includes(genre)
                      ? 'bg-accent text-white'
                      : 'bg-background text-textSecondary hover:text-textPrimary hover:bg-white/10'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleApply}
              className="flex-1 bg-accent hover:bg-accent/90 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Apply Filters
            </button>
            {hasFilters && (
              <button
                onClick={handleReset}
                className="p-2 text-textSecondary hover:text-textPrimary hover:bg-white/5 rounded-lg transition-colors"
                title="Reset filters"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterPanel;
