import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Compass, FolderPlus, Bell, ChevronDown, ChevronRight, BookOpen, Newspaper } from 'lucide-react';
import type { Series, ContinueReadingItem } from '../lib/types';
import { getSeries, getContinueReading, getSeriesCoverUrl, getPlaceholderUrl, getImportCount } from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import ImportModal from '../components/ImportModal';
import PendingList from '../components/PendingList';

const btnClass = 'p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400';
const btnActiveClass = 'p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors';

export default function LibraryPage() {
  const navigate = useNavigate();
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [continueReading, setContinueReading] = useState<ContinueReadingItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<'comic' | 'magazine'>('comic');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [continueCollapsed, setContinueCollapsed] = useState(true);

  // Import
  const [showImport, setShowImport] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const loadData = useCallback(async () => {
    const [series, cont, pending] = await Promise.all([
      getSeries(typeFilter),
      getContinueReading(),
      getImportCount().catch(() => ({ count: 0 })),
    ]);
    setSeriesList(series);
    setContinueReading(cont);
    setPendingCount(pending.count);
  }, [typeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll pending count every 5s when something might be scanning
  useEffect(() => {
    if (pendingCount === 0 && !showImport) return;
    const interval = setInterval(async () => {
      const { count } = await getImportCount().catch(() => ({ count: 0 }));
      setPendingCount(count);
    }, 5000);
    return () => clearInterval(interval);
  }, [pendingCount, showImport]);

  const filtered = search
    ? seriesList.filter((s) => {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.synopsis?.toLowerCase().includes(q) ?? false);
      })
    : seriesList;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Header toolbar */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-1.5">
          {/* Logo */}
          <img src="/logo.png" alt="Comic Reader" className="h-10 w-10 rounded-lg shrink-0" />

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />

          {/* Search */}
          <button
            onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearch(''); }}
            className={showSearch ? btnActiveClass : btnClass}
            title="Search"
          >
            <Search size={18} />
          </button>

          {/* Type filter */}
          <div className="relative">
            <button
              onClick={() => setShowTypeMenu(!showTypeMenu)}
              className={btnClass}
              title={typeFilter === 'comic' ? 'Comics' : 'Magazines'}
            >
              {typeFilter === 'comic' ? <BookOpen size={18} /> : <Newspaper size={18} />}
            </button>
            {showTypeMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-20 min-w-[130px]">
                <button
                  onClick={() => { setTypeFilter('comic'); setShowTypeMenu(false); }}
                  className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 ${typeFilter === 'comic' ? 'text-blue-600 dark:text-blue-400 font-medium' : ''}`}
                >
                  <BookOpen size={14} /> Comics
                </button>
                <button
                  onClick={() => { setTypeFilter('magazine'); setShowTypeMenu(false); }}
                  className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 ${typeFilter === 'magazine' ? 'text-blue-600 dark:text-blue-400 font-medium' : ''}`}
                >
                  <Newspaper size={14} /> Magazines
                </button>
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Import folder */}
          <button
            onClick={() => setShowImport(true)}
            className={btnClass}
            title="Import from folder"
          >
            <FolderPlus size={18} />
          </button>

          {/* Pending badge */}
          {pendingCount > 0 && (
            <button
              onClick={() => setShowPending(true)}
              className="relative p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-amber-600 dark:text-amber-400"
              title={`${pendingCount} pending imports`}
            >
              <Bell size={18} />
              <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                {pendingCount}
              </span>
            </button>
          )}

          {/* Discover */}
          <button
            onClick={() => navigate('/discover')}
            className={btnClass}
            title="Discover manga on MangaDex"
          >
            <Compass size={18} />
          </button>

          {/* Theme */}
          <ThemeToggle />
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="max-w-7xl mx-auto px-4 pb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${typeFilter === 'comic' ? 'comics' : 'magazines'}...`}
              autoFocus
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Continue Reading */}
        {continueReading.length > 0 && !search && (
          <section>
            <button
              onClick={() => setContinueCollapsed(!continueCollapsed)}
              className="flex items-center gap-2 text-lg font-semibold mb-3 hover:text-blue-500 transition-colors"
            >
              {continueCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
              Continue Reading
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({continueReading.length})</span>
            </button>
            {!continueCollapsed && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {continueReading.map((item) => (
                  <Link
                    key={`${item.seriesId}/${item.file}`}
                    to={`/read/${item.seriesId}/${item.file}`}
                    className="group bg-white dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
                  >
                    <div className="aspect-[2/3] bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
                      <img
                        src={`/api/thumbnails/${item.seriesId}/${item.file}`}
                        alt={item.file}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="absolute top-2 right-2 bg-blue-600/90 text-white text-xs px-1.5 py-0.5 rounded">
                        p.{item.currentPage + 1}/{item.pages || '?'}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                        <div className="h-full bg-blue-500" style={{ width: `${item.pages ? (item.currentPage / item.pages) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-medium truncate">{item.file.replace('.pdf', '')}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.seriesName}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Series grid */}
        <section>
          <h2 className="text-lg font-semibold mb-4">
            {search ? `Matching "${search}"` : typeFilter === 'comic' ? 'Comics' : 'Magazines'} ({filtered.length})
          </h2>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filtered.map((s) => (
                <Link
                  key={s.id}
                  to={`/series/${s.id}`}
                  className="group bg-white dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
                >
                  <div className="aspect-[2/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {s.coverFile ? (
                      <img
                        src={getSeriesCoverUrl(s.id)}
                        alt={s.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <img
                        src={getPlaceholderUrl(s.placeholder)}
                        alt=""
                        className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-200"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium truncate">{s.name}</h3>
                    {s.year && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{s.year}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{s.count} ch.</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{s.readCount}/{s.count}</span>
                      {s.score && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto">{s.score.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {search ? 'No results found.' : `No ${typeFilter === 'comic' ? 'comics' : 'magazines'} in your library yet.`}
              </p>
              {!search && (
                <button
                  onClick={() => setShowImport(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <FolderPlus size={16} /> Import from folder
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Import modal */}
      {showImport && (
        <ImportModal
          onClose={() => { setShowImport(false); loadData(); }}
        />
      )}

      {/* Pending list */}
      {showPending && (
        <PendingList
          onClose={() => { setShowPending(false); loadData(); }}
          onUpdate={async () => {
            const { count } = await getImportCount().catch(() => ({ count: 0 }));
            setPendingCount(count);
            loadData();
          }}
        />
      )}
    </div>
  );
}
