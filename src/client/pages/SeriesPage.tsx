import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, List, Star, RefreshCw, Loader, MoreHorizontal,
  Play, Search, ArrowUpDown, BookOpen, Pencil, Bell, BellOff, Trash2, X,
  Download, CheckCircle, Package, Heart, Plus, Check, AlertTriangle, Sparkles, Pin,
} from 'lucide-react';
import type { Series, Comic } from '../lib/types';
import {
  getSeriesDetail, getComics, getSeriesCoverUrl, getPlaceholderUrl,
  deleteSeries, syncSeriesNow,
  addToCollection, addFavorite, removeFavorite,
  pinSeries, unpinSeries,
  retryPartialChapters, refreshSeriesMetadata,
  getSimilarSeries, type SimilarSeriesItem,
} from '../lib/api';
import { saveSeriesOffline, removeSeriesOffline, getOfflineSeriesIds } from '../lib/offline';
import { useAuth } from '../App';
import SyncSourcePicker from '../components/SyncSourcePicker';
import SeriesEditModal from '../components/SeriesEditModal';
import ComicCard from '../components/ComicCard';
import ComicListItem from '../components/ComicListItem';
import { type ProfileMenuItem } from '../components/ProfileMenu';
import ConfirmSheet from '../components/ConfirmSheet';
import ToolbarIconButton from '../components/ToolbarIconButton';
import { Button, IconButton, Kicker, StatusPill, SegmentedControl, Badge } from '../components/ds';
import type { SeriesStatus } from '../components/ds/Badge';

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
  const [savedOffline, setSavedOffline] = useState(false);
  useEffect(() => { if (id) getOfflineSeriesIds().then((ids) => setSavedOffline(ids.has(id))); }, [id]);

  // Favorite + Add-to-library state (any logged-in user — not gated to admin)
  const [favBusy, setFavBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);

  // ----- Data load -----

  const refresh = useCallback(async () => {
    if (!id) return;
    const [s, c] = await Promise.all([getSeriesDetail(id), getComics(id)]);
    setSeries(s);
    setComics(c);
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  // ----- "More like this" — server-computed tag-similarity recommendations.
  // Fetched once per series-id change. Empty list (or absent tags) renders
  // no UI, so this is cheap when there's nothing to show. -----
  const [similar, setSimilar] = useState<SimilarSeriesItem[]>([]);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getSimilarSeries(id)
      .then((r) => { if (!cancelled) setSimilar(r.items); })
      .catch(() => { /* silent — strip just won't render */ });
    return () => { cancelled = true; };
  }, [id]);

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
   * Refresh metadata from AniList — pulls genres, tags, score, synopsis,
   * year, status, cover. Tags are merged with the existing set (so manual
   * tags from SeriesEditModal aren't lost). Most useful for series imported
   * from raw folders that have empty metadata.
   *
   * Reuses the syncing state — same UX shape as syncSeriesNow + retryPartials.
   */
  const handleRefreshMetadata = async () => {
    if (!id || syncing) return;
    setSyncing(true);
    setSyncResult('');
    try {
      const result = await refreshSeriesMetadata(id);
      if (result.matched) {
        const tagCount = result.series.tags?.length ?? 0;
        setSyncResult(`Refreshed via ${result.source} — ${tagCount} tags`);
      } else {
        setSyncResult(result.warning || 'No match found');
      }
      await refresh();
    } catch (err) {
      setSyncResult(`Error: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(''), 5000);
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
   * Toggle the "currently reading" pin. Personal marker — surfaces in the
   * library's Pinned filter so the user can drop straight back into a
   * series they're mid-way through. Optimistic, same pattern as favorite.
   */
  const handleTogglePin = async () => {
    if (!series || pinBusy) return;
    setPinBusy(true);
    const wasPinned = !!series.isPinned;
    setSeries((prev) => (prev ? { ...prev, isPinned: !wasPinned } : prev));
    try {
      if (wasPinned) await unpinSeries(series.id);
      else await pinSeries(series.id);
    } catch (err) {
      console.error('Toggle pin failed:', err);
      setSeries((prev) => (prev ? { ...prev, isPinned: wasPinned } : prev));
    } finally {
      setPinBusy(false);
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
    if (!id || !series || typeof caches === 'undefined' || comics.length === 0) return;
    setOfflineState('saving');
    setOfflineProgress({ done: 0, total: comics.length });
    try {
      await saveSeriesOffline(series, comics, setOfflineProgress);
      setSavedOffline(true);
      setOfflineState('done');
      setTimeout(() => setOfflineState('idle'), 4000);
    } catch (err) {
      console.error('Save offline failed:', err);
      setOfflineState('idle');
    }
  };

  const handleRemoveOffline = async () => {
    if (!id) return;
    await removeSeriesOffline(id);
    setSavedOffline(false);
    setOfflineState('idle');
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

  // Series-admin items — admin-only. Built dynamically so partial-retry /
  // sync-source / offline-save items appear only when applicable. Surfaced via
  // the inline ⋯ More button below; the global Bindery header handles identity.
  const seriesAdminItems: ProfileMenuItem[] = useMemo(() => {
    if (!isAdmin) return [];
    const items: ProfileMenuItem[] = [
      { icon: <Pencil size={15} />, label: 'Edit metadata', onClick: () => setShowEditModal(true) },
      {
        icon: syncing ? <Loader size={15} className="animate-spin" /> : <Sparkles size={15} />,
        label: 'Refresh from AniList',
        hint: series?.malId ? `MAL ID ${series.malId}` : 'matches by title',
        onClick: handleRefreshMetadata,
        disabled: syncing,
      },
    ];
    if (typeof caches !== 'undefined' && comics.length > 0) {
      if (savedOffline && offlineState === 'idle') {
        items.push({
          icon: <CheckCircle size={15} className="text-success" />,
          label: 'Saved offline · Remove download',
          hint: 'Frees up cached space',
          onClick: handleRemoveOffline,
          keepOpen: true,
        });
      } else {
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
    }
    if (comics.length > 0) {
      items.push({
        icon: <Package size={15} />,
        label: 'Export as .crz',
        hint: 'Archive · share across instances',
        onClick: handleExportCrz,
      });
    }
    if (partialCount > 0) {
      items.push({
        icon: syncing ? <Loader size={15} className="animate-spin" /> : <AlertTriangle size={15} className="text-warning" />,
        label: `Retry ${partialCount} partial chapter${partialCount === 1 ? '' : 's'}`,
        hint: 'Re-fetch missing pages from the source',
        onClick: handleRetryPartials,
        disabled: syncing,
      });
    }
    items.push({
      icon: syncing ? <Loader size={15} className="animate-spin" /> : <RefreshCw size={15} />,
      label: series?.syncSource ? 'Check for new chapters' : 'Set up auto-sync',
      hint: series?.syncSource ? `via ${series.syncSource.sourceId}` : undefined,
      onClick: series?.syncSource ? handleSyncNow : () => setShowSourcePicker(true),
      disabled: syncing,
    });
    if (series?.syncSource) {
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
  }, [
    isAdmin, syncing, series, comics.length, savedOffline, offlineState,
    offlineProgress, partialCount,
    handleRefreshMetadata, handleRemoveOffline, handleSaveOffline, handleExportCrz,
    handleRetryPartials, handleSyncNow,
  ]);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  useEffect(() => {
    if (!showMoreMenu) return;
    const onClick = () => setShowMoreMenu(false);
    const t = setTimeout(() => window.addEventListener('click', onClick), 0);
    return () => { clearTimeout(t); window.removeEventListener('click', onClick); };
  }, [showMoreMenu]);

  if (!series || !id) return null;

  const coverUrl = series.coverFile ? getSeriesCoverUrl(id, series.coverFile) : getPlaceholderUrl(series.placeholder);
  const hasCover = !!series.coverFile;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-page)', color: 'var(--text-body)' }}>
      {/* ===== HERO ===== Immersive cover-as-hero: cover blurred big behind,
          gradient fading to var(--bg-page) at the bottom so the body picks up
          the active theme cleanly. Foreground text reads white on dark fade. */}
      <header className="relative">
        {/* Blurred backdrop — deeper blur (30px) + brightness drop, matching
            the Bindery prototype. Fades to the page background at the bottom. */}
        <div className="absolute inset-0 overflow-hidden -z-0" style={{ height: 400 }}>
          <img
            src={coverUrl}
            alt=""
            aria-hidden="true"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: hasCover ? 'blur(30px) brightness(0.45)' : 'blur(40px) brightness(0.3)',
              transform: 'scale(1.15)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgb(0 0 0 / 0.25) 0%, rgb(0 0 0 / 0.45) 50%, var(--bg-page) 100%)',
            }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-5">
          <div className="flex gap-4 sm:gap-6 items-start">
            {/* Cover */}
            <div
              className="w-24 sm:w-32 md:w-44 shrink-0 overflow-hidden"
              style={{ borderRadius: 12, boxShadow: 'var(--shadow-2xl)' }}
            >
              <img
                src={coverUrl}
                alt={series.name}
                className={`w-full aspect-[2/3] object-cover ${hasCover ? '' : 'opacity-60'}`}
              />
            </div>

            {/* Title block — white text on the dark hero fade */}
            <div className="flex-1 min-w-0" style={{ color: '#fff' }}>
              <h1
                className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight break-words"
                style={{ textShadow: '0 2px 10px rgb(0 0 0 / 0.5)' }}
              >
                {series.name}
              </h1>
              {series.englishTitle && series.englishTitle.toLowerCase() !== series.name.toLowerCase() && (
                <p className="text-sm mt-0.5 break-words" style={{ opacity: 0.85 }}>{series.englishTitle}</p>
              )}

              {/* Meta strip — status pill + score + chapter count, all readable on dark */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 sm:mt-3 text-sm" style={{ opacity: 0.92 }}>
                {series.status && (
                  <StatusPill status={(series.status as SeriesStatus)} />
                )}
                {series.score != null && series.score > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium" style={{ color: 'rgb(253 230 138)' }}>
                    <Star size={14} fill="currentColor" /> {series.score.toFixed(1)}
                  </span>
                )}
                <span className="bindery-nums">{comics.length} ch{comics.length !== 1 ? 's' : ''}</span>
                {chapterRange && <span className="hidden sm:inline bindery-nums">{chapterRange}</span>}
                {series.year && <span className="bindery-nums">{series.year}</span>}
                {series.malId && (
                  <a
                    href={`https://myanimelist.net/manga/${series.malId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs hover:underline font-mono"
                    style={{ opacity: 0.7 }}
                  >
                    MAL #{series.malId}
                  </a>
                )}
              </div>

              {/* Read-state strip — only when meaningful */}
              {(readCount > 0 || inProgress > 0) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
                  {readCount > 0 && (
                    <span style={{ color: 'rgb(134 239 172)' }}>{readCount} read</span>
                  )}
                  {inProgress > 0 && (
                    <span style={{ color: 'rgb(196 181 253)' }}>{inProgress} in progress</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ===== Primary action row =====
              Continue (primary) → Recommend / Pin / Add toggles (secondary) →
              admin: subscribe + inline ⋯ More menu. */}
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            {continueTarget && (
              <Link
                to={`/read/${id}/${continueTarget.file}`}
                className="by-btn by-btn--primary by-btn--lg"
                style={{ textDecoration: 'none', flex: '0 1 auto' }}
              >
                <Play size={16} fill="currentColor" />
                <span>{continueLabel}</span>
              </Link>
            )}

            <Button
              variant={series.isFavorited ? 'primary' : 'secondary'}
              size="lg"
              iconLeft={favBusy ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <Heart size={16} fill={series.isFavorited ? 'currentColor' : 'none'} strokeWidth={series.isFavorited ? 0 : 2} />
              )}
              onClick={handleToggleFavorite}
              disabled={favBusy}
              aria-pressed={!!series.isFavorited}
              title={series.isFavorited ? 'Stop recommending' : 'Recommend this series'}
            >
              <span className="hidden sm:inline">{series.isFavorited ? 'Recommended' : 'Recommend'}</span>
            </Button>

            {!series.inCollection && (
              <Button
                variant="secondary"
                size="lg"
                iconLeft={addBusy ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
                onClick={handleAddToLibrary}
                disabled={addBusy}
                title="Add to my library"
              >
                <span className="hidden sm:inline">Add to library</span>
              </Button>
            )}
            {series.inCollection && (
              <Badge intent="success" pill>
                <Check size={12} /> In your library
              </Badge>
            )}

            <IconButton
              title={series.isPinned ? 'Unpin' : 'Pin to currently reading'}
              active={!!series.isPinned}
              onClick={handleTogglePin}
              disabled={pinBusy}
            >
              {pinBusy ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <Pin size={16} fill={series.isPinned ? 'currentColor' : 'none'} strokeWidth={series.isPinned ? 0 : 2} />
              )}
            </IconButton>

            {/* Subscribe quick action — admin only since updating sync source is admin-only */}
            {isAdmin && !series.syncSource && (
              <Button
                variant="secondary"
                size="lg"
                iconLeft={<Bell size={16} />}
                onClick={() => setShowSourcePicker(true)}
                title="Subscribe to updates from a source"
              >
                <span className="hidden sm:inline">Subscribe</span>
              </Button>
            )}
            {isAdmin && series.syncSource && (
              <Badge intent="accent-soft" pill>
                <Bell size={12} />
                <span className="capitalize">{series.syncSource.sourceId}</span>
              </Badge>
            )}

            {/* ⋯ More — admin tools dropdown */}
            {seriesAdminItems.length > 0 && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <IconButton
                  title="More"
                  active={showMoreMenu}
                  onClick={() => setShowMoreMenu((v) => !v)}
                >
                  <MoreHorizontal size={18} />
                </IconButton>
                {showMoreMenu && (
                  <div
                    role="menu"
                    style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                      minWidth: 260, zIndex: 30,
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 12,
                      boxShadow: 'var(--shadow-2xl)',
                      overflow: 'hidden',
                    }}
                  >
                    {seriesAdminItems.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          item.onClick?.();
                          if (!item.keepOpen) setShowMoreMenu(false);
                        }}
                        disabled={item.disabled}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          background: 'none',
                          border: 'none',
                          textAlign: 'left',
                          cursor: item.disabled ? 'not-allowed' : 'pointer',
                          opacity: item.disabled ? 0.5 : 1,
                          color: item.destructive ? 'var(--color-danger)' : 'var(--text-body)',
                          fontSize: 13,
                          borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                        }}
                        onMouseEnter={(e) => {
                          if (item.disabled) return;
                          (e.currentTarget as HTMLButtonElement).style.background = item.destructive
                            ? 'rgb(var(--danger) / 0.1)'
                            : 'var(--bg-subtle)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'none';
                        }}
                      >
                        <span style={{ color: item.destructive ? 'var(--color-danger)' : 'var(--text-tertiary)', display: 'inline-flex' }}>
                          {item.icon}
                        </span>
                        <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <span>{item.label}</span>
                          {item.hint && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.hint}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
        className="sticky top-0 z-20 transition-shadow"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          background: 'var(--chrome-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: pinned ? '1px solid var(--border-default)' : '1px solid var(--border-subtle)',
          boxShadow: pinned ? 'var(--shadow-md)' : 'none',
        }}
      >
        <div className="max-w-5xl mx-auto py-2.5 px-4 sm:px-6 flex items-center gap-2">
          {/* When pinned, show series name as context */}
          {pinned && (
            <span
              className="text-sm font-medium truncate max-w-[40%] sm:max-w-[50%]"
              title={series.name}
              style={{ color: 'var(--text-heading)' }}
            >
              {series.name}
            </span>
          )}
          {pinned && <span style={{ color: 'var(--text-muted)' }}>·</span>}

          <Kicker count={comics.length} className="shrink-0">Chapters</Kicker>

          <div className="flex-1 min-w-0">
            {showSearch && (
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chapters…"
                  autoFocus
                  className="by-input w-full"
                  style={{ paddingLeft: 28, paddingRight: 28, height: 32, fontSize: 13 }}
                />
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                    style={{ color: 'var(--text-muted)' }}
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
                className="absolute right-0 overflow-hidden text-sm z-30"
                style={{
                  top: 'calc(100% + 4px)',
                  minWidth: '10rem',
                  background: 'var(--surface-raised)',
                  borderRadius: 12,
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-2xl)',
                }}
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

          {/* Grid / list — DS SegmentedControl */}
          <div className="hidden sm:block">
            <SegmentedControl
              options={[
                { value: 'list', label: '', icon: <List size={14} /> },
                { value: 'grid', label: '', icon: <LayoutGrid size={14} /> },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
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

        {/* ===== More like this — tag-similarity recs from your own library ===== */}
        {similar.length > 0 && (
          <section className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                More like this
              </h2>
              <span className="text-[10px] uppercase tracking-wider font-mono text-gray-400">
                from your library
              </span>
            </div>
            {/* Horizontal scroll strip — same pattern as ContinueShelf.
                Each card is a thumb + title + tiny "similarity" pill. */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-3 snap-x snap-mandatory">
              {similar.map(({ series: s, sharedTags, similarity }) => (
                <Link
                  key={s.id}
                  to={`/series/${s.id}`}
                  className="group shrink-0 w-[130px] sm:w-[150px] snap-start"
                  title={`${s.name}\n${similarity}% tag similarity · shares: ${sharedTags.join(', ')}`}
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-800 group-hover:ring-accent transition-all">
                    <img
                      src={s.coverFile ? getSeriesCoverUrl(s.id, s.coverFile) : getPlaceholderUrl(s.placeholder)}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums backdrop-blur-sm">
                      {similarity}%
                    </div>
                  </div>
                  <p className="text-xs font-medium mt-1.5 line-clamp-2 group-hover:text-accent transition-colors">{s.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                    {sharedTags.slice(0, 3).join(' · ')}
                  </p>
                </Link>
              ))}
            </div>
          </section>
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

