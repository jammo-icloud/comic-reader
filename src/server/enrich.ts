import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { loadAllSeries, saveSeries, type SeriesRecord } from './data.js';
import { shortHash } from './hash.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const COVERS_DIR = path.join(DATA_DIR, 'series-covers');
const JIKAN_BASE = 'https://api.jikan.moe/v4';
const RATE_LIMIT_MS = 400;

function ensureCoversDir() {
  if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
}

function coverFilename(seriesId: string): string {
  return `${shortHash(seriesId)}.jpg`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface MalResult {
  title: string;
  imageUrl: string;
  score: number;
  synopsis: string;
}

async function fetchByMalId(malId: number): Promise<MalResult | null> {
  try {
    const res = await fetch(`${JIKAN_BASE}/manga/${malId}`);
    if (res.status === 429) { await sleep(2000); return fetchByMalId(malId); }
    if (!res.ok) { console.error(`  Jikan returned ${res.status} for MAL ID ${malId}`); return null; }
    const json = await res.json();
    const match = json.data;
    if (!match) return null;

    return {
      title: match.titles?.[0]?.title || `MAL #${malId}`,
      imageUrl: match.images?.jpg?.large_image_url || match.images?.jpg?.image_url || '',
      score: match.score || 0,
      synopsis: match.synopsis || '',
    };
  } catch (err) {
    console.error(`  Fetch MAL ID ${malId} failed:`, (err as Error).message);
    return null;
  }
}

async function searchManga(query: string): Promise<MalResult | null> {
  try {
    const res = await fetch(`${JIKAN_BASE}/manga?q=${encodeURIComponent(query)}&limit=5&sfw=true`);
    if (res.status === 429) { await sleep(2000); return searchManga(query); }
    if (!res.ok) return null;

    const json = await res.json();
    const results = json.data;
    if (!results?.length) return null;

    const queryLower = query.toLowerCase();
    const match = results.find((r: any) =>
      r.titles?.some((t: any) =>
        t.title.toLowerCase().includes(queryLower) || queryLower.includes(t.title.toLowerCase())
      )
    ) || results[0];

    return {
      title: match.titles?.[0]?.title || query,
      imageUrl: match.images?.jpg?.large_image_url || match.images?.jpg?.image_url || '',
      score: match.score || 0,
      synopsis: match.synopsis || '',
    };
  } catch (err) {
    console.error(`  Search failed for "${query}":`, (err as Error).message);
    return null;
  }
}

async function downloadCover(imageUrl: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    await sharp(buffer).resize(300, 450, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(path.join(COVERS_DIR, filename));
    return true;
  } catch (err) {
    console.error(`  Cover download failed:`, (err as Error).message);
    return false;
  }
}

// Kept for backward compat with library routes
export function getSeriesCoverPath(seriesId: string): string | null {
  const filename = coverFilename(seriesId);
  const p = path.join(COVERS_DIR, filename);
  return fs.existsSync(p) ? p : null;
}

// Legacy stubs
export function loadSeriesMetadata() { return {}; }
export function saveOverride() {}

/**
 * Enrich all series from MAL/Jikan — updates series records directly
 */
export async function enrichSeries(force = false): Promise<{ found: number; skipped: number; failed: number }> {
  ensureCoversDir();
  const allSeries = loadAllSeries();
  let found = 0, skipped = 0, failed = 0;

  console.log(`Enriching ${allSeries.length} series from MyAnimeList...`);

  for (const series of allSeries) {
    // Skip if already has cover (unless force)
    if (!force && series.coverFile && fs.existsSync(path.join(COVERS_DIR, series.coverFile))) {
      skipped++;
      continue;
    }

    await sleep(RATE_LIMIT_MS);

    let result: MalResult | null;
    if (series.malId) {
      console.log(`  MAL ID ${series.malId}: "${series.name}"`);
      result = await fetchByMalId(series.malId);
    } else {
      console.log(`  Searching: "${series.name}"`);
      result = await searchManga(series.name);
    }

    if (!result) {
      console.log(`  Not found: "${series.name}"`);
      failed++;
      continue;
    }

    const filename = coverFilename(series.id);
    const downloaded = await downloadCover(result.imageUrl, filename);

    // Update series record directly — one source of truth
    series.coverFile = downloaded ? filename : null;
    series.score = result.score;
    series.synopsis = result.synopsis;
    saveSeries(series);

    found++;
    console.log(`  → "${result.title}" (${result.score})`);
  }

  console.log(`Enrichment: ${found} found, ${skipped} skipped, ${failed} failed`);
  return { found, skipped, failed };
}

/**
 * Enrich a single series by MAL ID — called from the override UI
 */
export async function enrichSingle(seriesId: string, malId: number): Promise<SeriesRecord | null> {
  ensureCoversDir();
  const allSeries = loadAllSeries();
  const series = allSeries.find((s) => s.id === seriesId);
  if (!series) return null;

  const result = await fetchByMalId(malId);
  if (!result) return series;

  const filename = coverFilename(series.id);
  const downloaded = await downloadCover(result.imageUrl, filename);

  series.malId = malId;
  series.coverFile = downloaded ? filename : null;
  series.score = result.score;
  series.synopsis = result.synopsis;
  saveSeries(series);

  console.log(`  Updated "${series.name}" → "${result.title}" (${result.score})`);
  return series;
}
