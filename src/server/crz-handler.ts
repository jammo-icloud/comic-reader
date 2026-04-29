/**
 * Handle .crz (Bindery archive) file imports — both v1 (legacy) and v2.
 *
 * Top-level flow:
 *   1. Read manifest.json from the zip
 *   2. Dispatch on formatVersion → importCrzV1 or importCrzV2
 *   3. Each codepath validates paths (zip-slip), extracts, and merges into the catalog
 *
 * v2 differences from v1:
 *   - Carries score, malId, mangaDexId, englishTitle, type, placeholder
 *   - Per-chapter `order` preserves .5 chapters
 *   - Per-chapter `pages` is pre-counted (no need to re-parse the PDF)
 *   - Multi-part: each part is processed additively, no state machine needed
 *   - Conflict strategies: merge (default) | replace | fork
 *   - Translations bundle (chapter-keyed in zip, hash-keyed on disk)
 *   - Zip-slip hardening on every path read from the zip
 */
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import sharp from 'sharp';
import {
  slugify,
  loadAllSeries,
  saveSeries,
  loadComics,
  writeComics,
  addToCollection,
  resolveComicPath,
  type SeriesRecord,
  type ComicRecord,
} from './data.js';
import { shortHash } from './hash.js';
import {
  isV1,
  isV2,
  validateManifest,
  type CrzManifestV1,
  type CrzManifestV2,
} from './crz-format.js';

const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';
const DATA_DIR = process.env.DATA_DIR || './data';

// Source → auto-tags (shared with chapter-upload.ts; v1 only — v2 carries explicit tags)
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

// ============================================================
// Public types
// ============================================================

export type ImportStrategy = 'merge' | 'replace' | 'fork';

export interface ImportResult {
  seriesId: string;
  title: string;
  chaptersImported: number;
  merged: boolean;
  formatVersion: 1 | 2;
  // v2-only:
  partIndex?: number;
  totalParts?: number;
  strategy?: ImportStrategy;
  forked?: boolean;
  translationsImported?: number;
}

export interface ImportOptions {
  /** Conflict strategy when a same-slug-or-title series already exists. v2 only; v1 always merges. */
  strategy?: ImportStrategy;
}

// ============================================================
// Top-level dispatch
// ============================================================

export async function importCrz(
  buffer: Buffer,
  username: string,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(buffer);

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('Invalid .crz file: no manifest.json');

  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(await manifestFile.async('string'));
  } catch (err) {
    throw new Error(`Invalid .crz manifest: not valid JSON (${(err as Error).message})`);
  }

  const validation = validateManifest(manifestJson);
  if (!validation.ok) {
    throw new Error(`Invalid .crz manifest: ${validation.errors.join('; ')}`);
  }

  // The validator already confirmed formatVersion is 1 or 2.
  const m = manifestJson as { formatVersion: number };
  if (isV2(m)) return importCrzV2(zip, manifestJson as CrzManifestV2, username, options);
  if (isV1(m)) return importCrzV1(zip, manifestJson as CrzManifestV1, username);
  throw new Error(`Unsupported .crz formatVersion: ${m.formatVersion}`);
}

// ============================================================
// Path safety — defends against zip-slip
// ============================================================

function assertSafePath(p: string, ctx: string): void {
  if (!p) throw new Error(`${ctx}: empty path`);
  if (p.includes('..')) throw new Error(`${ctx}: path traversal not allowed: ${p}`);
  if (p.startsWith('/') || /^[a-zA-Z]:[/\\]/.test(p)) {
    throw new Error(`${ctx}: absolute path not allowed: ${p}`);
  }
  if (p.includes('\0')) throw new Error(`${ctx}: null byte in path`);
}

// ============================================================
// v1 importer (legacy)
//
// Behavior preserved from original — slug-or-title match, additive merge,
// SOURCE_TAGS auto-application. New: zip-slip hardening on paths from manifest.
// ============================================================

