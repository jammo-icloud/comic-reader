import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Loader, Check, ExternalLink, Eye, X, Compass, AlertCircle, BookOpen, Download, Puzzle, Heart, Library as LibraryIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SearchResult, ChapterResult, RecommendedItem, Series } from '../lib/types';
import { discoverSearch, discoverChapters, addToCollection, getComics, getCatalog, getRecommended, getSeriesCoverUrl, getPlaceholderUrl } from '../lib/api';
import { useSources, HAKUNEKO_SITES, HAKUNEKO_URL } from '../lib/browser-sources/registry';
import type { SourceConfig } from '../lib/browser-sources/types';
import MangaSearchCard from '../components/MangaSearchCard';
import ChapterPicker from '../components/ChapterPicker';
import NotificationDropdown from '../components/NotificationDropdown';
import ProfileMenu from '../components/ProfileMenu';
import StickyToolbar from '../components/StickyToolbar';
import ToolbarIconButton from '../components/ToolbarIconButton';

// Header height (Library-shape): py-2 (16px) + content (~40px) ≈ 56px
const HEADER_PX = 56;

export default function DiscoverPage() {
  const sources = useSources();
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string>('');

  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [showMoreSites, setShowMoreSites] = useState(false);

  const [selectedManga, setSelectedManga] = useState<SearchResult | null>(null);
  const [chapters, setChapters] = useState<ChapterResult[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [localChapterNums, setLocalChapterNums] = useState<Set<string>>(new Set());

  // Discover has three modes:
  //   'sources'     — existing UX, search external sources for new manga
  //   'library'     — browse the server's master catalog (this instance only)
  //   'recommended' — aggregated cross-user feed of favorites (NSFW-filtered)
  // The two server-internal modes are mutually exclusive with source selection.
  type ViewMode = 'sources' | 'library' | 'recommended';
  const [viewMode, setViewMode] = useState<ViewMode>('sources');
  const [libraryItems, setLibraryItems] = useState<Series[]>([]);
  const [recommendedItems, setRecommendedItems] = useState<RecommendedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  const hasSelection = selectedSources.size > 0;

  // Auto-show the search row once the user has results, so they can refine without toggling.
  useEffect(() => { if (hasSearched) setShowSearch(true); }, [hasSearched]);

  // Auto-show search input in library/recommended modes — the input becomes a
  // live filter, so it should be visible from the moment the user enters the mode.
  useEffect(() => {
    if (viewMode !== 'sources') setShowSearch(true);
  }, [viewMode]);

  // Load the appropriate feed when viewMode flips. Idempotent — refetches when
  // the user re-enters the mode so a fresh favorite shows up immediately.
  useEffect(() => {
    if (viewMode === 'sources') return;
    let cancelled = false;
    setFeedLoading(true);
    const promise = viewMode === 'library' ? getCatalog() : getRecommended();
    promise
      .then((data) => {
        if (cancelled) return;
        if (viewMode === 'library') setLibraryItems(data as Series[]);
        else setRecommendedItems(data as RecommendedItem[]);
      })
      .catch((err) => {
        if (!cancelled) console.error(`Failed to load ${viewMode} feed:`, err);
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => { cancelled = true; };
  }, [viewMode]);

  // Live-filter the loaded feed by the search query.
  const queryLower = query.trim().toLowerCase();
  const filteredLibrary = useMemo(() => {
    if (!queryLower) return libraryItems;
    return libraryItems.filter((s) =>
      s.name.toLowerCase().includes(queryLower) ||
      (s.englishTitle?.toLowerCase().includes(queryLower) ?? false),
    );
  }, [libraryItems, queryLower]);
  const filteredRecommended = useMemo(() => {
    if (!queryLower) return recommendedItems;
    return recommendedItems.filter((r) =>
      r.series.name.toLowerCase().includes(queryLower) ||
      (r.series.englishTitle?.toLowerCase().includes(queryLower) ?? false),
    );
  }, [recommendedItems, queryLower]);

  const toggleSource = (id: string) => {
    // Tapping a source pill always returns to sources mode.
    if (viewMode !== 'sources') setViewMode('sources');
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /**
   * Switch to a server-internal mode (library / recommended). Mutually
   * exclusive with source selection; flipping into one of these clears the
   * selected-sources set and any prior search results.
   */
  const switchMode = (next: 'library' | 'recommended') => {
    if (viewMode === next) {
      // Tapping the active pill exits back to sources mode.
      setViewMode('sources');
      return;
    }
    setViewMode(next);
    setSelectedSources(new Set());
    setHasSearched(false);
    setSearchError('');
    setResults([]);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || !hasSelection) return;
    setSearching(true);
    setHasSearched(true);
    setSearchError('');
    try {
      const data = await discoverSearch(query.trim());
      const serverIds = [...selectedSources];
      setResults(data.results.filter((r) => serverIds.includes(r.sourceId)));
    } catch (err) {
      setSearchError((err as Error).message || 'Search failed');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setSearchError('');
    setShowSearch(false);
  };

  const handleSelectManga = async (manga: SearchResult) => {
    if (manga.localSeriesId && !manga.inCollection) {
      await addToCollection(manga.localSeriesId);
      setResults((prev) => prev.map((r) =>
        r.mangaId === manga.mangaId && r.sourceId === manga.sourceId
          ? { ...r, inCollection: true }
          : r,
      ));
    }

    setSelectedManga(manga);
    setLoadingChapters(true);
    setLocalChapterNums(new Set());

    if (manga.localSeriesId) {
      try {
        const comics = await getComics(manga.localSeriesId);
        const nums = new Set(
          comics.map((c: any) => {
            const match = c.file.match(/(\d+(?:\.\d+)?)/);
            return match ? String(parseFloat(match[1])) : '';
          }).filter(Boolean),
        );
        setLocalChapterNums(nums);
      } catch { /* fall through */ }
    }

    try {
      const data = await discoverChapters(manga.sourceId, manga.mangaId);
      const ch = Array.isArray(data) ? data : data.chapters;
      setChapters(ch);
      if (!Array.isArray(data) && data.metadata) {
        const m = data.metadata;
        if (m.description && !manga.description) manga.description = m.description;
        if (m.genres?.length && !manga.tags?.length) manga.tags = m.genres;
        if (m.coverUrl && !manga.coverUrl) manga.coverUrl = m.coverUrl;
        if (m.year && !manga.year) manga.year = m.year;
      }
    } catch {
      setChapters([]);
    } finally {
      setLoadingChapters(false);
    }
  };

  const allActive = sources.length > 0 && selectedSources.size === sources.length;

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">

      {/* ===== Library-shape header =====
          paddingTop: env(safe-area-inset-top) clears the iOS standalone PWA status bar. */}
      <header
        className="sticky top-0 z-30 bg-gray-50/85 dark:bg-gray-950/85 backdrop-blur-md border-b border-gray-200 dark:border-gray-800"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-1.5">
          <img src="/logo.png" alt="Bindery" className="h-10 w-10 rounded-lg shrink-0" />
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />

          <ToolbarIconButton
            onClick={() => { setShowSearch((v) => !v); }}
            active={showSearch}
            title="Search"
          >
            <Search size={18} />
          </ToolbarIconButton>

          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Discover</span>

          <div className="flex-1" />
          <NotificationDropdown />
          <ProfileMenu />
        </div>

        {/* Search bar — toggles open, also shown automatically once you have results */}
        {showSearch && (
          <form onSubmit={handleSearch} className="max-w-6xl mx-auto px-4 pb-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={hasSelection ? 'Search manga or comics…' : 'Pick at least one source below ↓'}
                  disabled={!hasSelection}
                  autoFocus
                  className="w-full pl-9 pr-9 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
                    aria-label="Clear query"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              {hasSearched ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="px-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Clear
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={searching || !query.trim() || !hasSelection}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-accent hover:bg-accent text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[40px]"
                >
                  {searching ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
                  Search
                </button>
              )}
            </div>
          </form>
        )}
      </header>

      {/* ===== Sticky source pill row (always visible while sources are loaded) ===== */}
      {sources.length > 0 && (
        <StickyToolbar topPx={HEADER_PX}>
          {() => (
            <>
              <button
                onClick={() => {
                  if (allActive) setSelectedSources(new Set());
                  else setSelectedSources(new Set(sources.map((s) => s.id)));
                }}
                className={`shrink-0 text-[11px] uppercase tracking-wider font-semibold px-2 py-1 rounded transition-colors ${
                  allActive
                    ? 'text-accent hover:bg-accent/10'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title={allActive ? 'Clear all sources' : 'Select all sources'}
              >
                {allActive ? 'Clear' : 'All'}
              </button>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 flex-1 min-w-0">
                {/* Server-internal pills — mutually exclusive with source selection.
                    Visually distinct via accent tint to read as "this server" vs
                    external sources. */}
                <ServerPill
                  icon={<Heart size={12} fill={viewMode === 'recommended' ? 'currentColor' : 'none'} strokeWidth={viewMode === 'recommended' ? 0 : 2} />}
                  label="Recommended"
                  active={viewMode === 'recommended'}
                  onClick={() => switchMode('recommended')}
                />
                <ServerPill
                  icon={<LibraryIcon size={12} />}
                  label="Library"
                  active={viewMode === 'library'}
                  onClick={() => switchMode('library')}
                />
                {/* Visual divider between server-internal and external pills */}
                <span className="shrink-0 w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" aria-hidden="true" />
                {sources.map((source) => (
                  <SourcePill
                    key={source.id}
                    source={source}
                    selected={selectedSources.has(source.id)}
                    onClick={() => toggleSource(source.id)}
                  />
                ))}
              </div>

              <button
                onClick={() => setShowMoreSites(true)}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-accent px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="More manga sites"
              >
                <Eye size={13} /> <span className="hidden sm:inline">More…</span>
              </button>
            </>
          )}
        </StickyToolbar>
      )}

      {/* ===== Main ===== */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

        {/* Server-internal feeds (Library / Recommended) take over the main
            area when active. Source-search render flow is bypassed. */}
        {viewMode === 'recommended' && (
          <RecommendedFeed
            items={filteredRecommended}
            loading={feedLoading}
            query={query.trim()}
            totalLoaded={recommendedItems.length}
          />
        )}
        {viewMode === 'library' && (
          <LibraryFeed
            items={filteredLibrary}
            loading={feedLoading}
            query={query.trim()}
          />
        )}

        {/* Existing source-search flow — only when in 'sources' mode */}
        {viewMode === 'sources' && !hasSearched && !searching && (
          <PreSearchHint
            sources={sources}
            hasSelection={hasSelection}
            showSearch={showSearch}
            onOpenSearch={() => setShowSearch(true)}
            onShowMoreSites={() => setShowMoreSites(true)}
          />
        )}

        {/* Loading skeleton */}
        {viewMode === 'sources' && searching && <SkeletonGrid />}

        {/* Search error */}
        {viewMode === 'sources' && !searching && searchError && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 mb-4">
            <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-danger">Search failed</p>
              <p className="text-danger text-xs mt-0.5">{searchError}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {viewMode === 'sources' && hasSearched && !searching && !searchError && (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {results.length} result{results.length === 1 ? '' : 's'} for "{query}"
              <span className="text-gray-400 dark:text-gray-600"> · across {selectedSources.size} source{selectedSources.size === 1 ? '' : 's'}</span>
            </p>
            {results.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {results.map((manga, i) => (
                  <MangaSearchCard
                    key={`${manga.sourceId}-${manga.mangaId}-${i}`}
                    manga={manga}
                    onClick={() => handleSelectManga(manga)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Compass size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No results.</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Try a different query, or pick more sources above.</p>
                <button
                  onClick={() => setShowMoreSites(true)}
                  className="inline-flex items-center gap-2 text-sm text-accent hover:underline mt-4"
                >
                  <Eye size={14} /> Look on more sites
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* "More sites" modal — portaled to body */}
      {showMoreSites && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            aria-label="Close"
            onClick={() => setShowMoreSites(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full sm:max-w-lg bg-surface dark:bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mx-0 sm:mx-4 max-h-[90dvh] overflow-y-auto"
            style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>
            <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-base font-semibold">More sources</h2>
              <button
                onClick={() => setShowMoreSites(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 sm:px-6 py-4 space-y-6">

              {/* === Chrome extension — preferred path === */}
              <section>
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                    <Puzzle size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">Manga Finder Chrome extension</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Adds 10 more sources directly into Discover — MangaHub, OmegaScans, HentaiNexus, and more.
                      Downloads route through Bindery; no manual import needed.
                    </p>
                  </div>
                </div>
                <div className="mt-3 pl-12 space-y-1.5">
                  <a
                    href="/manga-finder-extension.zip"
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                  >
                    <Download size={14} /> Download extension
                  </a>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    Unzip → open <span className="font-mono">chrome://extensions</span> → enable Developer mode → Load unpacked.
                  </p>
                </div>
              </section>

              {/* === HakuNeko — alternative for sites the extension doesn't cover === */}
              <section className="pt-5 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex items-center justify-center">
                    <ExternalLink size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">HakuNeko desktop app</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Standalone app for sites we can't reach directly. Download chapters with HakuNeko, then use the
                      Import page to bring them into your library.
                    </p>
                  </div>
                </div>
                <div className="mt-3 pl-12 space-y-2">
                  <a
                    href={HAKUNEKO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                  >
                    Download HakuNeko <ExternalLink size={14} />
                  </a>
                  <details className="pt-1">
                    <summary className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer select-none">
                      Sites HakuNeko covers
                    </summary>
                    <div className="space-y-1.5 mt-2">
                      {HAKUNEKO_SITES.map((site) => (
                        <a
                          key={site.name}
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 rounded-md bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div>
                            <span className="text-xs font-medium">{site.name}</span>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">{site.description}</p>
                          </div>
                          <ExternalLink size={12} className="text-gray-400 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </details>
                </div>
              </section>

            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Chapter Picker */}
      {selectedManga && (
        <ChapterPicker
          manga={selectedManga}
          chapters={chapters}
          loading={loadingChapters}
          localChapterNums={localChapterNums}
          onClose={() => { setSelectedManga(null); setChapters([]); setLocalChapterNums(new Set()); }}
        />
      )}
    </div>
  );
}

// ----- Subcomponents -----

/**
 * Server-internal pill (Library / Recommended). Visually distinct from
 * SourcePill — uses accent tint instead of source-color so they read as
 * "this server" rather than an external source.
 */
function ServerPill({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={`${label} on this server`}
      className={`shrink-0 inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-xs font-medium border transition-colors min-h-[28px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        active
          ? 'bg-accent text-white border-transparent shadow-sm'
          : 'text-gray-700 dark:text-gray-300 bg-surface dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-accent'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate max-w-[8rem]">{label}</span>
    </button>
  );
}

/**
 * Hash-based username chip used as an attribution glyph on Recommended cards.
 * Stable color per username; dimensions match the small-circle Avatar.
 *
 * The user's own contribution is highlighted with the accent ring so they
 * can quickly see "yes, my taste is part of this signal."
 */
function AttributionChip({ username, isSelf }: { username: string; isSelf: boolean }) {
  // Cheap stable hash → 12 hue-distinct colors. Same series of usernames always
  // produces the same chip color across renders.
  const hueIndex = Array.from(username).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 12;
  const hues = [210, 280, 340, 20, 50, 130, 170, 0, 240, 310, 90, 200];
  const hue = hues[hueIndex];
  const initial = username.length > 0 ? username[0].toUpperCase() : '?';
  return (
    <span
      title={isSelf ? `${username} (you)` : username}
      aria-label={isSelf ? `Recommended by you (${username})` : `Recommended by ${username}`}
      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
        isSelf ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface dark:ring-offset-gray-900' : ''
      }`}
      style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
    >
      {initial}
    </span>
  );
}

/**
 * "Recommended" feed — aggregated cross-user favorites. Server already
 * NSFW-filters and sorts by count desc, recency tiebreak. We render cards
 * with attribution chips so each row tells you who liked it.
 */
function RecommendedFeed({
  items, loading, query, totalLoaded,
}: {
  items: RecommendedItem[];
  loading: boolean;
  query: string;
  totalLoaded: number;
}) {
  if (loading) return <SkeletonGrid />;

  // Empty-state branches: zero favorites server-wide vs. empty filter result.
  if (items.length === 0) {
    if (query) {
      return (
        <div className="text-center py-16">
          <Heart size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No recommendations match "{query}".</p>
        </div>
      );
    }
    if (totalLoaded === 0) {
      return (
        <div className="text-center py-16 max-w-md mx-auto">
          <Heart size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
          <h2 className="text-base font-semibold mb-1">Nothing's been recommended yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tap the Recommend button on a series page to add it to this feed for everyone on the server.
          </p>
        </div>
      );
    }
  }

  return (
    <>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {items.length} recommended series
        {query && <span className="text-gray-400 dark:text-gray-600"> · matching "{query}"</span>}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((item) => (
          <RecommendedCard key={item.series.id} item={item} />
        ))}
      </div>
    </>
  );
}

function RecommendedCard({ item }: { item: RecommendedItem }) {
  const { series, favoritedBy, count } = item;
  const coverUrl = series.coverFile
    ? getSeriesCoverUrl(series.id, series.coverFile)
    : getPlaceholderUrl(series.placeholder);
  // Prefer the current user's chip first if they're in the list; otherwise
  // alphabetic. Cap visible chips at 3 with a "+N" overflow indicator.
  const visibleChips = favoritedBy.slice(0, 3);
  const overflowCount = favoritedBy.length - visibleChips.length;
  return (
    <Link
      to={`/series/${series.id}`}
      className="group block bg-surface dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 hover:border-accent transition-colors"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img
          src={coverUrl}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        />
        {/* Count chip — top-right, visual quality signal */}
        <div className="absolute top-2 right-2 inline-flex items-center gap-1 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded-full backdrop-blur-sm">
          <Heart size={10} fill="currentColor" strokeWidth={0} />
          <span className="font-semibold tabular-nums">{count}</span>
        </div>
      </div>
      <div className="p-2.5">
        <h3 className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{series.name}</h3>
        {/* Attribution row — tells the user who specifically recommended this */}
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
          <span className="flex -space-x-1">
            {visibleChips.map((u) => (
              <AttributionChip key={u} username={u} isSelf={false} />
            ))}
          </span>
          {overflowCount > 0 && (
            <span className="ml-1 tabular-nums">+{overflowCount}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * "Library" feed — every series on this server. Useful when a user knows
 * something is in the catalog but isn't in their own collection yet.
 */
function LibraryFeed({
  items, loading, query,
}: {
  items: Series[];
  loading: boolean;
  query: string;
}) {
  if (loading) return <SkeletonGrid />;

  if (items.length === 0 && query) {
    return (
      <div className="text-center py-16">
        <LibraryIcon size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No series match "{query}".</p>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <LibraryIcon size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No series on this server yet.</p>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {items.length} series on this server
        {query && <span className="text-gray-400 dark:text-gray-600"> · matching "{query}"</span>}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {items.map((s) => (
          <Link
            key={s.id}
            to={`/series/${s.id}`}
            className="group block bg-surface dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 hover:border-accent transition-colors"
          >
            <div className="relative aspect-[2/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                src={s.coverFile ? getSeriesCoverUrl(s.id, s.coverFile) : getPlaceholderUrl(s.placeholder)}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              {s.inCollection && (
                <div className="absolute top-2 left-2 inline-flex items-center gap-1 bg-success/90 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  <Check size={10} strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="p-2.5">
              <h3 className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{s.name}</h3>
              {s.englishTitle && s.englishTitle.toLowerCase() !== s.name.toLowerCase() && (
                <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-0.5 truncate">{s.englishTitle}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function SourcePill({
  source, selected, onClick,
}: {
  source: SourceConfig;
  selected: boolean;
  onClick: () => void;
}) {
  const hex = source.color || '#6b7280';
  const [iconFailed, setIconFailed] = useState(false);
  const showFavicon = !!source.favicon && !iconFailed;
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      title={source.description || source.name}
      className={`shrink-0 inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-xs font-medium border transition-colors min-h-[28px] ${
        selected
          ? 'text-white border-transparent shadow-sm'
          : 'text-gray-700 dark:text-gray-300 bg-surface dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
      style={selected ? { backgroundColor: hex } : undefined}
    >
      {showFavicon ? (
        <img
          src={`/api/discover/proxy-image?url=${encodeURIComponent(source.favicon)}`}
          alt=""
          aria-hidden="true"
          onError={() => setIconFailed(true)}
          className={`w-4 h-4 rounded-sm shrink-0 ${selected ? 'ring-1 ring-white/40' : ''}`}
        />
      ) : (
        <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0 mx-1" style={{ backgroundColor: selected ? '#fff' : hex }} />
      )}
      <span className="truncate max-w-[8rem]">{source.name}</span>
      {selected && <Check size={11} strokeWidth={3} className="shrink-0 -mr-0.5" />}
    </button>
  );
}

function PreSearchHint({
  sources, hasSelection, showSearch, onOpenSearch, onShowMoreSites,
}: {
  sources: SourceConfig[];
  hasSelection: boolean;
  showSearch: boolean;
  onOpenSearch: () => void;
  onShowMoreSites: () => void;
}) {
  if (sources.length === 0) {
    return (
      <div className="text-center py-16">
        <Loader size={20} className="mx-auto animate-spin text-accent mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading sources…</p>
      </div>
    );
  }
  return (
    <div className="text-center py-16 space-y-6">
      <div>
        <Compass size={36} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
        <h2 className="text-lg font-semibold mb-1">Find new manga & comics</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          {!hasSelection
            ? 'Pick one or more sources from the bar above, then search.'
            : !showSearch
              ? 'Tap the search button in the header to begin.'
              : 'Type a title in the search bar above.'}
        </p>
      </div>

      {hasSelection && !showSearch && (
        <button
          onClick={onOpenSearch}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent text-white text-sm font-medium transition-colors min-h-[44px]"
        >
          <Search size={16} /> Open search
        </button>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <a
          href="https://myanimelist.net/topmanga.php"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-accent transition-colors"
        >
          <BookOpen size={14} /> Browse top manga on MAL
        </a>
        <span className="hidden sm:inline text-gray-300 dark:text-gray-700">·</span>
        <button
          onClick={onShowMoreSites}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-accent transition-colors"
        >
          <Eye size={14} /> More sources (extension &amp; HakuNeko)
        </button>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  const cells = Array.from({ length: 12 });
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
      {cells.map((_, i) => (
        <div key={i} className="bg-surface dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
          <div className="aspect-[2/3] bg-gray-100 dark:bg-gray-800" />
          <div className="p-3 space-y-2">
            <div className="h-3 rounded bg-gray-100 dark:bg-gray-800 w-3/4" />
            <div className="h-2.5 rounded bg-gray-100 dark:bg-gray-800 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
