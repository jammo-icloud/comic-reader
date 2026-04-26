import { useEffect } from 'react';
import { AlertTriangle, Loader } from 'lucide-react';

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Replaces window.confirm() — bottom sheet on mobile, centered modal on desktop.
 * Both share the same DOM; only positioning/breakpoint changes.
 *
 * - Click backdrop → cancel
 * - Esc → cancel
 * - Enter while focused on confirm button → confirm (native)
 */
export default function ConfirmSheet({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive, busy, onConfirm, onCancel,
}: ConfirmSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <button
        aria-label="Cancel"
        onClick={() => { if (!busy) onCancel(); }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Sheet / dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-sheet-title"
        className="relative w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden mx-0 sm:mx-4 mb-0 sm:mb-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
        </div>

        <div className="px-5 sm:px-6 pt-3 sm:pt-5 pb-2">
          <div className="flex items-start gap-3">
            {destructive && (
              <span className="shrink-0 w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <AlertTriangle size={18} />
              </span>
            )}
            <div className="flex-1 min-w-0">
              <h2 id="confirm-sheet-title" className="text-base font-semibold leading-tight">{title}</h2>
              {message && (
                <div className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{message}</div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 pt-3 pb-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 min-h-[44px] sm:min-h-0"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { void onConfirm(); }}
            disabled={busy}
            autoFocus
            className={`px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60 min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-2 ${
              destructive
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-accent hover:bg-accent'
            }`}
          >
            {busy && <Loader size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
