import type { MangaSource, SearchResult, ChapterResult } from './types.js';
import { mangadexSource } from './mangadex-source.js';
import { mangahubSource } from './mangahub.js';

// All registered sources
const sources: MangaSource[] = [
  mangadexSource,
  mangahubSource,
];

export function getSource(id: string): MangaSource | undefined {
  return sources.find((s) => s.id === id);
}

export function getAllSources(): { id: string; name: string }[] {
  return sources.map((s) => ({ id: s.id, name: s.name }));
}

/**
 * Search all sources in parallel, return merged results
 */
export async function searchAllSources(query: string, limit = 20): Promise<SearchResult[]> {
  const results = await Promise.allSettled(
    sources.map((s) =>
      s.search(query, limit).catch((err) => {
        console.error(`Search failed for ${s.name}: ${(err as Error).message}`);
        return [] as SearchResult[];
      })
    )
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
 * Get chapters from a specific source
 */
export async function getChaptersFromSource(sourceId: string, mangaId: string): Promise<ChapterResult[]> {
  const source = getSource(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  return source.getChapters(mangaId);
}

/**
 * Get page URLs from a specific source
 */
export async function getPageUrlsFromSource(sourceId: string, chapterId: string): Promise<string[]> {
  const source = getSource(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  return source.getPageUrls(chapterId);
}

export type { MangaSource, SearchResult, ChapterResult } from './types.js';
