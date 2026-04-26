import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Trash2, RotateCcw, Square, Loader, Check, AlertCircle,
  Users, Database, HardDrive, Zap, Search, X, Sparkles, GitMerge, Wrench,
  BookOpen, Tag, Link as LinkIcon, Bell,
} from 'lucide-react';
import {
  getAdminStats, getAdminTasks, deleteAdminTask, retryAdminTask, cancelAdminTask, clearAdminTasks,
  getAdminCatalog, purgeAdminSeries, adminEnrich, adminRescan, adminCleanup, adminMaintenance,
  getAdminSubscriptions, adminSyncAll, syncSeriesNow, updateSeriesSyncSource,
  getAdminUsers,
} from '../lib/api';
import MergeModal from '../components/MergeModal';
import SeriesEditModal from '../components/SeriesEditModal';
import StickyToolbar from '../components/StickyToolbar';
import ToolbarIconButton from '../components/ToolbarIconButton';
import ConfirmSheet from '../components/ConfirmSheet';
import SeriesAdminRow from '../components/SeriesAdminRow';
import ProfileMenu from '../components/ProfileMenu';
import Avatar from '../components/Avatar';

type Tab = 'library' | 'tasks' | 'subscriptions' | 'users';

// Header height (row 1 ~52px + row 2 ~44px). Used as topPx offset for the
// per-tab sticky toolbar so it pins right below the page header.
const HEADER_PX = 96;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function relativeTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

interface Confirm {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('library');
  const [stats, setStats] = useState<any>(null);

  // Tasks
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Catalog
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [maintaining, setMaintaining] = useState(false);

