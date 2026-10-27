import { useState, useId, useEffect } from 'react';
import { X, Download, Check, Loader, ExternalLink, BookOpen, Star } from 'lucide-react';
import type { SearchResult, ChapterResult } from '../lib/types';
import { startDownload, getMangaSourceUrl } from '../lib/api';
import { getSourceConfig } from '../lib/browser-sources/registry';
import { useEscapeKey } from '../lib/useEscapeKey';
import { StatusPill } from './ds/Badge';
import type { SeriesStatus } from './ds/Badge';

function cleanDescription(raw: string): string {
  let s = raw;
  // Block-level tags → newlines
  s = s.replace(/<\s*\/?\s*(p|br|div|li|h[1-6])\b[^>]*\/?>/gi, '\n');
  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, '');
  // Decode named entities
  s = s.replace(/&nbsp;/gi, ' ');
  s = s.replace(/&amp;/gi, '&');
  s = s.replace(/&lt;/gi, '<');
  s = s.replace(/&gt;/gi, '>');
  s = s.replace(/&quot;/gi, '"');
  s = s.replace(/&apos;/gi, "'");
  s = s.replace(/&mdash;/gi, '—');
  s = s.replace(/&ndash;/gi, '–');
  s = s.replace(/&hellip;/gi, '…');
  s = s.replace(/&lsquo;|&rsquo;/gi, "'");
  s = s.replace(/&ldquo;|&rdquo;/gi, '"');
  // Numeric + hex entities
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  // Collapse whitespace
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n[ \t]+/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

interface MangaDetailSheetProps {
  manga: SearchResult;
  chapters: ChapterResult[];
  loading: boolean;
  localChapterNums: Set<string>;
  onClose: () => void;
}

