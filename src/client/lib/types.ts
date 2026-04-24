// --- Series ---

export interface Series {
  id: string;
  type: 'comic' | 'magazine';
  name: string;
  coverFile: string | null;
  score: number | null;
  synopsis: string | null;
  tags: string[];
  status: string | null;
  year: number | null;
  malId: number | null;
  mangaDexId: string | null;
  englishTitle: string | null;
  placeholder: string;
  // Stats (from API)
  count: number;
  readCount: number;
  inProgress: number;
  inCollection: boolean;
}

// --- Comic (within a series) ---

export interface Comic {
  file: string;
  pages: number;
  currentPage: number;
  isRead: boolean;
  order: number;
  lastReadAt: string | null;
  thumbHash: string;
}

// --- Continue Reading ---

export interface ContinueReadingItem {
  seriesId: string;
  seriesName: string;
  file: string;
  currentPage: number;
  pages: number;
  lastReadAt: string;
  thumbHash: string;
  coverFile: string | null;
}

// --- Pending Import ---

export interface MalMatch {
  malId: number;
  title: string;
  englishTitle: string | null;
  score: number | null;
  synopsis: string | null;
  imageUrl: string;
  year: number | null;
  status: string;
}

export interface PendingImport {
  sourceFolder: string;
  folderName: string;
  suggestedType: 'comic' | 'magazine';
  fileCount: number;
  files: string[];
  malMatch: MalMatch | null;
  status: 'queued' | 'scanning' | 'ready' | 'confirmed' | 'skipped' | 'error';
  existingSeriesId: string | null;
}

// --- Discover (unified across sources) ---

export interface SearchResult {
  sourceId: string;
  sourceName: string;
  mangaId: string;
  title: string;
  coverUrl: string | null;
  description: string;
  status: string;
  year: number | null;
  tags: string[];
  localSeriesId: string | null;
  inCollection: boolean;
}

export interface ChapterResult {
  sourceId: string;
  chapterId: string;
  chapter: string | null;
  title: string | null;
  pages: number;
  scanlationGroup: string | null;
}

// Legacy alias for components that still use the old name
export type MangaDexManga = SearchResult;
export type MangaDexChapter = ChapterResult;
