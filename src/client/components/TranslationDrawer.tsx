/**
 * Translation drawer — shows Japanese OCR + English translation for a page.
 * Desktop: slide-in panel from the right (30-40% width).
 * Mobile: full-screen drawer from the right.
 */
import { useEffect, useState } from 'react';
import { X, Loader, RefreshCw, Languages, AlertCircle, Zap } from 'lucide-react';
import { getPageTranslation, type PageTranslation } from '../lib/api';

interface TranslationDrawerProps {
  seriesId: string;
  file: string;
  pageNum: number;
  open: boolean;
  onClose: () => void;
}

export default function TranslationDrawer({ seriesId, file, pageNum, open, onClose }: TranslationDrawerProps) {
  const [translation, setTranslation] = useState<PageTranslation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const load = async (force = false) => {
    setLoading(true);
    setError('');
    try {
      const result = await getPageTranslation(seriesId, file, pageNum, force);
      setTranslation(result);
    } catch (err) {
      setError((err as Error).message);
      setTranslation(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when drawer opens or page changes
  useEffect(() => {
    if (!open) return;
    setTranslation(null);
    load(false);
  }, [open, seriesId, file, pageNum]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 sm:pointer-events-none">
      {/* Backdrop — only on mobile, desktop can click through */}
      <div
        className="absolute inset-0 bg-black/40 sm:hidden pointer-events-auto"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute top-0 right-0 bottom-0 w-full sm:w-[400px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <Languages size={18} className="text-blue-500" />
          <h2 className="text-sm font-semibold flex-1">Translation — Page {pageNum + 1}</h2>
          {translation && (
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
              title="Retranslate"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && !translation && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Loader className="animate-spin mb-2" size={24} />
              <p className="text-sm">Translating page...</p>
              <p className="text-[11px] text-gray-500 mt-1">First page takes a few seconds</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">Translation failed</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
                {error.includes('not configured') && (
                  <p className="text-xs text-gray-500 mt-2">
                    An admin needs to configure the translation service URL in Settings.
                  </p>
                )}
              </div>
            </div>
          )}

          {translation && !error && (
            <>
              {translation.bubbles.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No Japanese text detected on this page.</p>
              ) : (
                <div className="space-y-2">
                  {translation.bubbles.map((b) => (
                    <div
                      key={b.order}
                      className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] text-gray-400 font-mono shrink-0 mt-0.5">#{b.order}</span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p
                            lang="ja"
                            className="text-sm font-medium text-gray-900 dark:text-gray-100"
                            style={{ fontFamily: 'system-ui, "Hiragino Sans", "Noto Sans CJK JP", sans-serif' }}
                          >
                            {b.japanese}
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-400">{b.english}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Metadata footer */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 flex items-center gap-2">
                <Zap size={10} /> {translation.modelUsed} · {(translation.durationMs / 1000).toFixed(1)}s
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
