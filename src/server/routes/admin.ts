import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { loadAllSeries, loadComics, removeSeries, loadCollection, loadUserProgress, userDir } from '../data.js';
import { getQueue, removeFromQueue, cancelDownload } from '../downloader.js';
import { enrichSeries } from '../enrich.js';
import { rescanLibrary } from '../scanner.js';

const router = Router();
const DATA_DIR = process.env.DATA_DIR || './data';
const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';
const TASKS_DIR = path.join(DATA_DIR, 'tasks');
const USERS_DIR = path.join(DATA_DIR, 'users');

// Admin guard — all routes require isAdmin
router.use((req, res, next) => {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
});

// --- Stats ---

function getDirSize(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let size = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        size += fs.statSync(fullPath).size;
      } else if (entry.isDirectory()) {
        size += getDirSize(fullPath);
      }
    }
  } catch {}
  return size;
}

const APP_VERSION = '2.3.0';

router.get('/admin/stats', (_req, res) => {
  const allSeries = loadAllSeries();
  let totalChapters = 0;
  for (const s of allSeries) {
    totalChapters += loadComics(s.id).length;
  }

  const users = fs.existsSync(USERS_DIR)
    ? fs.readdirSync(USERS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).length
    : 0;

  const tasks = getQueue();
  const activeTasks = tasks.filter((t) => t.status === 'queued' || t.status === 'downloading').length;

  const librarySize = getDirSize(path.join(LIBRARY_DIR, 'comics')) + getDirSize(path.join(LIBRARY_DIR, 'magazines'));
  const dataSize = getDirSize(DATA_DIR);

  res.json({
    version: APP_VERSION,
    seriesCount: allSeries.length,
    chapterCount: totalChapters,
    userCount: users,
    activeTasks,
    totalTasks: tasks.length,
    librarySize,
    dataSize,
  });
});

// --- Tasks ---

router.get('/admin/tasks', (_req, res) => {
  res.json(getQueue());
});

router.delete('/admin/tasks/:id', (req, res) => {
  removeFromQueue(req.params.id);
  res.json({ ok: true });
});

router.post('/admin/tasks/:id/retry', (req, res) => {
  const tasks = getQueue();
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) { res.status(404).json({ error: 'Task not found' }); return; }

  // Reset to queued
  task.status = 'queued';
  task.error = undefined;
  task.progress.pagesDownloaded = 0;
  task.progress.pagesTotal = 0;

  // Save the updated task
  const taskPath = path.join(TASKS_DIR, `${task.id}.json`);
  fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));

  res.json({ ok: true });
});

router.post('/admin/tasks/:id/cancel', (req, res) => {
  const cancelled = cancelDownload(req.params.id);
  if (cancelled) res.json({ ok: true });
  else res.status(404).json({ error: 'Task not found or not cancellable' });
});

router.post('/admin/tasks/clear', (_req, res) => {
  const tasks = getQueue();
  let cleared = 0;
  for (const task of tasks) {
    if (task.status === 'complete' || task.status === 'error') {
      removeFromQueue(task.id);
      cleared++;
    }
  }
  res.json({ ok: true, cleared });
});

// --- Catalog ---

router.get('/admin/catalog', (_req, res) => {
  const allSeries = loadAllSeries();
  const result = allSeries.map((s) => {
    const comics = loadComics(s.id);
    return {
      ...s,
      count: comics.length,
    };
  });
  res.json(result);
});

router.delete('/admin/catalog/:id', (req, res) => {
  const seriesId = req.params.id;
  const series = loadAllSeries().find((s) => s.id === seriesId);
  if (!series) { res.status(404).json({ error: 'Series not found' }); return; }

  // Delete files
  const typeDir = series.type === 'comic' ? 'comics' : 'magazines';
  const seriesDir = path.join(LIBRARY_DIR, typeDir, seriesId);
  if (fs.existsSync(seriesDir)) {
    fs.rmSync(seriesDir, { recursive: true, force: true });
  }

  // Delete cover
  if (series.coverFile) {
    const coverPath = path.join(DATA_DIR, 'series-covers', series.coverFile);
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
  }

  // Remove from all user collections
  if (fs.existsSync(USERS_DIR)) {
    for (const userEntry of fs.readdirSync(USERS_DIR, { withFileTypes: true })) {
      if (!userEntry.isDirectory()) continue;
      const collPath = path.join(USERS_DIR, userEntry.name, 'collection.jsonl');
      if (fs.existsSync(collPath)) {
        try {
          const lines = fs.readFileSync(collPath, 'utf-8').split('\n').filter(Boolean);
          const filtered = lines.filter((l) => {
            try { return JSON.parse(l).seriesId !== seriesId; } catch { return true; }
          });
          fs.writeFileSync(collPath, filtered.join('\n') + (filtered.length ? '\n' : ''));
        } catch {}
      }
    }
  }

  // Remove metadata
  removeSeries(seriesId);

  console.log(`Admin purged: ${series.name} (${seriesId})`);
  res.json({ ok: true });
});

// --- Enrich & Rescan ---

router.post('/admin/enrich', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await enrichSeries(force);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/admin/rescan', async (_req, res) => {
  try {
    const result = await rescanLibrary();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Users ---

router.get('/admin/users', (_req, res) => {
  if (!fs.existsSync(USERS_DIR)) { res.json([]); return; }

  const users = fs.readdirSync(USERS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const username = e.name;
      const collection = loadCollection(username);
      const progress = loadUserProgress(username);

      return {
        username,
        collectionSize: collection.length,
        progressEntries: progress.length,
        readChapters: progress.filter((p) => p.isRead).length,
      };
    });

  res.json(users);
});

export default router;
