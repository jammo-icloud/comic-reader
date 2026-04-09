import { useState, useEffect } from 'react';
import { X, Download, Check, Loader, BookOpen } from 'lucide-react';
import type { MangaDexManga, MangaDexChapter, Shelf } from '../lib/types';
import { getShelves, startDownload } from '../lib/api';

interface ChapterPickerProps {
  manga: MangaDexManga;
  chapters: MangaDexChapter[];
  loading: boolean;
  onClose: () => void;
  onDownloadStarted?: () => void;
}

export default function ChapterPicker({ manga, chapters, loading, onClose, onDownloadStarted }: ChapterPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [shelfId, setShelfId] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getShelves().then((s) => {
      setShelves(s);
      if (s.length > 0) setShelfId(s[0].id);
    });
  }, []);

  const toggleChapter = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(chapters.map((c) => c.id)));
  const selectNone = () => setSelected(new Set());

  const handleDownload = async () => {
    if (!shelfId || selected.size === 0) return;
    setDownloading(true);
    setError('');
    try {
      const chaptersToDownload = chapters
        .filter((c) => selected.has(c.id))
        .map((c) => ({ id: c.id, chapter: c.chapter, pages: c.pages }));

      await startDownload(manga.id, manga.title, shelfId, chaptersToDownload, {
        description: manga.description,
        status: manga.status,
        year: manga.year,
        tags: manga.tags,
        contentRating: manga.contentRating,
        coverUrl: manga.coverUrl,
      });
      onDownloadStarted?.();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Download failed');
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          {manga.coverUrl && (
            <img src={manga.coverUrl} alt="" className="w-16 h-24 object-cover rounded shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold">{manga.title}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">{manga.status}</p>
            {manga.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{manga.description}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Shelf selector + selection toolbar */}
        <div className="flex items-center gap-3 px-6 py-2 border-b border-gray-100 dark:border-gray-800 text-sm shrink-0">
          {/* Shelf picker */}
          <div className="flex items-center gap-1.5">
            <BookOpen size={14} className="text-gray-400" />
            <select
              value={shelfId}
              onChange={(e) => setShelfId(e.target.value)}
              className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <span className="text-gray-300 dark:text-gray-700">|</span>

          <span className="text-gray-500 dark:text-gray-400 text-xs">
            {loading ? 'Loading...' : `${chapters.length} ch.`}
          </span>
          {!loading && chapters.length > 0 && (
            <>
              <button onClick={selectAll} className="text-blue-600 dark:text-blue-400 hover:underline text-xs">All</button>
              <button onClick={selectNone} className="text-gray-400 hover:underline text-xs">None</button>
              <span className="ml-auto text-gray-500 dark:text-gray-400 text-xs">
                {selected.size} selected
              </span>
            </>
          )}
        </div>

        {/* Chapter list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={20} className="animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => toggleChapter(ch.id)}
                  className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left transition-colors"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected.has(ch.id)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selected.has(ch.id) && <Check size={12} strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">
                      Ch. {ch.chapter || '?'}
                      {ch.title && <span className="font-normal text-gray-500 dark:text-gray-400"> — {ch.title}</span>}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{ch.pages} pg</span>
                  {ch.scanlationGroup && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0 max-w-[8rem] truncate">
                      {ch.scanlationGroup}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-800 shrink-0">
          {error && <span className="text-xs text-red-500 mr-2">{error}</span>}
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={selected.size === 0 || !shelfId || downloading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {downloading ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
            Download {selected.size} chapter{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
