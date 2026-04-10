import fs from 'fs';
import path from 'path';
import { loadLibrary, saveLibrary, type ComicEntry } from './library.js';
import { loadShelves, type Shelf } from './shelves.js';
import { convertToPdf, isImageFolder } from './converter.js';

const COMIC_EXTENSIONS = new Set(['.pdf', '.cbr', '.cbz']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function extractSeriesOrder(filename: string): number {
  const numbers = filename.match(/\d+(\.\d+)?/g);
  if (!numbers || numbers.length === 0) return 0;
  return parseFloat(numbers[numbers.length - 1]);
}

function extractNestedOrder(relativePath: string): number {
  const parts = relativePath.split(path.sep);
  if (parts.length <= 2) {
    return extractSeriesOrder(parts[parts.length - 1]);
  }

  let yearMultiplier = 0;
  for (let i = 1; i < parts.length - 1; i++) {
    const yearMatch = parts[i].match(/^(\d{4})$/);
    if (yearMatch) {
      yearMultiplier = parseInt(yearMatch[1], 10) * 10000;
    }
  }

  const filename = parts[parts.length - 1];
  const filenameOrder = extractSeriesOrder(filename);
  return yearMultiplier + filenameOrder;
}

interface FoundItem {
  fullPath: string;
  type: 'pdf' | 'cbr' | 'cbz' | 'image-folder';
}

function walkDir(dir: string): FoundItem[] {
  const results: FoundItem[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    // Skip hidden folders (.originals, .DS_Store, etc.)
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Check if this directory is an image folder (contains images, no subdirs with comics)
      if (isImageFolder(fullPath)) {
        // Check if it has subdirectories — if so, it's a series folder, not an image set
        const hasSubdirs = fs.readdirSync(fullPath, { withFileTypes: true })
          .some((e) => e.isDirectory() && !e.name.startsWith('.'));
        if (!hasSubdirs) {
          results.push({ fullPath, type: 'image-folder' });
          continue;
        }
      }
      results.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.pdf') results.push({ fullPath, type: 'pdf' });
      else if (ext === '.cbr') results.push({ fullPath, type: 'cbr' });
      else if (ext === '.cbz') results.push({ fullPath, type: 'cbz' });
    }
  }
  return results;
}

/**
 * Convert a non-PDF item to PDF, moving the original to .originals
 * Returns the path to the new PDF, or null on failure
 */
async function convertAndArchive(item: FoundItem, shelfPath: string): Promise<string | null> {
  const basename = path.basename(item.fullPath, path.extname(item.fullPath));
  const dir = path.dirname(item.fullPath);
  const pdfPath = path.join(dir, `${basename}.pdf`);

  // Already has a PDF with the same name
  if (fs.existsSync(pdfPath)) return pdfPath;

  console.log(`  Converting: ${path.relative(shelfPath, item.fullPath)}`);

  try {
    const converted = await convertToPdf(item.fullPath);
    if (!converted) return null;

    // Copy converted PDF to sit alongside the original
    fs.copyFileSync(converted, pdfPath);

    // Move original to .originals
    const originalsDir = path.join(dir, '.originals');
    if (!fs.existsSync(originalsDir)) fs.mkdirSync(originalsDir, { recursive: true });

    if (item.type === 'image-folder') {
      // Move entire folder
      const destFolder = path.join(originalsDir, path.basename(item.fullPath));
      fs.renameSync(item.fullPath, destFolder);
    } else {
      // Move single file
      fs.renameSync(item.fullPath, path.join(originalsDir, path.basename(item.fullPath)));
    }

    console.log(`  → ${path.relative(shelfPath, pdfPath)}`);
    return pdfPath;
  } catch (err) {
    console.error(`  Conversion failed: ${(err as Error).message}`);
    return null;
  }
}

// Composite key: shelfId:relativePath — unique across shelves
function comicKey(shelfId: string, relativePath: string): string {
  return `${shelfId}:${relativePath}`;
}

