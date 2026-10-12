/**
 * Source registry. MangaDex and MyAnimeList are built in; every other source
 * is an add-on (see src/server/addons/loader.ts). The functions exported here
 * are the only way the rest of the server talks to sources.
 */
import type { AddonManifest, MangaSource, SearchResult, ChapterResult } from '@bindery/addon-api';
import { mangadexSource } from './mangadex-source.js';
import { malSource } from './mal-source.js';
import { loadAddons } from '../addons/loader.js';

type SourceMeta = Pick<AddonManifest, 'color' | 'description' | 'url' | 'favicon' | 'nsfw'>;

const builtinMeta: Record<string, SourceMeta> = {
  mangadex: {
    color: '#ea580c',
    description: 'Community-driven scanlations. Largest free manga library.',
    url: 'https://mangadex.org',
    favicon: 'https://mangadex.org/favicon.ico',
  },
  mal: {
    color: '#2e51a2',
    description: 'MyAnimeList metadata only (no downloads).',
    url: 'https://myanimelist.net',
    favicon: 'https://myanimelist.net/favicon.ico',
  },
};

// Sources with downloadable chapters, in the order the Discover picker shows
// them. The loader finds add-ons alphabetically; this keeps the established
// order, with anything new (installed add-ons) appended after it.
const SOURCE_ORDER = ['mangadex', 'mangafox', 'mangatown', 'rawkuma', 'readallcomics', 'readcomicsonline', 'archiveorg'];
const primarySources: MangaSource[] = [mangadexSource];
const meta = new Map<string, SourceMeta>(Object.entries(builtinMeta));

/**
 * Register add-on sources. Called once at startup, before the server listens,
 * so every request sees the full list.
 */
export async function initSources(): Promise<void> {
  for (const addon of await loadAddons()) {
    if (!addon.source) continue;
    if (primarySources.some((s) => s.id === addon.source!.id)) {
      console.warn(`  add-on ${addon.manifest.id} shadows a built-in source — skipped`);
      continue;
    }
    primarySources.push(addon.source);
    meta.set(addon.source.id, addon.manifest);
  }
  const rank = (id: string) => { const i = SOURCE_ORDER.indexOf(id); return i < 0 ? SOURCE_ORDER.length : i; };
  primarySources.sort((x, y) => rank(x.id) - rank(y.id));
}

// All sources including metadata-only (MAL)
function allSources(): MangaSource[] {
  return [...primarySources, malSource];
}

export function getSource(id: string): MangaSource | undefined {
  return allSources().find((s) => s.id === id);
}

export function getAllSources(): { id: string; name: string; color: string; description: string; url: string; favicon: string }[] {
  return allSources().map((s) => ({
    id: s.id,
    name: s.name,
    color: meta.get(s.id)?.color || '#64748b',
    description: meta.get(s.id)?.description || '',
    url: meta.get(s.id)?.url || '',
    favicon: meta.get(s.id)?.favicon || '',
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

export type { MangaSource, SearchResult, ChapterResult } from '@bindery/addon-api';
