import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, X, BookOpen, Search, RefreshCw, Image, LayoutGrid, List, ChevronDown, ChevronRight, Library, Compass } from 'lucide-react';
import type { Comic, Series, Shelf } from '../lib/types';
import { getComics, getSeries, getContinueReading, triggerScan, triggerEnrich, getSeriesCoverUrl, getShelves, addShelf as addShelfApi, removeShelf as removeShelfApi } from '../lib/api';
import ComicCard from '../components/ComicCard';
import ThemeToggle from '../components/ThemeToggle';
import AddShelfModal from '../components/AddShelfModal';

const btnClass = 'p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400';
const btnActiveClass = 'p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors';

export default function LibraryPage() {
  const navigate = useNavigate();
  const [comics, setComics] = useState<Comic[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [continueReading, setContinueReading] = useState<Comic[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [activeShelf, setActiveShelf] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sort, setSort] = useState('series');
  const [showSort, setShowSort] = useState(false);
  const [showShelfMenu, setShowShelfMenu] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [view, setView] = useState<'all' | 'series'>('series');
  const [continueCollapsed, setContinueCollapsed] = useState(true);

  const [showAddShelf, setShowAddShelf] = useState(false);

  const loadData = useCallback(async () => {
    const [comicsData, seriesData, continueData, shelvesData] = await Promise.all([
      getComics({ search, sort, shelf: activeShelf || undefined }),
      getSeries(),
      getContinueReading(),
      getShelves(),
    ]);
    setComics(comicsData);
    setSeries(seriesData);
    setContinueReading(continueData);
    setShelves(shelvesData);
  }, [search, sort, activeShelf]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleScan = async () => {
    setScanning(true);
    try { await triggerScan(); await loadData(); } finally { setScanning(false); }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try { await triggerEnrich(); await loadData(); } finally { setEnriching(false); }
  };

  const handleAddShelf = async (name: string, path: string) => {
    await addShelfApi(name, path);
    setShowAddShelf(false);
    setShowShelfMenu(false);
    await triggerScan();
    await loadData();
  };

  const handleRemoveShelf = async (id: string) => {
    await removeShelfApi(id);
    if (activeShelf === id) setActiveShelf(null);
    await loadData();
  };

  const filteredSeries = (() => {
    let s = series;
    if (activeShelf) {
      const seriesInShelf = new Set(comics.filter((c) => c.shelfId === activeShelf).map((c) => c.series));
      s = s.filter((ser) => seriesInShelf.has(ser.name));
    }
    if (search) {
      const q = search.toLowerCase();
      s = s.filter((ser) => ser.name.toLowerCase().includes(q) || (ser.malTitle?.toLowerCase().includes(q) ?? false));
    }
    return s;
  })();

  const hasUnmatched = series.some((s) => !s.hasCover);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Header toolbar */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-1.5">
          {/* Logo */}
          <img src="/logo.png" alt="Comic Reader" className="h-10 w-10 rounded-lg shrink-0" />

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />

          {/* Search toggle */}
          <button
            onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearch(''); }}
            className={showSearch ? btnActiveClass : btnClass}
            title="Search"
          >
            <Search size={18} />
          </button>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowSort(!showSort); setShowShelfMenu(false); }}
              className={btnClass}
              title={`Sort: ${sort}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M3 12h12M3 18h6" />
              </svg>
            </button>
            {showSort && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                {[
                  { value: 'series', label: 'Series' },
                  { value: 'title', label: 'Title' },
                  { value: 'recent', label: 'Recent' },
                  { value: 'added', label: 'Added' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSort(opt.value); setShowSort(false); }}
                    className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${sort === opt.value ? 'text-blue-600 dark:text-blue-400 font-medium' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View toggle: Series / All */}
          <button
            onClick={() => setView(view === 'series' ? 'all' : 'series')}
            className={btnClass}
            title={view === 'series' ? 'Series view' : 'All comics view'}
          >
            {view === 'series' ? <LayoutGrid size={18} /> : <List size={18} />}
          </button>

          {/* Shelf dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowShelfMenu(!showShelfMenu); setShowSort(false); }}
              className={activeShelf ? btnActiveClass : btnClass}
              title={activeShelf ? `Shelf: ${shelves.find(s => s.id === activeShelf)?.name}` : 'All shelves'}
            >
              <Library size={18} />
            </button>
            {showShelfMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-20 min-w-[200px]">
                <button
                  onClick={() => { setActiveShelf(null); setShowShelfMenu(false); }}
                  className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${!activeShelf ? 'text-blue-600 dark:text-blue-400 font-medium' : ''}`}
                >
                  All Shelves
                </button>
                {shelves.map((shelf) => (
                  <div key={shelf.id} className="flex items-center group">
                    <button
                      onClick={() => { setActiveShelf(shelf.id); setShowShelfMenu(false); }}
                      className={`flex-1 text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 ${activeShelf === shelf.id ? 'text-blue-600 dark:text-blue-400 font-medium' : ''}`}
                    >
                      <BookOpen size={13} /> {shelf.name}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveShelf(shelf.id); setShowShelfMenu(false); }}
                      className="px-2 py-1.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                      title="Remove shelf"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                  <button
                    onClick={() => { setShowAddShelf(true); setShowShelfMenu(false); }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                  >
                    <Plus size={13} /> Add Shelf
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Rescan */}
          <button
            onClick={handleScan}
            disabled={scanning}
            className={`${btnClass} disabled:opacity-30 ${scanning ? 'animate-spin' : ''}`}
            title="Rescan library"
          >
            <RefreshCw size={18} />
          </button>

          {/* Fetch Covers */}
          {hasUnmatched && (
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className={`${btnClass} disabled:opacity-30`}
              title="Fetch covers from MAL"
            >
              <Image size={18} />
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

        {/* Expandable search bar */}
        {showSearch && (
          <div className="max-w-7xl mx-auto px-4 pb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search series or comics..."
              autoFocus
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        )}

        {/* Empty state — no shelves (show below search if open) */}
        {shelves.length === 0 && (
          <div className="max-w-7xl mx-auto px-4 pb-2">
            <button
              onClick={() => setShowAddShelf(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <Plus size={16} /> Add your first shelf to get started
            </button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Continue Reading — collapsible, starts collapsed */}
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
                {continueReading.map((comic) => (
                  <ComicCard key={comic.path} comic={comic} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Series View */}
        {view === 'series' ? (
          <section>
            <h2 className="text-lg font-semibold mb-4">
              {search ? `Series matching "${search}"` : 'Series'} ({filteredSeries.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredSeries.map((s) => (
                <Link
                  key={s.name}
                  to={`/series/${encodeURIComponent(s.name)}`}
                  className="group bg-white dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
                >
                  {s.hasCover ? (
                    <div className="aspect-[2/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <img
                        src={getSeriesCoverUrl(s.name)}
                        alt={s.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[2/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <img
                        src="/unmatched-cover.png"
                        alt="Unmatched series"
                        className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="text-sm font-medium truncate">{s.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {s.count} ch.
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {s.readCount}/{s.count}
                      </span>
                      {s.score && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto">
                          {s.score.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {filteredSeries.length === 0 && shelves.length > 0 && (
              <p className="text-gray-500 text-center py-12">
                {search ? 'No series found.' : 'No series on this shelf yet. Click rescan to index.'}
              </p>
            )}
          </section>
        ) : (
          <section>
            <h2 className="text-lg font-semibold mb-4">
              {search ? `Results for "${search}"` : 'All Comics'} ({comics.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {comics.map((comic) => (
                <ComicCard key={comic.path} comic={comic} />
              ))}
            </div>
            {comics.length === 0 && (
              <p className="text-gray-500 text-center py-12">
                {search ? 'No comics found.' : shelves.length === 0 ? 'Add a shelf to get started.' : 'No comics found. Click rescan to index.'}
              </p>
            )}
          </section>
        )}
      </main>

      {/* Add Shelf Modal */}
      {showAddShelf && (
        <AddShelfModal
          onAdd={handleAddShelf}
          onClose={() => setShowAddShelf(false)}
        />
      )}
    </div>
  );
}
