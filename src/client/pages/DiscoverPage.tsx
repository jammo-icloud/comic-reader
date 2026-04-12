import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader, Check, ExternalLink, Eye, X } from 'lucide-react';
import type { SearchResult, ChapterResult } from '../lib/types';
import { discoverSearch, discoverChapters, addToCollection } from '../lib/api';
import { ALL_SOURCES, HAKUNEKO_SITES, HAKUNEKO_URL, getSourceConfig } from '../lib/browser-sources/registry';
import type { SourceConfig } from '../lib/browser-sources/types';
import MangaSearchCard from '../components/MangaSearchCard';
import ChapterPicker from '../components/ChapterPicker';
import NotificationDropdown from '../components/NotificationDropdown';
import ThemeToggle from '../components/ThemeToggle';

const colorHex: Record<string, string> = {
  'bg-orange-600': '#ea580c',
  'bg-emerald-600': '#059669',
};

function SourceCard({ source, selected, onClick }: { source: SourceConfig; selected: boolean; onClick: () => void }) {
  const hex = colorHex[source.color] || '#6b7280';
  return (
    <button
      onClick={onClick}
      className="relative text-left p-4 rounded-xl transition-all duration-200 w-full border-l-4"
      style={{
        borderLeftColor: hex,
        backgroundColor: selected ? `${hex}15` : undefined,
        boxShadow: selected ? `0 4px 20px ${hex}35, inset 0 0 0 1px ${hex}40` : `inset 0 0 0 1px ${hex}20`,
      }}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5">
          <Check size={16} style={{ color: hex }} />
        </div>
      )}
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-2 right-3 inline-flex items-center gap-1 text-[10px] text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
      >
        Visit site <ExternalLink size={9} />
      </a>
      <div className="flex items-start gap-3">
        <img
          src={`/api/discover/proxy-image?url=${encodeURIComponent(source.favicon)}`}
          alt=""
          className="w-7 h-7 rounded shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{source.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{source.description}</p>
        </div>
      </div>
    </button>
  );
}

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sourcesLocked, setSourcesLocked] = useState(false);
  const [showMoreSites, setShowMoreSites] = useState(false);

  const [selectedManga, setSelectedManga] = useState<SearchResult | null>(null);
  const [chapters, setChapters] = useState<ChapterResult[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);

  const hasSelection = selectedSources.size > 0;

  const toggleSource = (id: string) => {
    if (sourcesLocked) return;
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || !hasSelection) return;
    setSearching(true);
    setHasSearched(true);
    setSourcesLocked(true);
    try {
      const data = await discoverSearch(query.trim());
      const serverIds = [...selectedSources];
      setResults(data.results.filter((r) => serverIds.includes(r.sourceId)));
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setSourcesLocked(false);
  };

  const handleSelectManga = async (manga: SearchResult) => {
    // If series exists locally and not in collection, add it
    if (manga.localSeriesId && !manga.inCollection) {
      await addToCollection(manga.localSeriesId);
      // Update local state to show "In Collection"
      setResults((prev) => prev.map((r) =>
        r.mangaId === manga.mangaId && r.sourceId === manga.sourceId
          ? { ...r, inCollection: true }
          : r
      ));
      return;
    }

    // If already in collection, navigate to series page
    if (manga.localSeriesId && manga.inCollection) {
      navigate(`/series/${manga.localSeriesId}`);
      return;
    }

    // Not in local library — open chapter picker for download
    setSelectedManga(manga);
    setLoadingChapters(true);
    try {
      const ch = await discoverChapters(manga.sourceId, manga.mangaId);
      setChapters(ch);
    } catch (err) {
      setChapters([]);
    } finally {
      setLoadingChapters(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            <ArrowLeft size={18} />
          </button>
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={hasSelection ? 'Search manga...' : 'Select sources first...'}
                disabled={!hasSelection}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
            {hasSearched ? (
              <button type="button" onClick={handleClearSearch} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">Clear</button>
            ) : (
              <button type="submit" disabled={searching || !query.trim() || !hasSelection} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                {searching ? <Loader size={16} className="animate-spin" /> : 'Search'}
              </button>
            )}
          </form>
          {sourcesLocked && (
            <div className="hidden sm:flex items-center gap-1">
              {[...selectedSources].map((id) => {
                const config = getSourceConfig(id);
                const hex = colorHex[config?.color || ''] || '#6b7280';
                return config ? (
                  <span key={id} className="text-white text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: hex }}>{config.name}</span>
                ) : null;
              })}
            </div>
          )}
          <NotificationDropdown />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
        {/* Source picker — before search */}
        {!hasSearched && !searching && (
          <div className="space-y-6">
            {/* Source cards */}
            <section>
              <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">Search Sources</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ALL_SOURCES.map((source) => (
                  <SourceCard key={source.id} source={source} selected={selectedSources.has(source.id)} onClick={() => toggleSource(source.id)} />
                ))}
              </div>
            </section>

            {/* Looking for more */}
            {/* Browse MAL */}
            <section>
              <a
                href="https://myanimelist.net/topmanga.php"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                <ExternalLink size={16} /> Browse top manga on MyAnimeList
              </a>
            </section>

            <section className="space-y-2">
              <button
                onClick={() => setShowMoreSites(true)}
                className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                <Eye size={16} /> Looking for more sites?
              </button>
              <div className="text-xs text-gray-500 dark:text-gray-600 pl-6 space-y-1">
                <p>
                  The <span className="text-gray-400 dark:text-gray-500 font-medium">Manga Finder</span> Chrome extension adds 10 sources including MangaHub, OmegaScans, HentaiNexus, and more.
                </p>
                <a
                  href="/manga-finder-extension.zip"
                  download
                  className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-400 transition-colors"
                >
                  Download extension → unzip → load unpacked in chrome://extensions
                </a>
              </div>
            </section>
          </div>
        )}

        {/* Loading */}
        {searching && (
          <div className="flex items-center justify-center py-24">
            <Loader size={24} className="animate-spin text-blue-500" />
          </div>
        )}

        {/* Results */}
        {hasSearched && !searching && (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </p>
            {results.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {results.map((manga, i) => (
                  <MangaSearchCard key={`${manga.sourceId}-${manga.mangaId}-${i}`} manga={manga} onClick={() => handleSelectManga(manga)} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No results found.</p>
                <button onClick={() => setShowMoreSites(true)} className="inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-400">
                  <Eye size={16} /> Try more sites with HakuNeko
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* "Looking for more" modal */}
      {showMoreSites && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMoreSites(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-semibold">More Manga Sites</h2>
              <button onClick={() => setShowMoreSites(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                These sites require a desktop app to download from. Use <a href={HAKUNEKO_URL} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-medium">HakuNeko</a> to download chapters, then import the folder into Comic Reader.
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
        </div>
      )}

      {/* Chapter Picker */}
      {selectedManga && (
        <ChapterPicker
          manga={selectedManga}
          chapters={chapters}
          loading={loadingChapters}
          onClose={() => { setSelectedManga(null); setChapters([]); }}
        />
      )}

    </div>
  );
}
