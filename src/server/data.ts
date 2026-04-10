import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const SERIES_FILE = path.join(DATA_DIR, 'series.jsonl');
const COMICS_DIR = path.join(DATA_DIR, 'comics');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// --- Slugify ---

export function slugify(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// --- Series ---

export interface SeriesRecord {
  id: string;           // slugified folder name
  type: 'comic' | 'magazine';
  name: string;         // original folder name
  // Metadata (from MAL, MangaDex, or manual)
  coverFile: string | null;    // filename in data/series-covers/
  score: number | null;
  synopsis: string | null;
  tags: string[];
  status: string | null;       // ongoing, completed, hiatus, cancelled
  year: number | null;
  malId: number | null;
  mangaDexId: string | null;
  placeholder: string;         // default placeholder image
}

// JSONL read/write for series

export function loadAllSeries(): SeriesRecord[] {
  if (!fs.existsSync(SERIES_FILE)) return [];
  const lines = fs.readFileSync(SERIES_FILE, 'utf-8').split('\n').filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

export function saveSeries(series: SeriesRecord) {
  ensureDir(DATA_DIR);
  const all = loadAllSeries();
  const idx = all.findIndex((s) => s.id === series.id);
  if (idx >= 0) {
    all[idx] = series;
  } else {
    all.push(series);
  }
  writeAllSeries(all);
}

export function writeAllSeries(series: SeriesRecord[]) {
  ensureDir(DATA_DIR);
  const content = series.map((s) => JSON.stringify(s)).join('\n') + '\n';
  fs.writeFileSync(SERIES_FILE, content);
}

export function getSeries(id: string): SeriesRecord | undefined {
  return loadAllSeries().find((s) => s.id === id);
}

export function getSeriesByName(name: string): SeriesRecord | undefined {
  return loadAllSeries().find((s) => s.name === name);
}

export function removeSeries(id: string) {
  const all = loadAllSeries().filter((s) => s.id !== id);
  writeAllSeries(all);
  // Also remove the comics file
  const comicsFile = comicsFilePath(id);
  if (fs.existsSync(comicsFile)) fs.unlinkSync(comicsFile);
}

// --- Comics (per series) ---

export interface ComicRecord {
  file: string;         // relative path within the series folder (e.g. "Ch.055.pdf")
  pages: number;        // 0 until first read
  currentPage: number;
  isRead: boolean;
  order: number;        // sort order (extracted from filename)
  lastReadAt: string | null;
}

function comicsFilePath(seriesId: string): string {
  return path.join(COMICS_DIR, `${seriesId}.jsonl`);
}

export function loadComics(seriesId: string): ComicRecord[] {
  const filePath = comicsFilePath(seriesId);
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

export function writeComics(seriesId: string, comics: ComicRecord[]) {
  ensureDir(COMICS_DIR);
  const content = comics.map((c) => JSON.stringify(c)).join('\n') + '\n';
  fs.writeFileSync(comicsFilePath(seriesId), content);
}

export function updateComic(seriesId: string, file: string, updates: Partial<ComicRecord>) {
  const comics = loadComics(seriesId);
  const idx = comics.findIndex((c) => c.file === file);
  if (idx >= 0) {
    Object.assign(comics[idx], updates);
    writeComics(seriesId, comics);
  }
}

export function getComic(seriesId: string, file: string): ComicRecord | undefined {
  return loadComics(seriesId).find((c) => c.file === file);
}

// --- Helpers ---

export function getSeriesStats(seriesId: string): { count: number; readCount: number; inProgress: number } {
  const comics = loadComics(seriesId);
  return {
    count: comics.length,
    readCount: comics.filter((c) => c.isRead).length,
    inProgress: comics.filter((c) => c.currentPage > 0 && !c.isRead).length,
  };
}

/**
 * Resolve a comic to its full filesystem path.
 * Uses canonical structure: /library/{type}s/{series-id}/{file}
 */
const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';

export function resolveComicPath(seriesId: string, file: string): string | null {
  const series = getSeries(seriesId);
  if (!series) return null;
  const typeDir = series.type === 'comic' ? 'comics' : 'magazines';
  return path.join(LIBRARY_DIR, typeDir, series.id, file);
}

/**
 * Flush/cleanup: remove series that have zero comics
 */
export function pruneEmptySeries() {
  const all = loadAllSeries();
  const pruned = all.filter((s) => loadComics(s.id).length > 0);
  if (pruned.length < all.length) {
    writeAllSeries(pruned);
  }
}