async function importCrzV1(
  zip: JSZip,
  manifest: CrzManifestV1,
  username: string,
): Promise<ImportResult> {
  if (!manifest.title) throw new Error('Invalid .crz manifest: no title');

  const defaultSlug = slugify(manifest.title);
  const allExisting = loadAllSeries();
  const existingBySlug = allExisting.find((s) => s.id === defaultSlug);
  const existingByTitle = allExisting.find(
    (s) =>
      s.name.toLowerCase() === manifest.title.toLowerCase() ||
      s.englishTitle?.toLowerCase() === manifest.title.toLowerCase(),
  );
  let series = existingBySlug || existingByTitle || null;
  const seriesId = series ? series.id : defaultSlug;
  const merged = !!series;

  const seriesDir = path.join(LIBRARY_DIR, 'comics', seriesId);
  if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true });

  if (!series) {
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
    console.log(`  CRZ v1: Created series "${manifest.title}" (${seriesId})`);
  }

  if (manifest.coverFile && !series.coverFile) {
    assertSafePath(manifest.coverFile, 'cover');
    await applyCoverFromZip(zip, manifest.coverFile, series);
  }

  const existingComics = loadComics(seriesId);
  const existingFiles = new Set(existingComics.map((c) => c.file));
  const newComics: ComicRecord[] = [...existingComics];
  let chaptersImported = 0;

  for (const ch of manifest.chapters) {
    assertSafePath(ch.file, 'chapter');
    const chapterFile = zip.file(ch.file);
    if (!chapterFile) {
      console.warn(`  CRZ v1: Chapter file missing in zip: ${ch.file}`);
      continue;
    }

    const filename = `chapter-${ch.chapter.padStart(3, '0')}.pdf`;
    if (existingFiles.has(filename)) {
      console.log(`  CRZ v1: Skipping existing chapter ${ch.chapter}`);
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

  newComics.sort((a, b) => a.order - b.order);
  writeComics(seriesId, newComics);
  addToCollection(username, seriesId);

  console.log(
    `  CRZ v1: Imported ${chaptersImported} chapters for "${manifest.title}" ` +
      `(${merged ? 'merged' : 'new'}) → ${username}`,
  );

  return {
    seriesId,
    title: manifest.title,
    chaptersImported,
    merged,
    formatVersion: 1,
  };
}

// ============================================================
// v2 importer
// ============================================================

async function importCrzV2(
  zip: JSZip,
  manifest: CrzManifestV2,
  username: string,
  options: ImportOptions,
): Promise<ImportResult> {
  const strategy: ImportStrategy = options.strategy || 'merge';

  if (manifest.coverFile) assertSafePath(manifest.coverFile, 'cover');
  for (const ch of manifest.chapters) assertSafePath(ch.file, 'chapter');

  // --- Resolve destination series + apply strategy ---
  const { series, isNew, forked } = resolveDestinationSeriesV2(manifest, strategy);
  const seriesId = series.id;

  const typeDir = series.type === 'comic' ? 'comics' : 'magazines';
  const seriesDir = path.join(LIBRARY_DIR, typeDir, seriesId);
  if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true });

  // --- Cover (only if series doesn't have one yet, or strategy=replace cleared it) ---
  if (manifest.coverFile && !series.coverFile) {
    await applyCoverFromZip(zip, manifest.coverFile, series);
  }

  // --- Chapters ---
  const existingComics = loadComics(seriesId);
  const existingFiles = new Set(existingComics.map((c) => c.file));
  const newComics: ComicRecord[] = [...existingComics];
  let chaptersImported = 0;

  // Track which chapters from THIS part landed on disk under what destination
  // filename, so we know which translations to remap.
  const importedChapterFilenames = new Map<string, string>(); // src-in-zip-file → dest-on-disk-filename

  for (const ch of manifest.chapters) {
    const inZipFile = ch.file; // e.g. "chapters/chapter-005.pdf"
    const destFilename = `chapter-${String(ch.chapter).padStart(3, '0')}.pdf`;

    const chapterEntry = zip.file(inZipFile);
    if (!chapterEntry) {
      console.warn(`  CRZ v2: Chapter file missing in zip: ${inZipFile}`);
      continue;
    }

    if (existingFiles.has(destFilename)) {
      console.log(`  CRZ v2: Skipping existing chapter ${ch.chapter}`);
      continue;
    }

    const pdfData = await chapterEntry.async('nodebuffer');
    const outputPath = path.join(seriesDir, destFilename);
    fs.writeFileSync(outputPath, pdfData);

    newComics.push({
      file: destFilename,
      // Trust the manifest's pre-counted page count, but fall back to parsing if missing.
      pages: typeof ch.pages === 'number' && ch.pages > 0 ? ch.pages : getPageCount(pdfData),
      currentPage: 0,
      isRead: false,
      order: typeof ch.order === 'number' ? ch.order : parseFloat(ch.chapter) || 0,
      lastReadAt: null,
    });
    chaptersImported++;
    importedChapterFilenames.set(stripChaptersPrefix(inZipFile), destFilename);
  }

  newComics.sort((a, b) => a.order - b.order);
  writeComics(seriesId, newComics);

  // --- Translations (only for chapters we actually just imported) ---
  let translationsImported = 0;
  if (manifest.hasTranslations && importedChapterFilenames.size > 0) {
    translationsImported = await applyTranslationsFromZip(
      zip,
      seriesId,
      importedChapterFilenames,
    );
  }

  addToCollection(username, seriesId);

  console.log(
    `  CRZ v2: Imported ${chaptersImported} chapters (part ${manifest.partIndex + 1}/${manifest.totalParts}) ` +
      `for "${manifest.title}" → ${username} ` +
      `[strategy=${strategy}${forked ? ', forked' : ''}, translations=${translationsImported}]`,
  );

  return {
    seriesId,
    title: manifest.title,
    chaptersImported,
    merged: !isNew,
    formatVersion: 2,
    partIndex: manifest.partIndex,
    totalParts: manifest.totalParts,
    strategy,
    forked,
    translationsImported,
  };
}

