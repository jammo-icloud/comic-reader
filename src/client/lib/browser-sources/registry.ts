import type { SearchResult, ChapterResult } from '../types';
import type { SourceConfig, SourceTier } from './types';

// Working server-side sources
export const ALL_SOURCES: SourceConfig[] = [
  { id: 'mangadex', name: 'MangaDex', color: 'bg-orange-600', tier: 'fast', type: 'server',
    url: 'https://mangadex.org', favicon: 'https://mangadex.org/favicon.ico',
    description: 'Community-driven scanlations. Largest free manga library.' },
  { id: 'mangafox', name: 'MangaFox', color: 'bg-emerald-600', tier: 'fast', type: 'server',
    url: 'https://fanfox.net', favicon: 'https://fanfox.net/favicon.ico',
    description: 'Long-running manga site. Fast chapter updates.' },
];

// Sites known to work in HakuNeko (for reference/linking)
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

export function getSourcesByTier(tier: SourceTier): SourceConfig[] {
  return ALL_SOURCES.filter((s) => s.tier === tier);
}

export function getSourceConfig(id: string): SourceConfig | undefined {
  return ALL_SOURCES.find((s) => s.id === id);
}

// Browser sources removed — all search is server-side now
export async function searchBrowserSources(): Promise<SearchResult[]> {
  return [];
}

export async function getBrowserChapters(): Promise<ChapterResult[]> {
  return [];
}
