/**
 * Source registry. Every source is an add-on (see src/server/addons/loader.ts).
 * The functions exported here are the only way the rest of the server talks to
 * sources — no file outside this module imports a specific source adapter.
 */
import type { AddonManifest, MangaSource, SearchResult, ChapterResult } from '@bindery/addon-api';
import { loadAddons, getLoadedAddons } from '../addons/loader.js';

// Pill display order in the Discover picker. Anything not listed sorts after.
const SOURCE_ORDER = ['mangadex', 'mangafox', 'mangatown', 'rawkuma', 'readallcomics', 'readcomicsonline', 'archiveorg', 'elftoon', 'omegascans', 'mal'];

const primarySources: MangaSource[] = [];
const metadataOnlySources: MangaSource[] = [];
const meta = new Map<string, AddonManifest>();

// CDN hostname → Referer URL, built from every addon's hosts[] + url.
const cdnRefererMap = new Map<string, string>();

/**
 * Register add-on sources. Called at startup before the server listens, and
 * again from the admin Add-ons page after an install or removal.
 */
export async function initSources(): Promise<void> {
  primarySources.length = 0;
  metadataOnlySources.length = 0;
  meta.clear();
  cdnRefererMap.clear();

  for (const addon of await loadAddons()) {
    if (!addon.source) continue;
    if (primarySources.some((s) => s.id === addon.source!.id) || metadataOnlySources.some((s) => s.id === addon.source!.id)) {
      console.warn(`  add-on ${addon.manifest.id} shadows an existing source — skipped`);
      continue;
    }
    meta.set(addon.source.id, addon.manifest);
    if (addon.manifest.metadataOnly) {
      metadataOnlySources.push(addon.source);
    } else {
      primarySources.push(addon.source);
    }
    // Build CDN referer map from hosts[] → url
    const referer = addon.manifest.url ? addon.manifest.url.replace(/\/?$/, '/') : '';
    for (const host of addon.manifest.hosts || []) {
      if (referer) cdnRefererMap.set(host, referer);
    }
  }

  const rank = (id: string) => { const i = SOURCE_ORDER.indexOf(id); return i < 0 ? SOURCE_ORDER.length : i; };
  primarySources.sort((x, y) => rank(x.id) - rank(y.id));
  metadataOnlySources.sort((x, y) => rank(x.id) - rank(y.id));
}

function allSources(): MangaSource[] {
  return [...primarySources, ...metadataOnlySources];
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
 * Search primary sources first. If zero results, fallback to metadata-only sources.
 */
export async function searchAllSources(query: string, limit = 20): Promise<SearchResult[]> {
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

  // If no results from primary sources, try metadata-only sources as fallback
  if (allResults.length === 0 && metadataOnlySources.length > 0) {
    console.log(`  No results from primary sources, trying metadata-only sources...`);
    for (const s of metadataOnlySources) {
      try {
        const fallbackResults = await withTimeout(
          s.search(query, limit),
          10000,
          [] as SearchResult[],
        );
        allResults.push(...fallbackResults);
      } catch {}
    }
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

// ---------------------------------------------------------------------------
// Cross-cutting helpers — derived from loaded addon manifests
// ---------------------------------------------------------------------------

/**
 * Look up a CDN Referer for a hostname. Matches partial hostnames (e.g.
 * "mfcdn.net" matches "fmcdn.mfcdn.net"). Returns empty string if no match.
 */
export function getCdnReferer(hostname: string): string {
  // Direct match first
  const direct = cdnRefererMap.get(hostname);
  if (direct) return direct;
  // Partial match (e.g. hostname "fmcdn.mfcdn.net" contains "mfcdn.net")
  for (const [cdn, ref] of cdnRefererMap) {
    if (hostname.includes(cdn)) return ref;
  }
  return '';
}

/**
 * Get the source's homepage URL (used as a fallback Referer).
 */
export function getSourceHome(sourceId: string): string {
  const manifest = meta.get(sourceId);
  return manifest?.url ? manifest.url.replace(/\/?$/, '/') : '';
}

/**
 * Auto-tags for a source, from its addon manifest.
 */
export function getSourceTags(sourceId: string): string[] {
  return meta.get(sourceId)?.tags || [];
}

export type { MangaSource, SearchResult, ChapterResult } from '@bindery/addon-api';
