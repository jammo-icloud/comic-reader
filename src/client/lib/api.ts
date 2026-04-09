import type { Comic, Series, Shelf, MangaDexManga, MangaDexChapter } from './types';

const BASE = '/api';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `API error: ${res.status}`);
  }
  return res.json();
}

export function getComics(params?: {
  search?: string;
  series?: string;
  sort?: string;
  shelf?: string;
}): Promise<Comic[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.series) query.set('series', params.series);
  if (params?.sort) query.set('sort', params.sort);
  if (params?.shelf) query.set('shelf', params.shelf);
  const qs = query.toString();
  return fetchJson(`/comics${qs ? `?${qs}` : ''}`);
}

// Shelf API
export function getShelves(): Promise<Shelf[]> {
  return fetchJson('/shelves');
}

export function addShelf(name: string, path: string): Promise<Shelf> {
  return fetchJson('/shelves', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, path }),
  });
}

export function removeShelf(id: string): Promise<void> {
  return fetchJson(`/shelves/${id}`, { method: 'DELETE' });
}

export function getSeries(): Promise<Series[]> {
  return fetchJson('/series');
}

export function getContinueReading(): Promise<Comic[]> {
  return fetchJson('/continue-reading');
}

export function triggerScan(): Promise<{ added: number; removed: number; total: number }> {
  return fetchJson('/scan', { method: 'POST' });
}

// Encode each path segment individually so slashes are preserved
function encodePath(comicPath: string): string {
  return comicPath.split('/').map(encodeURIComponent).join('/');
}

export function updateProgress(
  comicPath: string,
  data: { currentPage?: number; isRead?: boolean; pageCount?: number }
): Promise<void> {
  return fetchJson(`/comics/progress/${encodePath(comicPath)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function getPdfUrl(comicPath: string): string {
  return `${BASE}/comics/read/${encodePath(comicPath)}`;
}

export function getThumbnailUrl(comicPath: string): string {
  return `${BASE}/thumbnails/${encodePath(comicPath)}`;
}

export function getSeriesCoverUrl(seriesName: string): string {
  return `${BASE}/series-cover/${encodeURIComponent(seriesName)}`;
}

export function triggerEnrich(force = false): Promise<{ found: number; skipped: number; failed: number }> {
  return fetchJson(`/enrich${force ? '?force=true' : ''}`, { method: 'POST' });
}

export function overrideMalId(seriesName: string, malId: number): Promise<any> {
  return fetchJson('/series-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seriesName, malId }),
  });
}

// Discover / MangaDex
export function discoverSearch(query: string, offset = 0): Promise<{ results: MangaDexManga[]; total: number }> {
  return fetchJson(`/discover/search?q=${encodeURIComponent(query)}&offset=${offset}`);
}

export function discoverMangaDetail(id: string): Promise<MangaDexManga> {
  return fetchJson(`/discover/manga/${id}`);
}

export function discoverChapters(mangaId: string): Promise<MangaDexChapter[]> {
  return fetchJson(`/discover/manga/${mangaId}/chapters`);
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
