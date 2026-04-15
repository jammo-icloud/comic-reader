import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trash2, RotateCcw, Square, Loader, Check, AlertCircle, Users, Database, HardDrive, Zap, Search, X, Sparkles, GitMerge, Wrench } from 'lucide-react';
import {
  getAdminStats, getAdminTasks, deleteAdminTask, retryAdminTask, cancelAdminTask, clearAdminTasks,
  getAdminCatalog, purgeAdminSeries, adminEnrich, adminRescan, adminCleanup, adminMaintenance,
  getAdminUsers,
} from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import UserMenu from '../components/UserMenu';
import MergeModal from '../components/MergeModal';

type Tab = 'tasks' | 'library' | 'users';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('tasks');
  const [stats, setStats] = useState<any>(null);

  // Tasks
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Catalog
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [maintaining, setMaintaining] = useState(false);

  // Merge — select exactly 2 series from the catalog
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set());
  const [mergeTarget, setMergeTarget] = useState<{ a: any; b: any } | null>(null);


  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Load stats on mount
  useEffect(() => {
    getAdminStats().then(setStats).catch(() => {});
  }, []);

  // Load tab data
  useEffect(() => {
    if (tab === 'tasks') {
      setLoadingTasks(true);
      getAdminTasks().then(setTasks).finally(() => setLoadingTasks(false));
    } else if (tab === 'library') {
      setLoadingCatalog(true);
      getAdminCatalog().then(setCatalog).finally(() => setLoadingCatalog(false));
    } else if (tab === 'users') {
      setLoadingUsers(true);
      getAdminUsers().then(setUsers).finally(() => setLoadingUsers(false));
    }
  }, [tab]);

  const refreshTasks = () => {
    setLoadingTasks(true);
    getAdminTasks().then(setTasks).finally(() => setLoadingTasks(false));
  };

  const filteredCatalog = catalogSearch
    ? catalog.filter((s) => s.name.toLowerCase().includes(catalogSearch.toLowerCase()) || s.englishTitle?.toLowerCase().includes(catalogSearch.toLowerCase()))
    : catalog;

  const tabClass = (t: Tab) => `px-4 py-2 text-sm font-medium transition-colors ${
    tab === t
      ? 'text-blue-500 border-b-2 border-blue-500'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
  }`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold flex-1">
            Admin
            {stats?.version && <span className="text-[10px] text-gray-500 ml-2 font-normal">v{stats.version}</span>}
          </h1>
          <ThemeToggle />
          <UserMenu />
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-0 border-t border-gray-100 dark:border-gray-900">
          <button onClick={() => setTab('tasks')} className={tabClass('tasks')}>Tasks</button>
          <button onClick={() => setTab('library')} className={tabClass('library')}>Library</button>
          <button onClick={() => setTab('users')} className={tabClass('users')}>Users</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1"><Database size={12} /> Series</div>
              <p className="text-2xl font-bold">{stats.seriesCount}</p>
              <p className="text-[10px] text-gray-400">{stats.chapterCount} chapters</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1"><Users size={12} /> Users</div>
              <p className="text-2xl font-bold">{stats.userCount}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1"><HardDrive size={12} /> Library</div>
              <p className="text-2xl font-bold">{formatBytes(stats.librarySize)}</p>
              <p className="text-[10px] text-gray-400">Data: {formatBytes(stats.dataSize)}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mb-1"><Zap size={12} /> Tasks</div>
              <p className="text-2xl font-bold">{stats.activeTasks}</p>
              <p className="text-[10px] text-gray-400">{stats.totalTasks} total</p>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {tab === 'tasks' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Download Tasks</h2>
              <div className="flex items-center gap-2">
                <button onClick={refreshTasks} disabled={loadingTasks} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {loadingTasks ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                </button>
                {tasks.some((t) => t.status === 'complete' || t.status === 'error') && (
                  <button
                    onClick={async () => { await clearAdminTasks(); refreshTasks(); }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear completed
                  </button>
                )}
              </div>
            </div>

            {tasks.length === 0 && !loadingTasks && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No download tasks</p>
            )}

            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center gap-3">
                    {task.status === 'downloading' && <Loader size={14} className="animate-spin text-blue-500 shrink-0" />}
                    {task.status === 'queued' && <Zap size={14} className="text-amber-500 shrink-0" />}
                    {task.status === 'complete' && <Check size={14} className="text-green-500 shrink-0" />}
                    {task.status === 'error' && <AlertCircle size={14} className="text-red-500 shrink-0" />}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.mangaTitle}</p>
                      <p className="text-[11px] text-gray-500">
                        {task.status === 'complete' ? `${task.progress.total} chapters` :
                         task.status === 'error' ? task.error :
                         `Ch. ${task.progress.currentChapter || '...'} — ${task.progress.current}/${task.progress.total}`}
                      </p>
                      {(task.status === 'downloading' || task.status === 'queued') && (
                        <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${task.progress.total > 0 ? (task.progress.current / task.progress.total) * 100 : 0}%` }} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {(task.status === 'downloading' || task.status === 'queued') && (
                        <button onClick={async () => { await cancelAdminTask(task.id); refreshTasks(); }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500" title="Cancel">
                          <Square size={13} />
                        </button>
                      )}
                      {task.status === 'error' && (
                        <button onClick={async () => { await retryAdminTask(task.id); refreshTasks(); }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-500" title="Retry">
                          <RotateCcw size={13} />
                        </button>
                      )}
                      <button onClick={async () => { await deleteAdminTask(task.id); refreshTasks(); }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Library Tab */}
        {tab === 'library' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Filter series..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                {mergeSelected.size === 2 && (
                  <button
                    onClick={() => {
                      const ids = [...mergeSelected];
                      const a = catalog.find((s) => s.id === ids[0]);
                      const b = catalog.find((s) => s.id === ids[1]);
                      if (a && b) setMergeTarget({ a, b });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                  >
                    <GitMerge size={12} /> Merge Selected
                  </button>
                )}
                {mergeSelected.size > 0 && mergeSelected.size < 2 && (
                  <span className="text-[10px] text-gray-400">Select one more to merge</span>
                )}
                <button
                  onClick={async () => { setMaintaining(true); await adminMaintenance().catch(() => {}); setMaintaining(false); }}
                  disabled={maintaining}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  title="Fix page counts and regenerate missing thumbnails"
                >
                  {maintaining ? <Loader size={12} className="animate-spin" /> : <Wrench size={12} />} Maintenance
                </button>
                <button
                  onClick={async () => { setCleaning(true); await adminCleanup().catch(() => {}); setCleaning(false); getAdminStats().then(setStats).catch(() => {}); setLoadingCatalog(true); getAdminCatalog().then(setCatalog).finally(() => setLoadingCatalog(false)); }}
                  disabled={cleaning}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {cleaning ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />} Cleanup
                </button>
                <button
                  onClick={async () => { setRescanning(true); await adminRescan().catch(() => {}); setRescanning(false); setLoadingCatalog(true); getAdminCatalog().then(setCatalog).finally(() => setLoadingCatalog(false)); }}
                  disabled={rescanning}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {rescanning ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />} Rescan
                </button>
                <button
                  onClick={async () => { setEnriching(true); await adminEnrich(true).catch(() => {}); setEnriching(false); setLoadingCatalog(true); getAdminCatalog().then(setCatalog).finally(() => setLoadingCatalog(false)); }}
                  disabled={enriching}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {enriching ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />} Re-enrich All
                </button>
              </div>
            </div>

            {loadingCatalog && (
              <div className="flex justify-center py-8"><Loader size={20} className="animate-spin text-blue-500" /></div>
            )}

            {!loadingCatalog && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-500 dark:text-gray-400">
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-4 py-2 font-medium">Chapters</th>
                        <th className="px-4 py-2 font-medium">Tags</th>
                        <th className="px-4 py-2 font-medium">MAL</th>
                        <th className="px-4 py-2 font-medium w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {filteredCatalog.map((s) => {
                        const isSelected = mergeSelected.has(s.id);
                        const canSelect = isSelected || mergeSelected.size < 2;
                        return (
                        <tr
                          key={s.id}
                          onClick={() => {
                            if (!canSelect && !isSelected) return;
                            setMergeSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(s.id)) next.delete(s.id);
                              else if (next.size < 2) next.add(s.id);
                              return next;
                            });
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/15 border-l-2 border-l-blue-500'
                              : canSelect
                                ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-2 border-l-transparent'
                                : 'border-l-2 border-l-transparent opacity-60'
                          }`}
                        >
                          <td className="px-4 py-2">
                            <p className="font-medium truncate max-w-[250px]">{s.name}</p>
                            {s.englishTitle && s.englishTitle !== s.name && (
                              <p className="text-[10px] text-gray-400 truncate max-w-[250px]">{s.englishTitle}</p>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-500">{s.count}</td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {(s.tags || []).map((t: string) => (
                                <span key={t} className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full capitalize">{t}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-gray-500">{s.malId || '—'}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`Permanently delete "${s.name}" and all ${s.count} chapters?`)) return;
                                await purgeAdminSeries(s.id);
                                setCatalog((prev) => prev.filter((x) => x.id !== s.id));
                                setMergeSelected((prev) => { const next = new Set(prev); next.delete(s.id); return next; });
                              }}
                              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                              title="Purge (delete files)"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-100 dark:border-gray-800">
                  {filteredCatalog.length} series
                </div>
              </div>
            )}
          </section>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Registered Users</h2>

            {loadingUsers && (
              <div className="flex justify-center py-8"><Loader size={20} className="animate-spin text-blue-500" /></div>
            )}

            {!loadingUsers && users.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No users found</p>
            )}

            {!loadingUsers && users.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {users.map((u) => (
                  <div key={u.username} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{u.username}</p>
                        <p className="text-[10px] text-gray-400">
                          {u.collectionSize} series · {u.readChapters} read · {u.progressEntries} tracked
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Merge Modal */}
      {mergeTarget && (
        <MergeModal
          seriesA={mergeTarget.a}
          seriesB={mergeTarget.b}
          onClose={() => setMergeTarget(null)}
          onComplete={() => {
            setMergeTarget(null);
            setMergeSelected(new Set());
            setLoadingCatalog(true);
            getAdminCatalog().then(setCatalog).finally(() => setLoadingCatalog(false));
            getAdminStats().then(setStats);
          }}
        />
      )}
    </div>
  );
}
