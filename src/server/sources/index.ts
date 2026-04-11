import type { MangaSource, SearchResult, ChapterResult } from './types.js';
import { mangadexSource } from './mangadex-source.js';
import { malSource } from './mal-source.js';
// import { mangahubSource } from './mangahub.js'; // Disabled: Cloudflare protected

// All registered sources
const sources: MangaSource[] = [
  mangadexSource,
  malSource,
  // mangahubSource, // Re-enable when Cloudflare bypass is solved
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
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function searchAllSources(query: string, limit = 20): Promise<SearchResult[]> {
  const results = await Promise.allSettled(
    sources.map((s) =>
      withTimeout(
        s.search(query, limit).catch((err) => {
          console.error(`Search failed for ${s.name}: ${(err as Error).message}`);
          return [] as SearchResult[];
        }),
        10000, // 10 second timeout per source
        [] as SearchResult[],
      )
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
