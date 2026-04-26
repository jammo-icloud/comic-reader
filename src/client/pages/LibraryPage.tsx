import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import type { Series, ContinueReadingItem } from '../lib/types';
import { getSeries, getContinueReading, getSeriesCoverUrl, getPlaceholderUrl } from '../lib/api';
import NotificationDropdown from '../components/NotificationDropdown';
import ProfileMenu from '../components/ProfileMenu';
import ContinueShelf from '../components/ContinueShelf';
import LibraryToolbar, { type SortMode } from '../components/LibraryToolbar';

// Slim page header: py-1.5 (12px) + 32px logo = ~44px. Toolbar pins below it.
const HEADER_PX = 48;

const NSFW_TAGS = new Set(['adult', 'hentai', 'nsfw', 'erotica']);

export default function LibraryPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [continueReading, setContinueReading] = useState<ContinueReadingItem[]>([]);

  // Persisted prefs — survive cross-page navigation
  const [typeFilter, setTypeFilter] = useState<'comic' | 'magazine'>(() => {
    const saved = localStorage.getItem('comic-reader-type-filter');
    return saved === 'magazine' ? 'magazine' : 'comic';
  });
  const [sortBy, setSortBy] = useState<SortMode>(() => {
    const saved = localStorage.getItem('comic-reader-library-sort');
    if (saved === 'name-asc' || saved === 'name-desc' || saved === 'score-desc'
      || saved === 'year-desc' || saved === 'count-desc' || saved === 'new-desc') {
      return saved;
    }
    return 'name-asc';
  });

  // Filter state (transient — resets on page change)
  const [search, setSearch] = useState('');
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());

  useEffect(() => { localStorage.setItem('comic-reader-type-filter', typeFilter); }, [typeFilter]);
  useEffect(() => { localStorage.setItem('comic-reader-library-sort', sortBy); }, [sortBy]);

  // ----- Data load -----

  const loadData = useCallback(async () => {
    const [series, cont] = await Promise.all([
      getSeries(typeFilter),
      getContinueReading(),
    ]);
    setSeriesList(series);
    setContinueReading(cont);
  }, [typeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset tag filters when switching type — tags are type-specific
  useEffect(() => { setTagFilters(new Set()); }, [typeFilter]);

  // ----- Offline cache map (which series have any cached PDF) -----
  const [offlineSeries, setOfflineSeries] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (typeof caches === 'undefined' || seriesList.length === 0) return;
    (async () => {
      const cache = await caches.open('pdf-cache');
      const keys = await cache.keys();
      const ids = new Set<string>();
      for (const req of keys) {
        const match = req.url.match(/\/api\/comics\/read\/([^/]+)\//);
        if (match) ids.add(match[1]);
      }
      setOfflineSeries(ids);
    })();
  }, [seriesList]);

  // ----- Tag universe + filtered + sorted -----

  const allTags = useMemo(
    () => [...new Set(seriesList.flatMap((s) => s.tags || []))].sort(),
    [seriesList],
  );

  const filtered = useMemo(() => {
    let list = seriesList;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q)
        || (s.englishTitle?.toLowerCase().includes(q) ?? false)
        || (s.synopsis?.toLowerCase().includes(q) ?? false),
      );
    }
    if (tagFilters.size > 0) {
      list = list.filter((s) => (s.tags || []).some((t) => tagFilters.has(t)));
    }
    return list;
  }, [seriesList, search, tagFilters]);

  const sortedFiltered = useMemo(() => {
    const arr = filtered.slice();
    switch (sortBy) {
      case 'name-asc':    arr.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc':   arr.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'score-desc':  arr.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)); break;
      case 'year-desc':   arr.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)); break;
      case 'count-desc':  arr.sort((a, b) => b.count - a.count); break;
      case 'new-desc':    arr.sort((a, b) => (b.newChapterCount ?? 0) - (a.newChapterCount ?? 0)); break;
    }
    return arr;
  }, [filtered, sortBy]);

  const isFiltered = !!search || tagFilters.size > 0;
  const showContinueShelf = continueReading.length > 0 && !isFiltered;

  const toggleTag = (tag: string) => {
    setTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const clearTags = () => setTagFilters(new Set());

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">

      {/* ===== Slim page header ===== */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center gap-2 h-12">
          <Link to="/" className="shrink-0">
            <img src="/logo.png" alt="Comic Reader" className="h-8 w-8 rounded-md" />
          </Link>
          <div className="flex-1" />
          <NotificationDropdown />
          <ProfileMenu />
        </div>
      </header>

      {/* ===== Library toolbar — type tabs, count, search, tags, sort ===== */}
      <LibraryToolbar
        topPx={HEADER_PX}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        resultCount={sortedFiltered.length}
        totalCount={seriesList.length}
        isFiltered={isFiltered}
        search={search}
        onSearchChange={setSearch}
        allTags={allTags}
        activeTags={tagFilters}
        onToggleTag={toggleTag}
        onClearTags={clearTags}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-6">

        {/* Continue Reading — compact horizontal strip */}
        {showContinueShelf && <ContinueShelf items={continueReading} />}

        {/* Series grid / empty states */}
        <section>
          {seriesList.length === 0 ? (
            <OnboardingCards />
          ) : sortedFiltered.length === 0 ? (
            <NoMatchesState
              search={search}
              hasTagFilters={tagFilters.size > 0}
              onClearAll={() => { setSearch(''); clearTags(); }}
            />
          ) : (
            <SeriesGrid items={sortedFiltered} offlineSeries={offlineSeries} />
          )}
        </section>
      </main>
    </div>
  );
}

