import fs from 'fs';
import path from 'path';

export interface ComicEntry {
  title: string;
  series: string;
  seriesOrder: number;
  pageCount: number;
  fileSize: number;
  currentPage: number;
  isRead: boolean;
  lastReadAt: string | null;
  addedAt: string;
  shelfId: string;
}

export interface LibraryData {
  comics: Record<string, ComicEntry>;
}

const DATA_DIR = process.env.DATA_DIR || './data';
const LIBRARY_PATH = path.join(DATA_DIR, 'library.json');

let libraryCache: LibraryData | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadLibrary(): LibraryData {
  if (libraryCache) return libraryCache;

  ensureDataDir();

  if (fs.existsSync(LIBRARY_PATH)) {
    const raw = fs.readFileSync(LIBRARY_PATH, 'utf-8');
    libraryCache = JSON.parse(raw);
  } else {
    libraryCache = { comics: {} };
  }

  return libraryCache!;
}

export function saveLibrary(immediate = false) {
  if (!libraryCache) return;

  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  const doSave = () => {
    ensureDataDir();
    fs.writeFileSync(LIBRARY_PATH, JSON.stringify(libraryCache, null, 2));
  };

  if (immediate) {
    doSave();
  } else {
    saveTimeout = setTimeout(doSave, 2000);
  }
}

export function getComic(relativePath: string): ComicEntry | undefined {
  const lib = loadLibrary();
  return lib.comics[relativePath];
}

export function updateComic(relativePath: string, updates: Partial<ComicEntry>) {
  const lib = loadLibrary();
  if (lib.comics[relativePath]) {
    Object.assign(lib.comics[relativePath], updates);
    saveLibrary();
  }
}

export function addComic(relativePath: string, entry: ComicEntry) {
  const lib = loadLibrary();
  lib.comics[relativePath] = entry;
  saveLibrary();
}

export function removeComic(relativePath: string) {
  const lib = loadLibrary();
  delete lib.comics[relativePath];
  saveLibrary();
}

export function getAllComics(): Array<ComicEntry & { path: string }> {
  const lib = loadLibrary();
  return Object.entries(lib.comics).map(([p, c]) => ({ ...c, path: p }));
}

export function flushLibrary() {
  saveLibrary(true);
}
