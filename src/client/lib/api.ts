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

// ==================== User ====================

export function getMe(): Promise<{ username: string; preferences: { theme: string; safeMode: boolean } }> {
  return fetchJson('/me');
}

export function updatePreferences(prefs: { theme?: string; safeMode?: boolean }): Promise<any> {
  return fetchJson('/me/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
}

// ==================== CRZ Import ====================

export async function uploadCrz(file: File): Promise<{ seriesId: string; title: string; chaptersImported: number; merged: boolean }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/import/crz`, { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `CRZ import failed: ${res.status}`);
  }
  return res.json();
}

// ==================== Collection ====================

export function addToCollection(seriesId: string): Promise<void> {
  return fetchJson(`/collection/${seriesId}`, { method: 'POST' });
}

export function removeFromCollection(seriesId: string): Promise<void> {
  return fetchJson(`/collection/${seriesId}`, { method: 'DELETE' });
}

export function getCatalog(type?: 'comic' | 'magazine'): Promise<Series[]> {
  const qs = type ? `?scope=catalog&type=${type}` : '?scope=catalog';
  return fetchJson(`/series${qs}`);
}

// ==================== Admin ====================

export function getAdminStats(): Promise<{ seriesCount: number; chapterCount: number; userCount: number; activeTasks: number; totalTasks: number; librarySize: number; dataSize: number }> {
  return fetchJson('/admin/stats');
}

export function getAdminTasks(): Promise<any[]> {
  return fetchJson('/admin/tasks');
}

export function deleteAdminTask(id: string): Promise<void> {
  return fetchJson(`/admin/tasks/${id}`, { method: 'DELETE' });
}

export function retryAdminTask(id: string): Promise<void> {
  return fetchJson(`/admin/tasks/${id}/retry`, { method: 'POST' });
}

export function cancelAdminTask(id: string): Promise<void> {
  return fetchJson(`/admin/tasks/${id}/cancel`, { method: 'POST' });
}

export function clearAdminTasks(): Promise<{ cleared: number }> {
  return fetchJson('/admin/tasks/clear', { method: 'POST' });
}

export function getAdminCatalog(): Promise<any[]> {
  return fetchJson('/admin/catalog');
}

export function purgeAdminSeries(id: string): Promise<void> {
  return fetchJson(`/admin/catalog/${id}`, { method: 'DELETE' });
}

export function getAdminSeriesComics(seriesId: string): Promise<Comic[]> {
  return fetchJson(`/admin/catalog/${seriesId}/comics`);
}

export function getMergePreview(keepId: string, removeId: string): Promise<any> {
  return fetchJson('/admin/merge/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keepId, removeId }),
  });
}

export function executeMerge(payload: {
  keepId: string;
  removeId: string;
  chapters: { file: string; from: 'keep' | 'remove' }[];
  metadata: Record<string, 'keep' | 'remove'>;
}): Promise<{ ok: boolean; chaptersMoved: number; usersUpdated: number }> {
  return fetchJson('/admin/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function adminEnrich(force = false): Promise<{ found: number; skipped: number; failed: number }> {
  return fetchJson(`/admin/enrich${force ? '?force=true' : ''}`, { method: 'POST' });
}

export function adminRescan(): Promise<{ updated: number }> {
  return fetchJson('/admin/rescan', { method: 'POST' });
}

export function adminCleanup(): Promise<{ ok: boolean }> {
  return fetchJson('/admin/cleanup', { method: 'POST' });
}

export function adminMaintenance(): Promise<{ ok: boolean }> {
  return fetchJson('/admin/maintenance', { method: 'POST' });
}

export function updateAdminSeries(id: string, updates: Record<string, any>): Promise<any> {
  return fetchJson(`/admin/catalog/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export function deleteAdminComic(seriesId: string, file: string): Promise<{ ok: boolean; remaining: number }> {
  return fetchJson(`/admin/catalog/${seriesId}/comics/${encodePath(file)}`, { method: 'DELETE' });
}

export async function uploadSeriesCover(seriesId: string, file: File): Promise<{ ok: boolean; coverFile: string }> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${BASE}/series/${seriesId}/cover`, { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export function getAdminUsers(): Promise<{ username: string; collectionSize: number; progressEntries: number; readChapters: number }[]> {
  return fetchJson('/admin/users');
}

// ==================== Series ====================

export function getSeries(type?: 'comic' | 'magazine'): Promise<Series[]> {
  const qs = type ? `?type=${type}` : '';
  return fetchJson(`/series${qs}`);
}

export function getSeriesDetail(id: string): Promise<Series> {
  return fetchJson(`/series/${id}`);
}

export function deleteSeries(id: string): Promise<void> {
  return fetchJson(`/series/${id}`, { method: 'DELETE' });
}

export function updateSeriesTags(id: string, tags: string[]): Promise<any> {
  return fetchJson(`/series/${id}/tags`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  });
}

// ==================== Subscriptions / Sync ====================

export function syncSeriesNow(id: string): Promise<{ ok: boolean; newChapters: number; error?: string }> {
  return fetchJson(`/series/${id}/sync`, { method: 'POST' });
}

export function updateSeriesSyncSource(
  id: string,
  source: { sourceId: string; mangaId: string } | null,
): Promise<{ ok: boolean }> {
  return fetchJson(`/series/${id}/sync-source`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(source || { sourceId: null }),
  });
}

export function getSubscriptionsWithNew(): Promise<{
  id: string;
  name: string;
  englishTitle: string | null;
  coverFile: string | null;
  newChapterCount: number;
  lastSyncAt: string | null;
}[]> {
  return fetchJson('/subscriptions/new');
}

export function getAdminSubscriptions(): Promise<{
  id: string;
  name: string;
  englishTitle: string | null;
  coverFile: string | null;
  syncSource: { sourceId: string; mangaId: string };
  lastSyncAt: string | null;
  newChapterCount: number | null;
  chapterCount: number;
}[]> {
  return fetchJson('/admin/subscriptions');
}

export function adminSyncAll(): Promise<{ ok: boolean; status: string }> {
  return fetchJson('/admin/sync-all', { method: 'POST' });
}

export function getAvailableSources(): Promise<{ id: string; name: string; color: string; favicon?: string; description?: string }[]> {
  return fetchJson('/discover/sources');
}

// ==================== Translation ====================

export interface TranslatedBubble {
  order: number;
  japanese: string;
  english: string;
}

export interface PageTranslation {
  bubbles: TranslatedBubble[];
  modelUsed: string;
  translatedAt: string;
  durationMs: number;
}

export function getPageTranslation(seriesId: string, file: string, pageNum: number, force = false): Promise<PageTranslation> {
  const qs = force ? '?force=true' : '';
  return fetchJson(`/translate/${seriesId}/${pageNum}/${encodePath(file)}${qs}`);
}

export function getTranslationStatus(seriesId: string, file: string): Promise<{ enabled: boolean; cachedPages: number[] }> {
  return fetchJson(`/translate/${seriesId}/status/${encodePath(file)}`);
}

export function translateWholeChapter(seriesId: string, file: string, force = false): Promise<{ ok: boolean; status: string }> {
  const qs = force ? '?force=true' : '';
  return fetchJson(`/translate/${seriesId}/chapter/${encodePath(file)}${qs}`, { method: 'POST' });
}

export interface TranslationConfig {
  url: string;
  model: string;
  prompt: string;
}

export function getTranslationConfig(): Promise<TranslationConfig> {
  return fetchJson('/translate/config');
}

export function updateTranslationConfig(cfg: Partial<TranslationConfig>): Promise<TranslationConfig> {
  return fetchJson('/translate/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
}

export function searchSource(sourceId: string, query: string): Promise<{
  sourceId: string;
  sourceName: string;
  mangaId: string;
  title: string;
  coverUrl: string | null;
  description: string;
  status: string;
  year: number | null;
  tags: string[];
}[]> {
  return fetchJson(`/discover/search?q=${encodeURIComponent(query)}&source=${sourceId}`);
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

/**
 * Thumbnail URL. Prefers static serving (no Express route) when thumbHash is known.
 * Falls back to the API route which generates on demand for missing thumbnails.
 */
export function getThumbnailUrl(seriesId: string, file: string, thumbHash?: string): string {
  if (thumbHash) return `/static/thumbnails/${thumbHash}.jpg`;
  return `${BASE}/thumbnails/${seriesId}/${encodePath(file)}`;
}

/**
 * Cover URL. Prefers static serving when coverFile is known.
 * Falls back to the API route for series without a cover yet.
 */
export function getSeriesCoverUrl(seriesId: string, coverFile?: string | null): string {
  if (coverFile) return `/static/covers/${coverFile}`;
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

export function getWatchFolder(): Promise<{ path: string; items: { name: string; isDirectory: boolean; size: number | null }[] }> {
  return fetchJson('/import/watch-folder');
}

export function scanLocalImport(): Promise<{ ok: boolean; count: number }> {
  return fetchJson('/import/scan-local', { method: 'POST' });
}

export function getLocalReady(): Promise<PendingImport[]> {
  return fetchJson('/import/local-ready');
}

export function getLocalCount(): Promise<{ count: number }> {
  return fetchJson('/import/local-count');
}

export function skipLocalImport(sourceFolder: string): Promise<void> {
  return fetchJson('/import/local-skip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceFolder }),
  });
}

export function clearLocalImports(): Promise<void> {
  return fetchJson('/import/local-clear', { method: 'POST' });
}

export async function uploadFiles(files: File[]): Promise<{ ok: boolean; files: { name: string; size: number; path: string }[]; importDir: string }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const res = await fetch(`${BASE}/import/upload-files`, { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

// ==================== Discover (MangaDex) ====================

export function discoverSearch(query: string, offset = 0): Promise<{ results: MangaDexManga[]; total: number }> {
  return fetchJson(`/discover/search?q=${encodeURIComponent(query)}&offset=${offset}`);
}

export function discoverChapters(sourceId: string, mangaId: string): Promise<{ chapters: MangaDexChapter[]; metadata?: any }> {
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
