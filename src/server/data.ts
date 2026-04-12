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
  englishTitle: string | null;  // English title from MAL (when name is Japanese/romaji)
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

// ==================== Per-User Data ====================

const USERS_DIR = path.join(DATA_DIR, 'users');

export interface CollectionEntry {
  seriesId: string;
  addedAt: string;
}

export interface UserProgressRecord {
  seriesId: string;
  file: string;
  currentPage: number;
  isRead: boolean;
  lastReadAt: string | null;
}

export interface UserPreferences {
  theme: 'dark' | 'light';
}

export function userDir(username: string): string {
  return path.join(USERS_DIR, username);
}

export function ensureUserDir(username: string) {
  const dir = userDir(username);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function hasUserData(): boolean {
  return fs.existsSync(USERS_DIR);
}

// --- Collection ---

function collectionPath(username: string): string {
  return path.join(userDir(username), 'collection.jsonl');
}

export function loadCollection(username: string): CollectionEntry[] {
  const p = collectionPath(username);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

export function addToCollection(username: string, seriesId: string) {
  ensureUserDir(username);
  const entries = loadCollection(username);
  if (entries.some((e) => e.seriesId === seriesId)) return; // already present
  entries.push({ seriesId, addedAt: new Date().toISOString() });
  fs.writeFileSync(collectionPath(username), entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

export function removeFromCollection(username: string, seriesId: string) {
  ensureUserDir(username);
  const entries = loadCollection(username).filter((e) => e.seriesId !== seriesId);
  fs.writeFileSync(collectionPath(username), entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

export function isInCollection(username: string, seriesId: string): boolean {
  return loadCollection(username).some((e) => e.seriesId === seriesId);
}

// --- User Progress ---

function progressPath(username: string): string {
  return path.join(userDir(username), 'progress.jsonl');
}

export function loadUserProgress(username: string): UserProgressRecord[] {
  const p = progressPath(username);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

export function loadProgressForSeries(username: string, seriesId: string): Map<string, UserProgressRecord> {
  const all = loadUserProgress(username);
  const map = new Map<string, UserProgressRecord>();
  for (const rec of all) {
    if (rec.seriesId === seriesId) map.set(rec.file, rec);
  }
  return map;
}

export function updateUserProgress(username: string, seriesId: string, file: string, updates: Partial<UserProgressRecord>) {
  ensureUserDir(username);
  const all = loadUserProgress(username);
  const idx = all.findIndex((r) => r.seriesId === seriesId && r.file === file);
  if (idx >= 0) {
    Object.assign(all[idx], updates);
  } else {
    all.push({
      seriesId,
      file,
      currentPage: 0,
      isRead: false,
      lastReadAt: null,
      ...updates,
    });
  }
  fs.writeFileSync(progressPath(username), all.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

// --- Preferences ---

function prefsPath(username: string): string {
  return path.join(userDir(username), 'preferences.json');
}

export function loadPreferences(username: string): UserPreferences {
  const p = prefsPath(username);
  if (!fs.existsSync(p)) return { theme: 'dark' };
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function savePreferences(username: string, prefs: UserPreferences) {
  ensureUserDir(username);
  fs.writeFileSync(prefsPath(username), JSON.stringify(prefs, null, 2));
}

// --- Merged queries (shared comics + user progress) ---

/**
 * Load comics for a series with user-specific progress overlaid.
 * Returns the same ComicRecord shape the client expects.
 */
export function loadComicsForUser(seriesId: string, username: string): ComicRecord[] {
  const shared = loadComics(seriesId);
  const progress = loadProgressForSeries(username, seriesId);

  return shared.map((comic) => {
    const userProg = progress.get(comic.file);
    if (userProg) {
      return {
        ...comic,
        currentPage: userProg.currentPage,
        isRead: userProg.isRead,
        lastReadAt: userProg.lastReadAt,
      };
    }
    // No user progress — return defaults
    return {
      ...comic,
      currentPage: 0,
      isRead: false,
      lastReadAt: null,
    };
  });
}

/**
 * Compute series stats using user-specific progress.
 */
export function getSeriesStatsForUser(seriesId: string, username: string): { count: number; readCount: number; inProgress: number } {
  const comics = loadComicsForUser(seriesId, username);
  return {
    count: comics.length,
    readCount: comics.filter((c) => c.isRead).length,
    inProgress: comics.filter((c) => c.currentPage > 0 && !c.isRead).length,
  };
}
