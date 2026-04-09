import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { getChapterPages, pageImageUrl, getMangaDetail, type MangaDexChapter } from './mangadex.js';
import { getShelf } from './shelves.js';
import { scanLibrary } from './scanner.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const QUEUE_PATH = path.join(DATA_DIR, 'download-queue.json');
const TRACKED_PATH = path.join(DATA_DIR, 'tracked-manga.json');

// --- Types ---

export interface DownloadJob {
  id: string;
  mangaDexId: string;
  mangaTitle: string;
  shelfId: string;
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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadQueue(): DownloadJob[] {
  if (fs.existsSync(QUEUE_PATH)) return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  return [];
}

function saveQueue(queue: DownloadJob[]) {
  ensureDataDir();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
}

export function getQueue(): DownloadJob[] {
  return loadQueue();
}

export function removeFromQueue(id: string) {
  const queue = loadQueue().filter((j) => j.id !== id);
  saveQueue(queue);
}

// --- Tracked manga ---

export function loadTracked(): Record<string, TrackedManga> {
  if (fs.existsSync(TRACKED_PATH)) return JSON.parse(fs.readFileSync(TRACKED_PATH, 'utf-8'));
  return {};
}

function saveTracked(data: Record<string, TrackedManga>) {
  ensureDataDir();
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

async function processQueue() {
  if (processing) return;
  processing = true;

  try {
    while (true) {
      const queue = loadQueue();
      const job = queue.find((j) => j.status === 'queued' || j.status === 'downloading');
      if (!job) break;

      job.status = 'downloading';
      saveQueue(queue);
      emitProgress(job);

      const shelf = getShelf(job.shelfId);
      if (!shelf) {
        job.status = 'error';
        job.error = `Shelf "${job.shelfId}" not found`;
        saveQueue(queue);
        emitProgress(job);
        continue;
      }

      // Create series folder
      const seriesDir = path.join(shelf.path, job.mangaTitle.replace(/[<>:"/\\|?*]/g, '_'));
      if (!fs.existsSync(seriesDir)) fs.mkdirSync(seriesDir, { recursive: true });

      try {
        for (let i = 0; i < job.chapters.length; i++) {
          const ch = job.chapters[i];
          const chapterNum = ch.chapter || 'oneshot';
          const filename = `Chapter ${String(chapterNum).padStart(3, '0')}.pdf`;
          const outputPath = path.join(seriesDir, filename);

          // Skip if already exists
          if (fs.existsSync(outputPath)) {
            job.progress.current = i + 1;
            job.progress.currentChapter = chapterNum;
            saveQueue(queue);
            emitProgress(job);
            continue;
          }

          job.progress.current = i;
          job.progress.currentChapter = chapterNum;
          job.progress.pagesDownloaded = 0;
          job.progress.pagesTotal = ch.pages;
          saveQueue(queue);
          emitProgress(job);

          console.log(`  Downloading Ch.${chapterNum} (${ch.pages} pages)...`);

          await assembleChapterPdf(ch.id, outputPath, () => {
            job.progress.pagesDownloaded++;
            emitProgress(job);
          });

          job.progress.current = i + 1;
          saveQueue(queue);
          emitProgress(job);

          // Rate limit between chapters — longer pause to avoid CDN limits and let GC run
          await sleep(1500);
        }

        job.status = 'complete';
        job.progress.current = job.chapters.length;
        job.progress.currentChapter = null;
        saveQueue(queue);
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

        // Re-scan library to pick up new files
        console.log(`  Download complete: ${job.mangaTitle}. Rescanning...`);
        await scanLibrary();

      } catch (err) {
        job.status = 'error';
        job.error = (err as Error).message;
        saveQueue(queue);
        emitProgress(job);
      }
    }
  } finally {
    processing = false;
  }
}

// Resume any incomplete downloads from a previous crash
export function resumeIncompleteDownloads() {
  const queue = loadQueue();
  const hasIncomplete = queue.some((j) => j.status === 'queued' || j.status === 'downloading');
  if (hasIncomplete) {
    // Reset any 'downloading' back to 'queued' so they restart cleanly
    for (const job of queue) {
      if (job.status === 'downloading') job.status = 'queued';
    }
    saveQueue(queue);
    console.log(`Resuming ${queue.filter(j => j.status === 'queued').length} incomplete download(s)...`);
    setTimeout(() => processQueue(), 1000);
  }
}

export function queueDownload(
  mangaDexId: string,
  mangaTitle: string,
  shelfId: string,
  chapters: { id: string; chapter: string | null; pages: number }[],
  metadata?: DownloadJob['metadata'],
): DownloadJob {
  const queue = loadQueue();

  const job: DownloadJob = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mangaDexId,
    mangaTitle,
    shelfId,
    chapters,
    status: 'queued',
    progress: { current: 0, total: chapters.length, currentChapter: null, pagesDownloaded: 0, pagesTotal: 0 },
    createdAt: new Date().toISOString(),
    metadata,
  };

  queue.push(job);
  saveQueue(queue);

  // Start processing (non-blocking)
  setTimeout(() => processQueue(), 0);

  return job;
}
