import fs from 'fs';
import path from 'path';
import { loadAllSeries, loadComics, writeComics, slugify, resolveComicPath, type ComicRecord } from './data.js';

const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';

/**
 * Re-scan the canonical library directories to pick up
 * any new files added directly (not via import wizard).
 * Also removes entries for files that no longer exist.
 */
export async function rescanLibrary(): Promise<{ updated: number }> {
  const allSeries = loadAllSeries();
  let updated = 0;

  for (const series of allSeries) {
    const typeDir = series.type === 'comic' ? 'comics' : 'magazines';
    const seriesDir = path.join(LIBRARY_DIR, typeDir, series.id);

    if (!fs.existsSync(seriesDir)) continue;

    const existingComics = loadComics(series.id);
    const existingByFile = new Map(existingComics.map((c) => [c.file, c]));

    // Find all PDFs in the series directory
    const files = fs.readdirSync(seriesDir)
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const newComics: ComicRecord[] = [];
    let changed = false;

    for (const file of files) {
      const existing = existingByFile.get(file);
      if (existing) {
        newComics.push(existing);
      } else {
        // New file found
        newComics.push({
          file,
          pages: 0,
          currentPage: 0,
          isRead: false,
          order: extractOrder(file),
          lastReadAt: null,
        });
        changed = true;
      }
    }

    // Check for removals
    if (newComics.length !== existingComics.length) changed = true;

    if (changed) {
      writeComics(series.id, newComics);
      updated++;
    }
  }

  return { updated };
}

function extractOrder(filename: string): number {
  const numbers = filename.match(/\d+(\.\d+)?/g);
  if (!numbers?.length) return 0;
  return parseFloat(numbers[numbers.length - 1]);
}

/**
 * Resolve a comic to its full path on disk.
 * Re-exported from data.ts for backward compat.
 */
export { resolveComicPath } from './data.js';
