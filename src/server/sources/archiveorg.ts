/**
 * Internet Archive connector.
 *
 * Archive.org items work differently from scraped sources:
 * - One item = one series (e.g., "manga_No_Game_No_Life")
 * - Each file inside an item = one volume/chapter
 * - Items have multiple variants per volume (EPUB, PDF, fan vs official translations)
 *
 * We group files by volume number and pick a canonical file per volume.
 *
 * Download path: pageUrls returns a single URL to the file. The downloader
 * short-circuits its normal image-stitching flow and downloads the file directly.
 */
import type { MangaSource, SearchResult, ChapterResult } from './types.js';

const API = 'https://archive.org';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const RATE_LIMIT_MS = 300;

let lastRequest = 0;
async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchJson(url: string): Promise<any> {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequest));
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Archive.org fetch failed: ${res.status}`);
  return res.json();
}

// --- Volume + canonical file selection ---

interface ArchiveFile {
  name: string;
  size: string;
  format: string;
  source: string;
}

/**
 * Extract a volume number from a filename.
 * Handles: "Volume 01", "Vol. 1", "v01", " 01 ", "#001"
 * Returns the first meaningful number, or null if nothing found.
 */
function extractVolumeNumber(filename: string): number | null {
  // Strip the extension
  const name = filename.replace(/\.[^.]+$/, '');
  // Try volume-like patterns first
  const volMatch = name.match(/(?:volume|vol\.?|v)\s*(\d+(?:\.\d+)?)/i);
  if (volMatch) return parseFloat(volMatch[1]);
  // Chapter / issue
  const chMatch = name.match(/(?:chapter|ch\.?|issue|#|c)\s*(\d+(?:\.\d+)?)/i);
  if (chMatch) return parseFloat(chMatch[1]);
  // Any standalone number (heuristic for "No Game No Life 01.pdf")
  const numMatch = name.match(/\s(\d{1,4}(?:\.\d+)?)\b/);
  if (numMatch) return parseFloat(numMatch[1]);
  return null;
}

/**
 * Score a file for "canonical" selection (higher = better).
 * Only renderable formats (PDF/CBZ/CBR) — EPUB excluded, we can't display them.
 * Prefer:
 *   - PDF > CBZ > CBR
 *   - Standard layout over "[Alternative Layout N]"
 *   - Official publishers ([Yen Press], [Kodansha], [Seven Seas]) over fan translations
 *   - Non-"CalibreV1DPC" / non-"[Kobo]" versions (those are e-reader specific)
 *   - Larger file size (usually higher quality) as last tiebreaker
 */
function scoreFile(file: ArchiveFile): number {
  const name = file.name.toLowerCase();
  let score = 0;

  // Format preference — only renderable formats
  if (/\.pdf$/i.test(file.name)) score += 1000;
  else if (/\.cbz$/i.test(file.name)) score += 900;
  else if (/\.cbr$/i.test(file.name)) score += 800;
  else return -1; // unsupported format (EPUB, MOBI, etc.)

  // Official publisher bonus
  if (/\[yen press\]|\[kodansha\]|\[seven seas\]|\[viz\]|\[dark horse\]/i.test(name)) score += 200;

  // Penalize variants
  if (/\[alternative layout/i.test(name)) score -= 150;
  if (/\[kobo\]|calibrev\d/i.test(name)) score -= 100;

  // Size as weak tiebreaker (larger = usually better scans)
  const size = parseInt(file.size, 10) || 0;
  score += Math.min(50, Math.floor(size / 1024 / 1024 / 2)); // cap bonus at 50

  return score;
}

/**
 * Group files by volume number and pick the best file for each volume.
 */
function pickCanonicalFiles(files: ArchiveFile[]): { volume: number; name: string }[] {
  // Only consider "original" files (not derivatives) that are renderable formats
  const supported = files.filter((f) =>
    f.source === 'original' && /\.(pdf|cbz|cbr)$/i.test(f.name)
  );

  // Group by volume number
  const byVolume = new Map<number, ArchiveFile[]>();
  const unnumbered: ArchiveFile[] = [];

  for (const f of supported) {
    const vol = extractVolumeNumber(f.name);
    if (vol !== null) {
      if (!byVolume.has(vol)) byVolume.set(vol, []);
      byVolume.get(vol)!.push(f);
    } else {
      unnumbered.push(f);
    }
  }

  const picks: { volume: number; name: string }[] = [];

  // For each volume, pick the highest-scoring file
  for (const [vol, group] of byVolume) {
    const scored = group.map((f) => ({ f, score: scoreFile(f) })).filter((s) => s.score > 0);
    if (scored.length === 0) continue;
    scored.sort((a, b) => b.score - a.score);
    picks.push({ volume: vol, name: scored[0].f.name });
  }

  // Unnumbered files — each becomes its own chapter (use array index)
  for (let i = 0; i < unnumbered.length; i++) {
    const score = scoreFile(unnumbered[i]);
    if (score > 0) picks.push({ volume: 1000 + i, name: unnumbered[i].name });
  }

  picks.sort((a, b) => a.volume - b.volume);
  return picks;
}

// --- Source interface ---

export const archiveorgSource: MangaSource = {
  id: 'archiveorg',
  name: 'Internet Archive',

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    // Title-scoped query gets much more relevant results than full-text.
    // Quote the phrase so the words have to appear together.
    const phrase = query.trim().replace(/"/g, '');
    const q = `title:("${phrase}" OR ${phrase}) AND mediatype:texts`;
    const url = `${API}/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=description&sort[]=downloads+desc&rows=${limit}&output=json`;

    let data;
    try {
      data = await fetchJson(url);
    } catch (err) {
      console.error(`Archive.org search failed: ${(err as Error).message}`);
      return [];
    }

    const docs = data?.response?.docs || [];
    return docs.map((d: any) => {
      const desc = Array.isArray(d.description) ? d.description[0] : d.description;
      const year = d.date ? parseInt(String(d.date).slice(0, 4), 10) : null;
      return {
        sourceId: 'archiveorg',
        sourceName: 'Internet Archive',
        mangaId: d.identifier,
        title: d.title || d.identifier,
        coverUrl: `${API}/services/img/${d.identifier}`,
        description: typeof desc === 'string' ? desc.replace(/<[^>]+>/g, '').slice(0, 400) : '',
        status: 'completed',
        year: year && year >= 1900 && year <= 2100 ? year : null,
        tags: [],
      };
    });
  },

  async getChapters(identifier: string): Promise<ChapterResult[]> {
    let meta;
    try {
      meta = await fetchJson(`${API}/metadata/${identifier}`);
    } catch (err) {
      console.error(`Archive.org metadata failed: ${(err as Error).message}`);
      return [];
    }

    const files: ArchiveFile[] = meta?.files || [];
    const picks = pickCanonicalFiles(files);

    return picks.map((p) => ({
      sourceId: 'archiveorg',
      chapterId: `${identifier}|${p.name}`, // identifier and filename separated by pipe
      chapter: String(p.volume),
      title: p.name.replace(/\.[^.]+$/, ''), // strip extension
      pages: 0,
      scanlationGroup: null,
    }));
  },

  async getPageUrls(chapterId: string): Promise<string[]> {
    // chapterId is "identifier|filename"
    const pipe = chapterId.indexOf('|');
    if (pipe < 0) return [];
    const identifier = chapterId.slice(0, pipe);
    const filename = chapterId.slice(pipe + 1);

    // Return a single URL to the file — downloader short-circuits for PDF/CBR/CBZ
    return [`${API}/download/${identifier}/${encodeURIComponent(filename)}`];
  },
};
