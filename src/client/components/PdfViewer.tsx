import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { BBox } from '../lib/api';
import { analyzePage, renderPageThumbnail, type PdfDoc, type PdfRenderTask } from '../lib/pdf';

/** 'fit' = whole page on screen; 'scroll' = fit the art's width, scroll down the page. */
export type ViewMode = 'fit' | 'scroll';
export type ReadingDirection = 'ltr' | 'rtl';

/**
 * A Story-mode citation highlight: a pulsing, glowing outline drawn over the
 * bubble the reader tapped in the Story panel — a "where on the page is this?"
 * pointer. Positioned in page-fraction percentages, so it tracks zoom/pan for
 * free. It deliberately does NOT cover the art (Story mode is for enjoying the
 * page) — it only rings the source bubble.
 */
function BubbleHighlight({ box }: { box: BBox }) {
  return (
    <div
      className="absolute animate-pulse rounded text-accent ring-2 ring-current"
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
        boxShadow: '0 0 16px 3px currentColor',
      }}
      aria-hidden
    />
  );
}

export interface PdfViewerHandle {
  prevPage: () => void;
  nextPage: () => void;
  goToPage: (n: number) => void;
  /**
   * One "reading step" from user input (tap, swipe, arrow key). When the page
   * is taller than the screen (fit-width) this scrolls within the page first
   * and only turns the page at its top/bottom edge.
   */
  step: (delta: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  totalPages: number;
  /**
   * Render a single page to a small JPEG data URL, off-screen. Used by the
   * reader's ChapterRail to populate page-thumb cells without spinning up a
   * second PDF document. Returns null if the page isn't loaded yet or
   * rendering fails.
   */
  getPageThumbnail: (pageIdx: number, maxWidth?: number) => Promise<string | null>;
}

interface PdfViewerProps {
  /** The loaded chapter PDF — owned by ReaderPage (see usePdfDocument). */
  doc: PdfDoc;
  initialPage?: number;
  viewMode: ViewMode;
  readingDirection?: ReadingDirection;
  onPageChange?: (page: number, totalPages: number) => void;
  onTotalPagesChange?: (total: number) => void;
  // Story-mode citation overlay: a single glowing box over the bubble the
  // reader tapped in the Story panel. `page` is checked against the page
  // actually on screen so a stale highlight never paints onto the wrong page.
  overlay?: { page: number; highlight: BBox | null } | null;
  // Tiny downscaled JPEG dataURL of each rendered page — Story mode uses it as
  // a blurred ambient backdrop. Pass undefined when it isn't needed.
  onAmbient?: (dataUrl: string) => void;
  // Fired when "next page" is invoked but the viewer is already on the last
  // page — ReaderPage uses this to flow into the next chapter instead of
  // letting the action dead-end at a disabled button.
  onPastEnd?: () => void;
  // Symmetric: fired when "prev page" is invoked from the first page, so
  // ReaderPage can flow into the previous chapter's last page.
  onPastStart?: () => void;
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
  { doc, initialPage = 0, viewMode, onPageChange, onTotalPagesChange, overlay, onAmbient, onPastEnd, onPastStart },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PdfDoc | null>(doc);
  pdfDocRef.current = doc;
  const renderTaskRef = useRef<PdfRenderTask | null>(null);
  // Bumped on every render request so a slow, superseded one can bail out.
  const renderSeq = useRef(0);
  // Fit-width: how far the canvas is shifted left to hide the blank margin.
  const [cropX, setCropX] = useState(0);

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

      const seq = ++renderSeq.current;
      const page = await doc.getPage(pageNum + 1);
      const viewport = page.getViewport({ scale: 1.0 });

