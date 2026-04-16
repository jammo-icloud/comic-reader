/**
 * Library maintenance — fixes page counts, sort order, and thumbnails.
 * Runs on startup, after downloads, after rescan, and via admin button.
 *
 * Page count: reads 10KB from PDF tail (fast, no rendering).
 * Sort order: re-extracts from filename so comics are always correctly ordered.
 * Thumbnails: renders page 1 at 300px via mupdf (only for missing ones).
 */
import fs from 'fs';
import path from 'path';
import { loadAllSeries, loadComics, writeComics } from './data.js';
import { resolveComicPath } from './scanner.js';
import { generateThumbnail, getThumbnailPath } from './thumbnails.js';
import { shortHash } from './hash.js';

/**
 * Read page count from the tail of a PDF file (fast — no rendering).
 */
function getPageCount(filePath: string): number {
  try {
    const fd = fs.openSync(filePath, 'r');
    const stat = fs.fstatSync(fd);
    const readSize = Math.min(10240, stat.size);
    const buffer = Buffer.alloc(readSize);
    fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);
    const text = buffer.toString('ascii');
    const match = text.match(/\/Count\s+(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Extract sort order from a filename. Handles:
 * - "chapter-001.pdf" → 1
 * - "1977-hm3.pdf" → 19770003 (year-prefixed magazines)
 * - "Met-Art-006.pdf" → 6
 * - "Vol.02 Ch.015.pdf" → 15
 */
function extractOrder(filename: string): number {
  const basename = path.basename(filename, path.extname(filename));

  // Check for year prefix: "1977-hm3" → year * 10000 + num
  const yearMatch = basename.match(/^(\d{4})-/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const rest = basename.slice(yearMatch[0].length);
    const nums = rest.match(/\d+(\.\d+)?/g);
    if (nums?.length) return year * 10000 + parseFloat(nums[nums.length - 1]);
    return year * 10000;
  }

  // Standard: extract the last number in the filename
  const numbers = basename.match(/\d+(\.\d+)?/g);
  if (!numbers?.length) return 0;
  return parseFloat(numbers[numbers.length - 1]);
}

/**
 * Run full library maintenance. Fixes page counts, sort order, and thumbnails.
 */
export async function runMaintenance(): Promise<{
  pageCounts: number;
  reordered: number;
  thumbnails: number;
  errors: number;
}> {
  const allSeries = loadAllSeries();
  let pageCounts = 0;
  let reordered = 0;
  let thumbnails = 0;
  let errors = 0;

  console.log(`Maintenance: scanning ${allSeries.length} series...`);

  let seriesProcessed = 0;
  for (const series of allSeries) {
    seriesProcessed++;
    if (seriesProcessed % 10 === 0) {
      console.log(`  Maintenance progress: ${seriesProcessed}/${allSeries.length} series`);
    }
    const comics = loadComics(series.id);
    if (comics.length === 0) continue;

    let comicsUpdated = false;

    for (const comic of comics) {
      const comicKey = `${series.id}/${comic.file}`;
      const fullPath = resolveComicPath(series.id, comic.file);

      if (!fullPath || !fs.existsSync(fullPath)) continue;

      // Fix page count if 0 or missing
      if (!comic.pages || comic.pages === 0) {
        const count = getPageCount(fullPath);
        if (count > 0) {
          comic.pages = count;
          comicsUpdated = true;
          pageCounts++;
        }
      }

      // Fix sort order — re-extract from filename
      const correctOrder = extractOrder(comic.file);
      if (comic.order !== correctOrder) {
        comic.order = correctOrder;
        comicsUpdated = true;
        reordered++;
      }

      // Generate missing thumbnail
      const existing = getThumbnailPath(comicKey);
      if (!existing) {
        try {
          const result = await generateThumbnail(comicKey);
          if (result) thumbnails++;
          else errors++;
        } catch (err) {
          console.error(`  Thumbnail failed for ${comicKey}: ${(err as Error).message}`);
          errors++;
        }
      }
    }

    if (comicsUpdated) {
      // Re-sort by the corrected order
      comics.sort((a, b) => a.order - b.order);
      writeComics(series.id, comics);
    }
  }

  const parts = [];
  if (pageCounts > 0) parts.push(`${pageCounts} page counts`);
  if (reordered > 0) parts.push(`${reordered} reordered`);
  if (thumbnails > 0) parts.push(`${thumbnails} thumbnails`);
  if (errors > 0) parts.push(`${errors} errors`);
  console.log(`Maintenance: ${parts.length > 0 ? parts.join(', ') : 'all clean'}`);

  return { pageCounts, reordered, thumbnails, errors };
}
