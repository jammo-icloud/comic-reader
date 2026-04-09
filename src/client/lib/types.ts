export interface Comic {
  path: string;
  title: string;
  series: string;
  seriesOrder: number;
  pageCount: number;
  fileSize: number;
  currentPage: number;
  isRead: boolean;
  lastReadAt: string | null;
  addedAt: string;
  shelfId: string;
}

export interface Shelf {
  id: string;
  name: string;
  path: string;
  placeholder: string;
}

// MangaDex types
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

export interface Series {
  name: string;
  count: number;
  readCount: number;
  latestReadAt: string | null;
  malTitle: string | null;
  score: number | null;
  synopsis: string | null;
  hasCover: boolean;
  // MangaDex metadata
  year: number | null;
  tags: string[] | null;
  status: string | null;
  mangaDexId: string | null;
  source: 'mangadex' | 'mal' | null;
  placeholder: string;
}
