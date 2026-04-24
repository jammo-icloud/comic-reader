import type { MangaSource, SearchResult, ChapterResult } from './types.js';
import { mangadexSource } from './mangadex-source.js';
import { malSource } from './mal-source.js';
import { mangafoxSource } from './mangafox.js';
import { mangatownSource } from './mangatown.js';
import { readallcomicsSource } from './readallcomics.js';
import { readcomicsonlineSource } from './readcomicsonline.js';
import { archiveorgSource } from './archiveorg.js';
// import { mangahubSource } from './mangahub.js'; // Disabled: Cloudflare protected

// Primary sources (have downloadable chapters)
const primarySources: MangaSource[] = [
  mangadexSource,
  mangafoxSource,
  mangatownSource,
  readallcomicsSource,
  readcomicsonlineSource,
  archiveorgSource,
];

// All sources including metadata-only (MAL)
const allSources: MangaSource[] = [...primarySources, malSource];

// Display metadata for the client picker
const sourceMeta: Record<string, { color: string; description: string; url: string; favicon: string }> = {
  mangadex: {
    color: '#ea580c',
    description: 'Community-driven scanlations. Largest free manga library.',
    url: 'https://mangadex.org',
    favicon: 'https://mangadex.org/favicon.ico',
  },
  mangafox: {
    color: '#059669',
    description: 'Long-running manga site. Fast chapter updates.',
    url: 'https://fanfox.net',
    favicon: 'https://fanfox.net/favicon.ico',
  },
  mangatown: {
    color: '#0284c7',
    description: 'Large manga library. Predictable image URLs for fast downloads.',
    url: 'https://www.mangatown.com',
    favicon: 'https://www.mangatown.com/favicon.ico',
  },
  readallcomics: {
    color: '#f59e0b',
    description: 'Western comics, DC, Marvel, and more.',
    url: 'https://readallcomics.com',
    favicon: 'https://readallcomics.com/wp-content/uploads/cropped-logo-readallcomic-seo-2-32x32.jpg',
  },
  readcomicsonline: {
    color: '#dc2626',
    description: 'Western comics — DC, Marvel, Image, and more.',
    url: 'https://readcomicsonline.ru',
    favicon: 'https://readcomicsonline.ru/favicon.ico',
  },
  archiveorg: {
    color: '#8b5cf6',
    description: 'Internet Archive — public domain comics, magazines, manga collections.',
    url: 'https://archive.org',
    favicon: 'https://archive.org/favicon.ico',
  },
  mal: {
    color: '#2e51a2',
    description: 'MyAnimeList metadata only (no downloads).',
    url: 'https://myanimelist.net',
    favicon: 'https://myanimelist.net/favicon.ico',
  },
};

export function getSource(id: string): MangaSource | undefined {
  return allSources.find((s) => s.id === id);
}

export function getAllSources(): { id: string; name: string; color: string; description: string; url: string; favicon: string }[] {
  return allSources.map((s) => ({
    id: s.id,
    name: s.name,
    color: sourceMeta[s.id]?.color || '#64748b',
    description: sourceMeta[s.id]?.description || '',
    url: sourceMeta[s.id]?.url || '',
    favicon: sourceMeta[s.id]?.favicon || '',
  }));
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
