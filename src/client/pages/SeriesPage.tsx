import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, List, Star, Pencil, RefreshCw, Loader } from 'lucide-react';
import type { Series, Comic } from '../lib/types';
import { getSeriesDetail, getComics, getSeriesCoverUrl, getPlaceholderUrl, overrideMalId, deleteSeries, getThumbnailUrl, updateSeriesTags, syncSeriesNow } from '../lib/api';
import SyncSourcePicker from '../components/SyncSourcePicker';
import ComicCard from '../components/ComicCard';
import ComicListItem from '../components/ComicListItem';
import ThemeToggle from '../components/ThemeToggle';
import OfflineButton from '../components/OfflineButton';

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

  // Synopsis toggle
  const [expandSynopsis, setExpandSynopsis] = useState(false);

  // Tag editing
  const [showTagEdit, setShowTagEdit] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string>('');
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const handleSyncNow = async () => {
    if (!id) return;
    setSyncing(true);
    setSyncResult('');
    try {
      const result = await syncSeriesNow(id);
      if (result.ok) {
        setSyncResult(result.newChapters > 0
          ? `${result.newChapters} new chapter${result.newChapters === 1 ? '' : 's'} queued for download`
          : 'Up to date — no new chapters');
      } else {
        setSyncResult(`Error: ${result.error || 'sync failed'}`);
      }
      const updated = await getSeriesDetail(id);
      setSeries(updated);
      const c = await getComics(id);
      setComics(c);
    } catch (err) {
      setSyncResult(`Error: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleTagSave = async () => {
    if (!id) return;
    setSavingTags(true);
    const tags = tagInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    try {
      await updateSeriesTags(id, tags);
      const updated = await getSeriesDetail(id);
      setSeries(updated);
      setShowTagEdit(false);
    } finally {
      setSavingTags(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    getSeriesDetail(id).then(setSeries);
    getComics(id).then(setComics);
  }, [id]);

  useEffect(() => {
    localStorage.setItem('comic-reader-series-view', viewMode);
  }, [viewMode]);

  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const handleDelete = async () => {
    if (!id) return;
    await deleteSeries(id);
    navigate('/');
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
              src={series.coverFile ? getSeriesCoverUrl(id!, series.coverFile) : getPlaceholderUrl(series.placeholder)}
              alt={series.name}
              className={`w-full aspect-[2/3] object-cover ${series.coverFile ? '' : 'opacity-60'}`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{series.name}</h1>
            {series.englishTitle && series.englishTitle.toLowerCase() !== series.name.toLowerCase() && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{series.englishTitle}</p>
            )}

            <div className="flex items-center gap-1.5 mt-1">
              {!showOverride ? (
                <>
                  {series.malId ? (
                    <a href={`https://myanimelist.net/manga/${series.malId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors font-mono">
                      MAL #{series.malId}
                    </a>
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-600">No MAL link</span>
                  )}
                  <button onClick={() => setShowOverride(true)} className="text-gray-400 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" title="Edit MAL ID">
                    <Pencil size={11} />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">MAL #</span>
                  <input type="number" value={malIdInput} onChange={(e) => setMalIdInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleOverrideSubmit()} placeholder={series.malId ? String(series.malId) : 'ID'} autoFocus className="w-20 px-2 py-0.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" />
                  <button onClick={handleOverrideSubmit} disabled={overriding || !malIdInput.trim()} className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded disabled:opacity-50">{overriding ? '...' : 'Go'}</button>
                  <button onClick={() => { setShowOverride(false); setMalIdInput(''); }} className="text-xs text-gray-400">Cancel</button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-3">
              {series.score != null && series.score > 0 && (
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

            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {series.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full capitalize">{tag}</span>
              ))}
              {!showTagEdit ? (
                <button
                  onClick={() => { setShowTagEdit(true); setTagInput(series.tags.join(', ')); }}
                  className="text-gray-400 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  title="Edit tags"
                >
                  <Pencil size={11} />
                </button>
              ) : (
                <div className="flex items-center gap-1.5 w-full mt-1">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTagSave()}
                    placeholder="action, comedy, manga..."
                    autoFocus
                    className="flex-1 px-2 py-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button onClick={handleTagSave} disabled={savingTags} className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50">{savingTags ? '...' : 'Save'}</button>
                  <button onClick={() => setShowTagEdit(false)} className="text-xs text-gray-400">Cancel</button>
                </div>
              )}
            </div>

            {series.synopsis && (
              <div className="mt-3">
                <p className={`text-sm text-gray-600 dark:text-gray-400 leading-relaxed ${expandSynopsis ? '' : 'line-clamp-2'}`}>{series.synopsis}</p>
                <button
                  onClick={() => setExpandSynopsis(!expandSynopsis)}
                  className="text-[11px] text-gray-400 hover:text-blue-500 mt-0.5 transition-colors"
                >
                  {expandSynopsis ? 'Show less' : 'Show more'}
                </button>
              </div>
            )}

            {/* Sync controls */}
            <div className="mt-3 flex items-center gap-3 text-[11px] flex-wrap">
              {series.syncSource ? (
                <>
                  <button
                    onClick={handleSyncNow}
                    disabled={syncing}
                    className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
                    title={`Check ${series.syncSource.sourceId} for new chapters`}
                  >
                    {syncing ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    {syncing ? 'Checking...' : 'Check for new chapters'}
                  </button>
                  <span className="text-gray-400 dark:text-gray-600">
                    via <span className="capitalize">{series.syncSource.sourceId}</span>
                  </span>
                  <button
                    onClick={() => setShowSourcePicker(true)}
                    className="text-gray-400 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400"
                  >
                    <Pencil size={11} />
                  </button>
                  {series.lastSyncAt && (
                    <span className="text-gray-400 dark:text-gray-600">
                      Last checked {new Date(series.lastSyncAt).toLocaleDateString()}
                    </span>
                  )}
                  {syncResult && (
                    <span className={`text-[10px] ${syncResult.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>
                      {syncResult}
                    </span>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setShowSourcePicker(true)}
                  className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                  title="Subscribe to auto-update from a source"
                >
                  <RefreshCw size={11} /> Subscribe to updates
                </button>
              )}
            </div>

            <div className="mt-3">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-[11px] text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  Delete series
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 text-[11px]">
                  <span className="text-red-500">Delete all {comics.length} chapters?</span>
                  <button onClick={handleDelete} className="text-red-500 hover:text-red-400 font-medium">Yes, delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-gray-400 hover:text-gray-300">Cancel</button>
                </span>
              )}
            </div>
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

      {showSourcePicker && id && (
        <SyncSourcePicker
          seriesId={id}
          seriesName={series.name}
          currentSource={series.syncSource}
          onClose={() => setShowSourcePicker(false)}
          onSaved={async () => {
            setShowSourcePicker(false);
            const updated = await getSeriesDetail(id);
            setSeries(updated);
          }}
        />
      )}
    </div>
  );
}
