import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, SkipForward, BookOpen, Newspaper, Star, Loader, Pencil, AlertTriangle, Merge } from 'lucide-react';
import type { PendingImport, Series } from '../lib/types';
import { getImportReady, getLocalReady, confirmImport, skipImport, skipLocalImport, getSeries } from '../lib/api';

export default function PendingList({ onClose, onUpdate, useLocal = false }: { onClose: () => void; onUpdate?: () => void; useLocal?: boolean }) {
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [existingSeries, setExistingSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);

  // Edit state for current item
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'comic' | 'magazine'>('comic');
  const [editMalId, setEditMalId] = useState('');
  const [showMalEdit, setShowMalEdit] = useState(false);
  const [brandImageFile, setBrandImageFile] = useState<File | null>(null);
  const [brandImagePreview, setBrandImagePreview] = useState<string | null>(null);

  const [polling, setPolling] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const loadPending = async () => {
    setLoading(true);
    const fetchReady = useLocal ? getLocalReady : getImportReady;
    const [data, series] = await Promise.all([fetchReady(), getSeries()]);
    setPending(data);
    setExistingSeries(series);
    setLoading(false);
    if (data.length > 0) {
      prefill(data[0]);
      setPolling(false);
    }
  };

  useEffect(() => { loadPending(); }, []);

  // Poll for results when scan is async (orchestrator mode) and nothing ready yet
  useEffect(() => {
    if (useLocal || pending.length > 0 || !loading) {
      // For orchestrator scans, start polling if we got 0 results on first load
      if (!useLocal && pending.length === 0 && !loading) {
        setPolling(true);
      }
    }
  }, [loading]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const data = await getImportReady().catch(() => []);
      if (data.length > 0) {
        setPending(data);
        const series = await getSeries().catch(() => []);
        setExistingSeries(series);
        prefill(data[0]);
        setPolling(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling]);

  const prefill = (item: PendingImport) => {
    setEditName(item.folderName);
    setEditType(item.suggestedType);
    setEditMalId(item.malMatch?.malId?.toString() || '');
    setShowMalEdit(false);
    setBrandImageFile(null);
    setBrandImagePreview(null);
  };

  const current = pending[0];

  const handleConfirm = async () => {
    if (!current) return;
    setImporting(current.sourceFolder);
    setImportError(null);
    try {
      await confirmImport(
        current.sourceFolder,
        editType,
        editName,
        editType === 'comic' && editMalId ? parseInt(editMalId, 10) : null,
      );

      // Upload brand image if provided (magazines)
      if (brandImageFile && editType === 'magazine') {
        const formData = new FormData();
        formData.append('image', brandImageFile);
        const slugName = editName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
        await fetch(`/api/series/${slugName}/cover`, { method: 'POST', body: formData });
      }
      const remaining = pending.slice(1);
      setPending(remaining);
      if (remaining.length > 0) prefill(remaining[0]);
      onUpdate?.();
    } catch (err) {
      // Surface the error inline (was a window.alert) so the user can fix the
      // input and retry without losing context.
      setImportError((err as Error).message || 'Import failed');
    } finally {
      setImporting(null);
    }
  };

  const handleSkip = async () => {
    if (!current) return;
    await (useLocal ? skipLocalImport : skipImport)(current.sourceFolder);
    const remaining = pending.slice(1);
    setPending(remaining);
    if (remaining.length > 0) prefill(remaining[0]);
    onUpdate?.();
  };

  if (loading) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8">
          <Loader size={24} className="animate-spin text-accent" />
        </div>
      </div>,
      document.body,
    );
  }

  if (!current) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8 text-center max-w-sm mx-4">
          {polling ? (
            <>
              <Loader size={32} className="mx-auto text-accent mb-3 animate-spin" />
              <h2 className="text-lg font-semibold">Scanning folders...</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Searching MAL for each series. Items will appear here shortly.</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
            </>
          ) : (
            <>
              <Check size={32} className="mx-auto text-green-500 mb-3" />
              <h2 className="text-lg font-semibold">All caught up!</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No pending imports.</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 text-sm bg-accent text-white rounded-lg">Done</button>
            </>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  const mal = current.malMatch;

  // Check for duplicate: same MAL ID or similar name already imported
  const malIdNum = editMalId ? parseInt(editMalId, 10) : (mal?.malId || null);
  const duplicate = existingSeries.find((s) =>
    (malIdNum && s.malId === malIdNum) ||
    s.name.toLowerCase() === editName.toLowerCase()
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            Import {pending.length} remaining
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setEditType('comic')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  editType === 'comic'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                <BookOpen size={14} /> Comic
              </button>
              <button
                onClick={() => setEditType('magazine')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  editType === 'magazine'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Newspaper size={14} /> Magazine
              </button>
            </div>
          </div>

          {/* MAL Match */}
          {editType === 'comic' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">MAL Match</label>
              {mal && !showMalEdit ? (
                <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  {mal.imageUrl && (
                    <img src={mal.imageUrl} alt="" className="w-12 h-18 object-cover rounded shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{mal.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {mal.score != null && mal.score > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                          <Star size={11} fill="currentColor" /> {mal.score.toFixed(1)}
                        </span>
                      )}
                      {mal.year && <span>{mal.year}</span>}
                      <span className="capitalize">{mal.status}</span>
                    </div>
                    {mal.synopsis && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{mal.synopsis}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowMalEdit(true)}
                    className="shrink-0 p-1 text-gray-400 hover:text-accent"
                    title="Change MAL ID"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={editMalId}
                    onChange={(e) => setEditMalId(e.target.value)}
                    placeholder={mal ? `Current: ${mal.malId}` : 'MAL ID (optional)'}
                    className="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  {showMalEdit && (
                    <button onClick={() => setShowMalEdit(false)} className="text-xs text-gray-400">Cancel</button>
                  )}
                </div>
              )}
              {!mal && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No MAL match found. You can enter a MAL ID manually.</p>
              )}
            </div>
          )}

          {/* Magazine brand image */}
          {editType === 'magazine' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Brand Image</label>
              <div className="flex items-center gap-3">
                {brandImagePreview ? (
                  <img src={brandImagePreview} alt="" className="w-16 h-24 object-cover rounded border border-gray-300 dark:border-gray-600" />
                ) : (
                  <div className="w-16 h-24 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center">
                    <Newspaper size={20} className="text-gray-400" />
                  </div>
                )}
                <div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setBrandImageFile(file);
                          setBrandImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                    Upload image
                  </label>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Optional cover art for this brand</p>
                </div>
              </div>
            </div>
          )}

          {/* Duplicate warning */}
          {duplicate && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-amber-700 dark:text-amber-300">
                  Possible duplicate of "{duplicate.name}"
                </p>
                <p className="text-amber-600 dark:text-amber-400 mt-0.5">
                  {duplicate.malId === malIdNum ? 'Same MAL ID.' : 'Similar name.'} {duplicate.count} chapters already imported.
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      // Merge: use the existing series name and MAL ID
                      setEditName(duplicate.name);
                      if (duplicate.malId) setEditMalId(String(duplicate.malId));
                    }}
                    className="px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700"
                  >
                    Merge into existing
                  </button>
                  <button
                    onClick={() => {
                      // Import as separate: clear the MAL ID to avoid conflict
                      setEditMalId('');
                    }}
                    className="px-2 py-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    Import as separate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Existing series match (from scan) */}
          {!duplicate && current.existingSeriesId && (
            <div className="flex items-start gap-2 bg-accent/10 border border-accent/30 rounded-lg px-3 py-2">
              <Merge size={16} className="text-accent shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-accent">
                  Series already exists — new chapters will be merged
                </p>
                <p className="text-accent mt-0.5">
                  {current.fileCount} files will be added. Existing chapters are kept.
                </p>
              </div>
            </div>
          )}

          {/* File count */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {current.fileCount} files in <span className="font-mono">{current.folderName}</span>
          </p>

          {/* Import error — shown inline instead of window.alert */}
          {importError && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-medium text-red-700 dark:text-red-300">Import failed</p>
                <p className="text-red-600 dark:text-red-400 mt-0.5">{importError}</p>
              </div>
              <button
                onClick={() => setImportError(null)}
                className="shrink-0 text-red-400 hover:text-red-600 dark:hover:text-red-200"
                aria-label="Dismiss error"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleSkip}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <SkipForward size={14} /> Skip
          </button>
          <button
            onClick={handleConfirm}
            disabled={!!importing || !editName.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {importing ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
            Import
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
