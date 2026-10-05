import {
  forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect,
  useMemo, useRef, useState,
} from 'react';
import {
  analyzePage, getPageRatios, renderPageThumbnail,
  type Band, type PageAnalysis, type PdfDoc, type PdfRenderTask,
} from '../lib/pdf';
import type { PdfViewerHandle } from './PdfViewer';

/**
 * Continuous strip — every page of the chapter stacked into one scroll, for
 * webtoon-style comics whose frames were sliced across PDF pages.
 *
 *   - Pages butt together with no gap, so a frame cut in half by a page break
 *     is whole again.
 *   - The strip is fitted to the art's width: blank side margins (measured
 *     across the chapter, so every page shares one scale) sit off-screen.
 *   - With `trimGaps`, long blank stretches — inside a page or across a seam —
 *     are cut down to one small, uniform gap.
 *   - Only pages near the viewport hold canvases; the rest are sized
 *     placeholders. Tall pages render as stacked tiles to stay inside browser
 *     canvas limits.
 *
 * Exposes the same handle as PdfViewer so ReaderPage's scrubber, page rail,
 * keyboard and Story mode drive either one.
 */
interface StripViewerProps {
  doc: PdfDoc;
  initialPage?: number;
  trimGaps: boolean;
  onPageChange?: (page: number, totalPages: number) => void;
  onTotalPagesChange?: (total: number) => void;
  onAmbient?: (dataUrl: string) => void;
  /** Label of the next / previous chapter, or null when there isn't one. */
  nextLabel?: string | null;
  prevLabel?: string | null;
  onPastEnd?: () => void;
  onPastStart?: () => void;
}

const MAX_TILE_PX = 2048;     // device px per canvas tile
const EDGE_BLOCK_H = 120;     // CSS px — chapter hand-off blocks above/below the strip
const OVERSCAN_ABOVE = 1;     // viewport heights kept rendered above…
const OVERSCAN_BELOW = 2;     // …and below

interface Tile { y: number; h: number }          // device px within the full page
interface PageLayout { top: number; height: number; tiles: Tile[] | null } // CSS px

/** Slice a page's kept bands into canvas tiles. Edges snap to whole CSS px. */
function tilesFor(bands: Band[], pageHeightPx: number, dpr: number): Tile[] {
  const snap = (v: number) => Math.round(v / dpr) * dpr;
  const tiles: Tile[] = [];
  for (const [f0, f1] of bands) {
    let y = snap(f0 * pageHeightPx);
    const end = Math.max(y + dpr, snap(f1 * pageHeightPx));
    while (y < end) {
      const h = Math.min(MAX_TILE_PX, end - y);
      tiles.push({ y, h });
      y += h;
    }
  }
  return tiles;
}

