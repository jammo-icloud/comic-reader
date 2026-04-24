/**
 * Subscription / sync system.
 *
 * For series with a syncSource, periodically fetch the chapter list from
 * the source, diff against local, and queue downloads for any new chapters.
 *
 * The syncSource is auto-populated when a download creates/updates a series,
 * and can be manually assigned via PATCH /api/series/:id/sync-source.
 */
import { loadAllSeries, getSeries, saveSeries, loadComics, type SeriesRecord } from './data.js';
import { getChaptersFromSource } from './sources/index.js';
import { queueDownload } from './downloader.js';

// Default: check every 6 hours
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
// Rate limit: wait between series to avoid hammering sources
const SYNC_DELAY_MS = 3000;

let syncTimer: NodeJS.Timeout | null = null;
let syncInProgress = false;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Normalize a chapter number string for comparison.
 * "Chapter 1" → "1", "001.5" → "1.5", etc.
 */
function normalizeChapter(ch: string | null | undefined): string {
  if (!ch) return '';
  const match = String(ch).match(/\d+(\.\d+)?/);
  return match ? String(parseFloat(match[0])) : '';
}

/**
 * Get set of chapter numbers that exist locally for a series.
 */
function getLocalChapterNumbers(seriesId: string): Set<string> {
  const comics = loadComics(seriesId);
  const nums = new Set<string>();
  for (const c of comics) {
    // Extract chapter number from filename like "chapter-001.pdf" → "1"
    const match = c.file.match(/(\d+(\.\d+)?)/);
    if (match) nums.add(String(parseFloat(match[1])));
  }
  return nums;
}

/**
 * Sync a single series — fetch latest chapter list from source,
 * queue downloads for missing chapters. Returns stats.
 */
export async function syncSeries(seriesId: string, username: string = 'system'): Promise<{
  ok: boolean;
  newChapters: number;
  error?: string;
}> {
  const series = getSeries(seriesId);
  if (!series) return { ok: false, newChapters: 0, error: 'Series not found' };
  if (!series.syncSource) return { ok: false, newChapters: 0, error: 'Series has no sync source' };

  const { sourceId, mangaId } = series.syncSource;

  try {
    // Fetch the full chapter list from the source
    const chapters = await getChaptersFromSource(sourceId, mangaId);
    if (chapters.length === 0) {
      const updated: SeriesRecord = {
        ...series,
        lastSyncAt: new Date().toISOString(),
      };
      saveSeries(updated);
      return { ok: true, newChapters: 0 };
    }

    // Diff against local
    const localNums = getLocalChapterNumbers(seriesId);
    const missing = chapters.filter((ch: any) => {
      const num = normalizeChapter(ch.chapter);
      return num && !localNums.has(num);
    });

    // Queue downloads for missing chapters
    if (missing.length > 0) {
      queueDownload(
        mangaId,
        series.name,
        'default',
        missing.map((ch: any) => ({
          id: ch.chapterId,
          chapter: ch.chapter,
          pages: ch.pages || 0,
        })),
        {
          sourceId,
          tags: series.tags,
          coverUrl: undefined,
        },
        username,
      );
      console.log(`  Sync "${series.name}": ${missing.length} new chapters queued`);
    }

    // Update series metadata — even if no new chapters, record the sync time
    const updated: SeriesRecord = {
      ...series,
      lastSyncAt: new Date().toISOString(),
      newChapterCount: (series.newChapterCount || 0) + missing.length,
    };
    saveSeries(updated);

    return { ok: true, newChapters: missing.length };
  } catch (err) {
    console.error(`  Sync failed for "${series.name}": ${(err as Error).message}`);
    return { ok: false, newChapters: 0, error: (err as Error).message };
  }
}

/**
 * Sync all series that have a syncSource set.
 */
export async function syncAll(): Promise<{ checked: number; updated: number; failed: number }> {
  if (syncInProgress) {
    console.log('Sync already running, skipping');
    return { checked: 0, updated: 0, failed: 0 };
  }
  syncInProgress = true;

  try {
    const all = loadAllSeries();
    const subscribed = all.filter((s) => s.syncSource);

    console.log(`Sync: checking ${subscribed.length} subscribed series...`);

    let checked = 0;
    let updated = 0;
    let failed = 0;

    for (const series of subscribed) {
      await sleep(SYNC_DELAY_MS);
      checked++;
      const result = await syncSeries(series.id);
      if (result.ok) {
        if (result.newChapters > 0) updated++;
      } else {
        failed++;
      }
    }

    console.log(`Sync complete: ${checked} checked, ${updated} with new chapters, ${failed} failed`);
    return { checked, updated, failed };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Start the background sync scheduler. Runs syncAll every SYNC_INTERVAL_MS.
 * Does NOT run immediately — gives the server time to start up.
 */
export function startSyncScheduler(): void {
  if (syncTimer) return;

  // First run: after 10 minutes (let server settle)
  syncTimer = setTimeout(() => {
    syncAll()
      .catch((err) => console.error('Sync failed:', err.message))
      .finally(() => {
        // Schedule recurring
        syncTimer = setInterval(() => {
          syncAll().catch((err) => console.error('Sync failed:', err.message));
        }, SYNC_INTERVAL_MS);
      });
  }, 10 * 60 * 1000);

  console.log(`Sync scheduler started (every ${SYNC_INTERVAL_MS / 1000 / 60 / 60}h)`);
}

/**
 * Clear the "new chapters" badge for a series when the user views it.
 */
export function markSeriesSeen(seriesId: string): void {
  const series = getSeries(seriesId);
  if (!series || !series.newChapterCount) return;
  saveSeries({ ...series, newChapterCount: 0 });
}
