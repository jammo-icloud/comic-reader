import type { MangaSource, SearchResult, ChapterResult } from './types.js';
import { mangadexSource } from './mangadex-source.js';
import { malSource } from './mal-source.js';
import { mangafoxSource } from './mangafox.js';
// import { mangahubSource } from './mangahub.js'; // Disabled: Cloudflare protected

// Primary sources (have downloadable chapters)
const primarySources: MangaSource[] = [
  mangadexSource,
  mangafoxSource,
];

// All sources including metadata-only (MAL)
const allSources: MangaSource[] = [...primarySources, malSource];

export function getSource(id: string): MangaSource | undefined {
  return allSources.find((s) => s.id === id);
}

export function getAllSources(): { id: string; name: string }[] {
  return allSources.map((s) => ({ id: s.id, name: s.name }));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Search primary sources first. If zero results, fallback to MAL.
 */
export async function searchAllSources(query: string, limit = 20): Promise<SearchResult[]> {
  // Search primary sources in parallel
  const results = await Promise.allSettled(
    primarySources.map((s) =>
      withTimeout(
        s.search(query, limit).catch((err) => {
          console.error(`Search failed for ${s.name}: ${(err as Error).message}`);
          return [] as SearchResult[];
        }),
        10000,
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

  // If no results from primary sources, try MAL as fallback
  if (allResults.length === 0) {
    console.log(`  No results from primary sources, trying MAL...`);
    try {
      const malResults = await withTimeout(
        malSource.search(query, limit),
        10000,
        [] as SearchResult[],
      );
      allResults.push(...malResults);
    } catch {}
  }

  return allResults;
}

export async function getChaptersFromSource(sourceId: string, mangaId: string): Promise<ChapterResult[]> {
  const source = getSource(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  return source.getChapters(mangaId);
}

export async function getPageUrlsFromSource(sourceId: string, chapterId: string): Promise<string[]> {
  const source = getSource(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  return source.getPageUrls(chapterId);
}

export type { MangaSource, SearchResult, ChapterResult } from './types.js';
