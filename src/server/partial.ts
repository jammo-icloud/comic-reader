/**
 * Partial chapter tracking.
 *
 * When a chapter download succeeds for some pages but fails for others (CDN
 * 403s, intermittent network errors, etc.) the assembler writes a multi-page
 * PDF that's *almost* the chapter — minus the failed pages. Without tracking,
 * the >5 KB existence guard in processQueue treats the partial as "done" and
 * the missing pages are unrecoverable.
 *
 * Sidecar files solve this: alongside `Chapter 053.pdf` we write
 * `Chapter 053.partial.json` describing the source URLs and what was missed.
 * The chapter loop reads the sidecar before deciding to skip — if it exists,
 * the chapter is retried. After a successful re-attempt the sidecar is
 * deleted; the PDF is now considered complete.
 *
 * Sidecar shape:
 *   chapterId          — source's identifier; used to re-fetch from the source
 *   sourceId           — which adapter to call (mangatown / mangadex / etc.)
 *   totalPages         — what the source reported on the original attempt
 *   successfulPages    — count embedded in the current PDF on disk
 *   missingPageIndices — 1-based indices of pages still missing (informational)
 *   pageUrls           — full URL list from the original attempt (diagnostic)
 *   lastAttempt        — ISO timestamp; lets the UI surface "tried 5 min ago"
 *   retryCount         — how many times we've retried; UI can warn when stuck
 *
 * Discoverability: sidecars are named with the same stem as their PDF and
 * sit in the same directory. `Chapter 053.pdf` ↔ `Chapter 053.partial.json`.
 * Scanning a series dir for partials is just a glob for `*.partial.json`.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface PartialChapterRecord {
  chapterId: string;
  sourceId: string;
  totalPages: number;
  successfulPages: number;
  missingPageIndices: number[];
  pageUrls: string[];
  lastAttempt: string;
  retryCount: number;
}

/** `Chapter 053.pdf` → `Chapter 053.partial.json`. */
export function partialSidecarPath(pdfPath: string): string {
  return pdfPath.replace(/\.pdf$/i, '.partial.json');
}

export function readPartial(pdfPath: string): PartialChapterRecord | null {
  const p = partialSidecarPath(pdfPath);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (err) {
    console.error(`Corrupt partial sidecar at ${p}: ${(err as Error).message}`);
    return null;
  }
}

export function writePartial(pdfPath: string, record: PartialChapterRecord): void {
  fs.writeFileSync(partialSidecarPath(pdfPath), JSON.stringify(record, null, 2));
}

export function clearPartial(pdfPath: string): void {
  const p = partialSidecarPath(pdfPath);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function hasPartial(pdfPath: string): boolean {
  return fs.existsSync(partialSidecarPath(pdfPath));
}

/**
 * Walk a series directory and return every chapter's partial sidecar.
 * Used by the admin "Retry partial chapters" endpoint to discover what to
 * re-attempt for a given series.
 */
export function listPartialsForSeries(seriesDir: string): Array<{
  pdfFile: string; // basename, e.g. "Chapter 053.pdf"
  record: PartialChapterRecord;
}> {
  if (!fs.existsSync(seriesDir)) return [];
  const out: Array<{ pdfFile: string; record: PartialChapterRecord }> = [];
  for (const entry of fs.readdirSync(seriesDir)) {
    if (!entry.endsWith('.partial.json')) continue;
    const sidecarPath = path.join(seriesDir, entry);
    try {
      const record = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8')) as PartialChapterRecord;
      const pdfFile = entry.replace(/\.partial\.json$/i, '.pdf');
      out.push({ pdfFile, record });
    } catch (err) {
      console.error(`Corrupt partial sidecar at ${sidecarPath}: ${(err as Error).message}`);
    }
  }
  return out;
}
