import { useState, useEffect, useId } from 'react';
import { X, GitMerge, Loader, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { getMergePreview, executeMerge } from '../lib/api';
import ConfirmSheet from './ConfirmSheet';
import { useEscapeKey } from '../lib/useEscapeKey';

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
  seriesA: CatalogItem;
  seriesB: CatalogItem;
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

export default function MergeModal({ seriesA, seriesB, onClose, onComplete }: MergeModalProps) {
  // Preview data — seriesA = "keep", seriesB = "remove" (but user chooses per-cell)
  const [preview, setPreview] = useState<{ keep: any; remove: any; slots: MergeSlot[] } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);

  // Selections
  const [chapterChoices, setChapterChoices] = useState<Map<number, 'keep' | 'remove'>>(new Map());
  const [metaChoices, setMetaChoices] = useState<Map<MetaField, 'keep' | 'remove'>>(new Map());
  const [showMeta, setShowMeta] = useState(true);

  // Execution
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');

  // Load preview immediately
  useEffect(() => {
    setLoadingPreview(true);
    setError('');
    getMergePreview(seriesA.id, seriesB.id)
      .then((data) => {
        setPreview(data);
        const defaults = new Map<number, 'keep' | 'remove'>();
        for (const slot of data.slots) {
          if (slot.keepChapter && !slot.removeChapter) defaults.set(slot.order, 'keep');
          else if (!slot.keepChapter && slot.removeChapter) defaults.set(slot.order, 'remove');
          else defaults.set(slot.order, 'keep');
        }
        setChapterChoices(defaults);
        setMetaChoices(new Map(META_FIELDS.map((f) => [f.key, 'keep'])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPreview(false));
  }, [seriesA.id, seriesB.id]);

  const [showConfirm, setShowConfirm] = useState(false);

  const requestMerge = () => {
    if (!preview) return;
    setShowConfirm(true);
  };

  const handleMerge = async () => {
    if (!preview) return;
    setShowConfirm(false);
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

      await executeMerge({ keepId: seriesA.id, removeId: seriesB.id, chapters, metadata });
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

  const titleId = useId();
  useEscapeKey(onClose, !showConfirm); // Esc on the inner ConfirmSheet handles its own close

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-5xl mx-4 max-h-full overflow-y-auto"
      >

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-t-xl">
          <GitMerge size={18} className="text-accent" />
          <h2 id={titleId} className="text-lg font-semibold flex-1">Merge Series</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">

          {/* Instructions */}
          <div className="flex items-start gap-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-4 py-3">
            <Info size={16} className="shrink-0 mt-0.5 text-accent" />
            <div>
              <p>Click a cell to select which value to keep for each row. <strong className="text-gray-700 dark:text-gray-200">Highlighted cells are kept</strong>, unhighlighted cells are discarded.</p>
              <p className="mt-1 text-xs text-gray-400">Merging <strong>{seriesA.name}</strong> ({seriesA.count} ch.) with <strong>{seriesB.name}</strong> ({seriesB.count} ch.). The unchosen series folder will be deleted.</p>
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
            <div className="text-sm text-danger bg-danger/10 rounded-lg px-4 py-2">{error}</div>
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
                          <th className="px-3 py-1.5 text-left font-medium truncate max-w-[200px]">{seriesA.name}</th>
                          <th className="px-3 py-1.5 text-left font-medium truncate max-w-[200px]">{seriesB.name}</th>
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
                                    ? 'bg-accent/10 font-medium'
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
                                    ? 'bg-accent/10 font-medium'
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
                      className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      All {seriesA.name.length > 15 ? 'left' : seriesA.name}
                    </button>
                    <button
                      onClick={() => {
                        const all = new Map<number, 'keep' | 'remove'>();
                        for (const s of preview.slots) all.set(s.order, s.removeChapter ? 'remove' : 'keep');
                        setChapterChoices(all);
                      }}
                      className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      All {seriesB.name.length > 15 ? 'right' : seriesB.name}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500">
                        <th className="px-3 py-1.5 text-left font-medium w-16">#</th>
                        <th className="px-3 py-1.5 text-left font-medium truncate max-w-[200px]">{seriesA.name}</th>
                        <th className="px-3 py-1.5 text-left font-medium truncate max-w-[200px]">{seriesB.name}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {preview.slots.map((slot) => {
                        const choice = chapterChoices.get(slot.order);

                        return (
                          <tr key={slot.order}>
                            <td className="px-3 py-1.5 text-gray-400 font-mono">{slot.order}</td>
                            <td
                              className={`px-3 py-1.5 ${
                                !slot.keepChapter
                                  ? 'text-gray-300 dark:text-gray-700'
                                  : choice === 'keep'
                                    ? 'bg-accent/10 font-medium cursor-pointer'
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
                                    ? 'bg-accent/10 font-medium cursor-pointer'
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

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 pb-1">
                <p className="text-xs text-gray-400">
                  {keepCount} from {seriesA.name.length > 20 ? 'left' : seriesA.name} + {removeCount} from {seriesB.name.length > 20 ? 'right' : seriesB.name} = {totalChapters} chapters
                </p>
                <button
                  onClick={requestMerge}
                  disabled={executing || totalChapters === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {executing ? <Loader className="animate-spin" size={14} /> : <GitMerge size={14} />}
                  {executing ? 'Merging...' : 'Merge Series'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmSheet
        open={showConfirm}
        title="Merge these two series?"
        message="The unchosen series folder and its rejected chapters will be permanently deleted. This cannot be undone."
        confirmLabel="Merge"
        destructive
        busy={executing}
        onConfirm={handleMerge}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
