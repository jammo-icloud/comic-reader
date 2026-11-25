/**
 * Decide which library series a download, import or search result belongs to.
 *
 * Pure: takes the series list, returns the match (or a free id). Rules, in order:
 *   1. Subscription: a series whose syncSource is this exact sourceId + mangaId
 *      (only when mangaId is non-empty). Wins regardless of type.
 *   2. Title within type: a series of the same type whose id is the title's slug,
 *      or whose name / englishTitle equals the title case-insensitively.
 *   3. No match: a new id — the slug if no series of any type owns it, else
 *      `${slug}-${type}`, else `${slug}-${type}-2`, `-3`, … until free.
 */
import { slugify, type SeriesRecord, type SeriesType } from './data.js';

export interface ResolveInput {
  title: string;
  sourceId: string;
  mangaId?: string | null;
  type: SeriesType;
}

export interface Resolved {
  existing: SeriesRecord | null;
  id: string;
}

export function resolveTargetSeries(all: SeriesRecord[], input: ResolveInput): Resolved {
  const { title, sourceId, mangaId, type } = input;

  if (mangaId) {
    const subscribed = all.find(
      (s) => s.syncSource?.sourceId === sourceId && s.syncSource?.mangaId === mangaId,
    );
    if (subscribed) return { existing: subscribed, id: subscribed.id };
  }

  const slug = slugify(title);
  const lowerTitle = title.toLowerCase();
  const sameType = all.filter((s) => s.type === type);
  const byTitle =
    sameType.find((s) => s.id === slug) ||
    sameType.find(
      (s) => s.name.toLowerCase() === lowerTitle || s.englishTitle?.toLowerCase() === lowerTitle,
    );
  if (byTitle) return { existing: byTitle, id: byTitle.id };

  const taken = new Set(all.map((s) => s.id));
  if (!taken.has(slug)) return { existing: null, id: slug };
  const typed = `${slug}-${type}`;
  if (!taken.has(typed)) return { existing: null, id: typed };
  let n = 2;
  while (taken.has(`${typed}-${n}`)) n++;
  return { existing: null, id: `${typed}-${n}` };
}
