import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { Comic } from '../lib/types';
import { getThumbnailUrl } from '../lib/api';

export default function ComicCard({ comic, seriesId, hideSeries }: { comic: Comic; seriesId: string; hideSeries?: boolean }) {
  const progress = comic.pages > 0 ? Math.round((comic.currentPage / comic.pages) * 100) : 0;

  return (
    <Link
      to={`/read/${seriesId}/${comic.file}`}
      className="group block bg-surface dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-accent transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
    >
      <div className="aspect-[2/3] bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
        <img
          src={getThumbnailUrl(seriesId, comic.file, comic.thumbHash)}
          alt={comic.file}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        {comic.isRead && (
          <div className="absolute top-2 right-2 bg-success/90 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
            <Check size={12} strokeWidth={3} /> Read
          </div>
        )}
        {!comic.isRead && comic.currentPage > 0 && (
          <div className="absolute top-2 right-2 bg-accent/90 text-white text-xs px-1.5 py-0.5 rounded">
            p.{comic.currentPage + 1}/{comic.pages}
          </div>
        )}
        {!comic.isRead && comic.currentPage > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
            <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
        )}
        {comic.isRead && <div className="absolute bottom-0 left-0 right-0 h-1 bg-success" />}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium truncate">{comic.file.replace('.pdf', '')}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{comic.pages || '?'} pages</p>
      </div>
    </Link>
  );
}
