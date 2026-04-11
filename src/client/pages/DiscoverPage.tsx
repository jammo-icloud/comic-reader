import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader, Zap, Globe, ShieldAlert } from 'lucide-react';
import type { SearchResult, ChapterResult } from '../lib/types';
import { discoverSearch, discoverChapters } from '../lib/api';
import { ALL_SOURCES, getSourcesByTier, searchBrowserSources, getBrowserChapters } from '../lib/browser-sources/registry';
import MangaSearchCard from '../components/MangaSearchCard';
import ChapterPicker from '../components/ChapterPicker';
import DownloadProgress from '../components/DownloadProgress';
import ThemeToggle from '../components/ThemeToggle';

const tierIcons = { fast: Zap, slow: Globe, nsfw: ShieldAlert };
const tierLabels = { fast: 'Fast', slow: 'Slow (browser-powered)', nsfw: 'NSFW' };

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Source selection
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(getSourcesByTier('fast').map((s) => s.id))
  );
  const [sourcesLocked, setSourcesLocked] = useState(false);

  // Chapter picker
  const [selectedManga, setSelectedManga] = useState<SearchResult | null>(null);
  const [chapters, setChapters] = useState<ChapterResult[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);

  const toggleSource = (id: string) => {
    if (sourcesLocked) return;
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || selectedSources.size === 0) return;

    setSearching(true);
    setHasSearched(true);
    setSourcesLocked(true);

    try {
      // Split selected sources into server vs browser
      const serverIds = [...selectedSources].filter((id) => {
        const config = ALL_SOURCES.find((s) => s.id === id);
        return config?.type === 'server';
      });
      const browserIds = [...selectedSources].filter((id) => {
        const config = ALL_SOURCES.find((s) => s.id === id);
        return config?.type === 'browser';
      });

      // Search in parallel
      const [serverData, browserData] = await Promise.all([
        serverIds.length > 0
          ? discoverSearch(query.trim()).then((d) =>
              d.results.filter((r) => serverIds.includes(r.sourceId))
            )
          : Promise.resolve([]),
        browserIds.length > 0
          ? searchBrowserSources(query.trim(), browserIds)
          : Promise.resolve([]),
      ]);

      setResults([...serverData, ...browserData]);
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
    setSelectedManga(manga);
    setLoadingChapters(true);
    try {
      const config = ALL_SOURCES.find((s) => s.id === manga.sourceId);
      let ch: ChapterResult[];
      if (config?.type === 'browser') {
        ch = await getBrowserChapters(manga.sourceId, manga.mangaId);
      } else {
        ch = await discoverChapters(manga.sourceId, manga.mangaId);
      }
      setChapters(ch);
    } catch (err) {
      console.error('Failed to load chapters:', err);
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
          <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400" title="Back">
            <ArrowLeft size={18} />
          </button>
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search manga..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
            {hasSearched ? (
              <button type="button" onClick={handleClearSearch} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                Clear
              </button>
            ) : (
              <button
                type="submit"
                disabled={searching || !query.trim() || selectedSources.size === 0}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                {searching ? <Loader size={16} className="animate-spin" /> : 'Search'}
              </button>
            )}
          </form>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
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
              <p className="text-gray-500 text-center py-12">No results found.</p>
            )}
          </>
        )}

        {/* Empty state — when no search */}
        {!hasSearched && !searching && (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-400 dark:text-gray-500">Select sources below, then search above</p>
          </div>
        )}
      </main>

      {/* Source picker — always at bottom */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto space-y-3">
          {(['fast', 'slow', 'nsfw'] as const).map((tier) => {
            const sources = getSourcesByTier(tier);
            if (sources.length === 0) return null;
            const Icon = tierIcons[tier];
            return (
              <div key={tier}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon size={13} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{tierLabels[tier]}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sources.map((source) => {
                    const isSelected = selectedSources.has(source.id);
                    return (
                      <button
                        key={source.id}
                        onClick={() => toggleSource(source.id)}
                        disabled={sourcesLocked}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                          isSelected
                            ? `${source.color} text-white border-transparent`
                            : `bg-transparent border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 ${sourcesLocked ? 'opacity-30' : 'hover:border-gray-400 dark:hover:border-gray-500'}`
                        } ${sourcesLocked ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {source.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Download progress */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <DownloadProgress />
      </div>

      {/* Chapter Picker Modal */}
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
