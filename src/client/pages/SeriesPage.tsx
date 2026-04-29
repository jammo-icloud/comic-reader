import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, LayoutGrid, List, Star, RefreshCw, Loader,
  Play, Search, ArrowUpDown, BookOpen, Pencil, Bell, BellOff, Trash2, X,
  Download, CheckCircle, Package, Heart, Plus, Check, AlertTriangle,
} from 'lucide-react';
import type { Series, Comic } from '../lib/types';
import {
  getSeriesDetail, getComics, getSeriesCoverUrl, getPlaceholderUrl,
  deleteSeries, syncSeriesNow,
  addToCollection, addFavorite, removeFavorite,
  retryPartialChapters,
} from '../lib/api';
import { useAuth } from '../App';
import SyncSourcePicker from '../components/SyncSourcePicker';
import SeriesEditModal from '../components/SeriesEditModal';
import ComicCard from '../components/ComicCard';
import ComicListItem from '../components/ComicListItem';
import ProfileMenu, { type ProfileMenuItem } from '../components/ProfileMenu';
import ConfirmSheet from '../components/ConfirmSheet';
import ToolbarIconButton from '../components/ToolbarIconButton';

type ViewMode = 'grid' | 'list';
type SortMode = 'order-asc' | 'order-desc' | 'recent';

