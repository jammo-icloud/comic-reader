import type { SearchResult as BaseSearchResult, ChapterResult } from '@bindery/addon-api';

export type { ChapterResult } from '@bindery/addon-api';

export interface DiscoverSourceConfig {
  id: string;
  name: string;
  color: string;
  url: string;
  favicon: string;
  description: string;
}

export type DiscoverSearchResult = BaseSearchResult & {
  localSeriesId?: string | null;
  inCollection?: boolean;
};

export interface ChapterDownloadItem {
  id: string;
  chapter: string | null;
  pages: number;
}

export interface MangaDetailSheetProps {
  manga: DiscoverSearchResult;
  chapters: ChapterResult[];
  loading: boolean;
  localChapterNums: Set<string>;
  sourceConfig: { color: string; name: string } | null;
  sourceUrl: string | null;
  onClose: () => void;
  onDownload: (chapters: ChapterDownloadItem[]) => Promise<void>;
}

export interface MangaSearchCardProps {
  manga: DiscoverSearchResult;
  sourceConfig: { color: string; name: string } | null;
  onClick: () => void;
}
