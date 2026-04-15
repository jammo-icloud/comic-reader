import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

type ViewMode = 'fit' | 'scroll';

interface PdfViewerProps {
  url: string;
  initialPage?: number;
  onPageChange?: (page: number, totalPages: number) => void;
}

export default function PdfViewer({ url, initialPage = 0, onPageChange }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('fit');
  const [loading, setLoading] = useState(true);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });
  const baseScaleRef = useRef(1);

  const renderPage = useCallback(
    async (pageNum: number) => {
      const doc = pdfDocRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!doc || !canvas || !container) return;

      const page = await doc.getPage(pageNum + 1);
      const viewport = page.getViewport({ scale: 1.0 });

      let scale: number;
      if (viewMode === 'fit') {
        const scaleW = container.clientWidth / viewport.width;
        const scaleH = container.clientHeight / viewport.height;
        scale = Math.min(scaleW, scaleH);
        baseScaleRef.current = scale;
      } else {
        scale = container.clientWidth / viewport.width;
        baseScaleRef.current = scale;
      }

      const effectiveScale = viewMode === 'fit' ? scale * zoom : scale;
      const scaledViewport = page.getViewport({ scale: effectiveScale });

      const dpr = window.devicePixelRatio || 1;
      canvas.width = scaledViewport.width * dpr;
      canvas.height = scaledViewport.height * dpr;
      canvas.style.width = `${scaledViewport.width}px`;
      canvas.style.height = `${scaledViewport.height}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    },
    [viewMode, zoom]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Reset to page 0 (or initialPage) when switching chapters
    setCurrentPage(initialPage);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    pdfjsLib.getDocument(url).promise.then((doc) => {
      if (cancelled) return;
      pdfDocRef.current = doc;
      setTotalPages(doc.numPages);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, [url, initialPage]);

  useEffect(() => {
    if (!loading && pdfDocRef.current) renderPage(currentPage);
  }, [currentPage, loading, renderPage]);

  useEffect(() => {
    const handleResize = () => {
      if (!loading && pdfDocRef.current) renderPage(currentPage);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentPage, loading, renderPage]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentPage, viewMode]);

  useEffect(() => {
    if (totalPages > 0) onPageChange?.(currentPage, totalPages);
  }, [currentPage, totalPages, onPageChange]);

  const goToPage = useCallback(
    (page: number) => setCurrentPage(Math.max(0, Math.min(page, totalPages - 1))),
    [totalPages]
  );
  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);
  const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault(); nextPage(); break;
        case 'ArrowLeft':
          e.preventDefault(); prevPage(); break;
        case '+': case '=':
          e.preventDefault(); if (viewMode === 'fit') setZoom((z) => Math.min(z + 0.25, 5)); break;
        case '-':
          e.preventDefault(); if (viewMode === 'fit') setZoom((z) => Math.max(z - 0.25, 0.5)); break;
        case '0':
          e.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [nextPage, prevPage, viewMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewMode !== 'fit') return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.max(0.5, Math.min(5, z + delta)));
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [viewMode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (viewMode !== 'fit' || zoom <= 1) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOffset.current = { ...pan };
    e.preventDefault();
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panOffset.current.x + (e.clientX - panStart.current.x),
      y: panOffset.current.y + (e.clientY - panStart.current.y),
    });
  };
  const handleMouseUp = () => { isPanning.current = false; };

  const handleClick = (e: React.MouseEvent) => {
    if (viewMode !== 'fit' || zoom > 1 || isPanning.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.3) prevPage();
    else if (x > 0.7) nextPage();
  };

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (viewMode !== 'fit' || zoom > 1) return;
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current || viewMode !== 'fit' || zoom > 1) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    if (Math.abs(dx) > 50) {
      if (dx < 0) nextPage(); else prevPage();
    }
    touchStart.current = null;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>;
  }

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col bg-gray-200 dark:bg-black select-none transition-colors">
      <div
        ref={scrollAreaRef}
        className={`flex-1 ${viewMode === 'scroll' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'} flex items-center justify-center`}
        style={viewMode === 'fit' ? { cursor: zoom > 1 ? 'grab' : 'pointer' } : undefined}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          style={
            viewMode === 'fit'
              ? { transform: `translate(${pan.x}px, ${pan.y}px)`, transition: isPanning.current ? 'none' : 'transform 0.1s' }
              : undefined
          }
        />
      </div>

      {/* Bottom controls */}
      <div className="shrink-0 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 px-2 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 transition-colors">
        <button
          onClick={prevPage}
          disabled={currentPage === 0}
          className="p-1 sm:p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20 transition-colors"
          title="Previous page (←)"
        >
          <ChevronLeft size={20} />
        </button>

        <input
          type="range"
          min={0}
          max={totalPages - 1}
          value={currentPage}
          onChange={(e) => goToPage(parseInt(e.target.value, 10))}
          className="flex-1 h-1 accent-blue-500 cursor-pointer"
        />

        <button
          onClick={nextPage}
          disabled={currentPage >= totalPages - 1}
          className="p-1 sm:p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20 transition-colors"
          title="Next page (→)"
        >
          <ChevronRight size={20} />
        </button>

        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap text-center">
          {currentPage + 1}/{totalPages}
        </span>

        {/* Fit/Scroll toggle — always visible */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 text-xs">
          <button
            onClick={() => setViewMode('fit')}
            className={`px-2 sm:px-2.5 py-1 rounded-l transition-colors ${viewMode === 'fit' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            title="Fit to screen"
          >
            Fit
          </button>
          <button
            onClick={() => setViewMode('scroll')}
            className={`px-2 sm:px-2.5 py-1 rounded-r transition-colors ${viewMode === 'scroll' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            title="Scroll mode"
          >
            Scroll
          </button>
        </div>

        {/* Zoom controls — desktop only */}
        {viewMode === 'fit' && (
          <div className="hidden sm:flex items-center gap-1">
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-700" />
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm"
            >
              −
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm"
            >
              +
            </button>
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
