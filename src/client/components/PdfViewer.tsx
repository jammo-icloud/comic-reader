import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export type ViewMode = 'fit' | 'scroll';
export type ReadingDirection = 'ltr' | 'rtl';

export interface PdfViewerHandle {
  prevPage: () => void;
  nextPage: () => void;
  goToPage: (n: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  totalPages: number;
}

interface PdfViewerProps {
  url: string;
  initialPage?: number;
  viewMode: ViewMode;
  readingDirection?: ReadingDirection;
  onPageChange?: (page: number, totalPages: number) => void;
  onTotalPagesChange?: (total: number) => void;
}

/**
 * Reading model:
 *   - The page surface is for viewing only — pinch zooms, one-finger drag pans
 *     when zoomed, **double-tap toggles zoom-to-point ↔ zoomed-out**.
 *     Single taps do nothing (page nav lives in the footer toolbar).
 *   - Page navigation lives entirely in the footer toolbar (and arrow keys
 *     on desktop). The toolbar's drawer chevron is the only way to show/hide it.
 *   - On every page change we reset zoom/pan, cancel any in-flight render,
 *     and clear the canvas so the new page lands clean — no leftover transform
 *     from the previous page's pan state.
 *   - Reading direction flips the keyboard arrow mapping (←/→) for RTL manga.
 */

const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST = 40;
const DOUBLE_TAP_ZOOM = 2.5;

const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer(
  { url, initialPage = 0, viewMode, readingDirection = 'ltr', onPageChange, onTotalPagesChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<ReturnType<pdfjsLib.PDFPageProxy['render']> | null>(null);

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  // Zoom and pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // ----- Render -----
  const renderPage = useCallback(
    async (pageNum: number) => {
      const doc = pdfDocRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!doc || !canvas || !container) return;

      // Cancel any in-flight render from a previous page so its painting
      // can't leak onto the current canvas.
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* already settled */ }
        renderTaskRef.current = null;
      }

      const page = await doc.getPage(pageNum + 1);
      const viewport = page.getViewport({ scale: 1.0 });

      let scale: number;
      if (viewMode === 'fit') {
        const scaleW = container.clientWidth / viewport.width;
        const scaleH = container.clientHeight / viewport.height;
        scale = Math.min(scaleW, scaleH);
      } else {
        scale = container.clientWidth / viewport.width;
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

      const task = page.render({ canvasContext: ctx, viewport: scaledViewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (err) {
        // Cancellation is expected when changing pages quickly — ignore it.
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') throw err;
      } finally {
        if (renderTaskRef.current === task) renderTaskRef.current = null;
      }
    },
    [viewMode, zoom],
  );

  // ----- Effects: load doc, render, react to changes -----

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCurrentPage(initialPage);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    pdfjsLib.getDocument(url).promise.then((doc) => {
      if (cancelled) return;
      pdfDocRef.current = doc;
      setTotalPages(doc.numPages);
      onTotalPagesChange?.(doc.numPages);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, [url, initialPage, onTotalPagesChange]);

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

  // Reset zoom/pan on view-mode change (page-change resets happen synchronously inside goToPage below)
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [viewMode]);

  // Notify parent of page changes
  useEffect(() => {
    if (totalPages > 0) onPageChange?.(currentPage, totalPages);
  }, [currentPage, totalPages, onPageChange]);

  // ----- Navigation -----

  /**
   * Synchronous page change: clears the canvas, cancels any in-flight render,
   * resets zoom/pan, then sets the new page. All state updates batch in one
   * React render so the new page is rendered cleanly at zoom 1, pan 0 — no
   * stale transform from the previous page.
   */
  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(0, Math.min(page, totalPages - 1));
      if (clamped === currentPage) return;

      // Stop the previous render from painting onto the new canvas
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* already settled */ }
        renderTaskRef.current = null;
      }

