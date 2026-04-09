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
}
