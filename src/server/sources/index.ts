/**
 * Source registry. Every source is an add-on (see src/server/addons/loader.ts).
 * The functions exported here are the only way the rest of the server talks to
 * sources — no file outside this module imports a specific source adapter.
 */
import type { AddonManifest, MangaSource, SearchResult, ChapterResult } from '@bindery/addon-api';
import { loadAddons, getLoadedAddons } from '../addons/loader.js';

const MAX_ORDER = 9999;

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

  const rank = (id: string) => meta.get(id)?.order ?? MAX_ORDER;
  const byRankThenName = (a: MangaSource, b: MangaSource) =>
    rank(a.id) - rank(b.id) || a.name.localeCompare(b.name);
  primarySources.sort(byRankThenName);
  metadataOnlySources.sort(byRankThenName);
}

function allSources(): MangaSource[] {
  return [...primarySources, ...metadataOnlySources];
}

export function getSource(id: string): MangaSource | undefined {
  return allSources().find((s) => s.id === id);
}

export function getAllSources(): { id: string; name: string; color: string; description: string; url: string; favicon: string; metadataOnly: boolean }[] {
  return allSources().map((s) => {
    const m = meta.get(s.id);
    return {
      id: s.id,
      name: s.name,
      color: m?.color || '#64748b',
      description: m?.description || '',
      url: m?.url || '',
      favicon: m?.favicon || '',
      metadataOnly: !!m?.metadataOnly,
    };
  });
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

/**
 * Resolve the URL for a manga on its source website.
 */
export async function getMangaUrl(sourceId: string, mangaId: string): Promise<string | null> {
  const source = getSource(sourceId);
  if (!source?.getMangaUrl) return null;
  return source.getMangaUrl(mangaId);
}

export type { MangaSource, SearchResult, ChapterResult } from '@bindery/addon-api';
