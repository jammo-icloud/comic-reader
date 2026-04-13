import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { getChapterPages, pageImageUrl, getMangaDetail, type MangaDexChapter } from './mangadex.js';
import { getPageUrlsFromSource } from './sources/index.js';
import { loadAllSeries, saveSeries, addToCollection, type SeriesRecord } from './data.js';
import { rescanLibrary } from './scanner.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const TASKS_DIR = path.join(DATA_DIR, 'tasks');
const TRACKED_PATH = path.join(DATA_DIR, 'tracked-manga.json');

// --- Types ---

export interface DownloadJob {
  id: string;
  mangaDexId: string;
  mangaTitle: string;
  shelfId: string;
  username: string;
  chapters: { id: string; chapter: string | null; pages: number }[];
  status: 'queued' | 'downloading' | 'complete' | 'error';
  progress: { current: number; total: number; currentChapter: string | null; pagesDownloaded: number; pagesTotal: number };
  error?: string;
  createdAt: string;
  // MangaDex metadata
  metadata?: {
    description?: string;
    status?: string;
    year?: number | null;
    tags?: string[];
    contentRating?: string;
    coverUrl?: string;
  };
}

export interface TrackedManga {
  mangaDexId: string;
  title: string;
  shelfId: string;
  lastSyncedAt: string;
  downloadedChapterIds: string[];
  // Rich metadata from MangaDex
  description?: string;
  status?: string;      // ongoing, completed, hiatus, cancelled
  year?: number | null;
  tags?: string[];
  contentRating?: string;
  coverUrl?: string;
}

// --- SSE listeners ---
type ProgressListener = (job: DownloadJob) => void;
const listeners = new Set<ProgressListener>();

export function onProgress(fn: ProgressListener) { listeners.add(fn); return () => listeners.delete(fn); }
function emitProgress(job: DownloadJob) { listeners.forEach((fn) => fn(job)); }

// --- Queue persistence ---

function ensureTasksDir() {
  if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });
}

function taskPath(id: string): string {
  return path.join(TASKS_DIR, `${id}.json`);
}

