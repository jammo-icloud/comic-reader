import { BookOpen } from 'lucide-react';
import type { MangaDexManga } from '../lib/types';

const statusColors: Record<string, string> = {
  ongoing: 'bg-green-600',
  completed: 'bg-blue-600',
  hiatus: 'bg-amber-600',
  cancelled: 'bg-red-600',
};

export default function MangaSearchCard({
  manga,
  onClick,
}: {
  manga: MangaDexManga;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left bg-white dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
    >
      {/* Cover */}
      <div className="aspect-[2/3] bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
        {manga.coverUrl ? (
          <img
            src={manga.coverUrl}
            alt={manga.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={32} className="text-gray-300 dark:text-gray-600" />
          </div>
        )}
        {/* Status badge */}
        <div className={`absolute top-2 right-2 ${statusColors[manga.status] || 'bg-gray-600'} text-white text-[10px] px-1.5 py-0.5 rounded capitalize`}>
          {manga.status}
        </div>
        {/* Content rating */}
        {manga.contentRating !== 'safe' && (
          <div className="absolute top-2 left-2 bg-red-600/80 text-white text-[10px] px-1.5 py-0.5 rounded uppercase">
            {manga.contentRating}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium truncate">{manga.title}</h3>
        {manga.year && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{manga.year}</p>
        )}
        {manga.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {manga.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
