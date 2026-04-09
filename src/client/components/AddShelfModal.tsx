import { useState, useEffect } from 'react';
import { X, FolderOpen, Check } from 'lucide-react';
import { getPlaceholders, getPlaceholderUrl } from '../lib/api';

interface AddShelfModalProps {
  onAdd: (name: string, path: string, placeholder: string) => Promise<void>;
  onClose: () => void;
}

export default function AddShelfModal({ onAdd, onClose }: AddShelfModalProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [placeholder, setPlaceholder] = useState('manga.png');
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getPlaceholders().then((list) => {
      setPlaceholders(list);
      if (list.length > 0 && !list.includes(placeholder)) {
        setPlaceholder(list[0]);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;
    setAdding(true);
    setError('');
    try {
      await onAdd(name.trim(), path.trim(), placeholder);
    } catch (err) {
      setError((err as Error).message || 'Failed to add shelf');
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">Add Shelf</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Shelf Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Manga, Magazines, Adult"
              autoFocus
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Path */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Folder Path
            </label>
            <div className="relative">
              <FolderOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/volume1/comics/Manga"
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 font-mono"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              Absolute path to the folder containing your comics. Each subfolder becomes a series.
            </p>
          </div>

          {/* Placeholder image picker */}
          {placeholders.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Default Cover
              </label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                Shown for series without matched cover art.
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {placeholders.map((file) => {
                  const label = file.replace(/\.(png|jpg|jpeg|webp)$/i, '').replace(/[-_]/g, ' ');
                  return (
                    <button
                      key={file}
                      type="button"
                      onClick={() => setPlaceholder(file)}
                      className={`shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                        placeholder === file
                          ? 'border-blue-500 ring-2 ring-blue-500/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="relative w-16 h-24">
                        <img
                          src={getPlaceholderUrl(file)}
                          alt={label}
                          className="w-full h-full object-cover"
                        />
                        {placeholder === file && (
                          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                            <Check size={20} className="text-white drop-shadow" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-center py-0.5 text-gray-500 dark:text-gray-400 capitalize truncate px-1">
                        {label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding || !name.trim() || !path.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {adding ? 'Adding...' : 'Add Shelf'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
