import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { loadLibrary, saveLibrary, getAllComics } from './library.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const COVERS_DIR = path.join(DATA_DIR, 'series-covers');
const OVERRIDES_PATH = path.join(DATA_DIR, 'series-overrides.json');
const JIKAN_BASE = 'https://api.jikan.moe/v4';

// Jikan has a rate limit of ~3 requests/second
const RATE_LIMIT_MS = 400;

function ensureCoversDir() {
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }
}

function coverPath(seriesName: string): string {
  const hash = Buffer.from(seriesName).toString('base64url');
  return path.join(COVERS_DIR, `${hash}.jpg`);
}

export function getSeriesCoverPath(seriesName: string): string | null {
  const cp = coverPath(seriesName);
  return fs.existsSync(cp) ? cp : null;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface MangaResult {
  title: string;
  imageUrl: string;
  score: number;
  synopsis: string;
}

function loadOverrides(): Record<string, { malId: number }> {
  if (fs.existsSync(OVERRIDES_PATH)) {
    return JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8'));
  }
  return {};
}

async function fetchByMalId(malId: number): Promise<MangaResult | null> {
  try {
    const url = `${JIKAN_BASE}/manga/${malId}`;
    const res = await fetch(url);

    if (res.status === 429) {
      console.log('  Rate limited, waiting 2s...');
      await sleep(2000);
      return fetchByMalId(malId);
    }

    if (!res.ok) {
      console.error(`  Jikan returned ${res.status} for MAL ID ${malId}`);
      return null;
    }

    const json = await res.json();
    const match = json.data;
    if (!match) return null;

    const imageUrl =
      match.images?.jpg?.large_image_url ||
      match.images?.jpg?.image_url ||
      match.images?.webp?.large_image_url;

    if (!imageUrl) return null;

    return {
      title: match.titles?.[0]?.title || match.title || `MAL #${malId}`,
      imageUrl,
      score: match.score || 0,
      synopsis: match.synopsis || '',
    };
  } catch (err) {
    console.error(`  Fetch by MAL ID ${malId} failed:`, (err as Error).message);
    return null;
  }
}

async function searchManga(query: string): Promise<MangaResult | null> {
  try {
    const url = `${JIKAN_BASE}/manga?q=${encodeURIComponent(query)}&limit=5&sfw=true`;
    const res = await fetch(url);

    if (res.status === 429) {
      console.log('  Rate limited, waiting 2s...');
      await sleep(2000);
      return searchManga(query);
    }

    if (!res.ok) return null;

    const json = await res.json();
    const results = json.data;
    if (!results || results.length === 0) return null;

    // Try to find best match — prefer exact-ish title match
    const queryLower = query.toLowerCase();
    const match = results.find((r: any) =>
      r.titles?.some((t: any) =>
        t.title.toLowerCase().includes(queryLower) ||
        queryLower.includes(t.title.toLowerCase())
      )
    ) || results[0];

    const imageUrl =
      match.images?.jpg?.large_image_url ||
      match.images?.jpg?.image_url ||
      match.images?.webp?.large_image_url;

    if (!imageUrl) return null;

    return {
      title: match.titles?.[0]?.title || match.title || query,
      imageUrl,
      score: match.score || 0,
      synopsis: match.synopsis || '',
    };
  } catch (err) {
    console.error(`  Search failed for "${query}":`, (err as Error).message);
    return null;
  }
}

async function downloadImage(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;

    const buffer = Buffer.from(await res.arrayBuffer());
    await sharp(buffer)
      .resize(300, 450, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toFile(destPath);

    return true;
  } catch (err) {
    console.error(`  Download failed:`, (err as Error).message);
    return false;
  }
}

export interface SeriesMetadata {
  coverPath: string | null;
  malTitle: string | null;
  score: number | null;
  synopsis: string | null;
}

// Load/save series metadata
const METADATA_PATH = path.join(DATA_DIR, 'series-metadata.json');

export function loadSeriesMetadata(): Record<string, SeriesMetadata> {
  if (fs.existsSync(METADATA_PATH)) {
    return JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
  }
  return {};
}

function saveSeriesMetadata(data: Record<string, SeriesMetadata>) {
  fs.writeFileSync(METADATA_PATH, JSON.stringify(data, null, 2));
}

export async function enrichSeries(force = false): Promise<{ found: number; skipped: number; failed: number }> {
  ensureCoversDir();

  const comics = getAllComics();
  const seriesNames = [...new Set(comics.map((c) => c.series))];
  const metadata = loadSeriesMetadata();
  const overrides = loadOverrides();

  let found = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`Enriching ${seriesNames.length} series from MyAnimeList...`);
  if (Object.keys(overrides).length > 0) {
    console.log(`  ${Object.keys(overrides).length} manual override(s) loaded`);
  }

  for (const series of seriesNames) {
    // Check overrides with normalized key matching (handle curly vs straight quotes etc.)
    const normalize = (s: string) => s.normalize('NFKC').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
    const override = overrides[series] || Object.entries(overrides).find(
      ([k]) => normalize(k) === normalize(series)
    )?.[1];

    // Skip if already enriched (unless force or has a new override)
    if (!force && !override && metadata[series]?.coverPath && fs.existsSync(metadata[series].coverPath!)) {
      skipped++;
      continue;
    }
    // Skip if override already applied (unless force)
    if (!force && override && metadata[series]?.coverPath && fs.existsSync(metadata[series].coverPath!)) {
      // Check if the override was already used by comparing malTitle
      // If metadata exists and has a cover, skip unless force
      skipped++;
      continue;
    }

    await sleep(RATE_LIMIT_MS);

    let result: MangaResult | null;
    if (override) {
      console.log(`  Override: "${series}" → MAL ID ${override.malId}`);
      result = await fetchByMalId(override.malId);
    } else {
      console.log(`  Searching: "${series}"...`);
      result = await searchManga(series);
    }
    if (!result) {
      console.log(`  Not found: "${series}"`);
      metadata[series] = { coverPath: null, malTitle: null, score: null, synopsis: null };
      failed++;
      continue;
    }

    console.log(`  Found: "${result.title}" (score: ${result.score})`);

    const cp = coverPath(series);
    const downloaded = await downloadImage(result.imageUrl, cp);

    metadata[series] = {
      coverPath: downloaded ? cp : null,
      malTitle: result.title,
      score: result.score,
      synopsis: result.synopsis,
    };

    if (downloaded) {
      found++;
      console.log(`  Cover saved for "${series}"`);
    } else {
      failed++;
    }
  }

  saveSeriesMetadata(metadata);
  console.log(`\nEnrichment complete: ${found} found, ${skipped} skipped, ${failed} failed`);
  return { found, skipped, failed };
}

export function saveOverride(seriesName: string, malId: number) {
  const overrides = loadOverrides();
  overrides[seriesName] = { malId };
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2));
}

export async function enrichSingle(seriesName: string, malId: number): Promise<SeriesMetadata> {
  ensureCoversDir();
  const metadata = loadSeriesMetadata();

  console.log(`  Fetching MAL ID ${malId} for "${seriesName}"...`);
  const result = await fetchByMalId(malId);

  if (!result) {
    const entry: SeriesMetadata = { coverPath: null, malTitle: null, score: null, synopsis: null };
    metadata[seriesName] = entry;
    saveSeriesMetadata(metadata);
    return entry;
  }

  const cp = coverPath(seriesName);
  const downloaded = await downloadImage(result.imageUrl, cp);

  const entry: SeriesMetadata = {
    coverPath: downloaded ? cp : null,
    malTitle: result.title,
    score: result.score,
    synopsis: result.synopsis,
  };

  metadata[seriesName] = entry;
  saveSeriesMetadata(metadata);
  console.log(`  Updated "${seriesName}" → "${result.title}" (${result.score})`);
  return entry;
}
