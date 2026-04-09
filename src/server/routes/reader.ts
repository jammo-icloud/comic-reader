import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { getComic, updateComic } from '../library.js';
import { getComicFullPath } from '../scanner.js';
import { loadShelves } from '../shelves.js';

const router = Router();

function extractKey(params: any): string {
  const raw = params.path;
  return Array.isArray(raw) ? raw.join('/') : raw;
}

// Serve a PDF file — key is shelfId:relative/path.pdf
router.get('/comics/read/{*path}', (req, res) => {
  const key = extractKey(req.params);
  if (!key) { res.status(400).json({ error: 'Missing path' }); return; }

  const fullPath = getComicFullPath(key);
  if (!fullPath || !fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  // Security: ensure resolved path is within a known shelf
  const resolved = path.resolve(fullPath);
  const shelves = loadShelves();
  const inShelf = shelves.some((s) => resolved.startsWith(path.resolve(s.path)));
  if (!inShelf) {
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

// Get reading progress
router.get('/comics/progress/{*path}', (req, res) => {
  const key = extractKey(req.params);
  if (!key) { res.status(400).json({ error: 'Missing path' }); return; }

  const comic = getComic(key);
  if (!comic) { res.status(404).json({ error: 'Comic not found' }); return; }

  res.json({ currentPage: comic.currentPage, pageCount: comic.pageCount, isRead: comic.isRead });
});

// Update reading progress
router.patch('/comics/progress/{*path}', (req, res) => {
  const key = extractKey(req.params);
  if (!key) { res.status(400).json({ error: 'Missing path' }); return; }

  const comic = getComic(key);
  if (!comic) { res.status(404).json({ error: 'Comic not found' }); return; }

  const { currentPage, isRead, pageCount } = req.body;
  const updates: Record<string, any> = { lastReadAt: new Date().toISOString() };

  // Update page count if provided (lazy discovery from PDF viewer)
  if (typeof pageCount === 'number' && pageCount > 0) {
    updates.pageCount = pageCount;
  }

  if (typeof currentPage === 'number') {
    updates.currentPage = currentPage;
    const totalPages = updates.pageCount || comic.pageCount;
    if (totalPages > 0 && currentPage >= totalPages - 1) updates.isRead = true;
  }
  if (typeof isRead === 'boolean') updates.isRead = isRead;

  updateComic(key, updates);
  res.json({ ok: true });
});

export default router;
