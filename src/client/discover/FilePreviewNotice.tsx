import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader } from 'lucide-react';
import { useEscapeKey } from './useEscapeKey';
import PreviewTopBar from './PreviewTopBar';

export interface FilePreviewNoticeProps {
  kind: 'archive' | 'epub';
  chapterLabel: string;
  mangaTitle: string;
  onClose: () => void;
  /** Queues the chapter; a returned promise shows progress and any error. */
  onDownload?: () => void | Promise<void>;
}

/** Shown instead of the preview reader for file chapters we can't render in place (EPUB, CBZ/CBR). */
export default function FilePreviewNotice({ kind, chapterLabel, mangaTitle, onClose, onDownload }: FilePreviewNoticeProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEscapeKey(onClose);

  const handleDownload = async () => {
    if (!onDownload) return;
    setBusy(true);
    setError('');
    try {
      await onDownload();
    } catch (err) {
      setError((err as Error).message || 'Download failed');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <PreviewTopBar mangaTitle={mangaTitle} chapterLabel={chapterLabel} onClose={onClose} />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-gray-400 max-w-sm">
          Preview isn't available for {kind === 'epub' ? 'EPUB' : 'CBZ/CBR'} files — download the chapter to read it.
        </p>
        {onDownload && (
          <button
            onClick={handleDownload}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-white transition-colors disabled:opacity-60"
          >
            {busy ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
            Download
          </button>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>,
    document.body,
  );
}
