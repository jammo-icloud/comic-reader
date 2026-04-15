/**
 * Enrichment via AniList GraphQL API (replaces Jikan/MAL).
 * AniList is free, no auth required, and cross-references MAL IDs.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { loadAllSeries, saveSeries, type SeriesRecord } from './data.js';
import { shortHash } from './hash.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const COVERS_DIR = path.join(DATA_DIR, 'series-covers');
const ANILIST_URL = 'https://graphql.anilist.co';
const RATE_LIMIT_MS = 700; // AniList allows ~90 req/min

function ensureCoversDir() {
  if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
}

function coverFilename(seriesId: string): string {
  return `${shortHash(seriesId)}.jpg`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface EnrichResult {
  malId: number | null;
  title: string;
  englishTitle: string | null;
  imageUrl: string;
  score: number | null;
  synopsis: string | null;
}

// --- AniList GraphQL queries ---

async function anilistQuery(query: string, variables: Record<string, any>): Promise<any> {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
    console.log(`  AniList rate limited, waiting ${retryAfter}s...`);
    await sleep(retryAfter * 1000);
    return anilistQuery(query, variables);
  }

  if (!res.ok) {
    throw new Error(`AniList returned ${res.status}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

function parseMedia(media: any): EnrichResult | null {
  if (!media) return null;
  return {
    malId: media.idMal || null,
    title: media.title?.romaji || media.title?.english || 'Unknown',
    englishTitle: media.title?.english || null,
    imageUrl: media.coverImage?.large || media.coverImage?.medium || '',
    score: media.averageScore ? media.averageScore / 10 : null, // AniList uses 0-100, we want 0-10
    synopsis: media.description ? media.description.replace(/<[^>]*>/g, '').trim() : null,
  };
}

const MEDIA_FIELDS = `
  idMal
  title { romaji english native }
  coverImage { large medium }
  averageScore
  description(asHtml: false)
  status
  startDate { year }
`;

/**
 * Fetch by MAL ID via AniList cross-reference
 */
async function fetchByMalId(malId: number): Promise<EnrichResult | null> {
  try {
    const data = await anilistQuery(`
      query ($malId: Int) {
        Media(idMal: $malId, type: MANGA) { ${MEDIA_FIELDS} }
      }
    `, { malId });
    return parseMedia(data?.Media);
  } catch (err) {
    console.error(`  AniList lookup for MAL ID ${malId} failed:`, (err as Error).message);
    return null;
  }
}

/**
 * Search by name via AniList
 */
async function searchManga(query: string): Promise<EnrichResult | null> {
  try {
    const data = await anilistQuery(`
      query ($search: String) {
        Page(perPage: 5) {
          media(search: $search, type: MANGA, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
        }
      }
    `, { search: query });

    const results = data?.Page?.media;
    if (!results?.length) return null;

    // Try to find a close title match
    const queryLower = query.toLowerCase();
    const match = results.find((r: any) => {
      const titles = [r.title?.romaji, r.title?.english, r.title?.native].filter(Boolean);
      return titles.some((t: string) => t.toLowerCase().includes(queryLower) || queryLower.includes(t.toLowerCase()));
    }) || results[0];

    return parseMedia(match);
  } catch (err) {
    console.error(`  AniList search failed for "${query}":`, (err as Error).message);
    return null;
  }
}

/**
 * Search by name — returns match info for the import UI
 */
export async function searchMalForName(query: string): Promise<{
  malId: number; title: string; englishTitle: string | null;
  score: number | null; synopsis: string | null; imageUrl: string;
  year: number | null; status: string;
} | null> {
  try {
    const data = await anilistQuery(`
      query ($search: String) {
        Page(perPage: 5) {
          media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `, { search: query });

    const results = data?.Page?.media;
    if (!results?.length) return null;

    const queryLower = query.toLowerCase();
    const match = results.find((r: any) => {
      const titles = [r.title?.romaji, r.title?.english, r.title?.native].filter(Boolean);
      return titles.some((t: string) => t.toLowerCase().includes(queryLower) || queryLower.includes(t.toLowerCase()));
    }) || results[0];

    if (!match.idMal) return null; // No MAL cross-reference

    return {
      malId: match.idMal,
      title: match.title?.romaji || match.title?.english || query,
      englishTitle: match.title?.english || null,
      score: match.averageScore ? match.averageScore / 10 : null,
      synopsis: match.description ? match.description.replace(/<[^>]*>/g, '').trim() : null,
      imageUrl: match.coverImage?.large || match.coverImage?.medium || '',
      year: match.startDate?.year || null,
      status: match.status?.toLowerCase() || 'unknown',
    };
  } catch {
    return null;
  }
}

// --- Cover download ---

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

// --- Public API ---

export function getSeriesCoverPath(seriesId: string): string | null {
  const filename = coverFilename(seriesId);
  const p = path.join(COVERS_DIR, filename);
  return fs.existsSync(p) ? p : null;
}

// Legacy stubs
export function loadSeriesMetadata() { return {}; }
export function saveOverride() {}

/**
 * Enrich all series from AniList — updates series records directly
 */
export async function enrichSeries(force = false): Promise<{ found: number; skipped: number; failed: number }> {
  ensureCoversDir();
  const allSeries = loadAllSeries();
  let found = 0, skipped = 0, failed = 0;

  console.log(`Enriching ${allSeries.length} series from AniList...`);

  for (const series of allSeries) {
    if (!force && series.coverFile && fs.existsSync(path.join(COVERS_DIR, series.coverFile))) {
      skipped++;
      continue;
    }

    await sleep(RATE_LIMIT_MS);

    let result: EnrichResult | null;
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

    series.name = result.title;
    series.coverFile = downloaded ? filename : null;
    series.score = result.score;
    series.synopsis = result.synopsis;
    series.englishTitle = result.englishTitle;
    if (result.malId && !series.malId) series.malId = result.malId;
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
export async function enrichSingle(seriesId: string, malId: number): Promise<{ series: SeriesRecord; error?: string } | null> {
  ensureCoversDir();
  const allSeries = loadAllSeries();
  const series = allSeries.find((s) => s.id === seriesId);
  if (!series) return null;

  const result = await fetchByMalId(malId);
  if (!result) {
    series.malId = malId;
    saveSeries(series);
    return { series, error: `MAL ID ${malId} not found on AniList. The ID was saved but no metadata was fetched.` };
  }

  const filename = coverFilename(series.id);
  const downloaded = await downloadCover(result.imageUrl, filename);

  const oldName = series.name;
  series.malId = malId;
  series.name = result.title;
  series.coverFile = downloaded ? filename : null;
  series.score = result.score;
  series.synopsis = result.synopsis;
  series.englishTitle = result.englishTitle;
  saveSeries(series);

  console.log(`  Updated "${oldName}" → "${result.title}" (${result.score})`);
  return { series };
}
