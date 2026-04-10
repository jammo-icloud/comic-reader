import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { resolveComicPath } from '../scanner.js';
import { getComic, updateComic, loadAllSeries } from '../data.js';

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

  const { currentPage, isRead, pageCount } = req.body;
  const updates: Partial<typeof comic> = { lastReadAt: new Date().toISOString() };

  if (typeof pageCount === 'number' && pageCount > 0) {
    updates.pages = pageCount;
  }
  if (typeof currentPage === 'number') {
    updates.currentPage = currentPage;
    const totalPages = (typeof pageCount === 'number' ? pageCount : comic.pages) || 0;
    if (totalPages > 0 && currentPage >= totalPages - 1) updates.isRead = true;
  }
  if (typeof isRead === 'boolean') {
    updates.isRead = isRead;
  }

  updateComic(seriesId, file, updates);
  res.json({ ok: true });
});

export default router;
