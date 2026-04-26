import { useState } from 'react';
import { X, FolderOpen, Loader, Search } from 'lucide-react';
import { importScan } from '../lib/api';

export default function ImportModal({ onClose }: { onClose: () => void }) {
  const [path, setPath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ id: string; status: string } | null>(null);
  const [error, setError] = useState('');

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) return;
    setScanning(true);
    setError('');
    try {
      const res = await importScan(path.trim());
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">Import from Folder</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleScan} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Source Folder
            </label>
            <div className="relative">
              <FolderOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/mnt/incoming/manga"
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent placeholder-gray-400 dark:placeholder-gray-500 font-mono"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              Each subfolder will be detected as a series. The orchestrator will search MAL for each one automatically.
            </p>
          </div>

          {error && (
            <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {result && (
            <div className="text-sm text-success bg-success/10 px-3 py-2 rounded-lg">
              Scanning started! Check the pending bell icon for results as they come in.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
              {result ? 'Done' : 'Cancel'}
            </button>
            {!result && (
              <button
                type="submit"
                disabled={scanning || !path.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg disabled:opacity-50"
              >
                {scanning ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
                Scan Folder
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