function loadTask(id: string): DownloadJob | null {
  const p = taskPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveTask(job: DownloadJob) {
  ensureTasksDir();
  fs.writeFileSync(taskPath(job.id), JSON.stringify(job, null, 2));
}

function deleteTask(id: string) {
  const p = taskPath(id);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function loadAllTasks(): DownloadJob[] {
  ensureTasksDir();
  return fs.readdirSync(TASKS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try { return JSON.parse(fs.readFileSync(path.join(TASKS_DIR, f), 'utf-8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a: DownloadJob, b: DownloadJob) => a.createdAt.localeCompare(b.createdAt));
}

export function getQueue(): DownloadJob[] {
  return loadAllTasks();
}

const cancelledJobs = new Set<string>();

export function removeFromQueue(id: string) {
  deleteTask(id);
}

export function cancelDownload(id: string): boolean {
  const job = loadTask(id);
  if (!job) return false;

  if (job.status === 'queued') {
    deleteTask(id);
    return true;
  }

  if (job.status === 'downloading') {
    cancelledJobs.add(id);
    job.status = 'error';
    job.error = 'Cancelled by user';
    saveTask(job);
    emitProgress(job);
    return true;
  }

  return false;
}

// --- Tracked manga ---

export function loadTracked(): Record<string, TrackedManga> {
  if (fs.existsSync(TRACKED_PATH)) return JSON.parse(fs.readFileSync(TRACKED_PATH, 'utf-8'));
  return {};
}

function saveTracked(data: Record<string, TrackedManga>) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TRACKED_PATH, JSON.stringify(data, null, 2));
}

export function getTrackedList(): TrackedManga[] {
  return Object.values(loadTracked());
}

// --- Download logic ---

let processing = false;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadImage(url: string, retries = 3): Promise<Buffer> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429) {
      console.log(`  Rate limited, waiting ${(attempt + 1) * 3}s...`);
      await sleep((attempt + 1) * 3000);
      continue;
    }
    if (attempt < retries - 1) {
      await sleep(1000);
      continue;
    }
    throw new Error(`Failed to download image: ${res.status}`);
  }
  throw new Error('Download failed after retries');
}

async function assembleChapterPdf(
  chapterId: string,
  outputPath: string,
  onPageDone?: () => void,
): Promise<void> {
  const { baseUrl, pages, hash } = await getChapterPages(chapterId);

  const pdf = await PDFDocument.create();
  const PDF_WIDTH = 800; // consistent width for all pages

  for (let i = 0; i < pages.length; i++) {
    const url = pageImageUrl(baseUrl, hash, pages[i]);

    try {
      const imgBuffer = await downloadImage(url);

      // Resize to consistent width, get dimensions
      const resized = sharp(imgBuffer).resize({ width: PDF_WIDTH, withoutEnlargement: true });
      const { width, height } = await resized.metadata().then((m) => ({
        width: m.width || PDF_WIDTH,
        height: m.height || 1200,
      }));

      // Convert to JPEG for consistent embedding
      const jpegBuffer = await resized.jpeg({ quality: 90 }).toBuffer();
      const jpegImage = await pdf.embedJpg(jpegBuffer);

      const page = pdf.addPage([width, height]);
      page.drawImage(jpegImage, { x: 0, y: 0, width, height });

      onPageDone?.();
    } catch (err) {
      console.error(`  Failed to download page ${i + 1}/${pages.length} of chapter ${chapterId}:`, (err as Error).message);
      onPageDone?.();
    }

    // Delay between pages to be nice to CDN and avoid rate limits
    if (i < pages.length - 1) await sleep(200);
  }

  const pdfBytes = await pdf.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

/**
 * Download chapter from a non-MangaDex source (MangaFox, etc.)
 * Uses the source adapter to get page URLs, then downloads images via proxy-compatible fetch.
 */
async function assembleChapterFromSource(
  chapterId: string,
  outputPath: string,
  onPageDone?: () => void,
): Promise<void> {
  // Determine source from chapterId format
  // MangaFox chapters: "slug/c001"
  const sourceId = 'mangafox'; // Currently the only non-MangaDex source
  const pageUrls = await getPageUrlsFromSource(sourceId, chapterId);

  if (pageUrls.length === 0) {
    console.error(`  No pages found for ${chapterId} from ${sourceId}`);
    onPageDone?.();
    return;
  }

  const pdf = await PDFDocument.create();
  const PDF_WIDTH = 800;

  // CDN referer mapping for image downloads
  const referers: Record<string, string> = {
    'zjcdn.mangafox.me': 'https://fanfox.net/',
    'fmcdn.mfcdn.net': 'https://fanfox.net/',
    'mfcdn.net': 'https://fanfox.net/',
  };

  function getReferer(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      for (const [cdn, ref] of Object.entries(referers)) {
        if (hostname.includes(cdn)) return ref;
      }
    } catch {}
    return '';
  }

  for (let i = 0; i < pageUrls.length; i++) {
    const url = pageUrls[i];
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': getReferer(url),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const imgBuffer = Buffer.from(await res.arrayBuffer());

      const resized = sharp(imgBuffer).resize({ width: PDF_WIDTH, withoutEnlargement: true });
      const { width, height } = await resized.metadata().then((m) => ({
        width: m.width || PDF_WIDTH,
        height: m.height || 1200,
      }));

      const jpegBuffer = await resized.jpeg({ quality: 90 }).toBuffer();
      const jpegImage = await pdf.embedJpg(jpegBuffer);
      const page = pdf.addPage([width, height]);
      page.drawImage(jpegImage, { x: 0, y: 0, width, height });

      onPageDone?.();
    } catch (err) {
      console.error(`  Failed page ${i + 1}/${pageUrls.length}: ${(err as Error).message}`);
      onPageDone?.();
    }

    if (i < pageUrls.length - 1) await sleep(200);
  }

  const pdfBytes = await pdf.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

async function processQueue() {
  if (processing) return;
  processing = true;

  try {
    while (true) {
      // Find next queued or downloading task
      const allTasks = loadAllTasks();
      const job = allTasks.find((j) => j.status === 'queued' || j.status === 'downloading');
      if (!job) break;

      job.status = 'downloading';
      saveTask(job);
      emitProgress(job);

      const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';
      const slugName = job.mangaTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
      const seriesDir = path.join(LIBRARY_DIR, 'comics', slugName);
      if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true });

      // Ensure series record exists (so rescanLibrary can find it)
      const existing = loadAllSeries().find((s) => s.id === slugName);
      if (!existing) {
        const newSeries: SeriesRecord = {
          id: slugName,
          type: 'comic',
          name: job.mangaTitle,
          coverFile: null,
          score: null,
          synopsis: job.metadata?.description || null,
          tags: job.metadata?.tags || [],
          status: job.metadata?.status || null,
          year: job.metadata?.year || null,
          malId: null,
          mangaDexId: job.mangaDexId,
          englishTitle: null,
          placeholder: 'manga.png',
        };
        saveSeries(newSeries);
        console.log(`  Created series record: ${job.mangaTitle}`);
      }

      // Add to the downloading user's collection
      addToCollection(job.username, slugName);
      console.log(`  Added to ${job.username}'s collection: ${slugName}`);

      // Download cover art if available and series doesn't have one yet
      const series = loadAllSeries().find((s) => s.id === slugName);
      if (series && !series.coverFile && job.metadata?.coverUrl) {
        try {
          const DATA_DIR = process.env.DATA_DIR || './data';
          const coversDir = path.join(DATA_DIR, 'series-covers');
          if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });

          const coverUrl = job.metadata.coverUrl;
          // Resolve cover URLs to actual CDN URLs
          let actualUrl: string;
          if (coverUrl.startsWith('/api/discover/proxy-image?url=')) {
            // MangaFox proxy URL — extract the real CDN URL
            actualUrl = decodeURIComponent(coverUrl.replace('/api/discover/proxy-image?url=', ''));
          } else if (coverUrl.startsWith('/api/discover/cover/')) {
            // MangaDex proxy URL — convert to direct CDN URL
            // /api/discover/cover/{mangaId}/{filename} → https://uploads.mangadex.org/covers/{mangaId}/{filename}
            const parts = coverUrl.replace('/api/discover/cover/', '').split('/');
            actualUrl = `https://uploads.mangadex.org/covers/${parts[0]}/${parts[1]}`;
          } else if (coverUrl.startsWith('/')) {
            // Other relative URLs — can't resolve, skip
            console.error(`  Can't resolve relative cover URL: ${coverUrl}`);
            actualUrl = '';
          } else {
            actualUrl = coverUrl;
          }

          if (!actualUrl) throw new Error('No resolvable cover URL');

          const coverRes = await fetch(actualUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': actualUrl.includes('mangadex') ? 'https://mangadex.org/' :
                         actualUrl.includes('mfcdn') || actualUrl.includes('fanfox') ? 'https://fanfox.net/' : '',
            },
          });
          if (coverRes.ok) {
            const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
            const { shortHash } = await import('./hash.js');
            const filename = `${shortHash(slugName)}.jpg`;
            const sharp = (await import('sharp')).default;
            await sharp(coverBuffer).resize(300, 450, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(path.join(coversDir, filename));
            series.coverFile = filename;
            saveSeries(series);
            console.log(`  Set cover for "${job.mangaTitle}"`);
          }
        } catch (err) {
          console.error(`  Cover download failed:`, (err as Error).message);
        }
      }

      try {
        let wasCancelled = false;
        const skippedChapters: string[] = [];

        for (let i = 0; i < job.chapters.length; i++) {
          // Re-read task from disk to check for cancellation
          if (cancelledJobs.has(job.id)) {
            cancelledJobs.delete(job.id);
            wasCancelled = true;
            console.log(`  Download cancelled: ${job.mangaTitle}`);
            break;
          }

          const ch = job.chapters[i];
          const chapterNum = ch.chapter || 'oneshot';
          const filename = `Chapter ${String(chapterNum).padStart(3, '0')}.pdf`;
          const outputPath = path.join(seriesDir, filename);

          // Skip if already exists
          if (fs.existsSync(outputPath)) {
            job.progress.current = i + 1;
            job.progress.currentChapter = chapterNum;
            saveTask(job);
            emitProgress(job);
            continue;
          }

          job.progress.current = i;
          job.progress.currentChapter = chapterNum;
          job.progress.pagesDownloaded = 0;
          job.progress.pagesTotal = ch.pages;
          saveTask(job);
          emitProgress(job);

          console.log(`  Downloading Ch.${chapterNum} (${ch.pages} pages)...`);

          try {
            // Determine source — MangaDex chapter IDs are UUIDs, others are slugs
            const isMangaDex = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(ch.id);

            if (isMangaDex) {
              await assembleChapterPdf(ch.id, outputPath, () => {
                job.progress.pagesDownloaded++;
                emitProgress(job);
              });
            } else {
              await assembleChapterFromSource(ch.id, outputPath, () => {
                job.progress.pagesDownloaded++;
                emitProgress(job);
              });
            }
          } catch (chErr) {
            // Skip this chapter but continue with the rest
            console.error(`  Ch.${chapterNum} failed: ${(chErr as Error).message} — skipping`);
            skippedChapters.push(chapterNum);
          }

          job.progress.current = i + 1;
          saveTask(job);
          emitProgress(job);

          // Rate limit between chapters
          await sleep(1500);
        }

        if (wasCancelled) {
          // Status already set to 'error' by cancelDownload()
          // Just re-scan for any chapters that did complete
          await rescanLibrary();
        } else {
          job.status = 'complete';
          job.progress.current = job.chapters.length;
          job.progress.currentChapter = null;
          saveTask(job);
          emitProgress(job);

          // Track this manga for future sync — include rich metadata
          const tracked = loadTracked();
          tracked[job.mangaDexId] = {
            mangaDexId: job.mangaDexId,
            title: job.mangaTitle,
            shelfId: job.shelfId,
            lastSyncedAt: new Date().toISOString(),
            downloadedChapterIds: job.chapters.map((c) => c.id),
            ...(job.metadata || {}),
          };
          saveTracked(tracked);

          // Note skipped chapters in the job error field (visible in UI)
          if (skippedChapters.length > 0) {
            job.error = `Skipped ${skippedChapters.length} chapter(s): ${skippedChapters.join(', ')}`;
          }

          // Re-scan library to pick up new files
          const skipNote = skippedChapters.length > 0 ? ` (${skippedChapters.length} skipped)` : '';
          console.log(`  Download complete: ${job.mangaTitle}${skipNote}. Rescanning...`);
          await rescanLibrary();
        }

      } catch (err) {
        job.status = 'error';
        job.error = (err as Error).message;
        saveTask(job);
        emitProgress(job);
      }
    }
  } finally {
    processing = false;
  }
}

