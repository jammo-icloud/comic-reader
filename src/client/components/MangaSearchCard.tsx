import { BookOpen, Library, Check } from 'lucide-react';
import type { SearchResult } from '../lib/types';
import { getSourceConfig } from '../lib/browser-sources/registry';

const statusColors: Record<string, string> = {
  ongoing: 'bg-green-600',
  completed: 'bg-blue-600',
  hiatus: 'bg-amber-600',
  cancelled: 'bg-red-600',
};

const colorHex: Record<string, string> = {
  'bg-orange-600': '#ea580c',
  'bg-emerald-600': '#059669',
  'bg-indigo-600': '#4f46e5',
  'bg-violet-600': '#7c3aed',
  'bg-purple-600': '#9333ea',
  'bg-sky-600': '#0284c7',
  'bg-rose-600': '#e11d48',
  'bg-blue-700': '#1d4ed8',
};

export default function MangaSearchCard({
  manga,
  onClick,
}: {
  manga: SearchResult;
  onClick: () => void;
}) {
  const sourceConfig = getSourceConfig(manga.sourceId);
  const hex = colorHex[sourceConfig?.color || ''] || '#6b7280';

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl overflow-hidden transition-all duration-200 border-2"
      style={{
        borderColor: `${hex}40`,
        backgroundColor: `${hex}08`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 8px 25px ${hex}40`;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = hex;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.borderColor = `${hex}40`;
      }}
    >
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
        {/* Source name — subtle bottom overlay */}
        <div
          className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[9px] font-medium text-white"
          style={{ backgroundColor: `${hex}cc` }}
        >
          {manga.sourceName}
        </div>
        {/* Status badge */}
        {manga.status && manga.status !== 'unknown' && (
          <div className={`absolute top-2 right-2 ${statusColors[manga.status] || 'bg-gray-600'} text-white text-[10px] px-1.5 py-0.5 rounded capitalize`}>
            {manga.status}
          </div>
        )}
        {/* Local library match badge */}
        {manga.localSeriesId && (
          <div className={`absolute top-2 left-2 flex items-center gap-1 text-white text-[9px] px-1.5 py-0.5 rounded-full ${manga.inCollection ? 'bg-green-600/90' : 'bg-blue-600/90'}`}>
            {manga.inCollection ? <><Check size={9} /> In Collection</> : <><Library size={9} /> In Library</>}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium truncate">{manga.title}</h3>
        {manga.year && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{manga.year}</p>}
        {manga.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {manga.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
