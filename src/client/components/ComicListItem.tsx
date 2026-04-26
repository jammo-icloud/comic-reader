import { Link } from 'react-router-dom';
import { Check, Circle, ChevronRight } from 'lucide-react';
import type { Comic } from '../lib/types';
import { updateProgress } from '../lib/api';
import ProgressBar from './ProgressBar';

export default function ComicListItem({ comic, seriesId, onToggleRead }: { comic: Comic; seriesId: string; onToggleRead?: (file: string, isRead: boolean) => void }) {
  const progress = comic.pages > 0 ? Math.round((comic.currentPage / comic.pages) * 100) : 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = !comic.isRead;
    updateProgress(seriesId, comic.file, { isRead: newState });
    onToggleRead?.(comic.file, newState);
  };

  return (
    <Link
      to={`/read/${seriesId}/${comic.file}`}
      className="group flex items-center gap-4 bg-surface dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-accent transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent px-4 py-2.5"
    >
      <button onClick={handleToggle} className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title={comic.isRead ? 'Mark as unread' : 'Mark as read'}>
        {comic.isRead ? (
          <Check size={16} strokeWidth={2.5} className="text-success" />
        ) : comic.currentPage > 0 ? (
          <div className="w-3 h-3 rounded-full border-2 border-accent border-t-transparent" />
        ) : (
          <Circle size={14} className="text-gray-300 dark:text-gray-600" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium truncate">{comic.file.replace('.pdf', '')}</h3>
        {comic.currentPage > 0 && !comic.isRead && <ProgressBar value={progress} className="mt-1.5" />}
      </div>

      <div className="shrink-0 text-right">
        {comic.isRead ? (
          <span className="text-xs text-success">{comic.pages || '?'} pages</span>
        ) : comic.currentPage > 0 ? (
          <span className="text-xs text-accent">p.{comic.currentPage + 1}/{comic.pages || '?'}</span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">{comic.pages || '?'} pages</span>
        )}
      </div>

      <ChevronRight size={16} className="shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
    </Link>
  );
}
