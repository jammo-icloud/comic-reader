/**
 * SyncSourcePicker — modal dialog to assign a sync source to a series.
 * User picks a source, types a search query (pre-filled with the series name),
 * picks a matching manga from the results. Saves to /series/:id/sync-source.
 */
import { useState, useEffect, useId } from 'react';
import { X, Search, Loader, Check } from 'lucide-react';
import { getAvailableSources, searchSource, updateSeriesSyncSource } from '../lib/api';
import ConfirmSheet from './ConfirmSheet';
import { useEscapeKey } from '../lib/useEscapeKey';

interface SyncSourcePickerProps {
  seriesId: string;
  seriesName: string;
  currentSource?: { sourceId: string; mangaId: string } | null;
  onClose: () => void;
  onSaved: (source: { sourceId: string; mangaId: string } | null) => void;
}

interface SourceInfo {
  id: string;
  name: string;
  color: string;
  favicon?: string;
}

interface SearchResultItem {
  mangaId: string;
  title: string;
  coverUrl: string | null;
  description: string;
  status: string;
  year: number | null;
}

// Sources that can't be subscribed to (one-shot galleries, no "new chapters")
const UNSUPPORTED_SOURCES = new Set(['hentainexus']);

export default function SyncSourcePicker({ seriesId, seriesName, currentSource, onClose, onSaved }: SyncSourcePickerProps) {
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>(currentSource?.sourceId || '');
  const [query, setQuery] = useState(seriesName);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getAvailableSources().then((list) => {
      setSources(list.filter((s) => !UNSUPPORTED_SOURCES.has(s.id)));
    });
  }, []);

  const handleSearch = async () => {
    if (!selectedSource || !query.trim()) return;
    setSearching(true);
    setError('');
    try {
      const hits = await searchSource(selectedSource, query.trim());
      setResults(hits);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const handlePick = async (result: SearchResultItem) => {
    setSaving(true);
    setError('');
    try {
      const newSource = { sourceId: selectedSource, mangaId: result.mangaId };
      await updateSeriesSyncSource(seriesId, newSource);
      onSaved(newSource);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const [showUnsubscribe, setShowUnsubscribe] = useState(false);

  const requestUnsubscribe = () => setShowUnsubscribe(true);

  const handleUnsubscribe = async () => {
    setShowUnsubscribe(false);
    setSaving(true);
    try {
      await updateSeriesSyncSource(seriesId, null);
      onSaved(null);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const titleId = useId();
  useEscapeKey(onClose, !showUnsubscribe);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 max-h-full overflow-y-auto"
      >

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-t-xl">
          <h2 id={titleId} className="text-lg font-semibold flex-1 truncate">Sync source for "{seriesName}"</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">

          {currentSource && (
            <div className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 text-xs">
              <span>
                Currently syncing from <strong className="capitalize">{currentSource.sourceId}</strong>
                <span className="text-gray-400 ml-2 font-mono">{currentSource.mangaId}</span>
              </span>
              <button
                onClick={requestUnsubscribe}
                disabled={saving}
                className="text-danger hover:text-danger hover:underline"
              >
                Unsubscribe
              </button>
            </div>
          )}

          {/* Source picker */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Source</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedSource(s.id); setResults([]); }}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    selectedSource === s.id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          {selectedSource && (
            <div>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Manga title..."
                  autoFocus
                  className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !query.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  {searching ? <Loader className="animate-spin" size={14} /> : <Search size={14} />}
                  Search
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-danger bg-danger/10 rounded-lg px-4 py-2">{error}</div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-400 mb-2">{results.length} results — pick the correct match</p>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {results.map((r) => {
                  const isCurrent = currentSource?.sourceId === selectedSource && currentSource?.mangaId === r.mangaId;
                  return (
                    <button
                      key={r.mangaId}
                      onClick={() => handlePick(r)}
                      disabled={saving || isCurrent}
                      className={`w-full flex items-start gap-3 p-2 rounded-lg border text-left transition-colors ${
                        isCurrent
                          ? 'border-success bg-success/10'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {r.coverUrl && (
                        <img src={r.coverUrl} alt="" className="w-12 h-18 object-cover rounded shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        <p className="text-[10px] text-gray-500 capitalize">{r.status}{r.year ? ` · ${r.year}` : ''}</p>
                        {r.description && <p className="text-[10px] text-gray-400 line-clamp-2 mt-1">{r.description}</p>}
                        <p className="text-[10px] text-gray-400 font-mono mt-1 truncate">{r.mangaId}</p>
                      </div>
                      {isCurrent && <Check size={16} className="text-success shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!results.length && selectedSource && !searching && (
            <p className="text-xs text-gray-400 text-center py-4">
              Click Search to find matching series on {sources.find((s) => s.id === selectedSource)?.name}
            </p>
          )}
        </div>
      </div>

      <ConfirmSheet
        open={showUnsubscribe}
        title="Unsubscribe from auto-sync?"
        message="New chapters will no longer be auto-downloaded. Existing chapters stay in your library."
        confirmLabel="Unsubscribe"
        busy={saving}
        onConfirm={handleUnsubscribe}
        onCancel={() => setShowUnsubscribe(false)}
      />
    </div>
  );
}
