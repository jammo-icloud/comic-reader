import fs from 'fs';
import path from 'path';
import { loadLibrary, saveLibrary, type ComicEntry } from './library.js';
import { loadShelves, type Shelf } from './shelves.js';

function extractSeriesOrder(filename: string): number {
  const numbers = filename.match(/\d+(\.\d+)?/g);
  if (!numbers || numbers.length === 0) return 0;
  return parseFloat(numbers[numbers.length - 1]);
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      results.push(fullPath);
    }
  }
  return results;
}

// Page count is determined lazily by the PDF viewer (browser-side) or thumbnail generator.
// mupdf WASM crashes on corrupt PDFs and kills the whole process, so we don't use it during scan.

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

function scanShelf(shelf: Shelf, lib: ReturnType<typeof loadLibrary>) {
  const pdfFiles = walkDir(shelf.path);
  const keysInShelf = new Set<string>();
  let added = 0;

  for (const fullPath of pdfFiles) {
    const rel = path.relative(shelf.path, fullPath);
    const key = comicKey(shelf.id, rel);
    keysInShelf.add(key);

    if (!lib.comics[key]) {
      const stat = fs.statSync(fullPath);
      const basename = path.basename(rel, '.pdf');
      const parentDir = path.dirname(rel);
      const series = parentDir === '.' ? 'Unsorted' : parentDir.split(path.sep)[0];

      const entry: ComicEntry = {
        title: basename,
        series,
        seriesOrder: extractSeriesOrder(basename),
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
      // Update sort order + ensure shelfId is set
      const basename = path.basename(rel, '.pdf');
      lib.comics[key].seriesOrder = extractSeriesOrder(basename);
      lib.comics[key].shelfId = shelf.id;
    }
  }

  return { keysInShelf, added };
}

export async function scanLibrary(): Promise<{ added: number; removed: number; total: number }> {
  const shelves = loadShelves();
  const lib = loadLibrary();

  if (shelves.length === 0) {
    console.log('No shelves configured. Add a shelf to start scanning.');
    return { added: 0, removed: 0, total: Object.keys(lib.comics).length };
  }

  let totalAdded = 0;
  let totalRemoved = 0;
  const allValidKeys = new Set<string>();

  for (const shelf of shelves) {
    console.log(`Scanning shelf "${shelf.name}": ${shelf.path}`);
    const { keysInShelf, added } = scanShelf(shelf, lib);
    keysInShelf.forEach((k) => allValidKeys.add(k));
    totalAdded += added;
    console.log(`  ${added} new, ${keysInShelf.size} total in shelf`);
  }

  // Remove comics whose files no longer exist (across all shelves)
  for (const key of Object.keys(lib.comics)) {
    if (!allValidKeys.has(key)) {
      delete lib.comics[key];
      totalRemoved++;
    }
  }

  saveLibrary(true);
  const total = Object.keys(lib.comics).length;
  console.log(`Scan complete: ${totalAdded} added, ${totalRemoved} removed, ${total} total`);
  return { added: totalAdded, removed: totalRemoved, total };
}