// ============================================================
// v2 helpers
// ============================================================

function resolveDestinationSeriesV2(
  manifest: CrzManifestV2,
  strategy: ImportStrategy,
): { series: SeriesRecord; isNew: boolean; forked: boolean } {
  const defaultSlug = slugify(manifest.title);
  const allExisting = loadAllSeries();
  const existingBySlug = allExisting.find((s) => s.id === defaultSlug);
  const existingByTitle = allExisting.find(
    (s) =>
      s.name.toLowerCase() === manifest.title.toLowerCase() ||
      s.englishTitle?.toLowerCase() === manifest.title.toLowerCase(),
  );
  const existing = existingBySlug || existingByTitle || null;

  if (!existing) {
    const series = createSeriesFromManifestV2(defaultSlug, manifest);
    saveSeries(series);
    console.log(`  CRZ v2: Created series "${manifest.title}" (${defaultSlug})`);
    return { series, isNew: true, forked: false };
  }

  if (strategy === 'fork') {
    let n = 2;
    while (allExisting.find((s) => s.id === `${defaultSlug}-${n}`)) n++;
    const forkedId = `${defaultSlug}-${n}`;
    const series = createSeriesFromManifestV2(forkedId, manifest);
    saveSeries(series);
    console.log(`  CRZ v2: Forked existing "${manifest.title}" → ${forkedId}`);
    return { series, isNew: true, forked: true };
  }

  if (strategy === 'replace') {
    // Wipe existing chapters from disk, leave the metadata shell ready for v2 overwrite
    deleteAllChaptersFromDisk(existing);
    writeComics(existing.id, []);
    applyV2MetadataReplace(existing, manifest);
    saveSeries(existing);
    console.log(`  CRZ v2: Replacing existing "${manifest.title}" (${existing.id}) — chapters wiped`);
    return { series: existing, isNew: false, forked: false };
  }

  // strategy === 'merge' (default)
  fillMissingV2Metadata(existing, manifest);
  saveSeries(existing);
  return { series: existing, isNew: false, forked: false };
}

function createSeriesFromManifestV2(id: string, m: CrzManifestV2): SeriesRecord {
  return {
    id,
    type: m.type,
    name: m.title,
    coverFile: null, // applyCoverFromZip will set this
    score: m.score,
    synopsis: m.synopsis,
    tags: [...new Set(m.tags || [])],
    status: m.status,
    year: m.year,
    malId: m.malId,
    mangaDexId: m.mangaDexId,
    englishTitle: m.englishTitle,
    placeholder: m.placeholder || 'manga.png',
  };
}

function applyV2MetadataReplace(series: SeriesRecord, m: CrzManifestV2): void {
  // 'replace' strategy: overwrite every catalog field. Type and id are not touched
  // (changing type would corrupt LIBRARY_DIR layout; id is the routing key).
  series.name = m.title;
  series.score = m.score;
  series.synopsis = m.synopsis;
  series.tags = [...new Set(m.tags || [])];
  series.status = m.status;
  series.year = m.year;
  series.malId = m.malId;
  series.mangaDexId = m.mangaDexId;
  series.englishTitle = m.englishTitle;
  series.placeholder = m.placeholder || 'manga.png';
  series.coverFile = null; // force re-extraction from this zip
}