  // Multi-select for merge (still capped at 2 since MergeModal takes pair)
  const [selectMode, setSelectMode] = useState(false);
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set());
  const [mergeTarget, setMergeTarget] = useState<{ a: any; b: any } | null>(null);

  // Edit
  const [editTarget, setEditTarget] = useState<any | null>(null);

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Confirm dialogs (replaces window.confirm)
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // ----- Data loading -----

  useEffect(() => {
    getAdminStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'tasks') {
      setLoadingTasks(true);
      getAdminTasks().then(setTasks).finally(() => setLoadingTasks(false));
    } else if (tab === 'library') {
      setLoadingCatalog(true);
      getAdminCatalog().then(setCatalog).finally(() => setLoadingCatalog(false));
    } else if (tab === 'subscriptions') {
      setLoadingSubs(true);
      getAdminSubscriptions().then(setSubscriptions).finally(() => setLoadingSubs(false));
    } else if (tab === 'users') {
      setLoadingUsers(true);
      getAdminUsers().then(setUsers).finally(() => setLoadingUsers(false));
    }
  }, [tab]);

  const refreshTasks = () => {
    setLoadingTasks(true);
    getAdminTasks().then(setTasks).finally(() => setLoadingTasks(false));
  };

  const refreshCatalog = () => {
    setLoadingCatalog(true);
    return getAdminCatalog().then((c) => { setCatalog(c); return c; }).finally(() => setLoadingCatalog(false));
  };

  // ----- Filtered catalog -----

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((s) => s.name.toLowerCase().includes(q) || s.englishTitle?.toLowerCase().includes(q));
  }, [catalog, catalogSearch]);

  // ----- Tab-specific stat computations -----

  const libraryStatCards = useMemo(() => {
    if (!stats) return null;
    const tagged = catalog.filter((s) => (s.tags || []).length > 0).length;
    const linked = catalog.filter((s) => s.malId).length;
    const total = catalog.length || stats.seriesCount;
    return {
      tagged, linked, total,
      taggedPct: total > 0 ? Math.round((tagged / total) * 100) : 0,
      linkedPct: total > 0 ? Math.round((linked / total) * 100) : 0,
    };
  }, [catalog, stats]);

  const taskStatCards = useMemo(() => ({
    active: tasks.filter((t) => t.status === 'downloading').length,
    queued: tasks.filter((t) => t.status === 'queued').length,
    complete: tasks.filter((t) => t.status === 'complete').length,
    errors: tasks.filter((t) => t.status === 'error').length,
  }), [tasks]);

  const subStatCards = useMemo(() => {
    const newCh = subscriptions.reduce((sum, s) => sum + (s.newChapterCount || 0), 0);
    const sources = new Set(subscriptions.map((s) => s.syncSource?.sourceId).filter(Boolean)).size;
    const lastSyncs = subscriptions
      .map((s) => (s.lastSyncAt ? new Date(s.lastSyncAt).getTime() : 0))
      .filter((t) => t > 0);
    const lastSync = lastSyncs.length ? new Date(Math.max(...lastSyncs)) : null;
    return { newCh, sources, lastSync };
  }, [subscriptions]);

  const userStatCards = useMemo(() => {
    const totalReads = users.reduce((sum, u) => sum + (u.readChapters || 0), 0);
    const tracking = users.reduce((sum, u) => sum + (u.progressEntries || 0), 0);
    const active = users.filter((u) => (u.progressEntries || 0) > 0).length;
    return { totalReads, tracking, active };
  }, [users]);

  // ----- Bulk action helpers -----

  const runBulk = async (
    setBusy: (b: boolean) => void,
    action: () => Promise<unknown>,
    refresh = true,
  ) => {
    setBusy(true);
    try {
      await action();
      if (refresh) {
        await refreshCatalog();
        getAdminStats().then(setStats).catch(() => {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const askConfirm = (c: Confirm) => setConfirm(c);
  const handleConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.onConfirm();
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  };

  const handleSelectToggle = (id: string) => {
    setMergeSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 2) next.add(id);
      return next;
    });
  };

  // Auto-open merge modal when 2 are selected
  useEffect(() => {
    if (selectMode && mergeSelected.size === 2) {
      const ids = [...mergeSelected];
      const a = catalog.find((s) => s.id === ids[0]);
      const b = catalog.find((s) => s.id === ids[1]);
      if (a && b) setMergeTarget({ a, b });
    }
  }, [mergeSelected, selectMode, catalog]);

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">

      {/* ========================================================================
          PAGE HEADER — sticky, two rows
          Row 1: [←] Admin v…  …  [⋯]
          Row 2: tab strip (Library | Tasks | Subscriptions | Users)
          Sticky at top:0, z-30.
          ======================================================================== */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        {/* Row 1 */}
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            aria-label="Back to library"
            title="Library"
            className="p-2 -ml-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg sm:text-xl font-bold">Admin</h1>
          {stats?.version && (
            <span className="text-[11px] text-gray-400 dark:text-gray-600 font-mono">v{stats.version}</span>
          )}
          <div className="flex-1" />
          {/* ProfileMenu — replaces the old ⋯ + nested UserMenu.
              Bulk actions are injected as the first section; identity / nav
              / theme / settings / sign-out come from the menu itself. */}
          <ProfileMenu
            sections={[
              {
                title: 'Library tools',
                items: [
                  {
                    icon: maintaining ? <Loader size={15} className="animate-spin" /> : <Wrench size={15} />,
                    label: 'Run maintenance',
                    hint: 'Page counts, thumbs, orphans',
                    onClick: () => runBulk(setMaintaining, adminMaintenance, false),
                    disabled: maintaining,
                    keepOpen: true,
                  },
                  {
                    icon: cleaning ? <Loader size={15} className="animate-spin" /> : <Sparkles size={15} />,
                    label: 'Cleanup',
                    hint: 'Remove orphaned files & data',
                    onClick: () => runBulk(setCleaning, adminCleanup),
                    disabled: cleaning,
                    keepOpen: true,
                  },
                  {
                    icon: rescanning ? <Loader size={15} className="animate-spin" /> : <RefreshCw size={15} />,
                    label: 'Rescan library',
                    hint: 'Re-detect all files on disk',
                    onClick: () => runBulk(setRescanning, adminRescan),
                    disabled: rescanning,
                    keepOpen: true,
                  },
                  {
                    icon: enriching ? <Loader size={15} className="animate-spin" /> : <Database size={15} />,
                    label: 'Re-enrich all',
                    hint: 'Refetch metadata from MAL',
                    onClick: () => runBulk(setEnriching, () => adminEnrich(true)),
                    disabled: enriching,
                    keepOpen: true,
                    destructive: true,
                  },
                  {
                    icon: syncingAll ? <Loader size={15} className="animate-spin" /> : <RefreshCw size={15} />,
                    label: 'Sync all subscriptions',
                    onClick: async () => {
                      setSyncingAll(true);
                      try { await adminSyncAll(); }
                      finally { setSyncingAll(false); }
                      setTimeout(() => { getAdminSubscriptions().then(setSubscriptions); }, 2000);
                    },
                    disabled: syncingAll,
                  },
                ],
              },
            ]}
          />
        </div>

        {/* Row 2: tab strip */}
        <div className="max-w-6xl mx-auto px-1 sm:px-3 flex overflow-x-auto no-scrollbar">
          <TabButton active={tab === 'library'} onClick={() => setTab('library')}>Library</TabButton>
          <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')}>Tasks</TabButton>
          <TabButton active={tab === 'subscriptions'} onClick={() => setTab('subscriptions')}>Subscriptions</TabButton>
          <TabButton active={tab === 'users'} onClick={() => setTab('users')}>Users</TabButton>
        </div>
      </header>

      {/* ========================================================================
          STAT CARDS — always shown, tab-specific. Inline (scrolls with content).
          ======================================================================== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        {tab === 'library' && libraryStatCards && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Database size={12} />}
              label="Series"
              value={libraryStatCards.total.toLocaleString()}
              hint={stats ? `${stats.chapterCount.toLocaleString()} chapters` : undefined}
            />
            <StatCard
              icon={<HardDrive size={12} />}
              label="Storage"
              value={stats ? formatBytes(stats.librarySize) : '—'}
              hint={stats ? `Data: ${formatBytes(stats.dataSize)}` : undefined}
            />
            <StatCard
              icon={<Tag size={12} />}
              label="Tagged"
              value={`${libraryStatCards.taggedPct}%`}
              hint={`${libraryStatCards.total - libraryStatCards.tagged} untagged`}
            />
            <StatCard
              icon={<LinkIcon size={12} />}
              label="MAL linked"
              value={`${libraryStatCards.linkedPct}%`}
              hint={`${libraryStatCards.total - libraryStatCards.linked} unlinked`}
            />
          </div>
        )}

        {tab === 'tasks' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Loader size={12} />}
              label="Active"
              value={taskStatCards.active}
              accent={taskStatCards.active > 0 ? 'blue' : undefined}
            />
            <StatCard
              icon={<Zap size={12} />}
              label="Queued"
              value={taskStatCards.queued}
              accent={taskStatCards.queued > 0 ? 'amber' : undefined}
            />
            <StatCard
              icon={<Check size={12} />}
              label="Complete"
              value={taskStatCards.complete}
            />
            <StatCard
              icon={<AlertCircle size={12} />}
              label="Errors"
              value={taskStatCards.errors}
              accent={taskStatCards.errors > 0 ? 'red' : undefined}
            />
          </div>
        )}

        {tab === 'subscriptions' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Bell size={12} />}
              label="Subscriptions"
              value={subscriptions.length}
            />
            <StatCard
              icon={<Database size={12} />}
              label="New chapters"
              value={subStatCards.newCh}
              accent={subStatCards.newCh > 0 ? 'blue' : undefined}
            />
            <StatCard
              icon={<RefreshCw size={12} />}
              label="Sources"
              value={subStatCards.sources}
            />
            <StatCard
              icon={<Zap size={12} />}
              label="Last sync"
              value={subStatCards.lastSync ? relativeTime(subStatCards.lastSync) : '—'}
            />
          </div>
        )}

        {tab === 'users' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Users size={12} />}
              label="Users"
              value={users.length}
            />
            <StatCard
              icon={<Check size={12} />}
              label="Total reads"
              value={userStatCards.totalReads.toLocaleString()}
            />
            <StatCard
              icon={<BookOpen size={12} />}
              label="Tracking"
              value={userStatCards.tracking.toLocaleString()}
              hint="Chapters in progress"
            />
            <StatCard
              icon={<Zap size={12} />}
              label="Active readers"
              value={userStatCards.active}
            />
          </div>
        )}
      </section>

      {/* ========================================================================
          PER-TAB STICKY TOOLBAR — pins below the page header at topPx=HEADER_PX
          ======================================================================== */}
      {tab === 'library' && (
        <StickyToolbar topPx={HEADER_PX}>
          {(pinned) => (
            <LibraryToolbar
              pinned={pinned}
              showSearch={showSearch}
              setShowSearch={setShowSearch}
              search={catalogSearch}
              setSearch={setCatalogSearch}
              resultCount={filteredCatalog.length}
              selectMode={selectMode}
              setSelectMode={(v) => {
                setSelectMode(v);
                if (!v) setMergeSelected(new Set());
              }}
              selectedCount={mergeSelected.size}
            />
          )}
        </StickyToolbar>
      )}

      {tab === 'tasks' && (
        <StickyToolbar topPx={HEADER_PX}>
          {() => (
            <>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Download Tasks</h2>
              <div className="flex-1" />
              <ToolbarIconButton onClick={refreshTasks} title="Refresh" disabled={loadingTasks}>
                {loadingTasks ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              </ToolbarIconButton>
              {tasks.some((t) => t.status === 'complete' || t.status === 'error') && (
                <ToolbarIconButton
                  onClick={() => askConfirm({
                    title: 'Clear completed tasks?',
                    message: 'Removes finished and errored downloads from the list. In-progress tasks are unaffected.',
                    confirmLabel: 'Clear',
                    onConfirm: async () => { await clearAdminTasks(); refreshTasks(); },
                  })}
                  title="Clear completed"
                  label="Clear"
                  variant="destructive"
                >
                  <Trash2 size={16} />
                </ToolbarIconButton>
              )}
            </>
          )}
        </StickyToolbar>
      )}

      {tab === 'subscriptions' && (
        <StickyToolbar topPx={HEADER_PX}>
          {() => (
            <>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Subscriptions <span className="text-gray-400 font-normal">({subscriptions.length})</span>
              </h2>
              <div className="flex-1" />
            </>
          )}
        </StickyToolbar>
      )}

      {tab === 'users' && (
        <StickyToolbar topPx={HEADER_PX}>
          {() => (
            <>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Registered Users</h2>
              <div className="flex-1" />
            </>
          )}
        </StickyToolbar>
      )}

      {/* ========================================================================
          TAB CONTENT
          ======================================================================== */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 pb-32">

        {/* Tasks Tab */}
        {tab === 'tasks' && (
          <section className="space-y-2">
            {tasks.length === 0 && !loadingTasks && (
              <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
                <Zap size={32} className="mx-auto mb-2 opacity-40" />
                <p>No download tasks.</p>
                <p className="text-xs mt-1">Imports from Discover will appear here.</p>
              </div>
            )}
            {tasks.map((task) => (
              <div key={task.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center gap-3">
                  {task.status === 'downloading' && <Loader size={14} className="animate-spin text-accent shrink-0" />}
                  {task.status === 'queued' && <Zap size={14} className="text-amber-500 shrink-0" />}
                  {task.status === 'complete' && <Check size={14} className="text-green-500 shrink-0" />}
                  {task.status === 'error' && <AlertCircle size={14} className="text-red-500 shrink-0" />}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.mangaTitle}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {task.status === 'complete' ? `${task.progress.total} chapters` :
                       task.status === 'error' ? task.error :
                       `Ch. ${task.progress.currentChapter || '...'} — ${task.progress.current}/${task.progress.total}`}
                    </p>
                    {(task.status === 'downloading' || task.status === 'queued') && (
                      <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${task.progress.total > 0 ? (task.progress.current / task.progress.total) * 100 : 0}%` }} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {(task.status === 'downloading' || task.status === 'queued') && (
                      <button onClick={async () => { await cancelAdminTask(task.id); refreshTasks(); }}
                        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Cancel" aria-label="Cancel task"
                      >
                        <Square size={14} />
                      </button>
                    )}
                    {task.status === 'error' && (
                      <button onClick={async () => { await retryAdminTask(task.id); refreshTasks(); }}
                        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-accent transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Retry" aria-label="Retry task"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                    <button onClick={async () => { await deleteAdminTask(task.id); refreshTasks(); }}
                      className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                      title="Delete" aria-label="Delete task"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Library Tab */}
        {tab === 'library' && (
          <>
            {loadingCatalog && (
              <div className="flex justify-center py-12"><Loader size={20} className="animate-spin text-accent" /></div>
            )}

            {!loadingCatalog && filteredCatalog.length === 0 && (
              <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
                <Database size={32} className="mx-auto mb-2 opacity-40" />
                <p>{catalogSearch ? `No series match "${catalogSearch}"` : 'No series yet.'}</p>
              </div>
            )}

            {!loadingCatalog && filteredCatalog.length > 0 && (
              <>
                <div className="hidden md:grid md:grid-cols-[1fr_auto_minmax(140px,220px)_64px_88px] gap-x-3 px-4 pb-2 text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-600 font-medium">
                  <span>Name</span>
                  <span className="text-right">Ch.</span>
                  <span>Tags</span>
                  <span>MAL</span>
                  <span></span>
                </div>

                <div className="space-y-1.5">
                  {filteredCatalog.map((s) => {
                    const isSelected = mergeSelected.has(s.id);
                    const canSelect = isSelected || mergeSelected.size < 2;
                    return (
                      <SeriesAdminRow
                        key={s.id}
                        series={s}
                        selectMode={selectMode}
                        selected={isSelected}
                        selectable={canSelect}
                        onEdit={() => setEditTarget(s)}
                        onPurge={() => askConfirm({
                          title: `Delete "${s.name}"?`,
                          message: `Permanently removes ${s.count} chapter${s.count === 1 ? '' : 's'} and the series metadata.`,
                          confirmLabel: 'Delete',
                          destructive: true,
                          onConfirm: async () => {
                            await purgeAdminSeries(s.id);
                            setCatalog((prev) => prev.filter((x) => x.id !== s.id));
                            setMergeSelected((prev) => { const next = new Set(prev); next.delete(s.id); return next; });
                          },
                        })}
                        onToggleSelect={() => {
                          if (!selectMode) setSelectMode(true);
                          handleSelectToggle(s.id);
                        }}
                      />
                    );
                  })}
                </div>
                <p className="px-4 pt-3 text-[11px] text-gray-400 dark:text-gray-600">
                  {filteredCatalog.length} of {catalog.length}
                </p>
              </>
            )}
          </>
        )}

        {/* Subscriptions Tab */}
        {tab === 'subscriptions' && (
          <>
            {loadingSubs && (
              <div className="flex justify-center py-12"><Loader size={20} className="animate-spin text-accent" /></div>
            )}

            {!loadingSubs && subscriptions.length === 0 && (
              <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
                <BookOpen size={32} className="mx-auto mb-2 opacity-40" />
                <p>No subscriptions yet.</p>
                <p className="text-xs mt-1">Series downloaded from a source are auto-subscribed. You can also subscribe from a series page.</p>
              </div>
            )}

            {!loadingSubs && subscriptions.length > 0 && (
              <div className="space-y-1.5">
                {subscriptions.map((s) => (
                  <div key={s.id} className="bg-white dark:bg-gray-900 rounded-xl ring-1 ring-gray-200 dark:ring-gray-800 px-4 py-3 md:py-2.5 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_minmax(140px,200px)_80px_minmax(120px,160px)_auto] md:items-center gap-x-3 gap-y-1">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      {s.englishTitle && s.englishTitle !== s.name && (
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{s.englishTitle}</p>
                      )}
                      <div className="md:hidden mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
                        <span className="capitalize">{s.syncSource.sourceId}</span>
                        <span className="text-gray-300 dark:text-gray-700">·</span>
                        <span>{s.chapterCount} ch</span>
                        {s.newChapterCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-accent/15 text-accent rounded-full font-medium">+{s.newChapterCount} new</span>
                        )}
                        <span className="text-gray-300 dark:text-gray-700">·</span>
                        <span>{s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleDateString() : 'Never'}</span>
                      </div>
                    </div>

                    <div className="hidden md:block min-w-0">
                      <p className="text-xs capitalize">{s.syncSource.sourceId}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate">{s.syncSource.mangaId}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                      {s.chapterCount}
                      {s.newChapterCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-accent/15 text-accent rounded-full">+{s.newChapterCount}</span>
                      )}
                    </div>
                    <span className="hidden md:inline text-xs text-gray-500 dark:text-gray-400">
                      {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : 'Never'}
                    </span>

                    <div className="col-start-2 row-start-1 md:row-auto md:col-auto self-start md:self-auto flex items-center gap-1 justify-end">
                      <button
                        onClick={async () => {
                          setSyncingId(s.id);
                          try {
                            await syncSeriesNow(s.id);
                            setSubscriptions(await getAdminSubscriptions());
                          } finally {
                            setSyncingId(null);
                          }
                        }}
                        disabled={syncingId === s.id}
                        className="p-2 rounded-md hover:bg-accent/10 text-gray-400 hover:text-accent transition-colors disabled:opacity-50 min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Sync now"
                        aria-label="Sync now"
                      >
                        {syncingId === s.id ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      </button>
                      <button
                        onClick={() => askConfirm({
                          title: `Unsubscribe "${s.name}"?`,
                          message: 'New chapters will no longer be auto-downloaded. Existing chapters stay in your library.',
                          confirmLabel: 'Unsubscribe',
                          onConfirm: async () => {
                            await updateSeriesSyncSource(s.id, null);
                            setSubscriptions((prev) => prev.filter((x) => x.id !== s.id));
                          },
                        })}
                        className="p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Unsubscribe"
                        aria-label="Unsubscribe"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <>
            {loadingUsers && (
              <div className="flex justify-center py-12"><Loader size={20} className="animate-spin text-accent" /></div>
            )}
            {!loadingUsers && users.length === 0 && (
              <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
                <Users size={32} className="mx-auto mb-2 opacity-40" />
                <p>No users found.</p>
              </div>
            )}
            {!loadingUsers && users.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {users.map((u) => (
                  <div key={u.username} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex items-center gap-3">
                      <Avatar username={u.username} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.username}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {u.collectionSize} series · {u.readChapters} read · {u.progressEntries} tracked
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ===== Selection footer (Library, multi-select mode) ===== */}
      {tab === 'library' && selectMode && (
        <div
          className="fixed left-0 right-0 bottom-0 z-30 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 shadow-2xl"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <span className="text-sm font-medium">
              {mergeSelected.size === 0 && 'Select 2 series to merge'}
              {mergeSelected.size === 1 && '1 selected — pick one more'}
              {mergeSelected.size === 2 && '2 selected'}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => {
                if (mergeSelected.size === 2) {
                  const ids = [...mergeSelected];
                  const a = catalog.find((s) => s.id === ids[0]);
                  const b = catalog.find((s) => s.id === ids[1]);
                  if (a && b) setMergeTarget({ a, b });
                }
              }}
              disabled={mergeSelected.size !== 2}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors min-h-[40px]"
            >
              <GitMerge size={14} /> Merge
            </button>
            <button
              onClick={() => { setSelectMode(false); setMergeSelected(new Set()); }}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 min-h-[40px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ===== Modals ===== */}
      {mergeTarget && (
        <MergeModal
          seriesA={mergeTarget.a}
          seriesB={mergeTarget.b}
          onClose={() => setMergeTarget(null)}
          onComplete={() => {
            setMergeTarget(null);
            setMergeSelected(new Set());
            setSelectMode(false);
            refreshCatalog();
            getAdminStats().then(setStats);
          }}
        />
      )}

      {editTarget && (
        <SeriesEditModal
          series={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={() => {
            setEditTarget(null);
            refreshCatalog();
          }}
        />
      )}

      <ConfirmSheet
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        destructive={confirm?.destructive}
        busy={confirmBusy}
        onConfirm={handleConfirm}
        onCancel={() => { if (!confirmBusy) setConfirm(null); }}
      />
    </div>
  );
}

// ----- Subcomponents -----

function StatCard({
  icon, label, value, hint, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  accent?: 'blue' | 'amber' | 'red';
}) {
  const valueColor = accent === 'blue' ? 'text-accent'
    : accent === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : accent === 'red' ? 'text-red-600 dark:text-red-400'
    : '';
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px] sm:text-xs mb-1">
        {icon} <span className="truncate">{label}</span>
      </div>
      <p className={`text-xl sm:text-2xl font-bold ${valueColor}`}>{value}</p>
      {hint && <p className="text-[10px] sm:text-[11px] text-gray-400 truncate">{hint}</p>}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors shrink-0 border-b-2 ${
        active
          ? 'text-accent border-accent'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-transparent'
      }`}
    >
      {children}
    </button>
  );
}

function LibraryToolbar({
  showSearch, setShowSearch, search, setSearch, resultCount,
  selectMode, setSelectMode, selectedCount,
}: {
  pinned: boolean;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  resultCount: number;
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  selectedCount: number;
}) {
  if (showSearch) {
    return (
      <>
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            placeholder="Search series…"
            className="w-full pl-8 pr-8 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <ToolbarIconButton
          onClick={() => { setShowSearch(false); setSearch(''); }}
          title="Close search"
        >
          <X size={16} />
        </ToolbarIconButton>
      </>
    );
  }
  return (
    <>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">
        <span className="hidden sm:inline">Library </span>
        <span className="text-gray-400 font-normal">({resultCount})</span>
      </h2>
      <div className="flex-1" />
      <ToolbarIconButton onClick={() => setShowSearch(true)} title="Search">
        <Search size={16} />
      </ToolbarIconButton>
      <ToolbarIconButton
        onClick={() => setSelectMode(!selectMode)}
        active={selectMode}
        title={selectMode ? 'Cancel selection' : 'Select for merge'}
        label={selectMode
          ? (selectedCount > 0 ? `${selectedCount}/2` : 'Select')
          : 'Select'}
      >
        <GitMerge size={16} />
      </ToolbarIconButton>
    </>
  );
}

