import { BookOpen, Library, Check } from 'lucide-react';
import type { SearchResult } from '../lib/types';
import { getSourceConfig } from '../lib/browser-sources/registry';

const statusColors: Record<string, string> = {
  ongoing: 'bg-success',
  completed: 'bg-accent',
  hiatus: 'bg-warning',
  cancelled: 'bg-danger',
};

export default function MangaSearchCard({
  manga,
  onClick,
}: {
  manga: SearchResult;
  onClick: () => void;
}) {
  const sourceConfig = getSourceConfig(manga.sourceId);
  const sourceHex = sourceConfig?.color || '#6b7280';

  return (
    <button
      onClick={onClick}
      className="group text-left bg-surface dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 hover:ring-2 hover:ring-accent hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 relative"
    >
      {/* Source-color accent: 3px top edge. Subtle but identifiable per-source. */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ backgroundColor: sourceHex }}
      />

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

        {/* Source name — subtle bottom strip */}
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[9px] font-medium text-white bg-black/60 backdrop-blur-sm flex items-center gap-1.5">
          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sourceHex }} />
          <span className="truncate">{manga.sourceName}</span>
        </div>

        {/* Status badge */}
        {manga.status && manga.status !== 'unknown' && (
          <div className={`absolute top-2 right-2 ${statusColors[manga.status] || 'bg-gray-600'} text-white text-[10px] px-1.5 py-0.5 rounded capitalize shadow-sm`}>
            {manga.status}
          </div>
        )}

        {/* Local library match badge */}
        {manga.localSeriesId && (
          <div className={`absolute top-2 left-2 flex items-center gap-1 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-sm ${manga.inCollection ? 'bg-success/90' : 'bg-accent/90'}`}>
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
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded capitalize">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