function fillMissingV2Metadata(series: SeriesRecord, m: CrzManifestV2): void {
  // 'merge' strategy: union tags, fill nullable fields only if currently null.
  series.tags = [...new Set([...(series.tags || []), ...(m.tags || [])])];
  if (series.score == null && m.score != null) series.score = m.score;
  if (series.synopsis == null && m.synopsis != null) series.synopsis = m.synopsis;
  if (series.status == null && m.status != null) series.status = m.status;
  if (series.year == null && m.year != null) series.year = m.year;
  if (series.malId == null && m.malId != null) series.malId = m.malId;
  if (series.mangaDexId == null && m.mangaDexId != null) series.mangaDexId = m.mangaDexId;
  if (series.englishTitle == null && m.englishTitle != null) series.englishTitle = m.englishTitle;
}

function deleteAllChaptersFromDisk(series: SeriesRecord): void {
  const comics = loadComics(series.id);
  for (const c of comics) {
    const p = resolveComicPath(series.id, c.file);
    if (p && fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch (err) {
        console.warn(`  CRZ v2: Could not delete chapter ${p}: ${(err as Error).message}`);
      }
    }
  }
}

/**
 * Strip the "chapters/" prefix from an in-zip path so we get just the original
 * chapter filename — matching how translations are keyed in the zip.
 *   "chapters/chapter-005.pdf" → "chapter-005.pdf"
 */
function stripChaptersPrefix(inZipPath: string): string {
  return inZipPath.startsWith('chapters/') ? inZipPath.slice('chapters/'.length) : inZipPath;
}

/**
 * Pull translations from translations/<chapterFile>/p*.json in the zip and
 * write them to data/translations/<destSeriesId>/<shortHash(destFile)>/p*.json.
 *
 * `importedChapterFilenames` maps  src-chapter-filename-in-zip → dest-on-disk-filename.
 * In practice these are usually the same string, but the importer rebuilds the
 * destination hash anyway so it stays correct if conflict resolution ever renames.
 */
async function applyTranslationsFromZip(
  zip: JSZip,
  destSeriesId: string,
  importedChapterFilenames: Map<string, string>,
): Promise<number> {
  const baseDir = path.join(DATA_DIR, 'translations', destSeriesId);
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

  let imported = 0;

  for (const [srcChapterFile, destFilename] of importedChapterFilenames) {
    const prefix = `translations/${srcChapterFile}/`;
    const destDir = path.join(baseDir, shortHash(destFilename));
    let createdDir = false;

    // JSZip lets us iterate entries by prefix
    const matching: JSZip.JSZipObject[] = [];
    zip.forEach((relPath, entry) => {
      if (relPath.startsWith(prefix) && !entry.dir && relPath.endsWith('.json')) {
        matching.push(entry);
      }
    });

    for (const entry of matching) {
      const pageFilename = entry.name.slice(prefix.length); // "p3.json"
      assertSafePath(pageFilename, 'translation');
      if (!createdDir) {
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        createdDir = true;
      }
      const data = await entry.async('nodebuffer');
      fs.writeFileSync(path.join(destDir, pageFilename), data);
      imported++;
    }
  }

  return imported;
}

// ============================================================
// Shared helpers (used by both v1 and v2 codepaths)
// ============================================================

async function applyCoverFromZip(
  zip: JSZip,
  inZipPath: string,
  series: SeriesRecord,
): Promise<void> {
  const coverFile = zip.file(inZipPath);
  if (!coverFile) return;
  try {
    const coverData = await coverFile.async('nodebuffer');
    const coversDir = path.join(DATA_DIR, 'series-covers');
    if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
    const filename = `${shortHash(series.id)}.jpg`;
    await sharp(coverData)
      .resize(300, 450, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toFile(path.join(coversDir, filename));
    series.coverFile = filename;
    saveSeries(series);
    console.log(`  CRZ: Set cover for "${series.name}"`);
  } catch (err) {
    console.error(`  CRZ: Cover processing failed: ${(err as Error).message}`);
  }
}

/** Read page count from the trailing kilobytes of a PDF. Returns 0 if it can't tell. */
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