export default function MangaDetailSheet({
  manga, chapters, loading, localChapterNums, onClose,
}: MangaDetailSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [expandSynopsis, setExpandSynopsis] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  const sourceConfig = getSourceConfig(manga.sourceId);
  const sourceHex = sourceConfig?.color || '#6b7280';

  const isLocal = (ch: ChapterResult) => localChapterNums.has(ch.chapter || '');
  const newChapters = chapters.filter((c) => !isLocal(c));
  const localCount = chapters.length - newChapters.length;

  const toggleChapter = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(newChapters.map((c) => c.chapterId)));
  const selectNew = () => setSelected(new Set(newChapters.map((c) => c.chapterId)));
  const selectNone = () => setSelected(new Set());

  useEffect(() => {
    let cancelled = false;
    getMangaSourceUrl(manga.sourceId, manga.mangaId)
      .then(({ url }) => { if (!cancelled) setSourceUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [manga.sourceId, manga.mangaId]);

  const handleDownload = async () => {
    if (selected.size === 0) return;
    setDownloading(true);
    setError('');
    try {
      const chaptersToDownload = chapters
        .filter((c) => selected.has(c.chapterId))
        .map((c) => ({ id: c.chapterId, chapter: c.chapter, pages: c.pages }));
      await startDownload(manga.mangaId, manga.title, 'default', chaptersToDownload, {
        description: manga.description,
        status: manga.status,
        year: manga.year,
        tags: manga.tags,
        contentRating: manga.status,
        coverUrl: manga.coverUrl,
        sourceId: manga.sourceId,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Download failed');
      setDownloading(false);
    }
  };

  const titleId = useId();
  useEscapeKey(onClose);

  const hasCover = !!manga.coverUrl;
  const coverSrc = manga.coverUrl || '';
  const validStatus = ['ongoing', 'completed', 'hiatus', 'cancelled'].includes(manga.status);
  const description = manga.description ? cleanDescription(manga.description) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full sm:max-w-3xl bg-surface dark:bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
        style={{
          maxHeight: '95dvh',
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Mobile handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        </div>

        {/* ===== Hero — SeriesPage style ===== */}
        <header className="relative shrink-0">
          {/* Blurred backdrop */}
          {hasCover && (
            <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
              <img
                src={coverSrc}
                alt=""
                aria-hidden="true"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'blur(28px) brightness(0.55) saturate(1.2)',
                  transform: 'scale(1.2)',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to bottom, rgb(0 0 0 / 0.15) 0%, rgb(0 0 0 / 0.35) 50%, rgb(0 0 0 / 0.75) 100%)',
                }}
              />
            </div>
          )}
          {!hasCover && (
            <div
              className="absolute inset-0"
              style={{ zIndex: 0, background: 'linear-gradient(135deg, var(--bg-subtle) 0%, var(--surface-card) 100%)' }}
            />
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 p-2 rounded-full"
            style={{
              zIndex: 2,
              background: 'rgb(0 0 0 / 0.5)',
              backdropFilter: 'blur(12px)',
              color: '#fff',
            }}
          >
            <X size={18} />
          </button>

          {/* Hero content — above the backdrop */}
          <div className="relative px-5 sm:px-6 pt-4 sm:pt-6 pb-5" style={{ zIndex: 1 }}>
            <div className="flex gap-4 sm:gap-5 items-start">
              {/* Cover — large and prominent */}
              <div
                className="w-28 sm:w-36 md:w-44 shrink-0 overflow-hidden"
                style={{ borderRadius: 12, boxShadow: '0 8px 32px rgb(0 0 0 / 0.4)' }}
              >
                {hasCover ? (
                  <img
                    src={coverSrc}
                    alt={manga.title}
                    className="w-full aspect-[2/3] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                    <BookOpen size={36} className="text-gray-400 dark:text-gray-600" />
                  </div>
                )}
              </div>

              {/* Title + meta */}
              <div className="flex-1 min-w-0" style={{ color: hasCover ? '#fff' : 'var(--text-body)' }}>
                <h2
                  id={titleId}
                  className="text-lg sm:text-xl md:text-2xl font-bold leading-tight break-words"
                  style={hasCover ? { textShadow: '0 2px 10px rgb(0 0 0 / 0.5)' } : undefined}
                >
                  {manga.title}
                </h2>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm" style={{ opacity: 0.92 }}>
                  {validStatus && (
                    <StatusPill status={manga.status as SeriesStatus} />
                  )}
                  {manga.year && (
                    <span className="font-medium tabular-nums">{manga.year}</span>
                  )}
                  {!loading && chapters.length > 0 && (
                    <span className="tabular-nums">{chapters.length} ch{chapters.length !== 1 ? 's' : ''}</span>
                  )}
                </div>

                {/* Source badge */}
                <div className="flex items-center gap-2 mt-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      background: hasCover ? 'rgb(255 255 255 / 0.15)' : `${sourceHex}15`,
                      color: hasCover ? '#fff' : sourceHex,
                      backdropFilter: hasCover ? 'blur(8px)' : undefined,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: sourceHex }}
                    />
                    {manga.sourceName}
                  </span>
                  {sourceUrl && (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                      style={{
                        color: hasCover ? 'rgb(255 255 255 / 0.7)' : 'var(--text-tertiary)',
                      }}
                    >
                      View on site <ExternalLink size={11} />
                    </a>
                  )}
                </div>

                {/* Library match indicator */}
                {manga.localSeriesId && (
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                      manga.inCollection
                        ? 'bg-success/20 text-success'
                        : 'bg-accent/20 text-accent'
                    }`}>
                      <Check size={11} strokeWidth={3} />
                      {manga.inCollection ? 'In your collection' : 'In server library'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {loading && !manga.description && (
              <div className="mt-4 space-y-2 animate-pulse">
                <div className="h-3 rounded bg-white/10 w-full" />
                <div className="h-3 rounded bg-white/10 w-5/6" />
                <div className="h-3 rounded bg-white/10 w-2/3" />
              </div>
            )}
            {description && (
              <div className="mt-4">
                <p
                  className={`text-sm leading-relaxed whitespace-pre-line ${expandSynopsis ? '' : 'line-clamp-3'}`}
                  style={{ color: hasCover ? 'rgb(255 255 255 / 0.85)' : 'var(--text-secondary)' }}
                >
                  {description}
                </p>
                {description.length > 150 && (
                  <button
                    onClick={() => setExpandSynopsis((v) => !v)}
                    className="text-xs font-medium mt-1 hover:underline"
                    style={{ color: hasCover ? 'rgb(255 255 255 / 0.6)' : 'var(--color-accent)' }}
                  >
                    {expandSynopsis ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}

            {/* Tags */}
            {loading && (!manga.tags || manga.tags.length === 0) && (
              <div className="flex gap-1.5 mt-3 animate-pulse">
                {[80, 60, 70, 50].map((w, i) => (
                  <div key={i} className="h-5 rounded-full bg-white/10" style={{ width: w }} />
                ))}
              </div>
            )}
            {manga.tags && manga.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {manga.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-0.5 rounded-full capitalize"
                    style={{
                      background: hasCover ? 'rgb(255 255 255 / 0.12)' : 'var(--bg-subtle)',
                      color: hasCover ? 'rgb(255 255 255 / 0.8)' : 'var(--text-secondary)',
                      backdropFilter: hasCover ? 'blur(4px)' : undefined,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* ===== Chapter toolbar ===== */}
        <div className="flex items-center gap-3 px-5 sm:px-6 py-2.5 border-b border-gray-200 dark:border-gray-800 text-sm shrink-0 bg-surface dark:bg-gray-900">
          <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">
            {loading ? 'Loading chapters…' : localCount > 0 ? `${chapters.length} chapters (${localCount} downloaded, ${newChapters.length} new)` : `${chapters.length} chapters`}
          </span>
          {!loading && chapters.length > 0 && (
            <>
              {newChapters.length > 0 && newChapters.length < chapters.length && (
                <button onClick={selectNew} className="text-success hover:underline text-xs">New only</button>
              )}
              <button onClick={selectAll} className="text-accent hover:underline text-xs">All</button>
              <button onClick={selectNone} className="text-gray-400 hover:underline text-xs">None</button>
              <span className="ml-auto text-gray-500 dark:text-gray-400 text-xs tabular-nums">{selected.size} selected</span>
            </>
          )}
        </div>

        {/* ===== Chapter list ===== */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={20} className="animate-spin text-accent" />
            </div>
          ) : chapters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">No downloadable chapters available</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 max-w-sm">
                This title may have been removed or isn't available for download from this source.
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
                    className={`w-full flex items-center gap-3 px-5 sm:px-6 py-2.5 text-left transition-colors ${
                      downloaded
                        ? 'opacity-40 cursor-default'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      downloaded
                        ? 'bg-success border-success text-white'
                        : selected.has(ch.chapterId)
                          ? 'bg-accent border-accent text-white'
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
                    {ch.scanlationGroup && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 hidden sm:inline">{ch.scanlationGroup}</span>
                    )}
                    {downloaded ? (
                      <span className="text-[10px] text-success shrink-0">Downloaded</span>
                    ) : (
                      ch.pages > 0 && <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">{ch.pages} pg</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== Download footer ===== */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-800 shrink-0 bg-surface dark:bg-gray-900">
          {error && <span className="text-xs text-danger mr-2 flex-1">{error}</span>}
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={selected.size === 0 || downloading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {downloading ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
            Download {selected.size} chapter{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
