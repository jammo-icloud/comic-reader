import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, List, Star, Pencil } from 'lucide-react';
import type { Comic, Series } from '../lib/types';
import { getComics, getSeries, getSeriesCoverUrl, getPlaceholderUrl, overrideMalId } from '../lib/api';
import ComicCard from '../components/ComicCard';
import ComicListItem from '../components/ComicListItem';
import ThemeToggle from '../components/ThemeToggle';
import OfflineButton from '../components/OfflineButton';
import SummarizeButton from '../components/SummarizeButton';

type ViewMode = 'grid' | 'list';

export default function SeriesPage() {
  const { name } = useParams<{ name: string }>();
  const [comics, setComics] = useState<Comic[]>([]);
  const [seriesInfo, setSeriesInfo] = useState<Series | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [malIdInput, setMalIdInput] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [aiSynopsis, setAiSynopsis] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('comic-reader-series-view') as ViewMode) || 'list';
  });

  const seriesName = name ? decodeURIComponent(name) : '';

  useEffect(() => {
    if (!seriesName) return;
    getComics({ series: seriesName, sort: 'series' }).then(setComics);
    getSeries().then((all) => {
      const found = all.find((s) => s.name === seriesName);
      if (found) setSeriesInfo(found);
    });
  }, [seriesName]);

  useEffect(() => {
    localStorage.setItem('comic-reader-series-view', viewMode);
  }, [viewMode]);

  // Compute chapter range from filenames
  const chapterRange = useMemo(() => {
    if (comics.length === 0) return null;
    const orders = comics.map((c) => c.seriesOrder).filter((n) => n > 0).sort((a, b) => a - b);
    if (orders.length === 0) return null;
    const min = orders[0];
    const max = orders[orders.length - 1];
    // Format: remove trailing .0
    const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);
    return min === max ? `Ch. ${fmt(min)}` : `Ch. ${fmt(min)} – ${fmt(max)}`;
  }, [comics]);

  const handleToggleRead = (path: string, isRead: boolean) => {
    setComics((prev) => prev.map((c) => c.path === path ? { ...c, isRead } : c));
  };

  const readCount = comics.filter((c) => c.isRead).length;
  const inProgress = comics.filter((c) => c.currentPage > 0 && !c.isRead).length;

  const handleOverrideSubmit = async () => {
    const malId = parseInt(malIdInput.trim(), 10);
    if (isNaN(malId)) return;
    setOverriding(true);
    try {
      await overrideMalId(seriesName, malId);
      const all = await getSeries();
      const found = all.find((s) => s.name === seriesName);
      if (found) setSeriesInfo(found);
      setShowOverride(false);
      setMalIdInput('');
    } finally {
      setOverriding(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Fixed top: header + hero */}
      <div className="shrink-0">
        {/* Slim header */}
        <header className="bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <Link to="/" className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">
              <ArrowLeft size={16} /> Library
            </Link>
            <div className="flex-1" />
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-l transition-colors ${viewMode === 'grid' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                title="Grid view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-r transition-colors ${viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                title="List view"
              >
                <List size={16} />
              </button>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Series hero — cover + info */}
        <section className="max-w-5xl mx-auto px-6 py-5 flex gap-6 items-start">
          {/* Cover art */}
          <div className="w-36 sm:w-44 shrink-0 rounded-lg overflow-hidden shadow-lg">
            <img
              src={seriesInfo?.hasCover ? getSeriesCoverUrl(seriesName) : getPlaceholderUrl(seriesInfo?.placeholder || 'manga.png')}
              alt={seriesName}
              className={`w-full aspect-[2/3] object-cover ${seriesInfo?.hasCover ? '' : 'opacity-60'}`}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{seriesName}</h1>

            <div className="flex items-center gap-2 mt-1">
              {seriesInfo?.malTitle && seriesInfo.malTitle !== seriesName && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  {seriesInfo.malTitle}
                </p>
              )}
              {!showOverride ? (
                <button
                  onClick={() => setShowOverride(true)}
                  className="text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  title="Change MAL match"
                >
                  <Pencil size={13} />
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={malIdInput}
                    onChange={(e) => setMalIdInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleOverrideSubmit()}
                    placeholder="MAL ID"
                    autoFocus
                    className="w-24 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleOverrideSubmit}
                    disabled={overriding || !malIdInput.trim()}
                    className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
                  >
                    {overriding ? '...' : 'Go'}
                  </button>
                  <button
                    onClick={() => { setShowOverride(false); setMalIdInput(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {seriesInfo?.score && (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                  <Star size={14} fill="currentColor" />
                  {seriesInfo.score.toFixed(1)}
                </span>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {comics.length} chapter{comics.length !== 1 ? 's' : ''}
              </span>
              {chapterRange && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {chapterRange}
                </span>
              )}
              {seriesInfo?.year && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {seriesInfo.year}
                </span>
              )}
              {seriesInfo?.status && (
                <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                  seriesInfo.status === 'completed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                  seriesInfo.status === 'ongoing' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                  seriesInfo.status === 'hiatus' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                  'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {seriesInfo.status}
                </span>
              )}
              {readCount > 0 && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  {readCount} read
                </span>
              )}
              {inProgress > 0 && (
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  {inProgress} in progress
                </span>
              )}
              <OfflineButton comics={comics} label={`Save all ${comics.length} offline`} />
            </div>

            {/* Tags */}
            {seriesInfo?.tags && seriesInfo.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {seriesInfo.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Synopsis — from MAL/MangaDex or AI-generated */}
            {(seriesInfo?.synopsis || aiSynopsis) ? (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-5">
                {seriesInfo?.synopsis || aiSynopsis}
              </p>
            ) : comics.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <SummarizeButton
                  comicKey={comics[0].path}
                  genre="manga"
                  onSummary={(s) => setAiSynopsis(s)}
                  size={16}
                />
                <span className="text-xs text-gray-400 dark:text-gray-500">Generate AI summary</span>
              </div>
            )}

            {/* Source link */}
            {seriesInfo?.mangaDexId && (
              <a
                href={`https://mangadex.org/title/${seriesInfo.mangaDexId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                Source: MangaDex &rarr;
              </a>
            )}
          </div>
        </section>

        {/* Divider */}
        <hr className="border-gray-200 dark:border-gray-800 max-w-5xl mx-auto" />
      </div>

      {/* Scrollable chapters area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Chapters
          </h2>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-6">
              {comics.map((comic) => (
                <ComicCard key={comic.path} comic={comic} hideSeries />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 pb-6">
              {comics.map((comic) => (
                <ComicListItem key={comic.path} comic={comic} onToggleRead={handleToggleRead} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
