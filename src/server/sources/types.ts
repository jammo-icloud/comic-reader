/**
 * Unified manga source interface.
 * Each source (MangaDex, MangaHub, etc.) implements this.
 */

export interface SearchResult {
  sourceId: string;          // 'mangadex', 'mangahub', etc.
  sourceName: string;        // 'MangaDex', 'MangaHub', etc.
  mangaId: string;           // source-specific ID
  title: string;
  coverUrl: string | null;   // proxied URL
  description: string;
  status: string;            // ongoing, completed, etc.
  year: number | null;
  tags: string[];
}

export interface ChapterResult {
  sourceId: string;
  chapterId: string;
  chapter: string | null;    // "1", "2.5", etc.
  title: string | null;
  pages: number;
  scanlationGroup: string | null;
}

export interface MangaSource {
  id: string;
  name: string;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  getChapters(mangaId: string): Promise<ChapterResult[]>;
  getPageUrls(chapterId: string): Promise<string[]>;
}
