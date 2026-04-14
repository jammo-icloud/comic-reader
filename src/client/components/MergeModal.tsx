import { useState, useEffect, useMemo } from 'react';
import { X, GitMerge, Loader, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { getMergePreview, executeMerge } from '../lib/api';

interface CatalogItem {
  id: string;
  name: string;
  englishTitle?: string | null;
  count: number;
  type: string;
  coverFile?: string | null;
  score?: number | null;
  synopsis?: string | null;
  tags?: string[];
  status?: string | null;
  year?: number | null;
  malId?: number | null;
  mangaDexId?: string | null;
}

interface MergeSlot {
  order: number;
  keepChapter: { file: string; pages: number; order: number } | null;
  removeChapter: { file: string; pages: number; order: number } | null;
}

interface MergeModalProps {
  keepSeries: CatalogItem;
  catalog: CatalogItem[];
  onClose: () => void;
  onComplete: () => void;
}

type MetaField = 'name' | 'englishTitle' | 'coverFile' | 'score' | 'synopsis' | 'tags' | 'status' | 'year' | 'malId' | 'mangaDexId';

const META_FIELDS: { key: MetaField; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'englishTitle', label: 'English Title' },
  { key: 'coverFile', label: 'Cover' },
  { key: 'score', label: 'Score' },
  { key: 'synopsis', label: 'Synopsis' },
  { key: 'tags', label: 'Tags' },
  { key: 'status', label: 'Status' },
  { key: 'year', label: 'Year' },
  { key: 'malId', label: 'MAL ID' },
  { key: 'mangaDexId', label: 'MangaDex ID' },
];

function displayValue(val: any): string {
  if (val == null) return '—';
  if (Array.isArray(val)) return val.length ? val.join(', ') : '—';
  return String(val);
}

