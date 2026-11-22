/**
 * Internet Archive Books connector.
 *
 * Searches archive.org text items outside the comic/manga collections the
 * `archiveorg` addon covers, and groups uploads into book series:
 * - One search result = one series (grouped by normalised title, see series.ts)
 * - One chapter = one book (one archive.org item, its best PDF/EPUB/CBZ/CBR)
 * - mangaId is `series:<series key>`; opening it re-runs the search so a newly
 *   uploaded book shows up on sync without storing member ids anywhere.
 *
 * Download path is the same as the comics addon: getPageUrls returns a single
 * file URL and the downloader saves or converts the file directly.
 */
import { createFetch, type MangaSource, type SearchResult, type ChapterResult } from '@bindery/addon-api';
import { bestFile, scoreFile, type ArchiveFile } from '../archiveorg/files.js';
import {
  groupBySeries,
  orderMembers,
  parseBookTitle,
  creatorString,
  type ArchiveDoc,
  type ParsedDoc,
  type SeriesGroup,
} from './series.js';

const API = 'https://archive.org';
const SOURCE_ID = 'archiveorg-books';
const SOURCE_NAME = 'Internet Archive Books';
const SERIES_PREFIX = 'series:';

const get = createFetch({ rateLimitMs: 300, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });

async function fetchJson(url: string): Promise<any> {
  const res = await get(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Archive.org fetch failed: ${res.status}`);
  return res.json();
}

/** The comics addon's scope; books are everything in `texts` outside it. */
const COMIC_SCOPE = [
  'collection:comics',
  'collection:manga_library',
  'collection:manga_novels',
  'collection:manga_japanese',
  'collection:manga_chinese',
  'collection:manga_korean',
  'subject:manga',
  'subject:comics',
  'subject:doujinshi',
  'subject:comic',
].join(' OR ');

async function searchDocs(phrase: string, rows: number): Promise<ArchiveDoc[]> {
  const clean = phrase.trim().replace(/"/g, '');
  const q = `(title:"${clean}"^5 OR "${clean}"^3 OR (${clean})) AND mediatype:texts AND NOT (${COMIC_SCOPE})`;
  const url = `${API}/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=description&fl[]=language&sort[]=downloads+desc&rows=${rows}&output=json`;
  try {
    const data = await fetchJson(url);
    return data?.response?.docs || [];
  } catch (err) {
    console.error(`Archive.org books search failed: ${(err as Error).message}`);
    return [];
  }
}

function asList(v: string | string[] | null | undefined): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

function cleanDescription(desc: string | string[] | null | undefined): string {
  const text = asList(desc).map((d) => String(d).replace(/<[^>]+>/g, '').trim()).sort((a, b) => b.length - a.length)[0];
  return text ? text.slice(0, 400) : '';
}

function languageTags(langs: string[]): string[] {
  const l = langs.map((x) => String(x).toLowerCase());
  const tags: string[] = [];
  if (l.some((x) => /^jpn|japanese$/.test(x))) tags.push('japanese');
  if (l.some((x) => /^kor|korean$/.test(x))) tags.push('korean');
  if (l.some((x) => /^eng|english$/.test(x))) tags.push('english');
  return tags;
}

/** One search result for a whole series group. Exported for tests. */
export function groupToResult(group: SeriesGroup): SearchResult {
  const years = group.members
    .map((m) => (m.date ? parseInt(String(m.date).slice(0, 4), 10) : NaN))
    .filter((y) => y >= 1900 && y <= 2100);
  const longest = group.members
    .map((m) => cleanDescription(m.description))
    .sort((a, b) => b.length - a.length)[0] || '';
  const tags = new Set<string>();
  for (const m of group.members) for (const t of languageTags(asList(m.language))) tags.add(t);
  return {
    sourceId: SOURCE_ID,
    sourceName: SOURCE_NAME,
    mangaId: SERIES_PREFIX + group.seriesKey,
    title: group.seriesTitle,
    coverUrl: `${API}/services/img/${group.members[0].identifier}`,
    description: longest,
    status: 'completed',
    year: years.length ? Math.min(...years) : null,
    tags: [...tags],
  };
}

async function bestFileFor(identifier: string): Promise<ArchiveFile | null> {
  try {
    const meta = await fetchJson(`${API}/metadata/${identifier}`);
    return bestFile(meta?.files || []);
  } catch (err) {
    console.error(`Archive.org metadata failed for ${identifier}: ${(err as Error).message}`);
    return null;
  }
}

function toChapter(identifier: string, file: ArchiveFile, chapter: number, title: string, creator: ArchiveDoc['creator']): ChapterResult {
  return {
    sourceId: SOURCE_ID,
    chapterId: `${identifier}|${file.name}`,
    chapter: String(chapter),
    title,
    pages: 0,
    scanlationGroup: creatorString(creator),
  };
}

export interface MemberFile {
  doc: ParsedDoc;
  /** Best downloadable original, or null when the item has none. */
  file: ArchiveFile | null;
}

/**
 * Turn series members into chapters: drop members with nothing to download,
 * keep the higher-scoring upload when two share a book number (ties: first
 * seen), then number what is left so chapter numbers stay contiguous.
 * Exported for tests.
 */
export function pickChapters(entries: MemberFile[]): (ParsedDoc & { chapter: number; chapterTitle: string; file: ArchiveFile })[] {
  const kept = new Map<string, { doc: ParsedDoc; file: ArchiveFile; score: number }>();
  for (const { doc, file } of entries) {
    if (!file) continue;
    const score = scoreFile(file);
    const key = doc.bookNumber === null ? `id:${doc.identifier}` : `n:${doc.bookNumber}`;
    const existing = kept.get(key);
    if (!existing || existing.score < score) kept.set(key, { doc, file, score });
  }
  const fileById = new Map([...kept.values()].map((e) => [e.doc.identifier, e.file]));
  return orderMembers([...kept.values()].map((e) => e.doc)).map((m) => ({ ...m, file: fileById.get(m.identifier)! }));
}

export const archiveorgBooksSource: MangaSource = {
  id: SOURCE_ID,
  name: SOURCE_NAME,

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const docs = await searchDocs(query, Math.min(limit * 3, 100));
    return groupBySeries(docs).slice(0, limit).map(groupToResult);
  },

  async getChapters(mangaId: string): Promise<ChapterResult[]> {
    if (!mangaId.startsWith(SERIES_PREFIX)) {
      // A bare item identifier: one book, one chapter.
      const file = await bestFileFor(mangaId);
      return file ? [toChapter(mangaId, file, 1, file.name.replace(/\.[^.]+$/, ''), null)] : [];
    }

    const key = mangaId.slice(SERIES_PREFIX.length);
    const docs = (await searchDocs(key, 100)).filter((d) => parseBookTitle(d.title || d.identifier, d.creator).seriesKey === key);
    const members = groupBySeries(docs)[0]?.members ?? [];

    const entries: MemberFile[] = [];
    for (const doc of members) entries.push({ doc, file: await bestFileFor(doc.identifier) });
    return pickChapters(entries).map((m) => toChapter(m.identifier, m.file, m.chapter, m.chapterTitle, m.creator));
  },

  async getPageUrls(chapterId: string): Promise<string[]> {
    const pipe = chapterId.indexOf('|');
    if (pipe < 0) return [];
    const identifier = chapterId.slice(0, pipe);
    const filename = chapterId.slice(pipe + 1);
    return [`${API}/download/${identifier}/${encodeURIComponent(filename)}`];
  },

  getMangaUrl(mangaId: string) {
    if (mangaId.startsWith(SERIES_PREFIX)) {
      const key = mangaId.slice(SERIES_PREFIX.length);
      return `${API}/search?query=${encodeURIComponent(key)}&and[]=mediatype%3A%22texts%22`;
    }
    return `${API}/details/${mangaId}`;
  },
};

export default archiveorgBooksSource;
