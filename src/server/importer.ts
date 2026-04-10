import fs from 'fs';
import path from 'path';
import { slugify, loadAllSeries, loadComics, saveSeries, writeComics, type SeriesRecord, type ComicRecord } from './data.js';
import { shortHash } from './hash.js';
import { convertToPdf, isImageFolder } from './converter.js';

/**
 * Read page count directly from PDF metadata — no rendering library needed.
 * The /Count entry in the /Pages dictionary is near the end of the file.
 */
function getPageCount(filePath: string): number {
  try {
    const fd = fs.openSync(filePath, 'r');
    const stat = fs.fstatSync(fd);
    // Read last 10KB — /Count is always near the end
    const readSize = Math.min(10240, stat.size);
    const buffer = Buffer.alloc(readSize);
    fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);

    const text = buffer.toString('ascii');
    // Match /Count followed by a number (the root Pages object)
    const match = text.match(/\/Count\s+(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';
const DATA_DIR = process.env.DATA_DIR || path.join(LIBRARY_DIR, '.comic-reader');

const COMIC_EXTENSIONS = new Set(['.pdf', '.cbr', '.cbz']);

// --- Types ---

export interface PendingImport {
  sourceFolder: string;     // absolute path to source folder
  folderName: string;       // original folder name
  suggestedName: string;    // cleaned-up name suggestion
  suggestedType: 'comic' | 'magazine';
  files: string[];          // filenames found
  fileCount: number;
}

export interface ImportConfig {
  sourceFolder: string;
  type: 'comic' | 'magazine';
  name: string;
  malId?: number | null;
}

// --- In-memory pending queue ---

let pendingImports: PendingImport[] = [];
let skippedFolders = new Set<string>();

export function getPendingImports(): PendingImport[] {
  return pendingImports.filter((p) => !skippedFolders.has(p.sourceFolder));
}

export function getNextPending(): PendingImport | null {
  return getPendingImports()[0] || null;
}

export function skipImport(sourceFolder: string) {
  skippedFolders.add(sourceFolder);
}

export function skipAllImports() {
  for (const p of pendingImports) skippedFolders.add(p.sourceFolder);
}

export function clearPending() {
  pendingImports = [];
  skippedFolders.clear();
}

// --- Scan source folder ---

function findFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (COMIC_EXTENSIONS.has(ext)) results.push(entry.name);
    } else if (entry.isDirectory()) {
      // Recurse into year folders etc.
      const subFiles = findFiles(fullPath);
      for (const f of subFiles) {
        results.push(path.join(entry.name, f));
      }
    }
  }
  return results;
}

function guessType(folderName: string, files: string[]): 'comic' | 'magazine' {
  const lower = folderName.toLowerCase();
  if (lower.includes('magazine') || lower.includes('heavy metal') || lower.includes('epic illustrated')) {
    return 'magazine';
  }
  // If files are organized by year subfolders, likely magazine
  const hasYearFolders = files.some((f) => /^\d{4}[\\/]/.test(f));
  if (hasYearFolders) return 'magazine';
  return 'comic';
}