export default function SeriesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [series, setSeries] = useState<Series | null>(null);
  const [comics, setComics] = useState<Comic[]>([]);

  // View prefs (persisted)
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    (localStorage.getItem('bindery-series-view') as ViewMode) || 'list',
  );
  const [sortMode, setSortMode] = useState<SortMode>(() =>
    (localStorage.getItem('bindery-series-sort') as SortMode) || 'order-asc',
  );

  // Filter state
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Synopsis expand
  const [expandSynopsis, setExpandSynopsis] = useState(false);

  // Sticky toolbar pinned state (driven by IntersectionObserver on a sentinel)
  const [pinned, setPinned] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Modals + admin actions
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string>('');

  // Offline-save state (admin menu)
  const [offlineState, setOfflineState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [offlineProgress, setOfflineProgress] = useState({ done: 0, total: 0 });

  // Favorite + Add-to-library state (any logged-in user — not gated to admin)
  const [favBusy, setFavBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);

  // ----- Data load -----

  const refresh = useCallback(async () => {
    if (!id) return;
    const [s, c] = await Promise.all([getSeriesDetail(id), getComics(id)]);
    setSeries(s);
    setComics(c);
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  // ----- Persist prefs -----

  useEffect(() => { localStorage.setItem('bindery-series-view', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('bindery-series-sort', sortMode); }, [sortMode]);

  // ----- Sticky toolbar pinned state -----

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setPinned(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px 0px 0px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ----- Close sort menu on outside click -----

  useEffect(() => {
    if (!showSortMenu) return;
    const handler = () => setShowSortMenu(false);
    // setTimeout so the click that opened the menu doesn't immediately close it
    const t = setTimeout(() => window.addEventListener('click', handler), 0);
    return () => { clearTimeout(t); window.removeEventListener('click', handler); };
  }, [showSortMenu]);

  // ----- Handlers -----

  const handleSyncNow = async () => {
    if (!id) return;
    setSyncing(true);
    setSyncResult('');
    try {
      const result = await syncSeriesNow(id);
      if (result.ok) {
        setSyncResult(result.newChapters > 0
          ? `${result.newChapters} new chapter${result.newChapters === 1 ? '' : 's'} queued`
          : 'Up to date');
      } else {
        setSyncResult(`Error: ${result.error || 'sync failed'}`);
      }
      await refresh();
    } catch (err) {
      setSyncResult(`Error: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
      // Auto-clear the result after a few seconds
      setTimeout(() => setSyncResult(''), 4000);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteSeries(id);
    navigate('/');
  };

  /**
   * Retry every partial chapter for this series in one job. Server-side
   * dedupe-on-enqueue means rapid double-tap is harmless. The chapter loop's
   * existence check has been taught to fall through when a sidecar exists,
   * so the partials get re-attempted via the normal download path.
   *
   * Reuses the syncing state for the spinner — they're conceptually similar
   * (admin-triggered backfill), and we don't want both spinning at once.
   */
  const handleRetryPartials = async () => {
    if (!id || syncing) return;
    setSyncing(true);
    setSyncResult('');
    try {
      const result = await retryPartialChapters(id);
      if (result.queued) {
        setSyncResult(`Retrying ${result.partialsFound} partial chapter${result.partialsFound === 1 ? '' : 's'}…`);
      } else {
        setSyncResult(result.message || 'No partial chapters');
      }
      await refresh();
    } catch (err) {
      setSyncResult(`Error: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(''), 4000);
    }
  };

  /**
   * Trigger a streaming .crz download via a programmatic <a> click.
   * The server sends Content-Disposition: attachment, so the browser hands
   * the response to its native download manager — never buffered in JS.
   * Cookies (auth) ride along automatically on a same-origin GET.
   */
  const handleExportCrz = () => {
    if (!id) return;
    const url = `/api/admin/series/${encodeURIComponent(id)}/export?translations=1`;
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    // Filename hint; server's Content-Disposition is authoritative.
    a.download = `${id}.crz`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /**
   * Toggle the current user's "I'd recommend this" mark. Optimistic update —
   * we flip local state immediately and revert on error so the button feels
   * instant. The cross-user Recommended feed re-aggregates on its next fetch.
   */
  const handleToggleFavorite = async () => {
    if (!series || favBusy) return;
    setFavBusy(true);
    const wasFavorited = !!series.isFavorited;
    setSeries((prev) => (prev ? { ...prev, isFavorited: !wasFavorited } : prev));
    try {
      if (wasFavorited) await removeFavorite(series.id);
      else await addFavorite(series.id);
    } catch (err) {
      console.error('Toggle favorite failed:', err);
      // Revert
      setSeries((prev) => (prev ? { ...prev, isFavorited: wasFavorited } : prev));
    } finally {
      setFavBusy(false);
    }
  };

  /**
   * Add this series to the current user's collection. Same primitive that
   * Discover already exposes — surfacing it on SeriesPage means a user can
   * land on a series via direct URL or the Recommended feed and add it
   * without going back through Discover.
   */
  const handleAddToLibrary = async () => {
    if (!series || addBusy || series.inCollection) return;
    setAddBusy(true);
    try {
      await addToCollection(series.id);
      setSeries((prev) => (prev ? { ...prev, inCollection: true } : prev));
    } catch (err) {
      console.error('Add to library failed:', err);
    } finally {
      setAddBusy(false);
    }
  };

  const handleSaveOffline = async () => {
    if (!id || typeof caches === 'undefined' || comics.length === 0) return;
    setOfflineState('saving');
    setOfflineProgress({ done: 0, total: comics.length });
    const cache = await caches.open('pdf-cache');
    for (let i = 0; i < comics.length; i++) {
      const url = `/api/comics/read/${id}/${comics[i].file}`;
      try {
        const existing = await cache.match(url);
        if (!existing) {
          const response = await fetch(url);
          if (response.ok) await cache.put(url, response);
        }
      } catch { /* skip failures, keep going */ }
      setOfflineProgress({ done: i + 1, total: comics.length });
    }
    setOfflineState('done');
    setTimeout(() => setOfflineState('idle'), 4000);
  };

  const handleToggleRead = (file: string, isRead: boolean) => {
    setComics((prev) => prev.map((c) => c.file === file ? { ...c, isRead } : c));
  };

  // ----- Derived data -----

  const chapterRange = useMemo(() => {
    if (comics.length === 0) return null;
    const orders = comics.map((c) => c.order).filter((n) => n > 0).sort((a, b) => a - b);
    if (orders.length === 0) return null;
    const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);
    const min = orders[0], max = orders[orders.length - 1];
    return min === max ? `Ch. ${fmt(min)}` : `Ch. ${fmt(min)}–${fmt(max)}`;
  }, [comics]);

  const readCount = comics.filter((c) => c.isRead).length;
  const inProgress = comics.filter((c) => c.currentPage > 0 && !c.isRead).length;
  const partialCount = comics.filter((c) => !!c.partial).length;

  // Continue-reading target: most recently read in-progress chapter, else first unread
  const continueTarget = useMemo<Comic | null>(() => {
    const inP = comics.filter((c) => c.currentPage > 0 && !c.isRead);
    if (inP.length > 0) {
      return inP.slice().sort((a, b) => {
        const ta = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0;
        const tb = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0;
        return tb - ta;
      })[0];
    }
    const ordered = comics.slice().sort((a, b) => a.order - b.order);
    const firstUnread = ordered.find((c) => !c.isRead);
    return firstUnread || ordered[0] || null;
  }, [comics]);

  const continueLabel = useMemo(() => {
    if (!continueTarget) return null;
    const inP = continueTarget.currentPage > 0 && !continueTarget.isRead;
    const allRead = comics.length > 0 && readCount === comics.length;
    if (allRead) return 'Re-read from start';
    if (inP) {
      const ord = continueTarget.order > 0 ? `Ch. ${continueTarget.order}` : 'Continue';
      return `${ord} · p. ${continueTarget.currentPage + 1}`;
    }
    return continueTarget.order > 0 ? `Start Ch. ${continueTarget.order}` : 'Start reading';
  }, [continueTarget, comics.length, readCount]);

  const filteredSorted = useMemo(() => {
    let list = comics;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.file.toLowerCase().includes(q));
    }
    if (unreadOnly) list = list.filter((c) => !c.isRead);

    const sorted = list.slice();
    if (sortMode === 'order-asc') sorted.sort((a, b) => a.order - b.order);
    else if (sortMode === 'order-desc') sorted.sort((a, b) => b.order - a.order);
    else if (sortMode === 'recent') sorted.sort((a, b) => {
      const ta = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0;
      const tb = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0;
      return tb - ta;
    });
    return sorted;
  }, [comics, search, unreadOnly, sortMode]);

  if (!series || !id) return null;

  const coverUrl = series.coverFile ? getSeriesCoverUrl(id, series.coverFile) : getPlaceholderUrl(series.placeholder);
  const hasCover = !!series.coverFile;

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">

      {/* ===== Floating top corner buttons (mirror Reader page) =====
          top/left/right use safe-area-inset so the buttons clear Dynamic Island
          in standalone PWA mode (status-bar-style: black-translucent). */}
      <Link
        to="/"
        aria-label="Back to library"
        className="fixed z-40 p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors shadow-lg"
        style={{
          top: 'max(0.75rem, env(safe-area-inset-top))',
          left: 'max(0.75rem, env(safe-area-inset-left))',
        }}
        title="Library"
      >
        <ArrowLeft size={18} />
      </Link>

      {/* Floating ProfileMenu (top-right) — series admin actions injected as a section.
          Identity / nav / theme / settings / sign-out all come from ProfileMenu itself. */}
      <div
        className="fixed z-40"
        style={{
          top: 'max(0.75rem, env(safe-area-inset-top))',
          right: 'max(0.75rem, env(safe-area-inset-right))',
        }}
      >
        <ProfileMenu
          triggerVariant="floating"
          sections={isAdmin ? [{
            title: 'This series',
            items: ((): ProfileMenuItem[] => {
              const items: ProfileMenuItem[] = [
                {
                  icon: <Pencil size={15} />,
                  label: 'Edit metadata',
                  onClick: () => setShowEditModal(true),
                },
              ];
              if (typeof caches !== 'undefined' && comics.length > 0) {
                items.push({
                  icon: offlineState === 'saving'
                    ? <Loader size={15} className="animate-spin" />
                    : offlineState === 'done'
                      ? <CheckCircle size={15} className="text-success" />
                      : <Download size={15} />,
                  label: offlineState === 'saving'
                    ? `Saving ${offlineProgress.done}/${offlineProgress.total}…`
                    : offlineState === 'done'
                      ? 'Saved offline'
                      : `Save all ${comics.length} offline`,
                  onClick: () => { if (offlineState === 'idle') handleSaveOffline(); },
                  disabled: offlineState !== 'idle',
                  keepOpen: true,
                });
              }
              if (comics.length > 0) {
                items.push({
                  icon: <Package size={15} />,
                  label: 'Export as .crz',
                  hint: 'Archive · share across instances',
                  onClick: handleExportCrz,
                });
              }
              // Show "Retry partial chapters" only when there's something
              // to retry. Re-attempts every partial in one job (dedupe-on-
              // enqueue means rapid taps merge harmlessly).
              if (partialCount > 0) {
                items.push({
                  icon: syncing
                    ? <Loader size={15} className="animate-spin" />
                    : <AlertTriangle size={15} className="text-warning" />,
                  label: `Retry ${partialCount} partial chapter${partialCount === 1 ? '' : 's'}`,
                  hint: 'Re-fetch missing pages from the source',
                  onClick: handleRetryPartials,
                  disabled: syncing,
                });
              }
              items.push({
                icon: syncing ? <Loader size={15} className="animate-spin" /> : <RefreshCw size={15} />,
                label: series.syncSource ? 'Check for new chapters' : 'Set up auto-sync',
                hint: series.syncSource ? `via ${series.syncSource.sourceId}` : undefined,
                onClick: series.syncSource
                  ? handleSyncNow
                  : () => setShowSourcePicker(true),
                disabled: syncing,
              });
              if (series.syncSource) {
                items.push({
                  icon: <BellOff size={15} />,
                  label: 'Change sync source',
                  onClick: () => setShowSourcePicker(true),
                });
              }
              items.push({
                icon: <Trash2 size={15} />,
                label: 'Delete series',
                onClick: () => setConfirmDelete(true),
                destructive: true,
              });
              return items;
            })(),
          }] : undefined}
        />
      </div>

      {/* ===== HERO ===== */}
      <header className="relative">
        {/* Blurred backdrop */}
        <div className="absolute inset-0 overflow-hidden -z-0">
          <img
            src={coverUrl}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full object-cover scale-110 ${hasCover ? 'opacity-30 blur-2xl' : 'opacity-10 blur-3xl'}`}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-50/40 via-gray-50/80 to-gray-50 dark:from-gray-950/40 dark:via-gray-950/80 dark:to-gray-950" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-5">
          <div className="flex gap-4 sm:gap-6 items-start">
            {/* Cover */}
            <div className="w-24 sm:w-32 md:w-44 shrink-0 rounded-lg overflow-hidden shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
              <img
                src={coverUrl}
                alt={series.name}
                className={`w-full aspect-[2/3] object-cover ${hasCover ? '' : 'opacity-60'}`}
              />
            </div>

            {/* Title block */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight break-words">{series.name}</h1>
              {series.englishTitle && series.englishTitle.toLowerCase() !== series.name.toLowerCase() && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 break-words">{series.englishTitle}</p>
              )}

              {/* Meta strip */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 sm:mt-3 text-sm text-gray-600 dark:text-gray-400">
                {series.score != null && series.score > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium text-warning">
                    <Star size={14} fill="currentColor" /> {series.score.toFixed(1)}
                  </span>
                )}
                <span>{comics.length} ch{comics.length !== 1 ? 's' : ''}</span>
                {chapterRange && <span className="hidden sm:inline">{chapterRange}</span>}
                {series.year && <span>{series.year}</span>}
                {series.status && (
                  <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                    series.status === 'completed' ? 'bg-accent/15 text-accent' :
                    series.status === 'ongoing' ? 'bg-success/15 dark:bg-success/20 text-success' :
                    'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}>{series.status}</span>
                )}
                {series.malId && (
                  <a
                    href={`https://myanimelist.net/manga/${series.malId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-accent transition-colors font-mono"
                  >
                    MAL #{series.malId}
                  </a>
                )}
              </div>

              {/* Read-state strip — only when meaningful */}
              {(readCount > 0 || inProgress > 0) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
                  {readCount > 0 && <span className="text-success">{readCount} read</span>}
                  {inProgress > 0 && <span className="text-accent">{inProgress} in progress</span>}
                </div>
              )}
            </div>
          </div>

          {/* ===== Primary action row =====
              Layout: Continue (primary, flex-1 on mobile) → Add (or "In library")
              → Favorite → Subscribe (admin). All buttons use min-h-44px for
              comfortable mobile tap targets. Text labels collapse to icon-only
              on mobile so the row stays single-line. */}
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            {continueTarget && (
              <Link
                to={`/read/${id}/${continueTarget.file}`}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-sm shadow-md transition-colors min-h-[44px]"
              >
                <Play size={16} fill="currentColor" />
                <span>{continueLabel}</span>
              </Link>
            )}

            {/* Add to library — only when not already in collection */}
            {!series.inCollection && (
              <button
                onClick={handleAddToLibrary}
                disabled={addBusy}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-accent hover:text-accent text-sm transition-colors min-h-[44px] disabled:opacity-50"
                title="Add to my library"
                aria-label="Add to my library"
              >
                {addBusy ? <Loader size={15} className="animate-spin" /> : <Plus size={15} />}
                <span className="hidden sm:inline">Add to library</span>
              </button>
            )}

            {/* In library — non-action indicator */}
            {series.inCollection && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-success/10 text-success text-sm"
                title="In your library"
              >
                <Check size={15} />
                <span className="hidden sm:inline">In your library</span>
              </span>
            )}

            {/* Favorite (Recommend) toggle — visible to all logged-in users.
                Filled heart when favorited; this is the user's "I'd recommend
                this" mark that surfaces in Discover's Recommended feed. */}
            <button
              onClick={handleToggleFavorite}
              disabled={favBusy}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-colors min-h-[44px] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                series.isFavorited
                  ? 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/15'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-accent hover:text-accent'
              }`}
              title={series.isFavorited ? 'Stop recommending' : 'Recommend this series'}
              aria-label={series.isFavorited ? 'Stop recommending' : 'Recommend this series'}
              aria-pressed={!!series.isFavorited}
            >
              {favBusy ? (
                <Loader size={15} className="animate-spin" />
              ) : (
                <Heart
                  size={15}
                  fill={series.isFavorited ? 'currentColor' : 'none'}
                  strokeWidth={series.isFavorited ? 0 : 2}
                />
              )}
              <span className="hidden sm:inline">{series.isFavorited ? 'Recommended' : 'Recommend'}</span>
            </button>

            {/* Subscribe quick action — admin only since updating sync source is admin-only */}
            {isAdmin && !series.syncSource && (
              <button
                onClick={() => setShowSourcePicker(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-accent hover:text-accent text-sm transition-colors min-h-[44px]"
                title="Subscribe to updates from a source"
              >
                <Bell size={15} />
                <span className="hidden sm:inline">Subscribe</span>
              </button>
            )}
            {isAdmin && series.syncSource && (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 text-accent text-xs">
                <Bell size={13} />
                <span className="capitalize">{series.syncSource.sourceId}</span>
              </span>
            )}
          </div>

          {/* Sync result toast */}
          {syncResult && (
            <p className={`text-xs mt-2 ${syncResult.startsWith('Error') ? 'text-danger' : 'text-success'}`}>
              {syncResult}
            </p>
          )}

          {/* ===== Synopsis ===== */}
          {series.synopsis && (
            <div className="mt-5">
              <p className={`text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line ${expandSynopsis ? '' : 'line-clamp-3'}`}>
                {series.synopsis}
              </p>
              <button
                onClick={() => setExpandSynopsis((v) => !v)}
                className="text-sm text-accent hover:underline mt-1 font-medium"
              >
                {expandSynopsis ? 'Show less' : 'Show more'}
              </button>
            </div>
          )}

          {/* ===== Tags — horizontal scroll on mobile, wrap on tablet+ ===== */}
          {series.tags.length > 0 && (
            <div className="mt-4 -mx-4 sm:mx-0">
              <div className="flex sm:flex-wrap gap-1.5 overflow-x-auto sm:overflow-visible no-scrollbar px-4 sm:px-0">
                {series.tags.map((tag) => (
                  <span
                    key={tag}
                    className="shrink-0 text-xs px-2.5 py-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm text-gray-600 dark:text-gray-400 rounded-full capitalize border border-gray-200 dark:border-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last sync line — small, only if there is a source */}
          {series.syncSource && series.lastSyncAt && (
            <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-4">
              Last checked {new Date(series.lastSyncAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </header>

      {/* ===== Sentinel just above the sticky toolbar ===== */}
      <div ref={sentinelRef} className="h-px" />

      {/* ===== Sticky chapter toolbar =====
          paddingTop: env(safe-area-inset-top) so when this pins under the
          (transparent) iOS status bar in standalone mode, the toolbar content
          (and the floating Back/⋯ buttons that sit on top of it) all clear
          the time/battery readout. The backdrop blur extends behind the bar. */}
      <div
        className={`sticky top-0 z-20 bg-gray-50/85 dark:bg-gray-950/85 backdrop-blur-md transition-shadow ${pinned ? 'shadow-md border-b border-gray-200 dark:border-gray-800' : 'border-b border-gray-200/60 dark:border-gray-800/60'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* When pinned, reserve space on each side so the floating Back / ⋯ buttons
            (fixed at top-3 left/right) don't cover the toolbar's content. */}
        <div className={`max-w-5xl mx-auto py-2.5 flex items-center gap-2 transition-[padding] ${
          pinned
            ? `pl-14 ${isAdmin ? 'pr-14' : 'pr-4 sm:pr-6'}`
            : 'px-4 sm:px-6'
        }`}>
          {/* When pinned, show series name as context */}
          {pinned && (
            <span className="text-sm font-medium truncate max-w-[40%] sm:max-w-[50%] text-gray-700 dark:text-gray-300" title={series.name}>
              {series.name}
            </span>
          )}
          {pinned && <span className="text-gray-300 dark:text-gray-700">·</span>}

          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">
            {pinned ? comics.length : `Chapters (${comics.length})`}
          </h2>

          <div className="flex-1 min-w-0">
            {showSearch && (
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chapters…"
                  autoFocus
                  className="w-full pl-7 pr-7 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Search toggle */}
          <ToolbarIconButton
            active={showSearch}
            title="Search chapters"
            onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearch(''); }}
          >
            <Search size={16} />
          </ToolbarIconButton>

          {/* Unread-only filter */}
          <ToolbarIconButton
            active={unreadOnly}
            title="Unread only"
            onClick={() => setUnreadOnly((v) => !v)}
          >
            <BookOpen size={16} />
          </ToolbarIconButton>

          {/* Sort */}
          <div className="relative">
            <ToolbarIconButton
              active={showSortMenu}
              title="Sort"
              onClick={(e) => { e.stopPropagation(); setShowSortMenu((v) => !v); }}
            >
              <ArrowUpDown size={16} />
            </ToolbarIconButton>
            {showSortMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-10 min-w-[10rem] bg-surface dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden text-sm z-30"
              >
                <SortItem active={sortMode === 'order-asc'} onClick={() => { setSortMode('order-asc'); setShowSortMenu(false); }}>
                  Chapter ↑ (1→N)
                </SortItem>
                <SortItem active={sortMode === 'order-desc'} onClick={() => { setSortMode('order-desc'); setShowSortMenu(false); }}>
                  Chapter ↓ (N→1)
                </SortItem>
                <SortItem active={sortMode === 'recent'} onClick={() => { setSortMode('recent'); setShowSortMenu(false); }}>
                  Recently read
                </SortItem>
              </div>
            )}
          </div>

          {/* Grid / list */}
          <div className="hidden sm:flex bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-l transition-colors ${viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
              title="List view"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-r transition-colors ${viewMode === 'grid' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ===== Chapter list ===== */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 pb-12">
        {filteredSorted.length === 0 ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-600 py-12">
            {comics.length === 0 ? 'No chapters yet.' : 'No chapters match.'}
          </p>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredSorted.map((comic) => (
              <ComicCard key={comic.file} comic={comic} seriesId={id} hideSeries />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filteredSorted.map((comic) => (
              <ComicListItem
                key={comic.file}
                comic={comic}
                seriesId={id}
                onToggleRead={handleToggleRead}
              />
            ))}
          </div>
        )}
      </main>

      {/* ===== Modals ===== */}
      {showEditModal && (
        <SeriesEditModal
          series={{
            id,
            name: series.name,
            englishTitle: series.englishTitle,
            type: series.type,
            score: series.score,
            synopsis: series.synopsis,
            tags: series.tags,
            status: series.status,
            year: series.year,
            malId: series.malId,
            mangaDexId: series.mangaDexId,
            syncSource: series.syncSource,
          }}
          onClose={() => setShowEditModal(false)}
          onSave={async () => { setShowEditModal(false); await refresh(); }}
        />
      )}

      {showSourcePicker && id && (
        <SyncSourcePicker
          seriesId={id}
          seriesName={series.name}
          currentSource={series.syncSource}
          onClose={() => setShowSourcePicker(false)}
          onSaved={async () => { setShowSourcePicker(false); await refresh(); }}
        />
      )}

      <ConfirmSheet
        open={confirmDelete}
        title={`Delete "${series.name}"?`}
        message={`Permanently removes ${comics.length} chapter${comics.length === 1 ? '' : 's'} and the series metadata.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

// ----- Subcomponents -----

function SortItem({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-accent/10 dark:bg-accent/20 text-accent font-medium'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  );
}

