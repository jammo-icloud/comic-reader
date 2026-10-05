/**
 * Shared PDF plumbing for the reader: one document load per chapter (shared by
 * the paged viewer, the continuous strip, and the page rail), thumbnails, and
 * the page analysis that powers edge-fit and gap trimming.
 */
import { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Bundle the worker as a same-origin asset (Vite emits a hashed URL) instead of
// fetching it from a CDN — a CDN worker is unreachable offline, which left the
// reader with a blank canvas. Served from our origin, it gets precached too.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type PdfDoc = pdfjsLib.PDFDocumentProxy;
export type PdfRenderTask = ReturnType<pdfjsLib.PDFPageProxy['render']>;

/**
 * Cache-first load: if the PDF is in any cache (the sticky offline cache or the
 * runtime pdf-cache), open it from those bytes directly. This makes saved
 * series openable with no network — and doesn't depend on the service worker
 * intercepting the request — while online reads fall through to the URL.
 */
async function loadPdf(url: string): Promise<PdfDoc> {
  try {
    const hit = typeof caches !== 'undefined' ? await caches.match(url) : undefined;
    if (hit) return pdfjsLib.getDocument({ data: await hit.arrayBuffer() }).promise;
  } catch { /* fall through to network */ }
  return pdfjsLib.getDocument(url).promise;
}

/**
 * Load the PDF at `url`; returns null until it's ready. The result is tagged
 * with its url so that on a chapter change consumers see null in the very same
 * render — they unmount before the old document is destroyed.
 */
export function usePdfDocument(url: string): PdfDoc | null {
  const [state, setState] = useState<{ url: string; doc: PdfDoc } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDoc | null = null;
    loadPdf(url)
      .then((doc) => {
        if (cancelled) { doc.destroy(); return; }
        loaded = doc;
        setState({ url, doc });
      })
      .catch((err) => console.error('Failed to load PDF:', err));
    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [url]);
  return state && state.url === url ? state.doc : null;
}

/** Render one page (0-based) to a small JPEG data URL, off-screen. */
export async function renderPageThumbnail(
  doc: PdfDoc, pageIdx: number, maxWidth = 140,
): Promise<string | null> {
  if (pageIdx < 0 || pageIdx >= doc.numPages) return null;
  try {
    const page = await doc.getPage(pageIdx + 1);
    const baseVp = page.getViewport({ scale: 1.0 });
    const vp = page.getViewport({ scale: maxWidth / baseVp.width });
    const cv = document.createElement('canvas');
    cv.width = Math.round(vp.width);
    cv.height = Math.round(vp.height);
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return cv.toDataURL('image/jpeg', 0.65);
  } catch {
    return null;
  }
}

/** Height / width of every page, in order. Cheap — no image decoding. */
export async function getPageRatios(doc: PdfDoc): Promise<number[]> {
  const ratios: number[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const vp = (await doc.getPage(i)).getViewport({ scale: 1 });
    ratios.push(vp.height / vp.width);
  }
  return ratios;
}

// ---------------------------------------------------------------------------
// Page analysis — where the art is
// ---------------------------------------------------------------------------

/** A vertical slice of a page to keep, as fractions of the page height. */
export type Band = [start: number, end: number];

export interface PageAnalysis {
  /** Left/right edges of the art as fractions of page width (0..1). */
  left: number;
  right: number;
  /**
   * The page with long blank stretches cut down to a small, uniform gap.
   * Concatenating these bands (and those of the next page) gives a strip with
   * consistent spacing, while a frame sliced across two pages — no blank at
   * the seam — rejoins untouched.
   */
  bands: Band[];
}

export const FULL_PAGE: PageAnalysis = { left: 0, right: 1, bands: [[0, 1]] };

const ANALYSIS_W = 160;       // analysis render width, px
const MAX_ANALYSIS_H = 6000;
const TOLERANCE = 14;         // per-channel difference still counted as "flat"
const KEEP_ROWS = 2;          // blank rows kept on each side of a cut (~1.25% of width)
const EDGE_KEEP_ROWS = 1;      // …and beside a cut that touches the page edge
const MIN_RUN_ROWS = 7;       // shorter blank runs are left alone
const SIDE_PAD = 0.008;       // breathing room kept beside the detected art edge
const MIN_SIDE_TRIM = 0.02;   // ignore side margins thinner than this