// ===== Subcomponents =====

function SeriesGrid({ items, offlineSeries }: { items: Series[]; offlineSeries: Set<string> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((s) => {
        const isNsfw = (s.tags || []).some((t) => NSFW_TAGS.has(t.toLowerCase()));
        return (
          <Link
            key={s.id}
            to={`/series/${s.id}`}
            className="group bg-white dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-accent transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
          >
            <div className="aspect-[2/3] bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
              <img
                src={s.coverFile ? getSeriesCoverUrl(s.id, s.coverFile) : getPlaceholderUrl(s.placeholder)}
                alt={s.name}
                /* NSFW: blur stays on hover (was unblurring on hover, defeating the warning).
                   Click-through (the Link) is the way to view. */
                className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 ${
                  s.coverFile ? '' : 'opacity-60'
                } ${isNsfw ? 'blur-lg' : ''}`}
                loading="lazy"
              />
              {isNsfw && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-white bg-danger/85 px-2 py-0.5 rounded-full font-medium shadow-sm">NSFW</span>
                </div>
              )}
              {offlineSeries.has(s.id) && (
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                  <WifiOff size={9} /> Offline
                </div>
              )}
              {s.newChapterCount != null && s.newChapterCount > 0 && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-semibold shadow-lg">
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
                  <span className="text-xs text-warning ml-auto">{s.score.toFixed(1)}</span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function OnboardingCards() {
  // Only shown when seriesList.length === 0 (truly empty library, never filtered to zero).
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <Link
        to="/import"
        className="group bg-white dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-accent transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
      >
        <div className="aspect-[2/3] bg-gradient-to-br from-accent to-accent-hover overflow-hidden relative">
          <img
            src={getPlaceholderUrl('import-first.png')}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <div className="p-3">
          <h3 className="text-sm font-medium">Import Your First Comic</h3>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Add from folder or drag &amp; drop</p>
        </div>
      </Link>
      <Link
        to="/discover"
        className="group bg-white dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-accent transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
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
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Search MangaDex, MangaFox &amp; more</p>
        </div>
      </Link>
    </div>
  );
}

function NoMatchesState({
  search, hasTagFilters, onClearAll,
}: {
  search: string;
  hasTagFilters: boolean;
  onClearAll: () => void;
}) {
  const reason = search && hasTagFilters
    ? 'No series match your search and selected tags.'
    : search
      ? `No series match "${search}".`
      : 'No series match the selected tags.';
  return (
    <div className="text-center py-16">
      <p className="text-sm text-gray-500 dark:text-gray-400">{reason}</p>
      <button
        onClick={onClearAll}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-accent hover:underline"
      >
        Clear filters
      </button>
    </div>
  );
}
