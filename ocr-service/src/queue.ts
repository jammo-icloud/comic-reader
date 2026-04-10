import fs from 'fs';
import path from 'path';
import { ocrPdf } from './ocr.js';
import { summarize } from './summarizer.js';
import { getPrompt, type Genre } from './prompts.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const QUEUE_PATH = path.join(DATA_DIR, 'ocr-queue.json');
const RESULTS_DIR = path.join(DATA_DIR, 'ocr-results');

// --- Types ---

export interface OcrJob {
  id: string;
  filePath: string;
  comicKey: string;
  title: string;
  genre: Genre;
  status: 'queued' | 'ocr' | 'summarizing' | 'complete' | 'error';
  progress: { currentPage: number; totalPages: number; phase: string };
  error?: string;
  createdAt: string;
}

export interface OcrCachedResult {
  comicKey: string;
  title: string;
  processedAt: string;
  pageCount: number;
  ocrText: string;
  avgConfidence: number;
  summary: string;
  genre: string;
  model: string;
  durationMs: number;
}

// --- SSE ---

type ProgressListener = (job: OcrJob) => void;
const listeners = new Set<ProgressListener>();
export function onProgress(fn: ProgressListener) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(job: OcrJob) { listeners.forEach((fn) => fn(job)); }

// --- Persistence ---

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function loadQueue(): OcrJob[] {
  if (fs.existsSync(QUEUE_PATH)) return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  return [];
}

function saveQueue(queue: OcrJob[]) {
  ensure();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2));
}

function resultPath(comicKey: string): string {
  const hash = Buffer.from(comicKey).toString('base64url');
  return path.join(RESULTS_DIR, `${hash}.json`);
}

// --- Public API ---

export function getQueue(): OcrJob[] { return loadQueue(); }

export function getCachedResult(comicKey: string): OcrCachedResult | null {
  const p = resultPath(comicKey);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  return null;
}

const cancelledJobs = new Set<string>();

export function cancelJob(id: string): boolean {
  const queue = loadQueue();
  const job = queue.find((j) => j.id === id);
  if (!job) return false;
  if (job.status === 'queued') {
    saveQueue(queue.filter((j) => j.id !== id));
    return true;
  }
  if (job.status === 'ocr' || job.status === 'summarizing') {
    cancelledJobs.add(id);
    job.status = 'error';
    job.error = 'Cancelled';
    saveQueue(queue);
    emit(job);
    return true;
  }
  return false;
}

export function removeJob(id: string) {
  saveQueue(loadQueue().filter((j) => j.id !== id));
}

// --- Processing ---

let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;

  try {
    while (true) {
      const queue = loadQueue();
      const job = queue.find((j) => j.status === 'queued' || j.status === 'ocr' || j.status === 'summarizing');
      if (!job) break;

      // Phase 1: OCR
      if (job.status === 'queued' || job.status === 'ocr') {
        job.status = 'ocr';
        job.progress.phase = 'Extracting text (OCR)';
        saveQueue(queue);
        emit(job);

        if (!fs.existsSync(job.filePath)) {
          job.status = 'error';
          job.error = `File not found: ${job.filePath}`;
          saveQueue(queue);
          emit(job);
          continue;
        }

        console.log(`OCR: ${job.title} (${job.filePath})`);

        try {
          const ocrResult = await ocrPdf(job.filePath, (pageResult, current, total) => {
            if (cancelledJobs.has(job.id)) return;
            job.progress.currentPage = current;
            job.progress.totalPages = total;
            emit(job);
          });

          if (cancelledJobs.has(job.id)) {
            cancelledJobs.delete(job.id);
            continue;
          }

          // Phase 2: Summarize
          job.status = 'summarizing';
          job.progress.phase = 'Generating summary (LLM)';
          saveQueue(queue);
          emit(job);

          console.log(`  OCR done: ${ocrResult.fullText.length} chars, avg confidence: ${ocrResult.avgConfidence.toFixed(1)}%`);
          console.log(`  Summarizing with Ollama...`);

          const prompt = getPrompt(job.genre, ocrResult.fullText);
          const summaryResult = await summarize(prompt);

          console.log(`  Summary generated (${summaryResult.durationMs}ms)`);

          // Save result
          ensure();
          const result: OcrCachedResult = {
            comicKey: job.comicKey,
            title: job.title,
            processedAt: new Date().toISOString(),
            pageCount: ocrResult.pageCount,
            ocrText: ocrResult.fullText,
            avgConfidence: ocrResult.avgConfidence,
            summary: summaryResult.summary,
            genre: job.genre,
            model: summaryResult.model,
            durationMs: summaryResult.durationMs,
          };
          fs.writeFileSync(resultPath(job.comicKey), JSON.stringify(result, null, 2));

          job.status = 'complete';
          job.progress.phase = 'Done';
          saveQueue(queue);
          emit(job);

        } catch (err) {
          job.status = 'error';
          job.error = (err as Error).message;
          saveQueue(queue);
          emit(job);
        }
      }
    }
  } finally {
    processing = false;
  }
}

export function queueOcr(
  filePath: string,
  comicKey: string,
  title: string,
  genre: Genre = 'general',
): OcrJob {
  // Check cache first
  const cached = getCachedResult(comicKey);
  if (cached) {
    // Return a fake "complete" job so the caller knows it's done
    return {
      id: 'cached',
      filePath,
      comicKey,
      title,
      genre,
      status: 'complete',
      progress: { currentPage: 0, totalPages: 0, phase: 'Cached' },
      createdAt: cached.processedAt,
    };
  }

  const queue = loadQueue();
  const job: OcrJob = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filePath,
    comicKey,
    title,
    genre,
    status: 'queued',
    progress: { currentPage: 0, totalPages: 0, phase: 'Queued' },
    createdAt: new Date().toISOString(),
  };

  queue.push(job);
  saveQueue(queue);
  setTimeout(() => processQueue(), 0);

  return job;
}

export function resumeIncomplete() {
  const queue = loadQueue();
  const incomplete = queue.filter((j) => j.status === 'ocr' || j.status === 'summarizing');
  if (incomplete.length > 0) {
    for (const job of incomplete) job.status = 'queued';
    saveQueue(queue);
    console.log(`Resuming ${incomplete.length} OCR job(s)...`);
    setTimeout(() => processQueue(), 1000);
  }
}
