// ============================================================================
// Offline support
// ----------------------------------------------------------------------------
// "Save offline" needs more than the PDF bytes: to open a saved series with no
// network, the app also needs the series detail and the chapter list (the table
// of contents that says which PDFs exist and in what order), plus the cover and
// thumbnails. We snapshot all of that into a DEDICATED cache that Workbox does
// not manage — so it has no LRU eviction and a saved series stays put until the
// user explicitly removes it (unlike the runtime `pdf-cache`, which caps at 20
// entries and would evict chapters out from under a long series).
//
// Reads are wired up elsewhere to fall back to this cache when offline:
//   - api.ts `fetchJson` → caches.match() for the JSON snapshots
//   - PdfViewer → caches.match() for the PDF bytes
// so the snapshot URLs here intentionally mirror the real API/static URLs.
// ============================================================================

import type { Series, Comic } from './types';

/** Sticky, app-managed cache. Bump the suffix to invalidate on schema changes. */
export const OFFLINE_CACHE = 'comic-offline-v1';

const MANIFEST_KEY = 'bindery-offline-v1';
const PROGRESS_QUEUE_KEY = 'bindery-progress-queue-v1';

// ----- URL builders (kept local to avoid an api.ts <-> offline.ts cycle) -----
// These must match api.ts exactly, since the cache is keyed by URL.

function encodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}
const seriesDetailUrl = (id: string) => `/api/series/${id}`;
const comicsUrl = (id: string) => `/api/series/${id}/comics`;
const pdfUrl = (id: string, file: string) => `/api/comics/read/${id}/${encodePath(file)}`;
const coverUrl = (id: string, coverFile: string | null) =>
  coverFile ? `/static/covers/${coverFile}` : `/api/series-cover/${id}`;
const thumbUrl = (id: string, file: string, thumbHash: string) =>
  thumbHash ? `/static/thumbnails/${thumbHash}.jpg` : `/api/thumbnails/${id}/${encodePath(file)}`;

// ----- Manifest ------------------------------------------------------------

export interface OfflineEntry {
  id: string;
  type: 'comic' | 'magazine';
  name: string;
  coverFile: string | null;
  chapterCount: number;
  savedAt: number;
}

