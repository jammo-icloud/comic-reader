import type { Series, Comic, ContinueReadingItem, PendingImport, MangaDexManga, MangaDexChapter } from './types';

const BASE = '/api';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `API error: ${res.status}`);
  }
  return res.json();
}

function encodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}

// ==================== Series ====================

export function getSeries(type?: 'comic' | 'magazine'): Promise<Series[]> {
  const qs = type ? `?type=${type}` : '';
  return fetchJson(`/series${qs}`);
}

export function getSeriesDetail(id: string): Promise<Series> {
  return fetchJson(`/series/${id}`);
}

// ==================== Comics (within a series) ====================

export function getComics(seriesId: string): Promise<Comic[]> {
  return fetchJson(`/series/${seriesId}/comics`);
}

// ==================== Continue Reading ====================

export function getContinueReading(): Promise<ContinueReadingItem[]> {
  return fetchJson('/continue-reading');
}

// ==================== Reading Progress ====================

export function updateProgress(
  seriesId: string,
  file: string,
  data: { currentPage?: number; isRead?: boolean; pageCount?: number },
): Promise<void> {
  return fetchJson(`/comics/progress/${seriesId}/${encodePath(file)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ==================== URLs ====================

export function getPdfUrl(seriesId: string, file: string): string {
  return `${BASE}/comics/read/${seriesId}/${encodePath(file)}`;
}

export function getThumbnailUrl(seriesId: string, file: string): string {
  return `${BASE}/thumbnails/${seriesId}/${encodePath(file)}`;
}

export function getSeriesCoverUrl(seriesId: string): string {
  return `${BASE}/series-cover/${seriesId}`;
}

export function getPlaceholderUrl(filename: string): string {
  return `/placeholders/${filename}`;
}

// ==================== Enrichment ====================

export function enrichAll(force = false): Promise<{ found: number; skipped: number; failed: number }> {
  return fetchJson(`/enrich${force ? '?force=true' : ''}`, { method: 'POST' });
}

export function overrideMalId(seriesId: string, malId: number): Promise<any> {
  return fetchJson('/series-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seriesId, malId }),
  });
}

// ==================== Import ====================

export function importScan(path: string): Promise<{ id: string; status: string; progress: any }> {
  return fetchJson('/import/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

export function getImportScanStatus(): Promise<{ status: string; progress?: any }> {
  return fetchJson('/import/scan-status');
}

export function getImportReady(): Promise<PendingImport[]> {
  return fetchJson('/import/ready');
}

export function getImportCount(): Promise<{ count: number }> {
  return fetchJson('/import/count');
}

export function confirmImport(
  sourceFolder: string,
  type: 'comic' | 'magazine',
  name: string,
  malId?: number | null,
): Promise<any> {
  return fetchJson('/import/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceFolder, type, name, malId }),
  });
}

export function skipImport(sourceFolder: string): Promise<void> {
  return fetchJson('/import/skip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceFolder }),
  });
}

export function clearImports(): Promise<void> {
  return fetchJson('/import/clear', { method: 'POST' });
}

// ==================== Discover (MangaDex) ====================

export function discoverSearch(query: string, offset = 0): Promise<{ results: MangaDexManga[]; total: number }> {
  return fetchJson(`/discover/search?q=${encodeURIComponent(query)}&offset=${offset}`);
}

export function discoverChapters(sourceId: string, mangaId: string): Promise<MangaDexChapter[]> {
  return fetchJson(`/discover/chapters/${sourceId}/${encodeURIComponent(mangaId)}`);
}

export function startDownload(
  mangaDexId: string,
  mangaTitle: string,
  shelfId: string,
  chapters: { id: string; chapter: string | null; pages: number }[],
  metadata?: Record<string, any>,
): Promise<any> {
  return fetchJson('/discover/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mangaDexId, mangaTitle, shelfId, chapters, metadata }),
  });
}

export function getDownloadQueue(): Promise<any[]> {
  return fetchJson('/discover/queue');
}

export function cancelDownload(jobId: string): Promise<void> {
  return fetchJson(`/discover/queue/${jobId}/cancel`, { method: 'POST' });
}

export function removeDownloadJob(jobId: string): Promise<void> {
  return fetchJson(`/discover/queue/${jobId}`, { method: 'DELETE' });
}
