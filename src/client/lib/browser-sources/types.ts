import type { SearchResult, ChapterResult } from '../types';

export type SourceTier = 'fast' | 'slow' | 'nsfw';

export interface BrowserSource {
  id: string;
  name: string;
  color: string;           // Tailwind bg color class
  tier: SourceTier;
  search(query: string): Promise<SearchResult[]>;
  getChapters(mangaId: string): Promise<ChapterResult[]>;
  getPageUrls(chapterId: string): Promise<string[]>;
  fetchImage(url: string): Promise<Blob>;
}

export interface SourceConfig {
  id: string;
  name: string;
  color: string;
  tier: SourceTier;
  type: 'server' | 'browser';
  url: string;
  favicon: string;
  description: string;
}
