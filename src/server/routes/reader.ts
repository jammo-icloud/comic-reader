import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { resolveComicPath } from '../scanner.js';
import { getComic, updateComic, updateUserProgress, addToCollection, isInCollection, addPin, loadProgressForSeries } from '../data.js';
import {
  translateChapter, getCachedTranslation, getCachedPageNumbers,
  isChapterTranslating, getTranslationConfig, saveTranslationConfig, isTranslationEnabled,
} from '../translate.js';
import { loadBible, saveBible, normalizeBible } from '../bible.js';

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

  // Capture whether the user had ANY prior progress on this series BEFORE
  // the write below. Used to gate the auto-pin: it should fire only on the
  // first-ever read of a series, never again — so a series the user
  // deliberately un-pinned (and therefore has progress on) is never
  // re-pinned against their wishes. Un-pinning stays fully manual.
  const isFirstEverRead = loadProgressForSeries(username, seriesId).size === 0;

  updateUserProgress(username, seriesId, file, progressUpdates);

  // Auto-add to collection on first read
  if (!isInCollection(username, seriesId)) {
    addToCollection(username, seriesId);
  }

  // Auto-pin on first-ever read — a no-fight automation. The "currently
  // reading" set populates itself as you start new series; you only ever
  // curate the removal side. addPin is idempotent, so a series the user
  // pre-pinned manually just stays pinned.
  if (isFirstEverRead) {
    addPin(username, seriesId);
  }

  res.json({ ok: true });
});

// --- Translation ---
//
// Translation is chapter-level: one vision-model call per page (see
// translate.ts). The per-page GET below only serves what's already cached.

// Status of a chapter's translation: which pages are done, and whether a
// translation run is in progress right now.
//
// NOTE: this MUST be registered before the /:pageNum/ route below. Express
// matches routes in registration order, and ":pageNum" happily captures the
// literal "status" segment — parseInt("status") is NaN, so the page route
// would 400 every status request and this endpoint would be unreachable.
router.get('/translate/:seriesId/status/{*file}', (req, res) => {
  const { seriesId } = req.params;
  const rawFile = req.params.file;
  const file = Array.isArray(rawFile) ? rawFile.join('/') : rawFile || '';
  if (!seriesId || !file) { res.status(400).json({ error: 'Missing params' }); return; }
  res.json({
    enabled: isTranslationEnabled(),
    cachedPages: getCachedPageNumbers(seriesId, file),
    inProgress: isChapterTranslating(seriesId, file),
  });
});

// Get a cached page translation.
router.get('/translate/:seriesId/:pageNum/{*file}', (req, res) => {
  const { seriesId, pageNum } = req.params;
  const rawFile = req.params.file;
  const file = Array.isArray(rawFile) ? rawFile.join('/') : rawFile;
  const pageNumInt = parseInt(pageNum, 10);

  if (!seriesId || !file || isNaN(pageNumInt)) {
    res.status(400).json({ error: 'Missing or invalid params' });
    return;
  }

  const cached = getCachedTranslation(seriesId, file, pageNumInt);
  if (!cached) {
    res.status(404).json({ error: 'Page not translated yet. Translate the chapter first.' });
    return;
  }
  res.json(cached);
});

// Translate an entire chapter (runs in background, returns immediately).
//   ?force=true  re-translate every page, even already-cached ones
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
    console.log(
      `  Translate complete "${seriesId}/${file}": ` +
      `${stats.translated}/${stats.totalPages} pages` +
      `${stats.failed ? ` (${stats.failed} failed)` : ''}` +
      `${stats.recalibrated ? ` (${stats.recalibrated} re-calibrated)` : ''} ` +
      `(${Math.round(stats.totalMs / 1000)}s)`,
    );
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

// --- Story bible ---
//
// The per-series narration bible: cast, glossary, recap, narrator directive.
// GET is open to any logged-in user (the reader's character pages will read
// it); PUT — the admin Bible editor's save — is admin-only. normalizeBible
// coerces hand-edited input into a safe, well-formed shape.
router.get('/series/:seriesId/bible', (req, res) => {
  const { seriesId } = req.params;
  if (!seriesId) { res.status(400).json({ error: 'Missing seriesId' }); return; }
  res.json(loadBible(seriesId));
});

router.put('/series/:seriesId/bible', (req, res) => {
  if (!req.isAdmin) { res.status(403).json({ error: 'Admin only' }); return; }
  const { seriesId } = req.params;
  if (!seriesId) { res.status(400).json({ error: 'Missing seriesId' }); return; }
  const bible = normalizeBible(req.body);
  saveBible(seriesId, bible);
  res.json(bible);
});

export default router;
