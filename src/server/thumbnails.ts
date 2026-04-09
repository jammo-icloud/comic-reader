import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import * as mupdf from 'mupdf';
import { getAllComics } from './library.js';
import { getComicFullPath } from './scanner.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const THUMB_DIR = path.join(DATA_DIR, 'thumbnails');
const THUMB_WIDTH = 300;

function ensureThumbDir() {
  if (!fs.existsSync(THUMB_DIR)) {
    fs.mkdirSync(THUMB_DIR, { recursive: true });
  }
}

function thumbPath(comicKey: string): string {
  const hash = Buffer.from(comicKey).toString('base64url');
  return path.join(THUMB_DIR, `${hash}.jpg`);
}

export function getThumbnailPath(comicKey: string): string | null {
  const tp = thumbPath(comicKey);
  return fs.existsSync(tp) ? tp : null;
}

export async function generateThumbnail(comicKey: string): Promise<string | null> {
  ensureThumbDir();
  const tp = thumbPath(comicKey);

  if (fs.existsSync(tp)) return tp;

  const fullPath = getComicFullPath(comicKey);
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
  const comics = getAllComics();
  console.log(`Generating thumbnails for ${comics.length} comics...`);
  let count = 0;
  let errors = 0;
  for (const comic of comics) {
    const existing = getThumbnailPath(comic.path);
    if (!existing) {
      try {
        const result = await generateThumbnail(comic.path);
        if (result) count++;
        else errors++;
      } catch (err) {
        console.error(`Thumbnail crash for ${comic.path}:`, (err as Error).message);
        errors++;
      }
    }
  }
  console.log(`Generated ${count} new thumbnails (${errors} errors)`);
}
