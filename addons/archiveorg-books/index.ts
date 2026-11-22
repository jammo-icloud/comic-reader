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
  seriesKeyOf,
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

/** Lucene special characters; user input is a bag of words, not query syntax. */
function luceneWords(phrase: string): string {
  return phrase.replace(/[+\-&|!(){}\[\]^"~*?:\\\/]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Title-only matching, most-downloaded first. Full-text matching with the
 * same sort surfaced magazines and unrelated books above the novel for
 * one-word titles ("Emma", "Dune"). Lending-library items are excluded:
 * they have no downloadable original.
 */
async function searchDocs(phrase: string, rows: number): Promise<ArchiveDoc[]> {
  const words = luceneWords(phrase);
  if (!words) return [];
  const q = `title:(${words}) AND mediatype:texts AND NOT (${COMIC_SCOPE}) AND NOT collection:inlibrary`;
  const url = `${API}/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=publicdate&fl[]=description&fl[]=language&sort[]=downloads+desc&rows=${rows}&output=json`;
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

/**
 * Best downloadable file of an item, or null when it has none. A failed
 * metadata fetch throws rather than reading as "no file": chapter numbers of
 * unnumbered uploads depend on which members exist, so a transient error must
 * abort the listing, not silently drop a member.
 */
async function bestFileFor(identifier: string): Promise<ArchiveFile | null> {
  const meta = await fetchJson(`${API}/metadata/${identifier}`);
  return bestFile(meta?.files || []);
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
 * Turn series members into chapters. Numbering happens first, over every
 * member, so an item with nothing to download leaves a gap instead of
 * shifting the numbers after it. Then members without a file are dropped and,
 * when two uploads share a book number, the higher-scoring file wins (ties:
 * first seen). Exported for tests.
 */
export function pickChapters(entries: MemberFile[]): (ParsedDoc & { chapter: number; chapterTitle: string; file: ArchiveFile })[] {
  const fileById = new Map(entries.map((e) => [e.doc.identifier, e.file]));
  const kept = new Map<number, ParsedDoc & { chapter: number; chapterTitle: string; file: ArchiveFile; score: number }>();
  for (const m of orderMembers(entries.map((e) => e.doc))) {
    const file = fileById.get(m.identifier);
    if (!file) continue;
    const score = scoreFile(file);
    const existing = kept.get(m.chapter);
    if (!existing || existing.score < score) kept.set(m.chapter, { ...m, file, score });
  }
  return [...kept.values()].sort((a, b) => a.chapter - b.chapter).map(({ score: _score, ...m }) => m);
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
    const docs = (await searchDocs(key, 100)).filter((d) => seriesKeyOf(d) === key);
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
