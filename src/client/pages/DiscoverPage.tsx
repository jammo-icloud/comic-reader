import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader } from 'lucide-react';
import type { MangaDexManga, MangaDexChapter } from '../lib/types';
import { discoverSearch, discoverChapters } from '../lib/api';
import MangaSearchCard from '../components/MangaSearchCard';
import ChapterPicker from '../components/ChapterPicker';
import DownloadProgress from '../components/DownloadProgress';
import ThemeToggle from '../components/ThemeToggle';

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MangaDexManga[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Chapter picker state
  const [selectedManga, setSelectedManga] = useState<MangaDexManga | null>(null);
  const [chapters, setChapters] = useState<MangaDexChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setHasSearched(true);
    try {
      const data = await discoverSearch(query.trim());
      setResults(data.results);
      setTotal(data.total);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectManga = async (manga: MangaDexManga) => {
    setSelectedManga(manga);
    setLoadingChapters(true);
    try {
      const ch = await discoverChapters(manga.sourceId, manga.mangaId);
      setChapters(ch);
    } catch (err) {
      console.error('Failed to load chapters:', err);
      setChapters([]);
    } finally {
      setLoadingChapters(false);
    }
  };

  const handleCloseChapterPicker = () => {
    setSelectedManga(null);
    setChapters([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
            title="Back to library"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Search form — always visible */}
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search MangaDex..."
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {searching ? <Loader size={16} className="animate-spin" /> : 'Search'}
            </button>
          </form>

          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Empty state */}
        {!hasSearched && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Search size={48} className="text-gray-300 dark:text-gray-700 mb-4" />
            <h2 className="text-xl font-semibold text-gray-400 dark:text-gray-500">
              Search MangaDex
            </h2>
            <p className="text-sm text-gray-400 dark:text-gray-600 mt-2 max-w-md">
              Find manga from MangaDex's community library. Select chapters to download directly to your shelves.
            </p>
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
              {total} result{total !== 1 ? 's' : ''} for "{query}"
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {results.map((manga) => (
                <MangaSearchCard
                  key={manga.mangaId}
                  manga={manga}
                  onClick={() => handleSelectManga(manga)}
                />
              ))}
            </div>
            {results.length === 0 && (
              <p className="text-gray-500 text-center py-12">
                No results found. Try a different search term.
              </p>
            )}
          </>
        )}
      </main>

      {/* Download progress bar — fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <DownloadProgress />
      </div>

      {/* Chapter Picker Modal */}
      {selectedManga && (
        <ChapterPicker
          manga={selectedManga}
          chapters={chapters}
          loading={loadingChapters}
          onClose={handleCloseChapterPicker}
        />
      )}
    </div>
  );
}