      let scale: number;
      let cropLeft = 0;
      if (viewMode === 'fit') {
        const scaleW = container.clientWidth / viewport.width;
        const scaleH = container.clientHeight / viewport.height;
        scale = Math.min(scaleW, scaleH);
      } else {
        // Fit the ART to the screen width, not the page: blank side margins
        // are detected and pushed off-screen so the content is as large as
        // it can be.
        const { left, right } = await analyzePage(doc, pageNum);
        scale = container.clientWidth / (viewport.width * (right - left));
        cropLeft = left * viewport.width * scale;
      }
      if (seq !== renderSeq.current) return; // a newer render took over
      setCropX(cropLeft);

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
        // A completed render — sample a tiny thumbnail for Story mode's
        // ambient backdrop. Purely decorative, so a failure here only warns.
        if (onAmbient) {
          try {
            const tw = 32;
            const th = Math.max(1, Math.round((canvas.height / canvas.width) * tw));
            const small = document.createElement('canvas');
            small.width = tw;
            small.height = th;
            const sctx = small.getContext('2d');
            if (sctx) {
              sctx.drawImage(canvas, 0, 0, tw, th);
              onAmbient(small.toDataURL('image/jpeg', 0.6));
            }
          } catch (e) {
            console.warn('Ambient thumbnail extraction failed:', e);
          }
        }
      } catch (err) {
        // Cancellation is expected when changing pages quickly — ignore it.
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') throw err;
      } finally {
        if (renderTaskRef.current === task) renderTaskRef.current = null;
      }
    },
    [viewMode, zoom, onAmbient],
  );

  // ----- Pan clamping: keep the canvas covering the container -----

  /**
   * Clamp a raw pan offset so the canvas can't be dragged past its own edges.
   *
   * The canvas is centered when pan = (0,0). It can be panned by at most
   * (canvasSize - containerSize) / 2 in each direction before its edge would
   * leave the container interior. When the canvas is smaller than the container
   * (page narrower than viewport at zoom=1), pan is locked to 0 in that axis.
   *
   * Reads live DOM dimensions via refs — accurate while zoom is stable. During
   * pinch we don't pan (gesture mode is 'pinch'), so we never read mid-resize.
   */
  const clampPan = useCallback((x: number, y: number): { x: number; y: number } => {
    const c = containerRef.current;
    const cv = canvasRef.current;
    if (!c || !cv) return { x, y };
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const iw = cv.clientWidth;
    const ih = cv.clientHeight;
    const maxX = Math.max(0, (iw - cw) / 2);
    const maxY = Math.max(0, (ih - ch) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  /**
   * Re-clamp pan whenever the canvas size changes — fires after every zoom-driven
   * re-render and after viewport / container resizes (rotation, split-screen, etc.).
   * Without this, zooming out would leave you with pan that exceeds the new bounds.
   */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ro = new ResizeObserver(() => {
      setPan((prev) => clampPan(prev.x, prev.y));
    });
    ro.observe(cv);
    return () => ro.disconnect();
  }, [clampPan]);

  // ----- Effects: load doc, render, react to changes -----

  useEffect(() => {
    setCurrentPage(initialPage);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setTotalPages(doc.numPages);
    onTotalPagesChange?.(doc.numPages);
    setLoading(false);
  }, [doc, initialPage, onTotalPagesChange]);

  // Stop any in-flight render when the viewer goes away (chapter / layout change).
  useEffect(() => () => {
    renderSeq.current++;
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch { /* already settled */ }
    }
  }, []);

  // A new page always starts at its top — otherwise fit-width would show the
  // next page at whatever depth the previous one was scrolled to.
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [currentPage, viewMode]);

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

  // ResizeObserver on the container — picks up parent layout changes that
  // window.resize won't, e.g. ReaderPage shrinking this container by the
  // toolbar height when the toolbar shows. Without this, fit-mode keeps
  // rendering at the OLD container height and the page bottom hides behind
  // the toolbar. Re-runs on the next animation frame to coalesce rapid
  // resize bursts (e.g. CSS transitions, drag-resize) into a single render.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let raf: number | null = null;
    const ro = new ResizeObserver(() => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = null;
        if (!loading && pdfDocRef.current) renderPage(currentPage);
      });
    });
    ro.observe(container);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      ro.disconnect();
    };
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

  const nextPage = useCallback(() => {
    if (currentPage < totalPages - 1) goToPage(currentPage + 1);
    else if (onPastEnd) onPastEnd();
  }, [goToPage, currentPage, totalPages, onPastEnd]);
  const prevPage = useCallback(() => {
    if (currentPage > 0) goToPage(currentPage - 1);
    else if (onPastStart) onPastStart();
  }, [goToPage, currentPage, onPastStart]);

  // Off-screen thumbnail rendering — reuses the already-loaded pdfDocRef
  // proxy so we don't open a second copy of the PDF just for the rail.
  // pageIdx is 0-based to match the rest of the file's conventions.
  const getPageThumbnail = useCallback(
    (pageIdx: number, maxWidth: number = 140) => renderPageThumbnail(doc, pageIdx, maxWidth),
    [doc],
  );

  const step = useCallback(
    (delta: number) => {
      const sc = scrollerRef.current;
      if (viewMode === 'scroll' && sc) {
        const max = sc.scrollHeight - sc.clientHeight;
        const jump = sc.clientHeight * 0.85;
        if (delta > 0 && sc.scrollTop < max - 4) { sc.scrollBy({ top: jump, behavior: 'smooth' }); return; }
        if (delta < 0 && sc.scrollTop > 4) { sc.scrollBy({ top: -jump, behavior: 'smooth' }); return; }
      }
      if (delta > 0) nextPage();
      else if (delta < 0) prevPage();
    },
    [viewMode, nextPage, prevPage],
  );

  // Imperative API for parent toolbar
  useImperativeHandle(
    ref,
    () => ({
      prevPage,
      nextPage,
      goToPage,
      step,
      zoomIn: () => setZoom((z) => Math.min(5, z + 0.25)),
      zoomOut: () => setZoom((z) => Math.max(0.5, z - 0.25)),
      resetZoom: () => { setZoom(1); setPan({ x: 0, y: 0 }); },
      totalPages,
      getPageThumbnail,
    }),
    [prevPage, nextPage, goToPage, step, totalPages, getPageThumbnail],
  );

  // ----- Keyboard (zoom only — page navigation keys live in ReaderPage) -----

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
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
  }, [viewMode]);

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
    // Set the focal-pointed pan now; ResizeObserver re-clamps once the canvas
    // grows to the new zoom (clampPan here can't see the new size yet).
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
        // Hard-clamp at the edges so the page can't be dragged past its bounds.
        // (No iOS-style rubberband — that's a bigger change; this prevents the
        // worst feel-bad case where you swipe and the page slides off-screen.)
        setPan(clampPan(
          gesture.current.panStartX + dx,
          gesture.current.panStartY + dy,
        ));
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
    setPan(clampPan(
      mouseDown.current.panStartX + dx,
      mouseDown.current.panStartY + dy,
    ));
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
        ref={scrollerRef}
        className={`w-full h-full flex ${viewMode === 'scroll' ? 'overflow-y-auto overflow-x-hidden no-scrollbar' : 'items-center justify-center'}`}
      >
        {/* Page wrapper — shrink-wraps the canvas so the translation overlay
            can position bubbles in page-fraction percentages. The pan
            transform lives here so canvas and overlay move as one.
            No CSS transition — a stale pan from the previous page would
            otherwise animate during a page swap and look broken.
            Fit-width: auto margins (not align-items) centre a short page
            without clipping the top of a tall one, and the negative left
            margin slides the blank page margin out of view. */}
        <div
          className="relative"
          style={
            viewMode === 'fit'
              ? { transform: `translate(${pan.x}px, ${pan.y}px)` }
              : { margin: `auto 0 auto ${-cropX}px`, flexShrink: 0 }
          }
        >
          <canvas ref={canvasRef} className="block" />
          {overlay && overlay.page === currentPage && overlay.highlight && (
            <div className="pointer-events-none absolute inset-0">
              <BubbleHighlight box={overlay.highlight} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default PdfViewer;
