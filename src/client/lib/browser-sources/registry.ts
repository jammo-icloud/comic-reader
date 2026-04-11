import type { SearchResult, ChapterResult } from '../types';
import type { BrowserSource, SourceConfig, SourceTier } from './types';

// All source configs (both server and browser)
export const ALL_SOURCES: SourceConfig[] = [
  // Fast (server-side)
  { id: 'mangadex', name: 'MangaDex', color: 'bg-orange-600', tier: 'fast', type: 'server' },
  { id: 'mangafox', name: 'MangaFox', color: 'bg-emerald-600', tier: 'fast', type: 'server' },
  // Slow (browser-side) — stubs for now, connectors added later
  { id: 'mangahub', name: 'MangaHub', color: 'bg-indigo-600', tier: 'slow', type: 'browser' },
  { id: 'mangafreak', name: 'MangaFreak', color: 'bg-violet-600', tier: 'slow', type: 'browser' },
  { id: 'mangafire', name: 'MangaFire', color: 'bg-purple-600', tier: 'slow', type: 'browser' },
  { id: 'mangadna', name: 'MangaDNA', color: 'bg-sky-600', tier: 'slow', type: 'browser' },
  // NSFW
  { id: 'hentainexus', name: 'HentaiNexus', color: 'bg-rose-600', tier: 'nsfw', type: 'browser' },
];

// Browser connector registry
const browserConnectors = new Map<string, BrowserSource>();

export function registerBrowserSource(source: BrowserSource) {
  browserConnectors.set(source.id, source);
}

export function getBrowserSource(id: string): BrowserSource | undefined {
  return browserConnectors.get(id);
}

export function getSourcesByTier(tier: SourceTier): SourceConfig[] {
  return ALL_SOURCES.filter((s) => s.tier === tier);
}

export function getSourceConfig(id: string): SourceConfig | undefined {
  return ALL_SOURCES.find((s) => s.id === id);
}

/**
 * Search across selected browser-side sources
 */
export async function searchBrowserSources(
  query: string,
  selectedIds: string[],
): Promise<SearchResult[]> {
  const browserIds = selectedIds.filter((id) => {
    const config = ALL_SOURCES.find((s) => s.id === id);
    return config?.type === 'browser' && browserConnectors.has(id);
  });

  if (browserIds.length === 0) return [];

  const results = await Promise.allSettled(
    browserIds.map((id) => {
      const source = browserConnectors.get(id)!;
      return Promise.race([
        source.search(query).catch(() => [] as SearchResult[]),
        new Promise<SearchResult[]>((resolve) => setTimeout(() => resolve([]), 30000)), // 30s timeout for browser sources
      ]);
    })
  );

  const allResults: SearchResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    }
  }
  return allResults;
}

/**
 * Get chapters from a browser source
 */
export async function getBrowserChapters(sourceId: string, mangaId: string): Promise<ChapterResult[]> {
  const source = browserConnectors.get(sourceId);
  if (!source) throw new Error(`No browser connector for ${sourceId}`);
  return source.getChapters(mangaId);
}

/**
 * Download chapter images from a browser source and upload to server
 */
export async function downloadBrowserChapter(
  sourceId: string,
  chapterId: string,
  seriesName: string,
  chapterNumber: string,
  onProgress?: (current: number, total: number) => void,
): Promise<{ ok: boolean; file?: string; pages?: number }> {
  const source = browserConnectors.get(sourceId);
  if (!source) throw new Error(`No browser connector for ${sourceId}`);

  // Get page URLs
  const pageUrls = await source.getPageUrls(chapterId);
  if (pageUrls.length === 0) throw new Error('No pages found');

  // Fetch each image
  const formData = new FormData();
  formData.append('seriesName', seriesName);
  formData.append('chapterNumber', chapterNumber);
  formData.append('sourceId', sourceId);

  for (let i = 0; i < pageUrls.length; i++) {
    try {
      const blob = await source.fetchImage(pageUrls[i]);
      formData.append('images', blob, `page-${String(i + 1).padStart(3, '0')}.jpg`);
      onProgress?.(i + 1, pageUrls.length);
    } catch (err) {
      console.error(`Failed to fetch page ${i + 1}:`, err);
    }
  }

  // Upload to server for PDF assembly
  const res = await fetch('/api/import/chapter-images', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error);
  }

  return res.json();
}
