import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { resolveComicPath } from '../scanner.js';
import { getComic, updateComic, updateUserProgress, addToCollection, isInCollection } from '../data.js';
import {
  translatePage, translateChapter, getCachedTranslation, getCachedPageNumbers,
  getTranslationConfig, saveTranslationConfig, isTranslationEnabled,
} from '../translate.js';

const router = Router();

// Serve a PDF file: /api/comics/read/:seriesId/:file
router.get('/comics/read/:seriesId/{*file}', (req, res) => {
  const seriesId = req.params.seriesId;
  const rawFile = req.params.file;
  const file = Array.isArray(rawFile) ? rawFile.join('/') : rawFile;

  if (!seriesId || !file) {
    res.status(400).json({ error: 'Missing seriesId or file' });
    return;
  }

  const fullPath = resolveComicPath(seriesId, file);
  if (!fullPath || !fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  // Security: ensure path is within the library directory
  const resolved = path.resolve(fullPath);
  const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';
  if (!resolved.startsWith(path.resolve(LIBRARY_DIR))) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const stat = fs.statSync(fullPath);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Accept-Ranges', 'bytes');

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(fullPath, { start, end }).pipe(res);
  } else {
    fs.createReadStream(fullPath).pipe(res);
  }
});

// Update reading progress
router.patch('/comics/progress/:seriesId/{*file}', (req, res) => {
  const seriesId = req.params.seriesId;
  const rawFile = req.params.file;
  const file = Array.isArray(rawFile) ? rawFile.join('/') : rawFile;

  if (!seriesId || !file) {
    res.status(400).json({ error: 'Missing seriesId or file' });
    return;
  }

  const comic = getComic(seriesId, file);
  if (!comic) {
    res.status(404).json({ error: 'Comic not found' });
    return;
  }

  const username = req.username;
  const { currentPage, isRead, pageCount } = req.body;

  // Update shared page count if provided
  if (typeof pageCount === 'number' && pageCount > 0 && comic.pages !== pageCount) {
    updateComic(seriesId, file, { pages: pageCount });
  }

  // Build per-user progress update
  const progressUpdates: Record<string, any> = { lastReadAt: new Date().toISOString() };
  if (typeof currentPage === 'number') {
    progressUpdates.currentPage = currentPage;
    const totalPages = (typeof pageCount === 'number' ? pageCount : comic.pages) || 0;
    if (totalPages > 0 && currentPage >= totalPages - 1) progressUpdates.isRead = true;
  }
  if (typeof isRead === 'boolean') {
    progressUpdates.isRead = isRead;
  }

  updateUserProgress(username, seriesId, file, progressUpdates);

  // Auto-add to collection on first read
  if (!isInCollection(username, seriesId)) {
    addToCollection(username, seriesId);
  }

  res.json({ ok: true });
});

// --- Translation ---

// Get or generate a translation for a specific page
router.get('/translate/:seriesId/:pageNum/{*file}', async (req, res) => {
  const { seriesId, pageNum } = req.params;
  const rawFile = req.params.file;
  const file = Array.isArray(rawFile) ? rawFile.join('/') : rawFile;
  const pageNumInt = parseInt(pageNum, 10);

  if (!seriesId || !file || isNaN(pageNumInt)) {
    res.status(400).json({ error: 'Missing or invalid params' });
    return;
  }

  if (!isTranslationEnabled()) {
    res.status(503).json({ error: 'Translation service not configured' });
    return;
  }

  try {
    const force = req.query.force === 'true';
    const result = await translatePage(seriesId, file, pageNumInt, force);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get status of translations for a chapter (which pages are cached)
router.get('/translate/:seriesId/status/{*file}', (req, res) => {
  const { seriesId } = req.params;
  const rawFile = req.params.file;
  const file = Array.isArray(rawFile) ? rawFile.join('/') : rawFile || '';
  if (!seriesId || !file) { res.status(400).json({ error: 'Missing params' }); return; }
  const cachedPages = getCachedPageNumbers(seriesId, file);
  res.json({ enabled: isTranslationEnabled(), cachedPages });
});

// Translate an entire chapter (runs in background, returns immediately)
router.post('/translate/:seriesId/chapter/{*file}', (req, res) => {
  const { seriesId } = req.params;
  const rawFile = req.params.file;
  const file = Array.isArray(rawFile) ? rawFile.join('/') : rawFile || '';
  const force = req.query.force === 'true';
  if (!seriesId || !file) { res.status(400).json({ error: 'Missing params' }); return; }

  if (!isTranslationEnabled()) {
    res.status(503).json({ error: 'Translation service not configured' });
    return;
  }

  // Respond immediately, run in background
  res.json({ ok: true, status: 'started' });

  translateChapter(seriesId, file, {
    force,
    onProgress: (done, total) => {
      if (done % 5 === 0 || done === total) {
        console.log(`  Translate "${seriesId}/${file}": ${done}/${total}`);
      }
    },
  }).then((stats) => {
    console.log(`  Translate complete: ${stats.translated} new, ${stats.cached} cached, ${stats.failed} failed (${Math.round(stats.totalMs / 1000)}s)`);
  }).catch((err) => {
    console.error(`  Translate chapter failed: ${(err as Error).message}`);
  });
});

// Admin-only: get or update translation config (Ollama URL, model, prompt)
router.get('/translate/config', (req, res) => {
  if (!req.isAdmin) { res.status(403).json({ error: 'Admin only' }); return; }
  res.json(getTranslationConfig());
});

router.patch('/translate/config', (req, res) => {
  if (!req.isAdmin) { res.status(403).json({ error: 'Admin only' }); return; }
  const updated = saveTranslationConfig(req.body);
  res.json(updated);
});

export default router;
