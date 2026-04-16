import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Tag } from 'lucide-react';

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

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeGenres = searchParams.getAll('genres');

  const handleGenreClick = (genre: string) => {
    const params = new URLSearchParams(searchParams);
    const current = params.getAll('genres');

    params.delete('genres');
    if (current.includes(genre)) {
      current
        .filter((g) => g !== genre)
        .forEach((g) => params.append('genres', g));
    } else {
      [...current, genre].forEach((g) => params.append('genres', g));
    }

    params.set('page', '1');
    navigate(`/browse?${params.toString()}`);
  };

  return (
    <aside className="w-full lg:w-56 shrink-0">
      <div className="bg-surface rounded-lg p-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-between w-full text-textPrimary font-semibold text-sm mb-3"
        >
          <span className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-accent" />
            Genres
          </span>
          {collapsed ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>

        {!collapsed && (
          <div className="space-y-1">
            {GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => handleGenreClick(genre)}
                className={`block w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                  activeGenres.includes(genre)
                    ? 'bg-accent/20 text-accent font-medium'
                    : 'text-textSecondary hover:text-textPrimary hover:bg-white/5'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
