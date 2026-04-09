import { Link } from 'react-router-dom';
import { Check, Circle, ChevronRight } from 'lucide-react';
import type { Comic } from '../lib/types';
import { updateProgress } from '../lib/api';
import ProgressBar from './ProgressBar';

export default function ComicListItem({ comic, onToggleRead }: { comic: Comic; onToggleRead?: (path: string, isRead: boolean) => void }) {
  const progress =
    comic.pageCount > 0 ? Math.round((comic.currentPage / comic.pageCount) * 100) : 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newState = !comic.isRead;
    updateProgress(comic.path, { isRead: newState });
    onToggleRead?.(comic.path, newState);
  };

  return (
    <Link
      to={`/read/${comic.path}`}
      className="group flex items-center gap-4 bg-white dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent px-4 py-2.5"
    >
      {/* Read status indicator — clickable toggle */}
      <button
        onClick={handleToggle}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={comic.isRead ? 'Mark as unread' : 'Mark as read'}
      >
        {comic.isRead ? (
          <Check size={16} strokeWidth={2.5} className="text-green-500" />
        ) : comic.currentPage > 0 ? (
          <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent" />
        ) : (
          <Circle size={14} className="text-gray-300 dark:text-gray-600" />
        )}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium truncate">{comic.title}</h3>
        {comic.currentPage > 0 && !comic.isRead && (
          <ProgressBar value={progress} className="mt-1.5" />
        )}
      </div>

      {/* Right side: page info */}
      <div className="shrink-0 text-right">
        {comic.isRead ? (
          <span className="text-xs text-green-600 dark:text-green-400">{comic.pageCount} pages</span>
        ) : comic.currentPage > 0 ? (
          <span className="text-xs text-blue-600 dark:text-blue-400">p.{comic.currentPage + 1}/{comic.pageCount}</span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">{comic.pageCount} pages</span>
        )}
      </div>

      <ChevronRight
        size={16}
        className="shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors"
      />
    </Link>
  );
}
