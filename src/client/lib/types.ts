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
  placeholder: string;
  // Stats (from API)
  count: number;
  readCount: number;
  inProgress: number;
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
}

// --- Pending Import ---

export interface MalMatch {
  malId: number;
  title: string;
  score: number;
  synopsis: string;
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
}

// --- MangaDex ---

export interface MangaDexManga {
  id: string;
  title: string;
  altTitles: string[];
  description: string;
  status: string;
  year: number | null;
  coverUrl: string | null;
  tags: string[];
  contentRating: string;
}

export interface MangaDexChapter {
  id: string;
  chapter: string | null;
  volume: string | null;
  title: string | null;
  pages: number;
  scanlationGroup: string | null;
  publishedAt: string;
}
