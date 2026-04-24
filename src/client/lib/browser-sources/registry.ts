/**
 * Source registry — backed by the server's /api/discover/sources endpoint.
 * Sources are fetched once per session and cached in memory.
 */
import { useEffect, useState } from 'react';
import type { SourceConfig } from './types';

let cachedSources: SourceConfig[] | null = null;
let inflightPromise: Promise<SourceConfig[]> | null = null;
const listeners = new Set<(sources: SourceConfig[]) => void>();

async function fetchSources(): Promise<SourceConfig[]> {
  if (cachedSources) return cachedSources;
  if (inflightPromise) return inflightPromise;

  inflightPromise = fetch('/api/discover/sources')
    .then((r) => r.json())
    .then((list: any[]) => {
      // Normalize shape — server returns hex colors already
      const sources: SourceConfig[] = list.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        description: s.description || '',
        url: s.url || '',
        favicon: s.favicon || '',
        tier: 'fast',
        type: 'server',
      }));
      cachedSources = sources;
      listeners.forEach((fn) => fn(sources));
      return sources;
    })
    .catch((err) => {
      console.error('Failed to load sources:', err);
      cachedSources = [];
      return [];
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

/**
 * React hook — returns the current list of sources (empty until fetched).
 */
export function useSources(): SourceConfig[] {
  const [sources, setSources] = useState<SourceConfig[]>(cachedSources || []);

  useEffect(() => {
    if (cachedSources) return;
    fetchSources().then(setSources);
    listeners.add(setSources);
    return () => { listeners.delete(setSources); };
  }, []);

  return sources;
}

/**
 * Synchronous lookup — returns null until sources are loaded.
 * Use getSourceConfigAsync when you need to guarantee a result.
 */
export function getSourceConfig(id: string): SourceConfig | undefined {
  if (!cachedSources) {
    // Trigger fetch for next time, but return undefined now
    fetchSources();
    return undefined;
  }
  return cachedSources.find((s) => s.id === id);
}

export async function getSourceConfigAsync(id: string): Promise<SourceConfig | undefined> {
  const sources = await fetchSources();
  return sources.find((s) => s.id === id);
}

// Preload at module import time so the first render has data ready
fetchSources();

// --- HakuNeko reference list (still hardcoded — these are external links, not sources we download from) ---

export const HAKUNEKO_SITES = [
  { name: 'MangaHub', url: 'https://mangahub.io', description: 'Large collection, GraphQL API' },
  { name: 'MangaFire', url: 'https://mangafire.to', description: 'Modern reader, multiple formats' },
  { name: 'MangaFreak', url: 'https://mangafreak.me', description: 'Popular manga downloader' },
  { name: 'MangaDNA', url: 'https://mangadna.com', description: 'WordPress-based library' },
  { name: 'KaliScan', url: 'https://kaliscan.io', description: 'Manhua and manga scans' },
  { name: 'HentaiNexus', url: 'https://hentainexus.com', description: 'Curated adult manga (NSFW)' },
  { name: 'OmegaScans', url: 'https://omegascans.org', description: 'Webtoons and manga (NSFW)' },
];

export const HAKUNEKO_URL = 'https://github.com/manga-download/hakuneko';
