/**
 * Internet Archive file selection — shared by the comics addon (archiveorg)
 * and the books addon (archiveorg-books).
 *
 * Archive.org items hold many files per upload (originals plus OCR/derivative
 * output). These helpers pick the renderable originals and score them so one
 * canonical file represents each volume or book.
 */
export interface ArchiveFile {
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
export function extractVolumeNumber(filename: string): number | null {
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
 * Prefer:
 *   - PDF > CBZ > CBR > EPUB (last resort — text EPUBs produce low-quality output)
 *   - Standard layout over "[Alternative Layout N]"
 *   - Official publishers ([Yen Press], [Kodansha], [Seven Seas]) over fan translations
 *   - Non-"CalibreV1DPC" / non-"[Kobo]" versions (those are e-reader specific)
 *   - Larger file size (usually higher quality) as last tiebreaker
 */
export function scoreFile(file: ArchiveFile): number {
  const name = file.name.toLowerCase();
  let score = 0;

  // Format preference — image-based formats win, EPUB is fallback
  if (/\.pdf$/i.test(file.name)) score += 1000;
  else if (/\.cbz$/i.test(file.name)) score += 900;
  else if (/\.cbr$/i.test(file.name)) score += 800;
  else if (/\.epub$/i.test(file.name)) score += 300;
  else return -1; // unsupported format (MOBI, DOCX, etc.)

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
export function pickCanonicalFiles(files: ArchiveFile[]): { volume: number; name: string }[] {
  // Only consider "original" files (not derivatives) that are renderable formats
  const supported = files.filter((f) =>
    f.source === 'original' && /\.(pdf|cbz|cbr|epub)$/i.test(f.name)
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

/**
 * The single best renderable original file in an item (for one-file-per-item
 * sources like books), or null when nothing is downloadable.
 */
export function bestFile(files: ArchiveFile[]): ArchiveFile | null {
  let best: ArchiveFile | null = null;
  let bestScore = 0;
  for (const f of files) {
    if (f.source !== 'original' || !/\.(pdf|cbz|cbr|epub)$/i.test(f.name)) continue;
    const score = scoreFile(f);
    if (score > bestScore) { best = f; bestScore = score; }
  }
  return best;
}