      // Wipe the canvas so the previous page doesn't bleed through during the
      // brief window before the new render finishes.
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      setCurrentPage(clamped);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    },
    [currentPage, totalPages],
  );

  const nextPage = useCallback(() => goToPage(currentPage + 1), [goToPage, currentPage]);
  const prevPage = useCallback(() => goToPage(currentPage - 1), [goToPage, currentPage]);

  // Imperative API for parent toolbar
  useImperativeHandle(
    ref,
    () => ({
      prevPage,
      nextPage,
      goToPage,
      zoomIn: () => setZoom((z) => Math.min(5, z + 0.25)),
      zoomOut: () => setZoom((z) => Math.max(0.5, z - 0.25)),
      resetZoom: () => { setZoom(1); setPan({ x: 0, y: 0 }); },
      totalPages,
    }),
    [prevPage, nextPage, goToPage, totalPages],
  );

  // ----- Keyboard (page-level nav only) -----

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          if (readingDirection === 'rtl') prevPage();
          else nextPage();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (readingDirection === 'rtl') nextPage();
          else prevPage();
          break;
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
  }, [nextPage, prevPage, readingDirection, viewMode]);

  // ----- Wheel zoom (desktop) -----

  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewMode !== 'fit') return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // require ctrl/cmd to zoom (otherwise scroll)
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.max(0.5, Math.min(5, z + delta)));
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [viewMode]);

  // ----- Touch gestures: pinch (zoom), pan when zoomed, double-tap zoom-to-point -----

  const gesture = useRef<{
    mode: 'idle' | 'touch' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    startTime: number;
    panStartX: number;
    panStartY: number;
    pinchStartDist: number;
    pinchStartZoom: number;
  }>({ mode: 'idle', startX: 0, startY: 0, startTime: 0, panStartX: 0, panStartY: 0, pinchStartDist: 0, pinchStartZoom: 1 });

  // Last tap that didn't promote to pan/pinch — used for double-tap detection
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const distance = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) => {
    const dx = b.clientX - a.clientX;
    const dy = b.clientY - a.clientY;
    return Math.hypot(dx, dy);
  };

  /**
   * Zoom toggle centered on (vx, vy) in viewport coordinates.
   * If currently zoomed: zoom out to 1x, reset pan.
   * If currently at 1x: zoom in to DOUBLE_TAP_ZOOM, computing pan so the
   * tapped pixel stays under the user's finger.
   */
  const toggleZoomAtPoint = useCallback((vx: number, vy: number) => {
    const c = containerRef.current;
    if (!c) return;
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const rect = c.getBoundingClientRect();
    const localX = vx - rect.left;
    const localY = vy - rect.top;
    const ratio = DOUBLE_TAP_ZOOM; // since current zoom is 1
    setZoom(DOUBLE_TAP_ZOOM);
    setPan({
      x: (1 - ratio) * (localX - rect.width / 2),
      y: (1 - ratio) * (localY - rect.height / 2),
    });
  }, [zoom]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (viewMode !== 'fit') return;
    if (e.touches.length === 2) {
      gesture.current.mode = 'pinch';
      gesture.current.pinchStartDist = distance(e.touches[0], e.touches[1]);
      gesture.current.pinchStartZoom = zoom;
      // A pinch invalidates any pending tap — clear it so a stray tap from
      // before the pinch doesn't get paired with a future single tap.
      lastTapRef.current = null;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      gesture.current.mode = 'touch';
      gesture.current.startX = t.clientX;
      gesture.current.startY = t.clientY;
      gesture.current.startTime = Date.now();
      gesture.current.panStartX = pan.x;
      gesture.current.panStartY = pan.y;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (viewMode !== 'fit') return;

    // Note: no e.preventDefault() — React attaches synthetic touch handlers as
    // passive listeners, so preventDefault is a no-op here and just emits a
    // console warning. We don't need it: the container has `touch-action: none`
    // (Tailwind's `touch-none`) which disables browser scroll, pinch-zoom, and
    // double-tap-zoom on this element, and the page's viewport meta sets
    // `user-scalable=no, maximum-scale=1` as a backstop.

    if (e.touches.length === 2 && gesture.current.mode === 'pinch') {
      const d = distance(e.touches[0], e.touches[1]);
      if (gesture.current.pinchStartDist > 0) {
        const ratio = d / gesture.current.pinchStartDist;
        const newZoom = Math.max(0.5, Math.min(5, gesture.current.pinchStartZoom * ratio));
        setZoom(newZoom);
      }
      return;
    }

    if (e.touches.length === 1 && (gesture.current.mode === 'touch' || gesture.current.mode === 'pan')) {
      const t = e.touches[0];
      const dx = t.clientX - gesture.current.startX;
      const dy = t.clientY - gesture.current.startY;
      // Promote to pan only when zoomed (otherwise the page fits, nothing to pan)
      if (gesture.current.mode === 'touch' && Math.hypot(dx, dy) > 10 && zoom > 1) {
        gesture.current.mode = 'pan';
      }
      if (gesture.current.mode === 'pan') {
        setPan({
          x: gesture.current.panStartX + dx,
          y: gesture.current.panStartY + dy,
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Only consider double-tap if this gesture was a stationary tap (didn't promote to pan/pinch)
    if (
      gesture.current.mode === 'touch'
      && e.changedTouches.length === 1
    ) {
      const t = e.changedTouches[0];
      const dx = t.clientX - gesture.current.startX;
      const dy = t.clientY - gesture.current.startY;
      const dt = Date.now() - gesture.current.startTime;
      const wasShortStationaryTap = Math.hypot(dx, dy) < 12 && dt < 350;

      if (wasShortStationaryTap) {
        const now = Date.now();
        const last = lastTapRef.current;
        const isDouble = !!last
          && (now - last.time) < DOUBLE_TAP_MS
          && Math.hypot(t.clientX - last.x, t.clientY - last.y) < DOUBLE_TAP_DIST;
        if (isDouble) {
          lastTapRef.current = null;
          toggleZoomAtPoint(t.clientX, t.clientY);
        } else {
          lastTapRef.current = { time: now, x: t.clientX, y: t.clientY };
        }
      } else {
        lastTapRef.current = null;
      }
    } else {
      // Pan or pinch ended — clear any pending single-tap so it can't pair
      // with a future tap.
      lastTapRef.current = null;
    }
    gesture.current.mode = 'idle';
  };

  // ----- Mouse: drag-pan when zoomed; double-click toggles zoom-to-point -----
  const mouseDown = useRef<{ x: number; y: number; panStartX: number; panStartY: number; pannable: boolean } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (viewMode !== 'fit' || zoom <= 1) return;
    mouseDown.current = {
      x: e.clientX, y: e.clientY,
      panStartX: pan.x, panStartY: pan.y,
      pannable: true,
    };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseDown.current?.pannable) return;
    const dx = e.clientX - mouseDown.current.x;
    const dy = e.clientY - mouseDown.current.y;
    setPan({
      x: mouseDown.current.panStartX + dx,
      y: mouseDown.current.panStartY + dy,
    });
  };
  const handleMouseUp = () => {
    mouseDown.current = null;
  };
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (viewMode !== 'fit') return;
    toggleZoomAtPoint(e.clientX, e.clientY);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>;
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-gray-200 dark:bg-black select-none overflow-hidden touch-none`}
      style={{ cursor: viewMode === 'fit' && zoom > 1 ? 'grab' : 'auto' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={`w-full h-full flex items-center justify-center ${viewMode === 'scroll' ? 'overflow-y-auto overflow-x-hidden no-scrollbar' : ''}`}
      >
        <canvas
          ref={canvasRef}
          // No CSS transition on transform — a stale pan state from a previous
          // page would otherwise animate during the page swap and look broken.
          // Double-tap zoom snaps; pinch/pan are already direct-manipulation.
          style={
            viewMode === 'fit'
              ? { transform: `translate(${pan.x}px, ${pan.y}px)` }
              : undefined
          }
        />
      </div>
    </div>
  );
});

export default PdfViewer;
