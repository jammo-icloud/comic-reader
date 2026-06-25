import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Pin } from 'lucide-react';
import type { Series, ContinueReadingItem } from '../lib/types';
import { getSeries, getContinueReading, getSeriesCoverUrl, getPlaceholderUrl } from '../lib/api';
import { getOfflineSeriesIds, getOfflineLibrary } from '../lib/offline';
import ContinueShelf from '../components/ContinueShelf';
import LibraryToolbar, { type SortMode } from '../components/LibraryToolbar';
import { CoverThumb, Badge } from '../components/ds';

// Global Bindery header (rendered by App's Shell) is 48px tall; toolbar pins below it.
const HEADER_PX = 48;

const NSFW_TAGS = new Set(['adult', 'hentai', 'nsfw', 'erotica']);

export default function LibraryPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [continueReading, setContinueReading] = useState<ContinueReadingItem[]>([]);

  // Persisted prefs — survive cross-page navigation
  const [typeFilter, setTypeFilter] = useState<'comic' | 'magazine'>(() => {
    const saved = localStorage.getItem('bindery-type-filter');
    return saved === 'magazine' ? 'magazine' : 'comic';
  });
  const [sortBy, setSortBy] = useState<SortMode>(() => {
    const saved = localStorage.getItem('bindery-library-sort');
    if (saved === 'name-asc' || saved === 'name-desc' || saved === 'score-desc'
      || saved === 'year-desc' || saved === 'count-desc' || saved === 'new-desc') {
      return saved;
    }
    return 'name-asc';
  });

  // Filter state (transient — resets on page change)
  const [search, setSearch] = useState('');
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());

  // Persisted: hide series that are "all caught up" — every chapter read AND
  // no new chapters waiting in the subscription queue. Lets the library feel
  // like an "active reading" surface instead of a full archive.
  const [hideCaughtUp, setHideCaughtUp] = useState<boolean>(() => {
    return localStorage.getItem('bindery-hide-caught-up') === '1';
  });

  // Persisted: show only pinned series — the user's hand-curated
  // "currently reading" set. The reliable answer to "what was I reading?"
  const [pinnedOnly, setPinnedOnly] = useState<boolean>(() => {
    return localStorage.getItem('bindery-pinned-only') === '1';
  });

  // Offline-only filter — not persisted: it's a transient "I'm on a plane" view,
  // not a standing preference.
  const [offlineOnly, setOfflineOnly] = useState(false);

  useEffect(() => { localStorage.setItem('bindery-type-filter', typeFilter); }, [typeFilter]);
  useEffect(() => { localStorage.setItem('bindery-library-sort', sortBy); }, [sortBy]);
  useEffect(() => { localStorage.setItem('bindery-hide-caught-up', hideCaughtUp ? '1' : '0'); }, [hideCaughtUp]);
  useEffect(() => { localStorage.setItem('bindery-pinned-only', pinnedOnly ? '1' : '0'); }, [pinnedOnly]);

  // ----- Data load -----

  const loadData = useCallback(async () => {
    // Continue-reading is best-effort — it's a peripheral shelf, never a reason
    // to fail the page.
    getContinueReading().then(setContinueReading).catch(() => setContinueReading([]));
    try {
      setSeriesList(await getSeries(typeFilter));
    } catch {
      // Offline and the live list isn't cached: fall back to the saved-offline
      // manifest so the user sees their downloads instead of the empty-library
      // onboarding screen.
      const offline = await getOfflineLibrary();
      setSeriesList(offline.filter((s) => s.type === typeFilter));
    }
  }, [typeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset tag filters when switching type — tags are type-specific
  useEffect(() => { setTagFilters(new Set()); }, [typeFilter]);

  // ----- Saved-offline set (from the offline manifest) -----
  // The manifest is the source of truth for "explicitly saved for offline" —
  // distinct from the volatile pdf-cache (casual recently-read chapters), which
  // gets LRU-evicted. Re-read on focus so a save/remove elsewhere reflects here.
  const [offlineSeries, setOfflineSeries] = useState<Set<string>>(new Set());
  useEffect(() => {
    const sync = () => { getOfflineSeriesIds().then(setOfflineSeries); };
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

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
    if (hideCaughtUp) {
      // "Caught up" = every chapter read AND no new chapters queued from sync.
      // Series with no chapters yet (count === 0) stay visible — they're not
      // "read", they're empty placeholders waiting for a download. A series
      // with `newChapterCount > 0` also stays — there's something new to read
      // even if everything previously available is read.
      list = list.filter((s) => {
        const allRead = s.count > 0 && s.readCount >= s.count;
        const noNew = !s.newChapterCount || s.newChapterCount <= 0;
        return !(allRead && noNew);
      });
    }
    if (pinnedOnly) {
      list = list.filter((s) => s.isPinned);
    }
    if (offlineOnly) {
      list = list.filter((s) => offlineSeries.has(s.id));
    }
    return list;
  }, [seriesList, search, tagFilters, hideCaughtUp, pinnedOnly, offlineOnly, offlineSeries]);

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

  const isFiltered = !!search || tagFilters.size > 0 || hideCaughtUp || pinnedOnly || offlineOnly;
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
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        color: 'var(--text-body)',
      }}
    >
      {/* ===== Library toolbar — type tabs, count, search, tags, sort =====
          Pins below the global Bindery header (rendered by App.Shell). */}
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
        hideCaughtUp={hideCaughtUp}
        onHideCaughtUpChange={setHideCaughtUp}
        pinnedOnly={pinnedOnly}
        onPinnedOnlyChange={setPinnedOnly}
        offlineOnly={offlineOnly}
        onOfflineOnlyChange={setOfflineOnly}
        offlineCount={offlineSeries.size}
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
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((s) => {
        const isNsfw = (s.tags || []).some((t) => NSFW_TAGS.has(t.toLowerCase()));
        const cover = s.coverFile
          ? getSeriesCoverUrl(s.id, s.coverFile)
          : getPlaceholderUrl(s.placeholder);
        const showProgress =
          s.readCount > 0 && s.count > 0 && s.readCount < s.count
            ? Math.round((s.readCount / s.count) * 100)
            : null;
        const meta = (
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--text-tertiary)' }}>{s.count} ch.</span>
            <span className="bindery-nums" style={{ color: 'var(--text-muted)' }}>
              {s.readCount}/{s.count}
            </span>
            {s.score != null && s.score > 0 && (
              <span className="ml-auto" style={{ color: 'var(--color-warning)' }}>
                {s.score.toFixed(1)}
              </span>
            )}
          </div>
        );
        return (
          <CoverThumb
            key={s.id}
            src={cover}
            alt={s.name}
            title={s.name}
            meta={meta}
            blurred={isNsfw}
            progress={showProgress}
            onClick={() => navigate(`/series/${s.id}`)}
            badgeTL={
              offlineSeries.has(s.id) ? (
                <Badge intent="success" pill>
                  <Download size={9} strokeWidth={2.5} /> Saved
                </Badge>
              ) : null
            }
            badgeTR={
              isNsfw ? (
                <Badge intent="danger" pill>NSFW</Badge>
              ) : s.newChapterCount != null && s.newChapterCount > 0 ? (
                <Badge intent="new">+{s.newChapterCount} NEW</Badge>
              ) : null
            }
            badgeBL={
              s.isPinned ? (
                <span
                  title="Pinned — currently reading"
                  aria-label="Pinned — currently reading"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'rgb(var(--accent) / 0.9)',
                    color: '#fff',
                  }}
                >
                  <Pin size={11} fill="currentColor" strokeWidth={0} />
                </span>
              ) : null
            }
          />
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
        className="group bg-surface dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-accent transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
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
        className="group bg-surface dark:bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-accent transition-all shadow-sm dark:shadow-none border border-gray-200 dark:border-transparent"
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
