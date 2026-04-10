import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, List, Star, Pencil } from 'lucide-react';
import type { Series, Comic } from '../lib/types';
import { getSeriesDetail, getComics, getSeriesCoverUrl, getPlaceholderUrl, overrideMalId, getThumbnailUrl } from '../lib/api';
import ComicCard from '../components/ComicCard';
import ComicListItem from '../components/ComicListItem';
import ThemeToggle from '../components/ThemeToggle';
import OfflineButton from '../components/OfflineButton';
import SummarizeButton from '../components/SummarizeButton';

type ViewMode = 'grid' | 'list';

export default function SeriesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [series, setSeries] = useState<Series | null>(null);
  const [comics, setComics] = useState<Comic[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('comic-reader-series-view') as ViewMode) || 'list'
  );

  // MAL override
  const [showOverride, setShowOverride] = useState(false);
  const [malIdInput, setMalIdInput] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [aiSynopsis, setAiSynopsis] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getSeriesDetail(id).then(setSeries);
    getComics(id).then(setComics);
  }, [id]);

  useEffect(() => {
    localStorage.setItem('comic-reader-series-view', viewMode);
  }, [viewMode]);

  const handleOverrideSubmit = async () => {
    if (!id) return;
    const malId = parseInt(malIdInput.trim(), 10);
    if (isNaN(malId)) return;
    setOverriding(true);
    try {
      await overrideMalId(id, malId);
      const updated = await getSeriesDetail(id);
      setSeries(updated);
      setShowOverride(false);
      setMalIdInput('');
    } finally {
      setOverriding(false);
    }
  };

  const handleToggleRead = (file: string, isRead: boolean) => {
    setComics((prev) => prev.map((c) => c.file === file ? { ...c, isRead } : c));
  };

  const chapterRange = useMemo(() => {
    if (comics.length === 0) return null;
    const orders = comics.map((c) => c.order).filter((n) => n > 0).sort((a, b) => a - b);
    if (orders.length === 0) return null;
    const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);
    const min = orders[0], max = orders[orders.length - 1];
    return min === max ? `Ch. ${fmt(min)}` : `Ch. ${fmt(min)} – ${fmt(max)}`;
  }, [comics]);

  const readCount = comics.filter((c) => c.isRead).length;
  const inProgress = comics.filter((c) => c.currentPage > 0 && !c.isRead).length;

  if (!series || !id) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <div className="shrink-0">
        <header className="bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <Link to="/" className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm">
              <ArrowLeft size={16} /> Library
            </Link>
            <div className="flex-1" />
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-l transition-colors ${viewMode === 'grid' ? 'bg-gray-200 dark:bg-gray-700' : ''}`} title="Grid view">
                <LayoutGrid size={16} />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-r transition-colors ${viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-700' : ''}`} title="List view">
                <List size={16} />
              </button>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <section className="max-w-5xl mx-auto px-6 py-5 flex gap-6 items-start">
          <div className="w-36 sm:w-44 shrink-0 rounded-lg overflow-hidden shadow-lg">
            <img
              src={series.coverFile ? getSeriesCoverUrl(id) : getPlaceholderUrl(series.placeholder)}
              alt={series.name}
              className={`w-full aspect-[2/3] object-cover ${series.coverFile ? '' : 'opacity-60'}`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{series.name}</h1>

            <div className="flex items-center gap-2 mt-1">
              {!showOverride ? (
                <button onClick={() => setShowOverride(true)} className="text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" title="Change MAL match">
                  <Pencil size={13} />
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input type="number" value={malIdInput} onChange={(e) => setMalIdInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleOverrideSubmit()} placeholder="MAL ID" autoFocus className="w-24 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <button onClick={handleOverrideSubmit} disabled={overriding || !malIdInput.trim()} className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded disabled:opacity-50">{overriding ? '...' : 'Go'}</button>
                  <button onClick={() => { setShowOverride(false); setMalIdInput(''); }} className="text-xs text-gray-400">Cancel</button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-3">
              {series.score && (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                  <Star size={14} fill="currentColor" /> {series.score.toFixed(1)}
                </span>
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400">{comics.length} chapter{comics.length !== 1 ? 's' : ''}</span>
              {chapterRange && <span className="text-sm text-gray-500 dark:text-gray-400">{chapterRange}</span>}
              {series.year && <span className="text-sm text-gray-500 dark:text-gray-400">{series.year}</span>}
              {series.status && (
                <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                  series.status === 'completed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                  series.status === 'ongoing' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                  'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>{series.status}</span>
              )}
              {readCount > 0 && <span className="text-sm text-green-600 dark:text-green-400">{readCount} read</span>}
              {inProgress > 0 && <span className="text-sm text-blue-600 dark:text-blue-400">{inProgress} in progress</span>}
              <OfflineButton comics={comics.map((c) => ({ ...c, path: `${id}/${c.file}` }))} label={`Save all ${comics.length} offline`} />
            </div>

            {series.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {series.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">{tag}</span>
                ))}
              </div>
            )}

            {(series.synopsis || aiSynopsis) ? (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-5">{series.synopsis || aiSynopsis}</p>
            ) : comics.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <SummarizeButton comicKey={`${id}/${comics[0].file}`} genre={series.type === 'magazine' ? 'magazine' : 'manga'} onSummary={(s) => setAiSynopsis(s)} size={16} />
                <span className="text-xs text-gray-400 dark:text-gray-500">Generate AI summary</span>
              </div>
            )}

            {series.mangaDexId && (
              <a href={`https://mangadex.org/title/${series.mangaDexId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500">Source: MangaDex &rarr;</a>
            )}
          </div>
        </section>

        <hr className="border-gray-200 dark:border-gray-800 max-w-5xl mx-auto" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Chapters</h2>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-6">
              {comics.map((comic) => (
                <ComicCard key={comic.file} comic={comic} seriesId={id} hideSeries />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 pb-6">
              {comics.map((comic) => (
                <ComicListItem key={comic.file} comic={comic} seriesId={id} onToggleRead={handleToggleRead} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