export default function MergeModal({ keepSeries, catalog, onClose, onComplete }: MergeModalProps) {
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Preview data
  const [preview, setPreview] = useState<{ keep: any; remove: any; slots: MergeSlot[] } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Selections
  const [chapterChoices, setChapterChoices] = useState<Map<number, 'keep' | 'remove'>>(new Map());
  const [metaChoices, setMetaChoices] = useState<Map<MetaField, 'keep' | 'remove'>>(new Map());
  const [showMeta, setShowMeta] = useState(true);

  // Execution
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');

  // Filter catalog for dropdown (exclude the keep series, match types)
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return catalog
      .filter((s) => s.id !== keepSeries.id && s.type === keepSeries.type)
      .filter((s) =>
        !q || s.name.toLowerCase().includes(q) || (s.englishTitle?.toLowerCase().includes(q))
      );
  }, [catalog, keepSeries, searchQuery]);

  // Load preview when removeId changes
  useEffect(() => {
    if (!removeId) { setPreview(null); return; }
    setLoadingPreview(true);
    setError('');
    getMergePreview(keepSeries.id, removeId)
      .then((data) => {
        setPreview(data);
        // Default selections: keep side when both exist, auto-select sole side
        const defaults = new Map<number, 'keep' | 'remove'>();
        for (const slot of data.slots) {
          if (slot.keepChapter && !slot.removeChapter) defaults.set(slot.order, 'keep');
          else if (!slot.keepChapter && slot.removeChapter) defaults.set(slot.order, 'remove');
          else defaults.set(slot.order, 'keep'); // Default to keep when both
        }
        setChapterChoices(defaults);
        // Default metadata: keep side for everything
        setMetaChoices(new Map(META_FIELDS.map((f) => [f.key, 'keep'])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPreview(false));
  }, [removeId, keepSeries.id]);

  const handleMerge = async () => {
    if (!preview || !removeId) return;
    if (!confirm(`Merge "${preview.remove.name}" into "${preview.keep.name}"? The removed series and its unchosen chapters will be permanently deleted.`)) return;

    setExecuting(true);
    setError('');
    try {
      const chapters = preview.slots
        .map((slot) => {
          const choice = chapterChoices.get(slot.order);
          if (!choice) return null;
          const ch = choice === 'keep' ? slot.keepChapter : slot.removeChapter;
          if (!ch) return null;
          return { file: ch.file, from: choice };
        })
        .filter(Boolean) as { file: string; from: 'keep' | 'remove' }[];

      const metadata: Record<string, 'keep' | 'remove'> = {};
      for (const [key, val] of metaChoices) metadata[key] = val;

      await executeMerge({ keepId: keepSeries.id, removeId, chapters, metadata });
      onComplete();
    } catch (err) {
      setError((err as Error).message);
      setExecuting(false);
    }
  };

  // Stats
  const keepCount = preview ? preview.slots.filter((s) => chapterChoices.get(s.order) === 'keep' && s.keepChapter).length : 0;
  const removeCount = preview ? preview.slots.filter((s) => chapterChoices.get(s.order) === 'remove' && s.removeChapter).length : 0;
  const totalChapters = keepCount + removeCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <GitMerge size={18} className="text-blue-500" />
          <h2 className="text-lg font-semibold flex-1">Merge Series</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* Series picker */}
          <div className="grid grid-cols-2 gap-4">
            {/* Keep side */}
            <div className="p-3 rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
              <p className="text-[10px] uppercase font-medium text-blue-500 mb-1">Keep</p>
              <p className="font-semibold truncate">{keepSeries.name}</p>
              {keepSeries.englishTitle && keepSeries.englishTitle !== keepSeries.name && (
                <p className="text-xs text-gray-400 truncate">{keepSeries.englishTitle}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">{keepSeries.count} chapters</p>
            </div>

            {/* Remove side — dropdown picker */}
            <div className="p-3 rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
              <p className="text-[10px] uppercase font-medium text-red-500 mb-1">Merge &amp; Remove</p>
              {removeId && preview ? (
                <div>
                  <p className="font-semibold truncate">{preview.remove.name}</p>
                  {preview.remove.englishTitle && preview.remove.englishTitle !== preview.remove.name && (
                    <p className="text-xs text-gray-400 truncate">{preview.remove.englishTitle}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{preview.remove.count} chapters</p>
                  <button onClick={() => { setRemoveId(null); setPreview(null); }} className="text-xs text-red-500 mt-1 hover:underline">Change</button>
                </div>
              ) : (
                <div className="relative">
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-pointer"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    <Search size={14} className="text-gray-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search series to merge..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setDropdownOpen(true); }}
                      onClick={(e) => { e.stopPropagation(); setDropdownOpen(true); }}
                      className="flex-1 bg-transparent outline-none text-sm"
                    />
                    {dropdownOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </div>
                  {dropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                      {filteredCatalog.length === 0 && (
                        <p className="px-3 py-2 text-sm text-gray-400">No matching series</p>
                      )}
                      {filteredCatalog.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setRemoveId(s.id); setDropdownOpen(false); setSearchQuery(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                        >
                          <p className="truncate font-medium">{s.name}</p>
                          {s.englishTitle && s.englishTitle !== s.name && (
                            <p className="text-[10px] text-gray-400 truncate">{s.englishTitle}</p>
                          )}
                          <p className="text-[10px] text-gray-400">{s.count} chapters</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Loading */}
          {loadingPreview && (
            <div className="flex justify-center py-8">
              <Loader className="animate-spin text-gray-400" size={24} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2">{error}</div>
          )}

          {/* Preview */}
          {preview && !loadingPreview && (
            <>
              {/* Metadata comparison */}
              <div>
                <button
                  onClick={() => setShowMeta(!showMeta)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 hover:text-gray-900 dark:hover:text-white"
                >
                  {showMeta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Metadata
                </button>
                {showMeta && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500">
                          <th className="px-3 py-1.5 text-left font-medium w-28">Field</th>
                          <th className="px-3 py-1.5 text-left font-medium">
                            <span className="text-blue-500">Keep</span>
                          </th>
                          <th className="px-3 py-1.5 text-left font-medium">
                            <span className="text-red-500">Remove</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {META_FIELDS.map(({ key, label }) => {
                          const keepVal = preview.keep[key];
                          const removeVal = preview.remove[key];
                          const choice = metaChoices.get(key) || 'keep';
                          const differs = JSON.stringify(keepVal) !== JSON.stringify(removeVal);

                          return (
                            <tr key={key} className={differs ? '' : 'opacity-50'}>
                              <td className="px-3 py-1.5 text-xs text-gray-500 font-medium">{label}</td>
                              <td
                                className={`px-3 py-1.5 text-xs cursor-pointer truncate max-w-[200px] ${
                                  choice === 'keep'
                                    ? 'bg-blue-50 dark:bg-blue-900/20 font-medium'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                                onClick={() => setMetaChoices((prev) => new Map(prev).set(key, 'keep'))}
                                title={displayValue(keepVal)}
                              >
                                {displayValue(keepVal)}
                              </td>
                              <td
                                className={`px-3 py-1.5 text-xs cursor-pointer truncate max-w-[200px] ${
                                  choice === 'remove'
                                    ? 'bg-red-50 dark:bg-red-900/20 font-medium'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                                onClick={() => setMetaChoices((prev) => new Map(prev).set(key, 'remove'))}
                                title={displayValue(removeVal)}
                              >
                                {displayValue(removeVal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Chapter comparison */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Chapters ({totalChapters} selected)
                  </h3>
                  <div className="flex gap-2 text-[10px]">
                    <button
                      onClick={() => {
                        const all = new Map<number, 'keep' | 'remove'>();
                        for (const s of preview.slots) all.set(s.order, s.keepChapter ? 'keep' : 'remove');
                        setChapterChoices(all);
                      }}
                      className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100"
                    >
                      All left
                    </button>
                    <button
                      onClick={() => {
                        const all = new Map<number, 'keep' | 'remove'>();
                        for (const s of preview.slots) all.set(s.order, s.removeChapter ? 'remove' : 'keep');
                        setChapterChoices(all);
                      }}
                      className="px-2 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100"
                    >
                      All right
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[40vh] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80 backdrop-blur">
                      <tr className="text-gray-500">
                        <th className="px-3 py-1.5 text-left font-medium w-16">#</th>
                        <th className="px-3 py-1.5 text-left font-medium">
                          <span className="text-blue-500">Keep</span>
                        </th>
                        <th className="px-3 py-1.5 text-left font-medium">
                          <span className="text-red-500">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {preview.slots.map((slot) => {
                        const choice = chapterChoices.get(slot.order);
                        const onlyOne = !slot.keepChapter || !slot.removeChapter;

                        return (
                          <tr key={slot.order}>
                            <td className="px-3 py-1.5 text-gray-400 font-mono">{slot.order}</td>
                            <td
                              className={`px-3 py-1.5 ${
                                !slot.keepChapter
                                  ? 'text-gray-300 dark:text-gray-700'
                                  : choice === 'keep'
                                    ? 'bg-blue-50 dark:bg-blue-900/20 font-medium cursor-pointer'
                                    : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                              onClick={() => slot.keepChapter && setChapterChoices((prev) => new Map(prev).set(slot.order, 'keep'))}
                            >
                              {slot.keepChapter ? (
                                <span title={slot.keepChapter.file}>
                                  {slot.keepChapter.file}
                                  <span className="text-gray-400 ml-2">{slot.keepChapter.pages}p</span>
                                </span>
                              ) : '—'}
                            </td>
                            <td
                              className={`px-3 py-1.5 ${
                                !slot.removeChapter
                                  ? 'text-gray-300 dark:text-gray-700'
                                  : choice === 'remove'
                                    ? 'bg-red-50 dark:bg-red-900/20 font-medium cursor-pointer'
                                    : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                              onClick={() => slot.removeChapter && setChapterChoices((prev) => new Map(prev).set(slot.order, 'remove'))}
                            >
                              {slot.removeChapter ? (
                                <span title={slot.removeChapter.file}>
                                  {slot.removeChapter.file}
                                  <span className="text-gray-400 ml-2">{slot.removeChapter.pages}p</span>
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {preview && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-800 shrink-0">
            <p className="text-xs text-gray-400">
              {keepCount} from keep + {removeCount} from remove = {totalChapters} chapters
            </p>
            <button
              onClick={handleMerge}
              disabled={executing || totalChapters === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {executing ? <Loader className="animate-spin" size={14} /> : <GitMerge size={14} />}
              {executing ? 'Merging...' : 'Merge Series'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
