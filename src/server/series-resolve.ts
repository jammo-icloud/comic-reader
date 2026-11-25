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

// --- Download jobs ---

export interface JobTargetInput extends ResolveInput {
  /** Series the user acted on when queueing (sync, retry, download into a known series). */
  targetSeriesId?: string | null;
}

export interface JobTarget extends Resolved {
  /** Type to download into: the existing series' type, else the source's. */
  type: SeriesType;
  /** True when targetSeriesId was given but no series has that id any more. */
  fellBack: boolean;
}

/**
 * Where a download job writes. An explicit targetSeriesId wins outright — the
 * caller already knew the series, so re-deriving it from the title would only
 * lose (a series moved to Books is invisible to a comic-type title lookup).
 * Without one, or when that id has since been deleted, fall back to
 * resolveTargetSeries.
 */
export function resolveJobTarget(all: SeriesRecord[], input: JobTargetInput): JobTarget {
  const { targetSeriesId, ...resolveInput } = input;
  if (targetSeriesId) {
    const target = all.find((s) => s.id === targetSeriesId);
    if (target) return { existing: target, id: target.id, type: target.type, fellBack: false };
  }
  const resolved = resolveTargetSeries(all, resolveInput);
  return {
    ...resolved,
    type: resolved.existing ? resolved.existing.type : input.type,
    fellBack: Boolean(targetSeriesId),
  };
}

/** The slice of a DownloadJob the guard predicate needs. */
export interface ActiveJobLike {
  status: 'queued' | 'downloading' | 'complete' | 'error';
  mangaDexId: string;
  mangaTitle: string;
  targetSeriesId?: string;
  metadata?: { sourceId?: string };
}

/**
 * The queued or downloading job (if any) that will write into `series`.
 * Used to refuse a type move while a download is in flight — processQueue
 * fixes the series dir once per job, so moving the folder under it would
 * strand the remaining chapters in the old type dir.
 *
 * Jobs carrying targetSeriesId match on it alone. Legacy jobs (queued before
 * the field existed) match the way the downloader would resolve them: by
 * syncSource, then by title slug.
 */
export function findActiveJobForSeries<T extends ActiveJobLike>(tasks: T[], series: SeriesRecord): T | undefined {
  return tasks.find((t) => {
    if (t.status !== 'queued' && t.status !== 'downloading') return false;
    if (t.targetSeriesId) return t.targetSeriesId === series.id;
    const sync = series.syncSource;
    if (sync && t.mangaDexId && sync.mangaId === t.mangaDexId && sync.sourceId === (t.metadata?.sourceId || '')) {
      return true;
    }
    if (t.mangaTitle === '') return false;
    const lower = t.mangaTitle.toLowerCase();
    return (
      slugify(t.mangaTitle) === series.id ||
      series.name.toLowerCase() === lower ||
      series.englishTitle?.toLowerCase() === lower
    );
  });
}

export interface EnqueueKey {
  targetSeriesId?: string | null;
  mangaDexId: string;
  username: string;
  sourceId: string;
}

/**
 * Do two enqueues address the same (series + source + user)? When both sides
 * name a target series, that decides; otherwise the source's manga id does.
 */
export function sameEnqueueTarget(a: EnqueueKey, b: EnqueueKey): boolean {
  if (a.username !== b.username || a.sourceId !== b.sourceId) return false;
  if (a.targetSeriesId && b.targetSeriesId) return a.targetSeriesId === b.targetSeriesId;
  return a.mangaDexId === b.mangaDexId;
}