// Resume any incomplete downloads from a previous crash
export function resumeIncompleteDownloads() {
  const tasks = loadAllTasks();
  const incomplete = tasks.filter((j) => j.status === 'queued' || j.status === 'downloading');
  if (incomplete.length > 0) {
    for (const job of incomplete) {
      if (job.status === 'downloading') {
        job.status = 'queued';
        saveTask(job);
      }
    }
    console.log(`Resuming ${incomplete.length} incomplete download(s)...`);
    setTimeout(() => processQueue(), 1000);
  }
}

export function queueDownload(
  mangaDexId: string,
  mangaTitle: string,
  shelfId: string,
  chapters: { id: string; chapter: string | null; pages: number }[],
  metadata?: DownloadJob['metadata'],
  username?: string,
): DownloadJob {
  const job: DownloadJob = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mangaDexId,
    mangaTitle,
    shelfId,
    username: username || process.env.DEFAULT_USER || 'local',
    chapters,
    status: 'queued',
    progress: { current: 0, total: chapters.length, currentChapter: null, pagesDownloaded: 0, pagesTotal: 0 },
    createdAt: new Date().toISOString(),
    metadata,
  };

  saveTask(job);

  // Start processing (non-blocking)
  setTimeout(() => processQueue(), 0);

  return job;
}
