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
  /** Publication date of the work (used for the year suffix). */
  date?: string | null;
  /** When the upload went public on archive.org (used to order unnumbered uploads). */
  publicdate?: string | null;
  addeddate?: string | null;
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
/** A subtitle that opens with a book marker: "Series - Book 1". "Part N of ..." is deliberately excluded. */
const SUBTITLE_MARKER = /^\s*(?:book|volume|vol\.?|#)\s*(\d+)\b/i;
/** Chapter numbers for uploads with no book number, so new books 1..999 never collide with them. */
export const UNNUMBERED_BASE = 1000;
/** The first subtitle separator: a colon or a spaced dash. */
const SUBTITLE_SPLIT = /^(.*?)(?::| - | – | — )(.*)$/;
const TRAILING_PUNCT = /[\s.,:;\-–—]+$/;

export function creatorString(creator: ArchiveDoc['creator']): string | null {
  if (Array.isArray(creator)) return creator.length ? creator.join(', ') : null;
  return creator ? String(creator) : null;
}

/**
 * Lowercase letters/digits/spaces only, single-spaced, leading "the" dropped.
 * Apostrophes are removed ("don't" -> "dont"); other punctuation becomes a
 * space so "Catch-22" stays searchable as "catch 22". Idempotent.
 */
export function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
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
  const original = title.trim();
  let rest = stripTrailingCreator(original, creator ?? null);
  let bookNumber: number | null = null;

  const bracketed = BRACKETED_MARKER.exec(rest);
  if (bracketed) {
    bookNumber = parseInt(bracketed[1], 10);
    rest = rest.slice(0, bracketed.index) + rest.slice(bracketed.index + bracketed[0].length);
  }

  let subtitle = '';
  const split = SUBTITLE_SPLIT.exec(rest);
  if (split && split[1].trim()) {
    rest = split[1];
    subtitle = split[2];
    const lead = SUBTITLE_MARKER.exec(subtitle);
    if (lead && bookNumber === null) bookNumber = parseInt(lead[1], 10);
  }

  const inline = INLINE_MARKER.exec(rest);
  if (inline) {
    if (bookNumber === null) bookNumber = parseInt(inline[1], 10);
    rest = rest.slice(0, inline.index);
  }

  const clean = (t: string) => t.trim().replace(TRAILING_PUNCT, '').trim();
  let seriesTitle = clean(rest);
  // "Book 1: The Way of Kings" — the name lives in the subtitle; "Volume 3" — keep the whole title.
  if (!seriesTitle) seriesTitle = clean(subtitle.replace(SUBTITLE_MARKER, '')) || clean(original);
  return { seriesTitle, seriesKey: normalizeKey(seriesTitle), bookNumber };
}

/** The grouping key for a search hit; what `groupBySeries` groups by and what a `series:` id holds. */
export function seriesKeyOf(doc: ArchiveDoc): string {
  return parseBookTitle(doc.title || doc.identifier, doc.creator).seriesKey || normalizeKey(doc.identifier);
}

export function groupBySeries(docs: ArchiveDoc[]): SeriesGroup[] {
  const groups = new Map<string, SeriesGroup>();
  for (const doc of docs) {
    const parsed = parseBookTitle(doc.title || doc.identifier, doc.creator);
    const key = seriesKeyOf(doc);
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

function uploadTime(doc: ArchiveDoc): string | null {
  return doc.publicdate || doc.addeddate || doc.date || null;
}

/**
 * Numbered books first by book number (stable). Unnumbered uploads follow,
 * ordered by archive.org upload time (unknown last, then identifier) and
 * numbered from UNNUMBERED_BASE, so a later upload appends a new number and
 * a newly numbered book never shifts the existing ones. Sync matches by
 * chapter number, so this stability is what keeps it from re-downloading.
 */
export function orderMembers(members: ParsedDoc[]): (ParsedDoc & { chapter: number; chapterTitle: string })[] {
  const numbered = members.filter((m) => m.bookNumber !== null)
    .sort((a, b) => (a.bookNumber as number) - (b.bookNumber as number));
  const unnumbered = members.filter((m) => m.bookNumber === null).sort((a, b) => {
    const ta = uploadTime(a), tb = uploadTime(b);
    if (ta && tb && ta !== tb) return ta < tb ? -1 : 1;
    if (ta && !tb) return -1;
    if (!ta && tb) return 1;
    return a.identifier.localeCompare(b.identifier);
  });
  return [
    ...numbered.map((m) => ({ ...m, chapter: m.bookNumber as number, chapterTitle: chapterTitleFor(m, true) })),
    ...unnumbered.map((m, i) => ({ ...m, chapter: UNNUMBERED_BASE + i, chapterTitle: chapterTitleFor(m, false) })),
  ];
}
