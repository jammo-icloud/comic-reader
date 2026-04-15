/**
 * Library maintenance — fixes page counts and regenerates missing thumbnails.
 * Lightweight: page count reads 10KB from each PDF tail (no rendering).
 * Thumbnails render page 1 at 300px via mupdf (only for missing ones).
 */
import fs from 'fs';
import path from 'path';
import { loadAllSeries, loadComics, writeComics } from './data.js';
import { resolveComicPath } from './scanner.js';
import { generateThumbnail, getThumbnailPath } from './thumbnails.js';
import { shortHash } from './hash.js';

const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';

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
 * Run full library maintenance. Fixes page counts and generates missing thumbnails.
 * Returns stats about what was fixed.
 */
export async function runMaintenance(): Promise<{
  pageCounts: number;
  thumbnails: number;
  errors: number;
}> {
  const allSeries = loadAllSeries();
  let pageCounts = 0;
  let thumbnails = 0;
  let errors = 0;

  console.log(`Maintenance: scanning ${allSeries.length} series...`);

  for (const series of allSeries) {
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

      // Generate missing thumbnail
      const thumbKey = shortHash(comicKey);
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
      writeComics(series.id, comics);
    }
  }

  console.log(`Maintenance: ${pageCounts} page counts fixed, ${thumbnails} thumbnails generated, ${errors} errors`);
  return { pageCounts, thumbnails, errors };
}
