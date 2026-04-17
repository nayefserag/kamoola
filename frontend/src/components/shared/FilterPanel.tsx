import { useState, useEffect } from 'react';
import { Filter, ChevronDown, X } from 'lucide-react';

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
  'Isekai', 'Martial Arts', 'Mystery', 'Romance', 'Sci-Fi', 'Seinen',
  'Shoujo', 'Shounen', 'Slice of Life', 'Sports', 'Supernatural',
  'Thriller', 'Tragedy',
];

const LANGUAGE_OPTIONS = [
  { value: '',   label: 'All Languages', flag: '🌐' },
  { value: 'en', label: 'English',       flag: '🇬🇧' },
  { value: 'ar', label: 'Arabic',        flag: '🇸🇦' },
];

const STATUS_OPTIONS = [
  { value: '',          label: 'All Status'  },
  { value: 'ongoing',   label: 'Ongoing'    },
  { value: 'completed', label: 'Completed'  },
  { value: 'hiatus',    label: 'Hiatus'     },
  { value: 'cancelled', label: 'Cancelled'  },
];

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular'   },
  { value: 'latest',  label: 'Latest Updates' },
  { value: 'az',      label: 'A - Z'          },
  { value: 'rating',  label: 'Highest Rated'  },
];

interface FilterPanelProps {
  selectedGenres: string[];
  selectedStatus: string;
  selectedSort: string;
  selectedLanguage: string;
  onApply: (filters: {
    genres: string[];
    status: string;
    sort: string;
    language: string;
  }) => void;
}

function FilterPanel({
  selectedGenres,
  selectedStatus,
  selectedSort,
  selectedLanguage,
  onApply,
}: FilterPanelProps) {
  const [genres,   setGenres]   = useState<string[]>(selectedGenres);
  const [status,   setStatus]   = useState(selectedStatus);
  const [sort,     setSort]     = useState(selectedSort || 'popular');
  const [language, setLanguage] = useState(selectedLanguage || '');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setGenres(selectedGenres);
    setStatus(selectedStatus);
    setSort(selectedSort || 'popular');
    setLanguage(selectedLanguage || '');
  }, [selectedGenres, selectedStatus, selectedSort, selectedLanguage]);

  const toggleGenre = (genre: string) =>
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );

  const handleApply = () => onApply({ genres, status, sort, language });

  const handleReset = () => {
    setGenres([]);
    setStatus('');
    setSort('popular');
    setLanguage('');
    onApply({ genres: [], status: '', sort: 'popular', language: '' });
  };

  const activeFilterCount =
    genres.length + (status ? 1 : 0) + (language ? 1 : 0);
  const hasFilters = activeFilterCount > 0 || sort !== 'popular';

  return (
    <div className="bg-surface rounded-xl p-4 border border-white/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-textPrimary font-semibold text-sm mb-3"
      >
        <span className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-accent" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-accent text-white text-xs px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="space-y-5">

          {/* Language */}
          <div>
            <label className="block text-xs text-textSecondary font-medium mb-2 uppercase tracking-wider">
              Language
            </label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLanguage(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    language === opt.value
                      ? 'bg-accent/15 text-accent border-accent/40'
                      : 'bg-background text-textSecondary hover:text-textPrimary border-white/5 hover:border-white/10'
                  }`}
                >
                  <span className="text-base leading-none">{opt.flag}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs text-textSecondary font-medium mb-1.5 uppercase tracking-wider">
              Sort By
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full bg-background border border-white/5 rounded-lg px-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-accent transition-colors"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
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
              className="w-full bg-background border border-white/5 rounded-lg px-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-accent transition-colors"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Genres */}
          <div>
            <label className="block text-xs text-textSecondary font-medium mb-2 uppercase tracking-wider">
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
                      : 'bg-background text-textSecondary hover:text-textPrimary hover:bg-white/8 border border-white/5'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleApply}
              className="flex-1 bg-accent hover:bg-accent/90 text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              Apply Filters
            </button>
            {hasFilters && (
              <button
                onClick={handleReset}
                className="p-2.5 text-textSecondary hover:text-textPrimary hover:bg-white/5 rounded-lg transition-colors"
                title="Reset all"
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
