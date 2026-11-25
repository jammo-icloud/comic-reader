import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { openPdf, type PdfDoc } from '../lib/pdf';
import { useEscapeKey } from './useEscapeKey';
import PreviewReader from './PreviewReader';
import PreviewTopBar from './PreviewTopBar';

export interface PdfPreviewProps {
  fileUrl: string;
  chapterLabel: string;
  mangaTitle: string;
  onClose: () => void;
  maxPages?: number;
}

const RENDER_WIDTH = 1200;

/** Render one page (1-based) to a JPEG blob at RENDER_WIDTH; null on failure. */
async function renderPage(doc: PdfDoc, pageNum: number): Promise<Blob | null> {
  try {
    const page = await doc.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: RENDER_WIDTH / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    page.cleanup();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  } catch {
    return null;
  }
}

/**
 * Preview a PDF chapter: renders its first pages one at a time with pdf.js and
 * hands them to PreviewReader as they finish.
 */
export default function PdfPreview({ fileUrl, chapterLabel, mangaTitle, onClose, maxPages = 20 }: PdfPreviewProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [target, setTarget] = useState<number | null>(null); // null until the document opens
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let doc: PdfDoc | null = null;
    const urls: string[] = [];
    setPages([]);
    setTarget(null);
    setError(false);

    (async () => {
      try {
        const loaded = await openPdf(fileUrl);
        if (cancelled) { loaded.destroy(); return; }
        doc = loaded;
        const count = Math.min(loaded.numPages, maxPages);
        setTarget(count);
        for (let i = 1; i <= count; i++) {
          const blob = await renderPage(loaded, i);
          if (cancelled) return;
          if (!blob) break; // stop at the first page that won't render
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setPages((prev) => [...prev, url]);
        }
        setTarget(urls.length); // settles loading even if we stopped early
      } catch (err) {
        if (cancelled) return;
        console.error('PDF preview failed:', err);
        setError(true);
      }
    })();

    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
      doc?.destroy();
    };
  }, [fileUrl, maxPages]);

  if (error) return <PdfPreviewError mangaTitle={mangaTitle} chapterLabel={chapterLabel} onClose={onClose} />;

  return (
    <PreviewReader
      pages={pages}
      chapterLabel={chapterLabel}
      mangaTitle={mangaTitle}
      loading={target === null || pages.length < target}
      onClose={onClose}
    />
  );
}

function PdfPreviewError({ mangaTitle, chapterLabel, onClose }: Pick<PdfPreviewProps, 'mangaTitle' | 'chapterLabel' | 'onClose'>) {
  useEscapeKey(onClose);
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <PreviewTopBar mangaTitle={mangaTitle} chapterLabel={chapterLabel} onClose={onClose} />
      <div className="flex-1 flex items-center justify-center px-6 text-center text-sm text-gray-500">
        Couldn't open this PDF for preview.
      </div>
    </div>,
    document.body,
  );
}
