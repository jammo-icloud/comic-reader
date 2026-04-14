/**
 * Data cleanup — runs on server startup.
 * Compacts JSONL files, removes stale data, deduplicates entries.
 */
import fs from 'fs';
import path from 'path';
import {
  loadAllSeries, writeAllSeries, loadComics, writeComics,
  loadCollection, loadUserProgress, userDir,
  type SeriesRecord, type ComicRecord, type CollectionEntry, type UserProgressRecord,
} from './data.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';
const USERS_DIR = path.join(DATA_DIR, 'users');

/**
 * Run all cleanup tasks. Called once on server startup.
 */
export function runCleanup() {
  console.log('Running data cleanup...');
  const start = Date.now();

  let cleaned = 0;
  cleaned += compactSeries();
  cleaned += compactComics();
  cleaned += cleanupUsers();

  const elapsed = Date.now() - start;
  if (cleaned > 0) {
    console.log(`  Cleanup complete: ${cleaned} issues fixed (${elapsed}ms)`);
  } else {
    console.log(`  Cleanup: all clean (${elapsed}ms)`);
  }
}

/**
 * Compact series.jsonl — remove duplicates, remove series with no files on disk
 */
function compactSeries(): number {
  const allSeries = loadAllSeries();
  if (allSeries.length === 0) return 0;

  let fixed = 0;

  // Deduplicate by ID (keep last occurrence — most recently updated)
  const byId = new Map<string, SeriesRecord>();
  for (const s of allSeries) {
    if (byId.has(s.id)) fixed++;
    byId.set(s.id, s);
  }

  // Remove series whose folder doesn't exist on disk
  const toRemove: string[] = [];
  for (const [id, series] of byId) {
    const typeDir = series.type === 'comic' ? 'comics' : 'magazines';
    const seriesDir = path.join(LIBRARY_DIR, typeDir, id);
    if (!fs.existsSync(seriesDir)) {
      toRemove.push(id);
      fixed++;
    }
  }
  for (const id of toRemove) {
    byId.delete(id);
    console.log(`  Removed orphan series: ${id}`);
  }

  // Sort alphabetically by name for consistent ordering
  const sorted = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

  if (fixed > 0 || sorted.length !== allSeries.length) {
    writeAllSeries(sorted);
  }

  return fixed;
}

/**
 * Compact comics JSONL files — remove entries for files that don't exist on disk
 */
function compactComics(): number {
  const allSeries = loadAllSeries();
  let fixed = 0;

  for (const series of allSeries) {
    const comics = loadComics(series.id);
    if (comics.length === 0) continue;

    const typeDir = series.type === 'comic' ? 'comics' : 'magazines';
    const seriesDir = path.join(LIBRARY_DIR, typeDir, series.id);

    // Remove comics whose files don't exist
    const valid = comics.filter((c) => {
      const filePath = path.join(seriesDir, c.file);
      if (!fs.existsSync(filePath)) {
        fixed++;
        return false;
      }
      return true;
    });

    // Deduplicate by filename
    const byFile = new Map<string, ComicRecord>();
    for (const c of valid) {
      if (byFile.has(c.file)) fixed++;
      byFile.set(c.file, c);
    }

    const deduped = [...byFile.values()].sort((a, b) => a.order - b.order);

    if (deduped.length !== comics.length) {
      writeComics(series.id, deduped);
    }
  }

  return fixed;
}

/**
 * Cleanup user data — deduplicate collections, remove stale progress
 */
function cleanupUsers(): number {
  if (!fs.existsSync(USERS_DIR)) return 0;
  let fixed = 0;

  const userDirs = fs.readdirSync(USERS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const validSeriesIds = new Set(loadAllSeries().map((s) => s.id));

  for (const username of userDirs) {
    // Deduplicate collection
    const collPath = path.join(USERS_DIR, username, 'collection.jsonl');
    if (fs.existsSync(collPath)) {
      try {
        const lines = fs.readFileSync(collPath, 'utf-8').split('\n').filter(Boolean);
        const entries: CollectionEntry[] = lines.map((l) => JSON.parse(l));

        // Deduplicate by seriesId, remove stale (series no longer exists)
        const seen = new Set<string>();
        const clean = entries.filter((e) => {
          if (seen.has(e.seriesId)) { fixed++; return false; }
          if (!validSeriesIds.has(e.seriesId)) { fixed++; return false; }
          seen.add(e.seriesId);
          return true;
        });

        // Sort alphabetically by seriesId for consistency
        clean.sort((a, b) => a.seriesId.localeCompare(b.seriesId));

        if (clean.length !== entries.length) {
          fs.writeFileSync(collPath, clean.map((e) => JSON.stringify(e)).join('\n') + (clean.length ? '\n' : ''));
        }
      } catch {}
    }

    // Compact progress — remove entries for series/files that no longer exist
    const progPath = path.join(USERS_DIR, username, 'progress.jsonl');
    if (fs.existsSync(progPath)) {
      try {
        const lines = fs.readFileSync(progPath, 'utf-8').split('\n').filter(Boolean);
        const entries: UserProgressRecord[] = lines.map((l) => JSON.parse(l));

        // Deduplicate by seriesId+file, remove stale
        const seen = new Set<string>();
        const clean = entries.filter((e) => {
          const key = `${e.seriesId}/${e.file}`;
          if (seen.has(key)) { fixed++; return false; }
          if (!validSeriesIds.has(e.seriesId)) { fixed++; return false; }
          seen.add(key);
          return true;
        });

        if (clean.length !== entries.length) {
          fs.writeFileSync(progPath, clean.map((e) => JSON.stringify(e)).join('\n') + (clean.length ? '\n' : ''));
        }
      } catch {}
    }
  }

  return fixed;
}