const StripViewer = forwardRef<PdfViewerHandle, StripViewerProps>(function StripViewer(
  { doc, initialPage = 0, trimGaps, onPageChange, onTotalPagesChange, onAmbient, nextLabel, prevLabel, onPastEnd, onPastStart },
  ref,
) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const total = doc.numPages;
  const dpr = Math.max(1, Math.min(2, Math.round(window.devicePixelRatio || 1)));

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [ratios, setRatios] = useState<number[] | null>(null);
  const [crop, setCrop] = useState<{ left: number; right: number } | null>(null);
  // Per-page analysis results live in a ref; `analysisTick` re-renders on arrival.
  const analyses = useRef<(PageAnalysis | null)[]>([]);
  const [analysisTick, setAnalysisTick] = useState(0);
  const [current, setCurrent] = useState(Math.min(initialPage, total - 1));
  const currentRef = useRef(current);
  currentRef.current = current;
  const [range, setRange] = useState({ first: current, last: current });

  // Where the reader is, as (page, fraction down that page). Layout changes —
  // a resize, analysis landing for pages above — re-apply this so the art
  // under the reader's eyes doesn't move.
  const anchor = useRef({ page: Math.min(initialPage, total - 1), frac: 0 });

  useEffect(() => { onTotalPagesChange?.(total); }, [total, onTotalPagesChange]);
  useEffect(() => { onPageChange?.(current, total); }, [current, total, onPageChange]);

  // ----- Measure the viewport -----
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let timer: number | null = null;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(() => {
      // Coalesce drag-resizes and layout transitions into one re-layout.
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(measure, 120);
    });
    ro.observe(el);
    return () => { ro.disconnect(); if (timer !== null) window.clearTimeout(timer); };
  }, []);

  // ----- Page shapes + the chapter-wide art edges -----
  useEffect(() => {
    let cancelled = false;
    analyses.current = new Array(total).fill(null);
    (async () => {
      const r = await getPageRatios(doc);
      if (cancelled) return;
      setRatios(r);
      // One crop for the whole chapter keeps every page at the same scale.
      // Sample the page being opened plus two others rather than all of them,
      // so the first frame isn't held up decoding the whole chapter.
      const picks = [...new Set(
        [Math.min(initialPage, total - 1)]
          .concat([0.3, 0.7].map((f) => Math.min(total - 1, Math.floor(f * total)))),
      )];
      let left = 1;
      let right = 0;
      for (const i of picks) {
        const a = await analyzePage(doc, i);
        if (cancelled) return;
        analyses.current[i] = a;
        left = Math.min(left, a.left);
        right = Math.max(right, a.right);
      }
      setCrop(right - left > 0.3 ? { left, right } : { left: 0, right: 1 });
      setAnalysisTick((t) => t + 1);
    })().catch((err) => {
      console.error('Strip setup failed:', err);
      if (!cancelled) setCrop({ left: 0, right: 1 });
    });
    return () => { cancelled = true; };
    // initialPage only seeds the sample; it must not restart the setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, total]);

  // ----- Analyse the remaining pages, nearest the reader first -----
  useEffect(() => {
    if (!trimGaps || !crop) return;
    let cancelled = false;
    (async () => {
      for (;;) {
        let best = -1;
        for (let i = 0; i < total; i++) {
          if (analyses.current[i]) continue;
          if (best < 0 || Math.abs(i - currentRef.current) < Math.abs(best - currentRef.current)) best = i;
        }
        if (best < 0) return;
        const a = await analyzePage(doc, best);
        if (cancelled) return;
        analyses.current[best] = a;
        setAnalysisTick((t) => t + 1);
        await new Promise((r) => setTimeout(r, 0)); // let input and paint through
      }
    })();
    return () => { cancelled = true; };
  }, [doc, total, trimGaps, crop]);

  // ----- Layout -----
  const ready = !!ratios && !!crop && size.w > 0;
  const stripPx = Math.round(size.w * dpr);                                   // visible strip, device px
  const fullPx = crop ? Math.round(stripPx / (crop.right - crop.left)) : stripPx; // whole page width
  const offsetXPx = crop ? Math.round(crop.left * fullPx) : 0;
  const headH = prevLabel ? EDGE_BLOCK_H : 0;

  const layout = useMemo(() => {
    if (!ready || !ratios) return null;
    const pages: PageLayout[] = [];
    let top = headH;
    for (let i = 0; i < total; i++) {
      const pagePx = Math.round(fullPx * ratios[i]);
      const a = analyses.current[i];
      let tiles: Tile[] | null;
      if (!trimGaps) tiles = tilesFor([[0, 1]], pagePx, dpr);
      else tiles = a ? tilesFor(a.bands, pagePx, dpr) : null;
      const height = tiles ? tiles.reduce((s, t) => s + t.h, 0) / dpr : pagePx / dpr;
      pages.push({ top, height, tiles });
      top += height;
    }
    return { pages, bottom: top, totalHeight: top + EDGE_BLOCK_H };
    // analysisTick stands in for the analyses ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ratios, total, fullPx, trimGaps, dpr, headH, analysisTick]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  /** Read the scroll position into anchor / current page / render range. */
  const sync = useCallback(() => {
    const el = scrollerRef.current;
    const l = layoutRef.current;
    if (!el || !l) return;
    const { pages } = l;
    const st = el.scrollTop;
    const vh = el.clientHeight;
    const pageAt = (y: number) => {
      let lo = 0;
      let hi = pages.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (pages[mid].top <= y) lo = mid; else hi = mid - 1;
      }
      return lo;
    };
    // +2: a position within a couple of px of a page top anchors to THAT
    // page at 0, not to 99.9% of the one above (which drifts when it resizes).
    const topPage = pageAt(st + 2);
    const p = pages[topPage];
    anchor.current = {
      page: topPage,
      frac: p.height > 0 ? Math.max(0, Math.min(1, (st - p.top) / p.height)) : 0,
    };
    const cur = pageAt(st + vh * 0.4);
    if (cur !== currentRef.current) setCurrent(cur);
    const first = pageAt(st - vh * OVERSCAN_ABOVE);
    const last = pageAt(st + vh * (1 + OVERSCAN_BELOW));
    setRange((r) => (r.first === first && r.last === last ? r : { first, last }));
  }, []);

  // Re-apply the anchor whenever the layout changes, then re-read the range.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || !layout) return;
    const p = layout.pages[anchor.current.page];
    if (p) {
      const target = Math.round(p.top + anchor.current.frac * p.height);
      if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
    }
    sync();
  }, [layout, sync]);

  // ----- Scroll tracking -----
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf: number | null = null;
    const onScroll = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => { raf = null; sync(); });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); if (raf !== null) cancelAnimationFrame(raf); };
  }, [sync]);

  // ----- Story-mode ambient backdrop -----
  useEffect(() => {
    if (!onAmbient) return;
    let cancelled = false;
    renderPageThumbnail(doc, current, 32).then((url) => { if (url && !cancelled) onAmbient(url); });
    return () => { cancelled = true; };
  }, [doc, current, onAmbient]);

  // ----- Imperative API (shared with PdfViewer) -----
  const goToPage = useCallback((n: number) => {
    const el = scrollerRef.current;
    const l = layoutRef.current;
    const clamped = Math.max(0, Math.min(n, total - 1));
    anchor.current = { page: clamped, frac: 0 };
    if (el && l) { el.scrollTop = Math.round(l.pages[clamped].top); sync(); }
  }, [total, sync]);

  const step = useCallback((delta: number) => {
    const el = scrollerRef.current;
    const l = layoutRef.current;
    if (!el || !l) return;
    if (delta > 0) {
      if (el.scrollTop + el.clientHeight >= l.bottom - 4) { onPastEnd?.(); return; }
      el.scrollBy({ top: el.clientHeight * 0.85, behavior: 'smooth' });
    } else if (delta < 0) {
      if (el.scrollTop <= headH + 4) { onPastStart?.(); return; }
      el.scrollBy({ top: -el.clientHeight * 0.85, behavior: 'smooth' });
    }
  }, [onPastEnd, onPastStart, headH]);

  useImperativeHandle(ref, () => ({
    prevPage: () => (currentRef.current > 0 ? goToPage(currentRef.current - 1) : onPastStart?.()),
    nextPage: () => (currentRef.current < total - 1 ? goToPage(currentRef.current + 1) : onPastEnd?.()),
    goToPage,
    step,
    zoomIn: () => {},
    zoomOut: () => {},
    resetZoom: () => {},
    totalPages: total,
    getPageThumbnail: (pageIdx: number, maxWidth = 140) => renderPageThumbnail(doc, pageIdx, maxWidth),
  }), [goToPage, step, total, doc, onPastEnd, onPastStart]);

  const stripW = stripPx / dpr;

  return (
    <div
      ref={scrollerRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden no-scrollbar select-none"
      style={{ background: '#0a0a0a', overscrollBehavior: 'contain' }}
    >
      {layout && (
        <div style={{ position: 'relative', height: layout.totalHeight, width: stripW, margin: '0 auto' }}>
          {prevLabel && (
            <EdgeBlock top={0} label={`Back to ${prevLabel}`} onClick={onPastStart} />
          )}
          {layout.pages.map((p, i) => (i < range.first || i > range.last ? null : (
            <div
              key={i}
              style={{
                position: 'absolute', top: p.top, left: 0, width: stripW, height: p.height,
                background: p.tiles ? '#fff' : 'rgb(255 255 255 / 0.04)',
              }}
            >
              {p.tiles && (
                <StripPage
                  key={`${stripPx}:${fullPx}:${offsetXPx}:${p.tiles.length}:${p.height}`}
                  doc={doc}
                  pageIdx={i}
                  tiles={p.tiles}
                  stripPx={stripPx}
                  fullPx={fullPx}
                  offsetXPx={offsetXPx}
                  dpr={dpr}
                />
              )}
            </div>
          )))}
          {nextLabel ? (
            <EdgeBlock top={layout.bottom} label={`Continue to ${nextLabel}`} onClick={onPastEnd} primary />
          ) : (
            <div style={{ ...edgeBlockBox, top: layout.bottom, opacity: 0.55, fontSize: 13 }}>
              You're caught up — this is the latest chapter.
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default StripViewer;

const edgeBlockBox = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  height: EDGE_BLOCK_H,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
};

function EdgeBlock({ top, label, onClick, primary }: {
  top: number; label: string; onClick?: () => void; primary?: boolean;
}) {
  return (
    <div style={{ ...edgeBlockBox, top }}>
      <button
        // Don't let the hand-off tap also toggle the reader chrome.
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        style={{
          background: primary ? 'rgb(var(--accent))' : 'rgb(255 255 255 / 0.1)',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '12px 22px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    </div>
  );
}

/**
 * One page of the strip: a stack of canvas tiles, each showing a kept slice of
 * the page. Mounted only while near the viewport; remounted (via key) whenever
 * its geometry changes, so the effect below renders exactly once per mount.
 */
const StripPage = memo(function StripPage({ doc, pageIdx, tiles, stripPx, fullPx, offsetXPx, dpr }: {
  doc: PdfDoc; pageIdx: number; tiles: Tile[]; stripPx: number; fullPx: number; offsetXPx: number; dpr: number;
}) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    let task: PdfRenderTask | null = null;
    (async () => {
      const page = await doc.getPage(pageIdx + 1);
      const scale = fullPx / page.getViewport({ scale: 1 }).width;
      for (let t = 0; t < tiles.length; t++) {
        if (cancelled) return;
        const cv = canvases.current[t];
        const ctx = cv?.getContext('2d');
        if (!cv || !ctx) continue;
        // Shift the page so this tile's slice lands on the canvas.
        const viewport = page.getViewport({ scale, offsetX: -offsetXPx, offsetY: -tiles[t].y });
        task = page.render({ canvasContext: ctx, viewport });
        await task.promise;
      }
    })().catch((err) => {
      if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
        console.error(`Strip page ${pageIdx + 1} failed to render:`, err);
      }
    });
    return () => {
      cancelled = true;
      try { task?.cancel(); } catch { /* already settled */ }
    };
    // Geometry is fixed for the life of this mount (see key at the call site).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {tiles.map((t, i) => (
        <canvas
          key={i}
          ref={(el) => { canvases.current[i] = el; }}
          width={stripPx}
          height={t.h}
          style={{ display: 'block', width: stripPx / dpr, height: t.h / dpr }}
        />
      ))}
    </>
  );
});
