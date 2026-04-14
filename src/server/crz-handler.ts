/**
 * Handle .crz (Comic Reader Zip) file imports.
 * Extracts chapters, cover, and metadata from a .crz package.
 */
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import sharp from 'sharp';
import { slugify, loadAllSeries, saveSeries, loadComics, writeComics, addToCollection, type SeriesRecord, type ComicRecord } from './data.js';
import { shortHash } from './hash.js';

const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';
const DATA_DIR = process.env.DATA_DIR || './data';

// Source → auto-tags mapping (shared with chapter-upload.ts)
const SOURCE_TAGS: Record<string, string[]> = {
  mangadex: ['manga'],
  mangafox: ['manga'],
  mangahub: ['manga'],
  mangadna: ['manga'],
  manga18fx: ['manga', 'adult'],
  omegascans: ['manhwa', 'adult'],
  hentainexus: ['hentai', 'adult'],
  weebcentral: ['manga'],
  readallcomics: ['western', 'comics'],
  novelcool: ['manga'],
};

interface CrzManifest {
  formatVersion: number;
  title: string;
  sourceId: string;
  tags: string[];
  synopsis: string | null;
  status: string | null;
  year: number | null;
  coverFile: string | null;
  chapters: { file: string; chapter: string }[];
  partIndex: number;
  totalParts: number;
}

/**
 * Read page count from PDF bytes (same technique as importer.ts)
 */
function getPageCount(pdfBuffer: Buffer): number {
  try {
    const tail = pdfBuffer.slice(Math.max(0, pdfBuffer.length - 10240));
    const text = tail.toString('ascii');
    const match = text.match(/\/Count\s+(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

export async function importCrz(
  buffer: Buffer,
  username: string,
): Promise<{ seriesId: string; title: string; chaptersImported: number; merged: boolean }> {
  const zip = await JSZip.loadAsync(buffer);

  // Read manifest
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('Invalid .crz file: no manifest.json');
  const manifest: CrzManifest = JSON.parse(await manifestFile.async('string'));

  if (!manifest.title) throw new Error('Invalid .crz manifest: no title');

  const defaultSlug = slugify(manifest.title);

  // Check for existing series by slug, name, or English title (prevent duplicates)
  const allExisting = loadAllSeries();
  const existingBySlug = allExisting.find((s) => s.id === defaultSlug);
  const existingByTitle = allExisting.find((s) =>
    s.name.toLowerCase() === manifest.title.toLowerCase() ||
    s.englishTitle?.toLowerCase() === manifest.title.toLowerCase()
  );
  let series = existingBySlug || existingByTitle || null;
  const seriesId = series ? series.id : defaultSlug;
  const merged = !!series;

  const seriesDir = path.join(LIBRARY_DIR, 'comics', seriesId);
  if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true });

  if (!series) {
    // Build tags from manifest + source auto-tags
    const autoTags = SOURCE_TAGS[manifest.sourceId] || [];
    const tags = [...new Set([...(manifest.tags || []), ...autoTags])];

    series = {
      id: seriesId,
      type: 'comic',
      name: manifest.title,
      coverFile: null,
      score: null,
      synopsis: manifest.synopsis || null,
      tags,
      status: manifest.status || null,
      year: manifest.year || null,
      malId: null,
      mangaDexId: null,
      englishTitle: null,
      placeholder: 'manga.png',
    };
    saveSeries(series);
    console.log(`  CRZ: Created series "${manifest.title}" (${seriesId})`);
  }

  // Extract cover if present and series doesn't have one
  if (manifest.coverFile && !series.coverFile) {
    const coverFile = zip.file(manifest.coverFile);
    if (coverFile) {
      try {
        const coverData = await coverFile.async('nodebuffer');
        const coversDir = path.join(DATA_DIR, 'series-covers');
        if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
        const filename = `${shortHash(seriesId)}.jpg`;
        await sharp(coverData)
          .resize(300, 450, { fit: 'cover' })
          .jpeg({ quality: 85 })
          .toFile(path.join(coversDir, filename));
        series.coverFile = filename;
        saveSeries(series);
        console.log(`  CRZ: Set cover for "${manifest.title}"`);
      } catch (err) {
        console.error(`  CRZ: Cover processing failed: ${(err as Error).message}`);
      }
    }
  }

  // Extract chapter PDFs
  const existingComics = loadComics(seriesId);
  const existingFiles = new Set(existingComics.map((c) => c.file));
  const newComics: ComicRecord[] = [...existingComics];
  let chaptersImported = 0;

  for (const ch of manifest.chapters) {
    const chapterFile = zip.file(ch.file);
    if (!chapterFile) {
      console.warn(`  CRZ: Chapter file missing in zip: ${ch.file}`);
      continue;
    }

    const filename = `chapter-${ch.chapter.padStart(3, '0')}.pdf`;

    // Skip if already exists (additive merge)
    if (existingFiles.has(filename)) {
      console.log(`  CRZ: Skipping existing chapter ${ch.chapter}`);
      continue;
    }

    const pdfData = await chapterFile.async('nodebuffer');
    const outputPath = path.join(seriesDir, filename);
    fs.writeFileSync(outputPath, pdfData);

    const pages = getPageCount(pdfData);
    newComics.push({
      file: filename,
      pages,
      currentPage: 0,
      isRead: false,
      order: parseFloat(ch.chapter) || 0,
      lastReadAt: null,
    });

    chaptersImported++;
  }

  // Sort and save comics
  newComics.sort((a, b) => a.order - b.order);
  writeComics(seriesId, newComics);

  // Add to user's collection
  addToCollection(username, seriesId);

  console.log(`  CRZ: Imported ${chaptersImported} chapters for "${manifest.title}" (${merged ? 'merged' : 'new'}) → ${username}`);

  return { seriesId, title: manifest.title, chaptersImported, merged };
}