export function parseComicKey(key: string): { shelfId: string; relativePath: string } {
  const idx = key.indexOf(':');
  return { shelfId: key.substring(0, idx), relativePath: key.substring(idx + 1) };
}

export function getComicFullPath(key: string): string | null {
  const { shelfId, relativePath } = parseComicKey(key);
  const shelves = loadShelves();
  const shelf = shelves.find((s) => s.id === shelfId);
  if (!shelf) return null;
  return path.join(shelf.path, relativePath);
}

async function scanShelf(shelf: Shelf, lib: ReturnType<typeof loadLibrary>) {
  const items = walkDir(shelf.path);
  const keysInShelf = new Set<string>();
  let added = 0;
  let converted = 0;

  // First pass: convert non-PDFs
  for (const item of items) {
    if (item.type !== 'pdf') {
      const pdfPath = await convertAndArchive(item, shelf.path);
      if (pdfPath) converted++;
    }
  }

  if (converted > 0) {
    console.log(`  Converted ${converted} items to PDF`);
  }

  // Second pass: scan all PDFs (including newly converted ones)
  const pdfItems = walkDir(shelf.path).filter((i) => i.type === 'pdf');

  for (const item of pdfItems) {
    const rel = path.relative(shelf.path, item.fullPath);
    const key = comicKey(shelf.id, rel);
    keysInShelf.add(key);

    if (!lib.comics[key]) {
      const stat = fs.statSync(item.fullPath);
      const basename = path.basename(rel, '.pdf');
      const parentDir = path.dirname(rel);
      const series = parentDir === '.' ? 'Unsorted' : parentDir.split(path.sep)[0];

      const pathParts = rel.split(path.sep);
      const subfolders = pathParts.slice(1, -1);
      const title = subfolders.length > 0 ? `${subfolders.join(' - ')} - ${basename}` : basename;

      const entry: ComicEntry = {
        title,
        series,
        seriesOrder: extractNestedOrder(rel),
        pageCount: 0,
        fileSize: stat.size,
        currentPage: 0,
        isRead: false,
        lastReadAt: null,
        addedAt: new Date().toISOString(),
        shelfId: shelf.id,
      };

      lib.comics[key] = entry;
      added++;
    } else {
      lib.comics[key].seriesOrder = extractNestedOrder(rel);
      lib.comics[key].shelfId = shelf.id;
    }
  }

  return { keysInShelf, added, converted };
}

export async function scanLibrary(): Promise<{ added: number; removed: number; total: number; converted: number }> {
  const shelves = loadShelves();
  const lib = loadLibrary();

  if (shelves.length === 0) {
    console.log('No shelves configured. Add a shelf to start scanning.');
    return { added: 0, removed: 0, total: Object.keys(lib.comics).length, converted: 0 };
  }

  let totalAdded = 0;
  let totalRemoved = 0;
  let totalConverted = 0;
  const allValidKeys = new Set<string>();

  for (const shelf of shelves) {
    console.log(`Scanning shelf "${shelf.name}": ${shelf.path}`);
    const { keysInShelf, added, converted } = await scanShelf(shelf, lib);
    keysInShelf.forEach((k) => allValidKeys.add(k));
    totalAdded += added;
    totalConverted += converted;
    console.log(`  ${added} new, ${keysInShelf.size} total in shelf${converted > 0 ? `, ${converted} converted` : ''}`);
  }

  for (const key of Object.keys(lib.comics)) {
    if (!allValidKeys.has(key)) {
      delete lib.comics[key];
      totalRemoved++;
    }
  }

  saveLibrary(true);
  const total = Object.keys(lib.comics).length;
  console.log(`Scan complete: ${totalAdded} added, ${totalRemoved} removed, ${total} total, ${totalConverted} converted`);
  return { added: totalAdded, removed: totalRemoved, total, converted: totalConverted };
}
