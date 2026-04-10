import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import * as mupdf from 'mupdf';
import { loadAllSeries, loadComics } from './data.js';
import { resolveComicPath } from './scanner.js';
import { shortHash } from './hash.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const THUMB_DIR = path.join(DATA_DIR, 'thumbnails');
const THUMB_WIDTH = 300;

function ensureThumbDir() {
  if (!fs.existsSync(THUMB_DIR)) {
    fs.mkdirSync(THUMB_DIR, { recursive: true });
  }
}

function thumbPath(comicKey: string): string {
  return path.join(THUMB_DIR, `${shortHash(comicKey)}.jpg`);
}

export function getThumbnailPath(comicKey: string): string | null {
  const tp = thumbPath(comicKey);
  return fs.existsSync(tp) ? tp : null;
}

export async function generateThumbnail(comicKey: string): Promise<string | null> {
  ensureThumbDir();
  const tp = thumbPath(comicKey);

  if (fs.existsSync(tp)) return tp;

  // comicKey is now "seriesId/filename" — split and resolve
  const slashIdx = comicKey.indexOf('/');
  const seriesId = comicKey.substring(0, slashIdx);
  const file = comicKey.substring(slashIdx + 1);
  const fullPath = resolveComicPath(seriesId, file);
  if (!fullPath || !fs.existsSync(fullPath)) return null;

  try {
    const data = fs.readFileSync(fullPath);
    const doc = mupdf.Document.openDocument(data, 'application/pdf');
    const page = doc.loadPage(0);

    const bounds = page.getBounds();
    const pageWidth = bounds[2] - bounds[0];
    const scale = THUMB_WIDTH / pageWidth;

    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(scale, scale),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true
    );

    const pngBuffer = pixmap.asPNG();

    await sharp(Buffer.from(pngBuffer))
      .jpeg({ quality: 80 })
      .toFile(tp);

    return tp;
  } catch (err) {
    console.error(`Failed to generate thumbnail for ${comicKey}:`, (err as Error).message);
    return null;
  }
}

export async function generateAllThumbnails() {
  const allSeries = loadAllSeries();
  let totalComics = 0;
  let count = 0;
  let errors = 0;
  for (const series of allSeries) {
    const comics = loadComics(series.id);
    for (const comic of comics) {
      totalComics++;
      const key = `${series.id}/${comic.file}`;
      const existing = getThumbnailPath(key);
      if (!existing) {
        try {
          const result = await generateThumbnail(key);
          if (result) count++;
          else errors++;
        } catch (err) {
          console.error(`Thumbnail crash for ${key}:`, (err as Error).message);
          errors++;
        }
      }
    }
  }
  console.log(`Generated ${count} new thumbnails (${errors} errors)`);
}
