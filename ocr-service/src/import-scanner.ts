import fs from 'fs';
import path from 'path';

const JIKAN_BASE = 'https://api.jikan.moe/v4';
const RATE_LIMIT_MS = 500;
const DATA_DIR = process.env.DATA_DIR || './data';
const PENDING_FILE = path.join(DATA_DIR, 'pending-imports.json');

// --- Types ---

export interface MalMatch {
  malId: number;
  title: string;
  score: number;
  synopsis: string;
  imageUrl: string;
  year: number | null;
  status: string;
}

export interface PendingImport {
  sourceFolder: string;
  folderName: string;
  suggestedType: 'comic' | 'magazine';
  fileCount: number;
  files: string[];
  malMatch: MalMatch | null;
  status: 'queued' | 'scanning' | 'ready' | 'confirmed' | 'skipped' | 'error';
  error?: string;
}

export interface ScanJob {
  id: string;
  sourcePath: string;
  status: 'scanning' | 'complete' | 'error';
  progress: { current: number; total: number; currentFolder: string | null };
  error?: string;
}

// --- SSE ---

type ProgressListener = (data: { type: 'scan-progress' | 'pending-update'; payload: any }) => void;
const listeners = new Set<ProgressListener>();
export function onImportProgress(fn: ProgressListener) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(type: 'scan-progress' | 'pending-update', payload: any) {
  listeners.forEach((fn) => fn({ type, payload }));
}

// --- Persistence ---

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadPending(): PendingImport[] {
  if (fs.existsSync(PENDING_FILE)) return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
  return [];
}

function savePending(pending: PendingImport[]) {
  ensureDir();
  fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));
}

// --- MAL search ---

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchMal(query: string): Promise<MalMatch | null> {
  try {
    const res = await fetch(`${JIKAN_BASE}/manga?q=${encodeURIComponent(query)}&limit=5&sfw=true`);
    if (res.status === 429) { await sleep(2000); return searchMal(query); }
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
      malId: match.mal_id,
      title: match.titles?.[0]?.title || query,
      score: match.score || null,
      synopsis: match.synopsis || '',
      imageUrl: match.images?.jpg?.large_image_url || match.images?.jpg?.image_url || '',
      year: match.published?.prop?.from?.year || null,
      status: match.status || 'unknown',
    };
  } catch (err) {
    console.error(`  MAL search failed for "${query}":`, (err as Error).message);
    return null;
  }
}

// --- Folder scanning ---

const COMIC_EXTENSIONS = new Set(['.pdf', '.cbr', '.cbz']);

function findFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (COMIC_EXTENSIONS.has(ext)) results.push(entry.name);
    } else if (entry.isDirectory()) {
      const subFiles = findFiles(fullPath);
      for (const f of subFiles) results.push(path.join(entry.name, f));
    }
  }
  return results;
}

function guessType(folderName: string, files: string[]): 'comic' | 'magazine' {
  const lower = folderName.toLowerCase();
  if (lower.includes('magazine') || lower.includes('heavy metal') || lower.includes('epic illustrated')) {
    return 'magazine';
  }
  const hasYearFolders = files.some((f) => /^\d{4}[\\/]/.test(f));
  if (hasYearFolders) return 'magazine';
  return 'comic';
}

// --- Main scan + enrich pipeline ---

let currentScanJob: ScanJob | null = null;

export function getCurrentScanJob(): ScanJob | null {
  return currentScanJob;
}

export async function startScan(sourcePath: string): Promise<ScanJob> {
  if (currentScanJob?.status === 'scanning') {
    throw new Error('A scan is already in progress');
  }

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Folder not found: ${sourcePath}`);
  }

  const entries = fs.readdirSync(sourcePath, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));

  // If no subfolders but the path itself contains comic files, treat it as a single series
  let scanPath = sourcePath;
  let folderNames = folders.map((f) => f.name);
  if (folderNames.length === 0) {
    const hasComicFiles = entries.some((e) => e.isFile() && COMIC_EXTENSIONS.has(path.extname(e.name).toLowerCase()));
    if (hasComicFiles) {
      // Scan the parent dir with this folder as the only entry
      scanPath = path.dirname(sourcePath);
      folderNames = [path.basename(sourcePath)];
    }
  }

  const job: ScanJob = {
    id: `scan-${Date.now()}`,
    sourcePath,
    status: 'scanning',
    progress: { current: 0, total: folderNames.length, currentFolder: null },
  };
  currentScanJob = job;
  emit('scan-progress', job);

  // Run in background
  processScanning(scanPath, folderNames, job).catch((err) => {
    job.status = 'error';
    job.error = (err as Error).message;
    emit('scan-progress', job);
  });

  return job;
}

async function processScanning(sourcePath: string, folderNames: string[], job: ScanJob) {
  const pending = loadPending();
  const existingFolders = new Set(pending.map((p) => p.sourceFolder));

  for (let i = 0; i < folderNames.length; i++) {
    const folderName = folderNames[i];
    const fullPath = path.join(sourcePath, folderName);

    // Skip if already pending
    if (existingFolders.has(fullPath)) {
      job.progress.current = i + 1;
      emit('scan-progress', job);
      continue;
    }

    job.progress.current = i;
    job.progress.currentFolder = folderName;
    emit('scan-progress', job);

    const files = findFiles(fullPath);
    if (files.length === 0) continue;

    const suggestedType = guessType(folderName, files);

    const entry: PendingImport = {
      sourceFolder: fullPath,
      folderName,
      suggestedType,
      fileCount: files.length,
      files,
      malMatch: null,
      status: 'scanning',
    };

    pending.push(entry);
    savePending(pending);
    emit('pending-update', { count: pending.filter((p) => p.status === 'ready' || p.status === 'scanning').length });

    // Search MAL (only for comics, not magazines)
    if (suggestedType === 'comic') {
      await sleep(RATE_LIMIT_MS);
      console.log(`  [${i + 1}/${folderNames.length}] Searching MAL: "${folderName}"`);
      const malMatch = await searchMal(folderName);
      entry.malMatch = malMatch;
      if (malMatch) {
        console.log(`    → ${malMatch.title} (${malMatch.score})`);
      } else {
        console.log(`    → No match`);
      }
    }

    entry.status = 'ready';
    savePending(pending);
    emit('pending-update', { count: pending.filter((p) => p.status === 'ready').length });
  }

  job.progress.current = folderNames.length;
  job.progress.currentFolder = null;
  job.status = 'complete';
  currentScanJob = null;
  emit('scan-progress', job);

  const readyCount = pending.filter((p) => p.status === 'ready').length;
  console.log(`Scan complete: ${readyCount} ready for import`);
}

// --- Pending management ---

export function confirmImport(sourceFolder: string) {
  const pending = loadPending();
  const entry = pending.find((p) => p.sourceFolder === sourceFolder);
  if (entry) {
    entry.status = 'confirmed';
    savePending(pending);
    emit('pending-update', { count: pending.filter((p) => p.status === 'ready').length });
  }
}

export function skipPendingImport(sourceFolder: string) {
  const pending = loadPending();
  const entry = pending.find((p) => p.sourceFolder === sourceFolder);
  if (entry) {
    entry.status = 'skipped';
    savePending(pending);
    emit('pending-update', { count: pending.filter((p) => p.status === 'ready').length });
  }
}

export function getReadyImports(): PendingImport[] {
  return loadPending().filter((p) => p.status === 'ready');
}

export function getPendingCount(): number {
  return loadPending().filter((p) => p.status === 'ready').length;
}

export function clearAllPending() {
  savePending([]);
  emit('pending-update', { count: 0 });
}
