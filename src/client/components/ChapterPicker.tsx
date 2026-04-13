import { useState } from 'react';
import { X, Download, Check, Loader } from 'lucide-react';
import type { MangaDexManga, MangaDexChapter } from '../lib/types';
import { startDownload } from '../lib/api';

interface ChapterPickerProps {
  manga: MangaDexManga;
  chapters: MangaDexChapter[];
  loading: boolean;
  localChapterNums?: Set<string>;
  onClose: () => void;
  onDownloadStarted?: () => void;
}

export default function ChapterPicker({ manga, chapters, loading, localChapterNums, onClose, onDownloadStarted }: ChapterPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const isLocal = (ch: MangaDexChapter) => localChapterNums?.has(ch.chapter || '') ?? false;
  const newChapters = chapters.filter((c) => !isLocal(c));
  const localCount = chapters.length - newChapters.length;

  const toggleChapter = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const selectAll = () => setSelected(new Set(newChapters.map((c) => c.chapterId)));
  const selectNew = () => setSelected(new Set(newChapters.map((c) => c.chapterId)));
  const selectNone = () => setSelected(new Set());

  const handleDownload = async () => {
    if (selected.size === 0) return;
    setDownloading(true);
    setError('');
    try {
      const chaptersToDownload = chapters
        .filter((c) => selected.has(c.chapterId))
        .map((c) => ({ id: c.chapterId, chapter: c.chapter, pages: c.pages }));

      // No shelf — downloads go to /library/comics/ automatically
      await startDownload(manga.mangaId, manga.title, 'default', chaptersToDownload, {
        description: manga.description,
        status: manga.status,
        year: manga.year,
        tags: manga.tags,
        contentRating: manga.status,
        coverUrl: manga.coverUrl,
        sourceId: manga.sourceId,
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
          {manga.coverUrl && <img src={manga.coverUrl} alt="" className="w-16 h-24 object-cover rounded shrink-0" />}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold">{manga.title}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">{manga.status}</p>
            {manga.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{manga.description}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 shrink-0"><X size={18} /></button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-2 border-b border-gray-100 dark:border-gray-800 text-sm shrink-0">
          <span className="text-gray-500 dark:text-gray-400 text-xs">
            {loading ? 'Loading...' : localCount > 0 ? `${chapters.length} ch. (${localCount} downloaded, ${newChapters.length} new)` : `${chapters.length} ch.`}
          </span>
          {!loading && chapters.length > 0 && (
            <>
              {newChapters.length > 0 && newChapters.length < chapters.length && (
                <button onClick={selectNew} className="text-green-600 dark:text-green-400 hover:underline text-xs">New only</button>
              )}
              <button onClick={selectAll} className="text-blue-600 dark:text-blue-400 hover:underline text-xs">All</button>
              <button onClick={selectNone} className="text-gray-400 hover:underline text-xs">None</button>
              <span className="ml-auto text-gray-500 dark:text-gray-400 text-xs">{selected.size} selected</span>
            </>
          )}
        </div>

        {/* Chapter list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader size={20} className="animate-spin text-blue-500" /></div>
          ) : chapters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">No downloadable chapters available</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 max-w-sm">
                This title may have been removed due to licensing restrictions. Try searching on other sources like MangaFox, or use the Manga Finder extension for more options.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {chapters.map((ch) => {
                const downloaded = isLocal(ch);
                return (
                  <button
                    key={ch.chapterId}
                    onClick={() => !downloaded && toggleChapter(ch.chapterId)}
                    className={`w-full flex items-center gap-3 px-6 py-2.5 text-left transition-colors ${
                      downloaded
                        ? 'opacity-40 cursor-default'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      downloaded
                        ? 'bg-green-600 border-green-600 text-white'
                        : selected.has(ch.chapterId)
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {(downloaded || selected.has(ch.chapterId)) && <Check size={12} strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">
                        Ch. {ch.chapter || '?'}
                        {ch.title && <span className="font-normal text-gray-500 dark:text-gray-400"> — {ch.title}</span>}
                      </span>
                    </div>
                    {downloaded ? (
                      <span className="text-[10px] text-green-600 dark:text-green-400 shrink-0">Downloaded</span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{ch.pages} pg</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-800 shrink-0">
          {error && <span className="text-xs text-red-500 mr-2">{error}</span>}
          <button onClick={onClose} className="text-sm text-gray-500">Cancel</button>
          <button onClick={handleDownload} disabled={selected.size === 0 || downloading} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
            {downloading ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
            Download {selected.size} chapter{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
