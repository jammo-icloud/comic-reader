import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Loader, Check, ExternalLink, Eye, X, Compass, AlertCircle, BookOpen } from 'lucide-react';
import type { SearchResult, ChapterResult } from '../lib/types';
import { discoverSearch, discoverChapters, addToCollection, getComics } from '../lib/api';
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

  const hasSelection = selectedSources.size > 0;

  // Auto-show the search row once the user has results, so they can refine without toggling.
  useEffect(() => { if (hasSearched) setShowSearch(true); }, [hasSearched]);

  const toggleSource = (id: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

      {/* ===== Library-shape header ===== */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-1.5">
          <img src="/logo.png" alt="Comic Reader" className="h-10 w-10 rounded-lg shrink-0" />
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

        {/* Search hint — pre-search state */}
        {!hasSearched && !searching && (
          <PreSearchHint
            sources={sources}
            hasSelection={hasSelection}
            showSearch={showSearch}
            onOpenSearch={() => setShowSearch(true)}
            onShowMoreSites={() => setShowMoreSites(true)}
          />
        )}

        {/* Loading skeleton */}
        {searching && <SkeletonGrid />}

        {/* Search error */}
        {!searching && searchError && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 mb-4">
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-red-700 dark:text-red-300">Search failed</p>
              <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">{searchError}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {hasSearched && !searching && !searchError && (
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
            className="relative w-full sm:max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mx-0 sm:mx-4 max-h-[90dvh] overflow-y-auto"
            style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>
            <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-base font-semibold">More Manga Sites</h2>
              <button
                onClick={() => setShowMoreSites(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 sm:px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                These sites require a desktop app to download from. Use{' '}
                <a href={HAKUNEKO_URL} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium">HakuNeko</a>{' '}
                to download chapters, then import the folder into Comic Reader.
              </p>
              <div className="space-y-2">
                {HAKUNEKO_SITES.map((site) => (
                  <a
                    key={site.name}
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium">{site.name}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{site.description}</p>
                    </div>
                    <ExternalLink size={14} className="text-gray-400 shrink-0" />
                  </a>
                ))}
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <a
                  href={HAKUNEKO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                >
                  Download HakuNeko <ExternalLink size={14} />
                </a>
              </div>
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
          : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
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
          <Eye size={14} /> More sites with HakuNeko
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
        <div key={i} className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
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
