/**
 * Series grouping for Internet Archive book uploads.
 *
 * Archive.org has no series concept: every upload is its own item, so the
 * seven books of a series arrive as seven search hits. These pure helpers
 * reduce an item title to a series key ("Dungeon Crawler Carl. Book 7. This
 * Inevitable Ruin" -> "dungeon crawler carl", book 7), group items by that
 * key and assign chapter numbers. No network, no addon-api dependency, so
 * the behaviour is unit-tested against real archive.org titles.
 */

export interface ArchiveDoc {
  identifier: string;
  title: string;
  creator?: string | string[] | null;
  date?: string | null;
  description?: string | string[] | null;
  language?: string | string[] | null;
}

export interface ParsedTitle {
  seriesTitle: string;
  seriesKey: string;
  bookNumber: number | null;
}

export type ParsedDoc = ArchiveDoc & ParsedTitle;

export interface SeriesGroup {
  seriesKey: string;
  seriesTitle: string;
  members: ParsedDoc[];
}

const MARKER_WORDS = '(?:book|volume|vol\\.?|part|no\\.?)';
/** "(Book 1)", "[Vol. 3]", "(#2)" — anywhere in the title. */
const BRACKETED_MARKER = new RegExp(`\\s*[(\\[](?:${MARKER_WORDS}\\s*|#)(\\d+)[^)\\]]*[)\\]]`, 'i');
/** "Book 7", "Vol. 2", "#4" — unbracketed, after the subtitle split. */
const INLINE_MARKER = new RegExp(`(?:\\b${MARKER_WORDS}\\s*|#)(\\d+)\\b`, 'i');
/** A trailing bare number such as "Series 2" or "Series 02." */
const TRAILING_NUMBER = /\s(\d{1,3})\.?\s*$/;
/** The first subtitle separator: a colon or a spaced dash. */
const SUBTITLE_SPLIT = /^(.*?)(?::| - | – | — )(.*)$/;
const TRAILING_PUNCT = /[\s.,:;\-–—]+$/;

export function creatorString(creator: ArchiveDoc['creator']): string | null {
  if (Array.isArray(creator)) return creator.length ? creator.join(', ') : null;
  return creator ? String(creator) : null;
}

/** Lowercase letters/digits/spaces only, single-spaced, leading "the" dropped. Idempotent. */
export function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/, '');
}

function stripTrailingCreator(title: string, creator: ArchiveDoc['creator']): string {
  const names = Array.isArray(creator) ? creator : creator ? [creator] : [];
  for (const name of names) {
    const n = String(name).trim();
    if (!n) continue;
    const lower = title.toLowerCase();
    const idx = lower.lastIndexOf(n.toLowerCase());
    if (idx > 0 && idx + n.length === lower.trimEnd().length) {
      const before = title.slice(0, idx).replace(/(?:\s+-\s*|\s+by\s+|,\s*|\s+)$/i, '');
      if (before.trim()) return before;
    }
  }
  return title;
}

export function parseBookTitle(title: string, creator?: string | string[] | null): ParsedTitle {
  let rest = stripTrailingCreator(title.trim(), creator ?? null);
  let bookNumber: number | null = null;

  const bracketed = BRACKETED_MARKER.exec(rest);
  if (bracketed) {
    bookNumber = parseInt(bracketed[1], 10);
    rest = rest.slice(0, bracketed.index) + rest.slice(bracketed.index + bracketed[0].length);
  }

  const split = SUBTITLE_SPLIT.exec(rest);
  if (split && split[1].trim()) rest = split[1];

  const inline = INLINE_MARKER.exec(rest);
  if (inline) {
    if (bookNumber === null) bookNumber = parseInt(inline[1], 10);
    rest = rest.slice(0, inline.index);
  } else {
    const trailing = TRAILING_NUMBER.exec(rest);
    if (trailing) {
      if (bookNumber === null) bookNumber = parseInt(trailing[1], 10);
      rest = rest.slice(0, trailing.index);
    }
  }

  const seriesTitle = rest.trim().replace(TRAILING_PUNCT, '').trim();
  return { seriesTitle, seriesKey: normalizeKey(seriesTitle), bookNumber };
}

export function groupBySeries(docs: ArchiveDoc[]): SeriesGroup[] {
  const groups = new Map<string, SeriesGroup>();
  for (const doc of docs) {
    const parsed = parseBookTitle(doc.title || doc.identifier, doc.creator);
    const key = parsed.seriesKey || normalizeKey(doc.identifier);
    let group = groups.get(key);
    if (!group) {
      group = { seriesKey: key, seriesTitle: parsed.seriesTitle || doc.title, members: [] };
      groups.set(key, group);
    }
    group.members.push({ ...doc, ...parsed });
  }
  return [...groups.values()];
}

function yearOf(date: string | null | undefined): number | null {
  const m = date ? /^(\d{4})/.exec(date) : null;
  return m ? parseInt(m[1], 10) : null;
}

function chapterTitleFor(doc: ParsedDoc, numbered: boolean): string {
  const base = doc.title.trim().replace(/[\s.,:;]+$/, '');
  const year = numbered ? null : yearOf(doc.date);
  return year ? `${base} (${year})` : base;
}

/**
 * Numbered books first by book number (stable), then unnumbered uploads by
 * date (unknown dates last, then identifier) numbered after the highest book.
 */
export function orderMembers(members: ParsedDoc[]): (ParsedDoc & { chapter: number; chapterTitle: string })[] {
  const numbered = members.filter((m) => m.bookNumber !== null)
    .sort((a, b) => (a.bookNumber as number) - (b.bookNumber as number));
  const unnumbered = members.filter((m) => m.bookNumber === null).sort((a, b) => {
    if (a.date && b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : a.identifier.localeCompare(b.identifier);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.identifier.localeCompare(b.identifier);
  });
  let next = numbered.length ? Math.max(...numbered.map((m) => m.bookNumber as number)) + 1 : 1;
  return [
    ...numbered.map((m) => ({ ...m, chapter: m.bookNumber as number, chapterTitle: chapterTitleFor(m, true) })),
    ...unnumbered.map((m) => ({ ...m, chapter: next++, chapterTitle: chapterTitleFor(m, false) })),
  ];
}
