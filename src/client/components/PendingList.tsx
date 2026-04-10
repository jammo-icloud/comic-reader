import { useState, useEffect } from 'react';
import { X, Check, SkipForward, BookOpen, Newspaper, Star, Loader, Pencil } from 'lucide-react';
import type { PendingImport } from '../lib/types';
import { getImportReady, confirmImport, skipImport } from '../lib/api';

export default function PendingList({ onClose }: { onClose: () => void }) {
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);

  // Edit state for current item
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'comic' | 'magazine'>('comic');
  const [editMalId, setEditMalId] = useState('');
  const [showMalEdit, setShowMalEdit] = useState(false);

  const loadPending = async () => {
    setLoading(true);
    const data = await getImportReady();
    setPending(data);
    setLoading(false);
    // Pre-fill edit state from first item
    if (data.length > 0) prefill(data[0]);
  };

  useEffect(() => { loadPending(); }, []);

  const prefill = (item: PendingImport) => {
    setEditName(item.folderName);
    setEditType(item.suggestedType);
    setEditMalId(item.malMatch?.malId?.toString() || '');
    setShowMalEdit(false);
  };

  const current = pending[0];

  const handleConfirm = async () => {
    if (!current) return;
    setImporting(current.sourceFolder);
    try {
      await confirmImport(
        current.sourceFolder,
        editType,
        editName,
        editMalId ? parseInt(editMalId, 10) : null,
      );
      const remaining = pending.slice(1);
      setPending(remaining);
      if (remaining.length > 0) prefill(remaining[0]);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setImporting(null);
    }
  };

  const handleSkip = async () => {
    if (!current) return;
    await skipImport(current.sourceFolder);
    const remaining = pending.slice(1);
    setPending(remaining);
    if (remaining.length > 0) prefill(remaining[0]);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8">
          <Loader size={24} className="animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8 text-center max-w-sm mx-4">
          <Check size={32} className="mx-auto text-green-500 mb-3" />
          <h2 className="text-lg font-semibold">All caught up!</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No pending imports.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Done</button>
        </div>
      </div>
    );
  }

  const mal = current.malMatch;

  return (
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
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
              >
                <BookOpen size={14} /> Comic
              </button>
              <button
                onClick={() => setEditType('magazine')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  editType === 'magazine'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
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
                      {mal.score > 0 && (
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
                    className="shrink-0 p-1 text-gray-400 hover:text-blue-500"
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
                    className="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
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

          {/* File count */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {current.fileCount} files in <span className="font-mono">{current.folderName}</span>
          </p>
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
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {importing ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