function readManifest(): Record<string, OfflineEntry> {
  try {
    return JSON.parse(localStorage.getItem(MANIFEST_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeManifest(m: Record<string, OfflineEntry>): void {
  localStorage.setItem(MANIFEST_KEY, JSON.stringify(m));
}

export function listOffline(): OfflineEntry[] {
  return Object.values(readManifest()).sort((a, b) => b.savedAt - a.savedAt);
}

/** Set of series ids saved for offline — for badges and the library filter. */
export function offlineSeriesIds(): Set<string> {
  return new Set(Object.keys(readManifest()));
}

export function isSavedOffline(id: string): boolean {
  return id in readManifest();
}

// ----- Persistent storage --------------------------------------------------

/**
 * Ask the browser to make our storage persistent so it isn't evicted under
 * pressure (or, in Safari, after ~7 days of non-use). Best-effort: returns
 * false if the API is missing or the browser declines.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch { /* ignore */ }
  return false;
}

// ----- Save / remove -------------------------------------------------------

export interface SaveProgress {
  done: number;
  total: number;
}

/**
 * Snapshot a whole series for offline reading: metadata + cover + per-chapter
 * thumbnail + PDF. Idempotent — re-running tops up anything missing without
 * re-downloading what's already cached. `onProgress` reports PDF progress (the
 * slow part), counted in chapters.
 */
export async function saveSeriesOffline(
  series: Series,
  comics: Comic[],
  onProgress?: (p: SaveProgress) => void,
): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('Cache API unavailable');

  await requestPersistentStorage();
  const cache = await caches.open(OFFLINE_CACHE);

  // 1. Metadata snapshots — the table of contents the reader navigates by.
  const json = (data: unknown) =>
    new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  await cache.put(seriesDetailUrl(series.id), json(series));
  await cache.put(comicsUrl(series.id), json(comics));

  // 2. Cover (best-effort — a missing cover shouldn't fail the save).
  try {
    const c = await fetch(coverUrl(series.id, series.coverFile));
    if (c.ok) await cache.put(coverUrl(series.id, series.coverFile), c);
  } catch { /* ignore */ }

  // 3. Per-chapter thumbnail + PDF.
  onProgress?.({ done: 0, total: comics.length });
  for (let i = 0; i < comics.length; i++) {
    const c = comics[i];
    try {
      const t = await fetch(thumbUrl(series.id, c.file, c.thumbHash));
      if (t.ok) await cache.put(thumbUrl(series.id, c.file, c.thumbHash), t);
    } catch { /* thumbnails are non-critical */ }
    try {
      const url = pdfUrl(series.id, c.file);
      if (!(await cache.match(url))) {
        const r = await fetch(url);
        if (r.ok) await cache.put(url, r);
      }
    } catch { /* skip a failed chapter, keep going */ }
    onProgress?.({ done: i + 1, total: comics.length });
  }

  // 4. Record in the manifest only after the content is in place.
  const m = readManifest();
  m[series.id] = {
    id: series.id,
    type: series.type,
    name: series.name,
    coverFile: series.coverFile,
    chapterCount: comics.length,
    savedAt: Date.now(),
  };
  writeManifest(m);
}

// ----- Offline library view -------------------------------------------------

/**
 * Build a library list from what's actually cached for offline reading, for when
 * the live list can't be fetched (offline). This scans the offline cache for
 * series-detail snapshots — deliberately the SAME source that makes a series
 * readable offline. That guarantees consistency: if you can open a series
 * offline, it appears in the library offline. (We intentionally do NOT trust the
 * localStorage manifest here — it can drift out of sync with the cache, which is
 * exactly the bug where reading worked but the library showed empty.)
 */
export async function getOfflineLibrary(): Promise<Series[]> {
  if (typeof caches === 'undefined') return [];
  const cache = await caches.open(OFFLINE_CACHE);
  const keys = await cache.keys();
  const out: Series[] = [];
  for (const req of keys) {
    // Match the series-detail snapshot key exactly: /api/series/:id (not /comics).
    if (!/^\/api\/series\/[^/]+$/.test(new URL(req.url).pathname)) continue;
    const res = await cache.match(req);
    if (!res) continue;
    try { out.push(await res.json()); } catch { /* skip a corrupt snapshot */ }
  }
  return out;
}

/** Series ids with a cached offline snapshot — for badges and the library filter. */
export async function getOfflineSeriesIds(): Promise<Set<string>> {
  if (typeof caches === 'undefined') return new Set();
  const cache = await caches.open(OFFLINE_CACHE);
  const keys = await cache.keys();
  const ids = new Set<string>();
  for (const req of keys) {
    const m = new URL(req.url).pathname.match(/^\/api\/series\/([^/]+)$/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

/** Delete every cached entry for a series and drop it from the manifest. */
export async function removeSeriesOffline(id: string): Promise<void> {
  const m = readManifest();
  const coverFile = m[id]?.coverFile ?? null; // capture before deleting the entry
  delete m[id];
  writeManifest(m);

  if (typeof caches === 'undefined') return;
  const cache = await caches.open(OFFLINE_CACHE);
  const keys = await cache.keys();
  await Promise.all(
    keys
      .filter((req) => {
        const path = new URL(req.url).pathname;
        return (
          path === seriesDetailUrl(id) ||
          path === comicsUrl(id) ||
          path.startsWith(`/api/comics/read/${id}/`) ||
          path.startsWith(`/api/thumbnails/${id}/`) ||
          path === coverUrl(id, coverFile)
        );
      })
      .map((req) => cache.delete(req)),
  );
}

// ----- Reading-progress queue ----------------------------------------------
// Progress writes go to the server, which is unreachable offline. Rather than
// throwing (and losing the user's place), we queue the latest state per chapter
// and flush on reconnect. Keyed by series+file so rapid page turns collapse to
// one pending write.

interface ProgressData {
  currentPage?: number;
  isRead?: boolean;
  pageCount?: number;
}
interface QueuedProgress {
  seriesId: string;
  file: string;
  data: ProgressData;
  ts: number;
}

function readQueue(): Record<string, QueuedProgress> {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_QUEUE_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeQueue(q: Record<string, QueuedProgress>): void {
  localStorage.setItem(PROGRESS_QUEUE_KEY, JSON.stringify(q));
}

export function enqueueProgress(seriesId: string, file: string, data: ProgressData): void {
  const q = readQueue();
  const key = `${seriesId} ${file}`;
  // Merge onto any pending write for this chapter — keep the freshest fields.
  q[key] = { seriesId, file, data: { ...q[key]?.data, ...data }, ts: Date.now() };
  writeQueue(q);
}

/**
 * Re-send every queued progress write. Entries that succeed are dropped; ones
 * that fail (still offline) stay for the next flush. Returns the number sent.
 */
export async function flushProgressQueue(): Promise<number> {
  const q = readQueue();
  const entries = Object.entries(q);
  if (entries.length === 0) return 0;

  let flushed = 0;
  for (const [key, item] of entries) {
    try {
      const res = await fetch(
        `/api/comics/progress/${item.seriesId}/${encodePath(item.file)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data),
        },
      );
      if (res.ok) {
        delete q[key];
        flushed++;
      }
    } catch {
      break; // network's down again — stop, retry the rest later
    }
  }
  writeQueue(q);
  return flushed;
}

export function hasQueuedProgress(): boolean {
  return Object.keys(readQueue()).length > 0;
}
