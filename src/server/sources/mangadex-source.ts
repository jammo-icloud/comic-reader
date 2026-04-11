import type { MangaSource, SearchResult, ChapterResult } from './types.js';
import { searchManga, getChapterList, getChapterPages, pageImageUrl } from '../mangadex.js';

export const mangadexSource: MangaSource = {
  id: 'mangadex',
  name: 'MangaDex',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const { results } = await searchManga(query, 0, limit);
    return results.map((r) => ({
      sourceId: 'mangadex',
      sourceName: 'MangaDex',
      mangaId: r.id,
      title: r.title,
      coverUrl: r.coverUrl,
      description: r.description,
      status: r.status,
      year: r.year,
      tags: r.tags,
    }));
  },

  async getChapters(mangaId: string): Promise<ChapterResult[]> {
    const chapters = await getChapterList(mangaId);
    return chapters.map((ch) => ({
      sourceId: 'mangadex',
      chapterId: ch.id,
      chapter: ch.chapter,
      title: ch.title,
      pages: ch.pages,
      scanlationGroup: ch.scanlationGroup,
    }));
  },

  async getPageUrls(chapterId: string): Promise<string[]> {
    const { baseUrl, pages, hash } = await getChapterPages(chapterId);
    return pages.map((filename) => pageImageUrl(baseUrl, hash, filename));
  },
};