export function scanSourceFolder(sourcePath: string): { count: number } {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Folder not found: ${sourcePath}`);
  }

  const entries = fs.readdirSync(sourcePath, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));

  // Check for already-imported series
  const existingSeries = new Set(loadAllSeries().map((s) => s.name));

  pendingImports = [];
  skippedFolders.clear();

  for (const folder of folders) {
    const fullPath = path.join(sourcePath, folder.name);
    const files = findFiles(fullPath);

    if (files.length === 0) continue;

    // Skip if already imported
    if (existingSeries.has(folder.name)) {
      skippedFolders.add(fullPath);
    }

    pendingImports.push({
      sourceFolder: fullPath,
      folderName: folder.name,
      suggestedName: folder.name,
      suggestedType: guessType(folder.name, files),
      files,
      fileCount: files.length,
    });
  }

  return { count: pendingImports.length };
}

// --- File renaming ---

function extractChapterNumber(filename: string): string {
  // Try to extract a chapter/issue number from the filename
  const basename = path.basename(filename, path.extname(filename));

  // Patterns: "Chapter 55", "Ch.055.5", "Ch 1", "001", etc.
  const match = basename.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const num = parseFloat(match[1]);
    if (Number.isInteger(num)) {
      return String(num).padStart(3, '0');
    }
    return num.toFixed(1).replace(/^(\d+)\./, (_, n) => n.padStart(3, '0') + '.');
  }
  return basename; // fallback: use original name
}

function canonicalFilename(sourceFile: string, type: 'comic' | 'magazine'): string {
  const ext = path.extname(sourceFile);
  if (type === 'comic') {
    const num = extractChapterNumber(sourceFile);
    return `chapter-${num}${ext}`;
  }
  // Magazines: keep original name but clean it up
  const basename = path.basename(sourceFile, ext);
  const clean = basename.replace(/[<>:"|?*]/g, '_').trim();
  return `${clean}${ext}`;
}

// --- Import execution ---

export async function importSeries(config: ImportConfig): Promise<SeriesRecord> {
  const { sourceFolder, type, name, malId } = config;
  const seriesId = slugify(name);
  const typeDir = type === 'comic' ? 'comics' : 'magazines';
  const destDir = path.join(LIBRARY_DIR, typeDir, seriesId);

  // Create destination
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  // Check if this is a merge (series already exists)
  const existingSeries = loadAllSeries().find((s) => s.id === seriesId);
  const existingComics = existingSeries ? loadComics(seriesId) : [];
  const existingFiles = new Set(existingComics.map((c) => c.file));

  // Find source files
  const sourceFiles = findFiles(sourceFolder);
  const comics: ComicRecord[] = [...existingComics]; // Start with existing

  for (const sourceFile of sourceFiles) {
    const sourcePath = path.join(sourceFolder, sourceFile);
    const newFilename = canonicalFilename(sourceFile, type);
    const destPath = path.join(destDir, newFilename);

    // Skip if this file is already in the series (dedup for merge)
    const ext = path.extname(sourceFile).toLowerCase();
    const finalFilename = (ext === '.cbr' || ext === '.cbz')
      ? newFilename.replace(/\.(cbr|cbz)$/i, '.pdf')
      : newFilename;

    if (existingFiles.has(finalFilename)) continue;

    // Convert CBR/CBZ to PDF if needed
    if (ext === '.cbr' || ext === '.cbz') {
      const converted = await convertToPdf(sourcePath);
      if (converted) {
        const destFile = path.join(destDir, finalFilename);
        fs.copyFileSync(converted, destFile);
        comics.push({
          file: finalFilename,
          pages: getPageCount(destFile),
          currentPage: 0,
          isRead: false,
          order: extractChapterOrder(sourceFile),
          lastReadAt: null,
        });
      }
    } else {
      // Move/copy PDF
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(sourcePath, destPath);
      }
      comics.push({
        file: newFilename,
        pages: getPageCount(destPath),
        currentPage: 0,
        isRead: false,
        order: extractChapterOrder(sourceFile),
        lastReadAt: null,
      });
    }
  }

  // Sort comics by order
  comics.sort((a, b) => a.order - b.order);

  // Create or update series record (preserve existing metadata on merge)
  const series: SeriesRecord = existingSeries ? {
    ...existingSeries,
    malId: malId || existingSeries.malId,
  } : {
    id: seriesId,
    type,
    name,
    coverFile: null,
    score: null,
    synopsis: null,
    tags: [],
    status: null,
    year: null,
    malId: malId || null,
    mangaDexId: null,
    placeholder: type === 'comic' ? 'manga.png' : 'magazine.png',
  };

  // Save
  saveSeries(series);
  writeComics(seriesId, comics);

  // Remove from pending
  skippedFolders.add(sourceFolder);

  console.log(`Imported "${name}" (${type}): ${comics.length} files → ${destDir}`);
  return series;
}

function extractChapterOrder(sourceFile: string): number {
  const parts = sourceFile.split(path.sep);
  // Check for year folder
  let yearMultiplier = 0;
  for (const part of parts.slice(0, -1)) {
    const yearMatch = part.match(/^(\d{4})$/);
    if (yearMatch) yearMultiplier = parseInt(yearMatch[1], 10) * 10000;
  }
  const filename = parts[parts.length - 1];
  const numbers = filename.match(/\d+(\.\d+)?/g);
  if (!numbers?.length) return yearMultiplier;
  return yearMultiplier + parseFloat(numbers[numbers.length - 1]);
}