const analysisCache = new WeakMap<PdfDoc, Map<number, Promise<PageAnalysis>>>();

/** Analyse a page (0-based). Cached per document; failures fall back to the full page. */
export function analyzePage(doc: PdfDoc, pageIdx: number): Promise<PageAnalysis> {
  let perDoc = analysisCache.get(doc);
  if (!perDoc) { perDoc = new Map(); analysisCache.set(doc, perDoc); }
  let hit = perDoc.get(pageIdx);
  if (!hit) {
    hit = computeAnalysis(doc, pageIdx).catch(() => FULL_PAGE);
    perDoc.set(pageIdx, hit);
  }
  return hit;
}

async function computeAnalysis(doc: PdfDoc, pageIdx: number): Promise<PageAnalysis> {
  const page = await doc.getPage(pageIdx + 1);
  const base = page.getViewport({ scale: 1 });
  let scale = ANALYSIS_W / base.width;
  if (base.height * scale > MAX_ANALYSIS_H) scale = MAX_ANALYSIS_H / base.height;
  const vp = page.getViewport({ scale });
  const w = Math.max(8, Math.round(vp.width));
  const h = Math.max(8, Math.round(vp.height));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return FULL_PAGE;
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const px = ctx.getImageData(0, 0, w, h).data;

  const near = (a: number, b: number) =>
    Math.abs(px[a] - px[b]) <= TOLERANCE &&
    Math.abs(px[a + 1] - px[b + 1]) <= TOLERANCE &&
    Math.abs(px[a + 2] - px[b + 2]) <= TOLERANCE;

  // --- Rows: a row is blank when it is one flat colour edge to edge. ---
  const blank = new Uint8Array(h);
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    let flat = true;
    for (let x = 1; x < w; x++) {
      if (!near(row, row + x * 4)) { flat = false; break; }
    }
    blank[y] = flat ? 1 : 0;
  }

  // Blank runs (rows of the same flat colour), cut down to a uniform gap.
  const cuts: [number, number][] = []; // row ranges to drop
  let y = 0;
  while (y < h) {
    if (!blank[y]) { y++; continue; }
    let end = y + 1;
    while (end < h && blank[end] && near(y * w * 4, end * w * 4)) end++;
    if (end - y >= MIN_RUN_ROWS) {
      // Interior runs keep KEEP_ROWS on each side; runs touching the page edge
      // keep half that, so two meeting at a seam add up to one uniform gap.
      const atTop = y === 0;
      const atBottom = end === h;
      const from = atTop ? 0 : y + (atBottom ? EDGE_KEEP_ROWS : KEEP_ROWS);
      const to = atBottom ? h : end - (atTop ? EDGE_KEEP_ROWS : KEEP_ROWS);
      if (to > from) cuts.push([from, to]);
    }
    y = end;
  }
  const bands: Band[] = [];
  let cursor = 0;
  for (const [from, to] of cuts) {
    if (from > cursor) bands.push([cursor / h, from / h]);
    cursor = to;
  }
  if (cursor < h) bands.push([cursor / h, 1]);
  // An entirely blank page still needs to exist — keep a sliver.
  if (bands.length === 0) bands.push([0, Math.min(1, (KEEP_ROWS * 2) / h)]);

  // --- Columns: side margins are flat columns matching the page corner. ---
  const columnBlank = (x: number, corner: number) => {
    const top = x * 4;
    if (!near(top, corner)) return false;
    for (let yy = 1; yy < h; yy++) {
      if (!near(top, (yy * w + x) * 4)) return false;
    }
    return true;
  };
  let l = 0;
  while (l < w - 1 && columnBlank(l, 0)) l++;
  let r = w - 1;
  while (r > l && columnBlank(r, (w - 1) * 4)) r--;
  let left = Math.max(0, l / w - SIDE_PAD);
  let right = Math.min(1, (r + 1) / w + SIDE_PAD);
  if (left < MIN_SIDE_TRIM) left = 0;
  if (1 - right < MIN_SIDE_TRIM) right = 1;
  if (right - left < 0.3) { left = 0; right = 1; } // blank or near-blank page

  return { left, right, bands };
}
