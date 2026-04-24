import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Compass, FolderPlus, ChevronDown, ChevronRight, BookOpen, Newspaper, WifiOff, Shield, Menu, X } from 'lucide-react';
import { useAuth } from '../App';
import type { Series, ContinueReadingItem } from '../lib/types';
import { getSeries, getContinueReading, getSeriesCoverUrl, getPlaceholderUrl } from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import NotificationDropdown from '../components/NotificationDropdown';
import UserMenu from '../components/UserMenu';

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
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [showAllTags, setShowAllTags] = useState(false);
  const [continueCollapsed, setContinueCollapsed] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { isAdmin } = useAuth();

  const loadData = useCallback(async () => {
    const [series, cont] = await Promise.all([
      getSeries(typeFilter),
      getContinueReading(),
    ]);
    setSeriesList(series);
    setContinueReading(cont);
  }, [typeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Check which series have cached chapters for offline reading
  const [offlineSeries, setOfflineSeries] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (typeof caches === 'undefined' || seriesList.length === 0) return;
    (async () => {
      const cache = await caches.open('pdf-cache');
      const keys = await cache.keys();
      const ids = new Set<string>();
      for (const req of keys) {
        // URLs like /api/comics/read/{seriesId}/...
        const match = req.url.match(/\/api\/comics\/read\/([^/]+)\//);
        if (match) ids.add(match[1]);
      }
      setOfflineSeries(ids);
    })();
  }, [seriesList]);

  // Collect all unique tags across series
  const allTags = [...new Set(seriesList.flatMap((s) => s.tags || []))].sort();

  const filtered = seriesList.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !(s.englishTitle?.toLowerCase().includes(q)) && !(s.synopsis?.toLowerCase().includes(q))) return false;
    }
    if (tagFilters.size > 0 && !(s.tags || []).some((t) => tagFilters.has(t))) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Header toolbar */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-1.5">
          {/* Logo */}
          <img src="/logo.png" alt="Comic Reader" className="h-10 w-10 rounded-lg shrink-0" />

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />

          {/* Search — always visible */}
          <button
            onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearch(''); }}
            className={showSearch ? btnActiveClass : btnClass}
            title="Search"
          >
            <Search size={18} />
          </button>

          {/* Type filter — always visible */}
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

          {/* Notifications — always visible */}
          <NotificationDropdown />

          {/* Desktop icons — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-1.5">
            {isAdmin && (
              <button onClick={() => navigate('/admin')} className={btnClass} title="Admin">
                <Shield size={18} />
              </button>
            )}
            <button onClick={() => navigate('/import')} className={btnClass} title="Import">
              <FolderPlus size={18} />
            </button>
            <button onClick={() => navigate('/discover')} className={btnClass} title="Discover">
              <Compass size={18} />
            </button>
            <ThemeToggle />
            <UserMenu />
          </div>

          {/* Mobile hamburger — visible only on small screens */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="sm:hidden p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            {showMobileMenu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {showMobileMenu && (
          <div className="sm:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-2 space-y-1">
            {isAdmin && (
              <button onClick={() => { navigate('/admin'); setShowMobileMenu(false); }} className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <Shield size={16} /> Admin
              </button>
            )}
            <button onClick={() => { navigate('/import'); setShowMobileMenu(false); }} className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <FolderPlus size={16} /> Import
            </button>
            <button onClick={() => { navigate('/discover'); setShowMobileMenu(false); }} className="flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <Compass size={16} /> Discover
            </button>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-gray-500">Theme</span>
              <ThemeToggle />
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 pt-1">
              <UserMenu />
            </div>
          </div>
        )}

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

      {/* Tag filter — collapsible, multi-select */}
      {allTags.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => { setTagFilters(new Set()); setShowAllTags(false); }}
              className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${
                tagFilters.size === 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
            {tagFilters.size > 0 && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400">{filtered.length} results</span>
            )}
            {!showAllTags && (
              <button
                onClick={() => setShowAllTags(true)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
              >
                Tags <ChevronDown size={10} />
              </button>
            )}
          </div>
          {showAllTags && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {allTags.map((tag) => {
                const active = tagFilters.has(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      setTagFilters((prev) => {
                        const next = new Set(prev);
                        if (next.has(tag)) next.delete(tag); else next.add(tag);
                        return next;
                      });
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-full capitalize transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
              <button
                onClick={() => setShowAllTags(false)}
                className="text-[10px] text-gray-400 hover:text-gray-300 ml-1"
              >
                collapse
              </button>
            </div>
          )}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Continue Reading */}
        {continueReading.length > 0 && !search && tagFilters.size === 0 && (
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
                        src={getSeriesCoverUrl(item.seriesId, item.coverFile)}
                        alt={item.seriesName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholderUrl('manga.png'); }}
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

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Fake onboarding cards when library is empty */}
            {filtered.length === 0 && !search && (
              <>
                <Link
                  to="/import"
                  className="group bg-white dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
                >
                  <div className="aspect-[2/3] bg-gradient-to-br from-blue-500 to-indigo-600 overflow-hidden relative">
                    <img
                      src={getPlaceholderUrl('import-first.png')}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium">Import Your First Comic</h3>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Add from folder or drag & drop</p>
                  </div>
                </Link>
                <Link
                  to="/discover"
                  className="group bg-white dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
                >
                  <div className="aspect-[2/3] bg-gradient-to-br from-purple-500 to-pink-600 overflow-hidden relative">
                    <img
                      src={getPlaceholderUrl('discover-online.png')}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium">Discover Comics Online</h3>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Search MangaDex, MangaFox & more</p>
                  </div>
                </Link>
              </>
            )}
            {filtered.length === 0 && search && (
              <div className="col-span-full text-center py-16">
                <p className="text-gray-500 dark:text-gray-400">No results found.</p>
              </div>
            )}
            {filtered.map((s) => {
              const isNsfw = (s.tags || []).some((t) => ['adult', 'hentai', 'nsfw', 'erotica'].includes(t.toLowerCase()));
              return (
              <Link
                key={s.id}
                to={`/series/${s.id}`}
                className="group bg-white dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
              >
                <div className="aspect-[2/3] bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                  {s.coverFile ? (
                    <img
                      src={getSeriesCoverUrl(s.id, s.coverFile)}
                      alt={s.name}
                      className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 ${isNsfw ? 'blur-lg group-hover:blur-sm' : ''}`}
                      loading="lazy"
                    />
                  ) : (
                    <img
                      src={getPlaceholderUrl(s.placeholder)}
                      alt=""
                      className={`w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-200 ${isNsfw ? 'blur-lg group-hover:blur-sm' : ''}`}
                    />
                  )}
                  {isNsfw && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                      <span className="text-[10px] text-white bg-red-600/80 px-2 py-0.5 rounded-full font-medium">NSFW</span>
                    </div>
                  )}
                  {offlineSeries.has(s.id) && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                      <WifiOff size={9} /> Offline
                    </div>
                  )}
                  {s.newChapterCount != null && s.newChapterCount > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold shadow-lg">
                      +{s.newChapterCount} NEW
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium truncate">{s.name}</h3>
                  {s.englishTitle && s.englishTitle.toLowerCase() !== s.name.toLowerCase() && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{s.englishTitle}</p>
                  )}
                  {s.year && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{s.year}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{s.count} ch.</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{s.readCount}/{s.count}</span>
                    {s.score != null && s.score > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto">{s.score.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        </section>
      </main>

    </div>
  );
}
