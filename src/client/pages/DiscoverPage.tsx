import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader, Zap, Globe, ShieldAlert, ExternalLink, Check } from 'lucide-react';
import type { SearchResult, ChapterResult } from '../lib/types';
import { discoverSearch, discoverChapters } from '../lib/api';
import { ALL_SOURCES, getSourcesByTier, searchBrowserSources, getBrowserChapters } from '../lib/browser-sources/registry';
import type { SourceConfig, SourceTier } from '../lib/browser-sources/types';
import MangaSearchCard from '../components/MangaSearchCard';
import ChapterPicker from '../components/ChapterPicker';
import DownloadProgress from '../components/DownloadProgress';
import ThemeToggle from '../components/ThemeToggle';

const tierIcons = { fast: Zap, slow: Globe, nsfw: ShieldAlert };
const tierLabels = { fast: 'Fast', slow: 'Browser-powered (slower)', nsfw: 'NSFW' };

// Map Tailwind bg classes to hex for dynamic styling
const colorHex: Record<string, string> = {
  'bg-orange-600': '#ea580c',
  'bg-emerald-600': '#059669',
  'bg-indigo-600': '#4f46e5',
  'bg-violet-600': '#7c3aed',
  'bg-purple-600': '#9333ea',
  'bg-sky-600': '#0284c7',
  'bg-rose-600': '#e11d48',
  'bg-blue-700': '#1d4ed8',
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

  // Source selection
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sourcesLocked, setSourcesLocked] = useState(false);

  // Chapter picker
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
      const serverIds = [...selectedSources].filter((id) => {
        const config = ALL_SOURCES.find((s) => s.id === id);
        return config?.type === 'server';
      });
      const browserIds = [...selectedSources].filter((id) => {
        const config = ALL_SOURCES.find((s) => s.id === id);
        return config?.type === 'browser';
      });

      const [serverData, browserData] = await Promise.all([
        serverIds.length > 0
          ? discoverSearch(query.trim()).then((d) => d.results.filter((r) => serverIds.includes(r.sourceId)))
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
      const ch = config?.type === 'browser'
        ? await getBrowserChapters(manga.sourceId, manga.mangaId)
        : await discoverChapters(manga.sourceId, manga.mangaId);
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
              <button type="button" onClick={handleClearSearch} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                Clear
              </button>
            ) : (
              <button
                type="submit"
                disabled={searching || !query.trim() || !hasSelection}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                {searching ? <Loader size={16} className="animate-spin" /> : 'Search'}
              </button>
            )}
          </form>
          {/* Active source badges when searching */}
          {sourcesLocked && (
            <div className="hidden sm:flex items-center gap-1">
              {[...selectedSources].map((id) => {
                const config = ALL_SOURCES.find((s) => s.id === id);
                return config ? (
                  <span key={id} className={`${config.color} text-white text-[9px] px-1.5 py-0.5 rounded font-medium`}>{config.name}</span>
                ) : null;
              })}
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
        {/* Source picker — shown when NOT searching */}
        {!hasSearched && !searching && (
          <div className="space-y-6">
            {(['fast', 'slow', 'nsfw'] as const).map((tier) => {
              const sources = getSourcesByTier(tier);
              if (sources.length === 0) return null;
              const Icon = tierIcons[tier];
              return (
                <section key={tier}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={16} className="text-gray-500 dark:text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">{tierLabels[tier]}</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {sources.map((source) => (
                      <SourceCard
                        key={source.id}
                        source={source}
                        selected={selectedSources.has(source.id)}
                        onClick={() => toggleSource(source.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
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
              <p className="text-gray-500 text-center py-12">No results found. Try different sources or search terms.</p>
            )}
          </>
        )}
      </main>

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
