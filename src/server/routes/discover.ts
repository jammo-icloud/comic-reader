import { Router } from 'express';
import { searchManga, getMangaDetail, getChapterList } from '../mangadex.js';
import { queueDownload, getQueue, removeFromQueue, cancelDownload, onProgress, getTrackedList } from '../downloader.js';

const router = Router();

// Search MangaDex
router.get('/discover/search', async (req, res) => {
  const q = req.query.q as string;
  if (!q) { res.status(400).json({ error: 'Query parameter "q" required' }); return; }

  try {
    const offset = parseInt(req.query.offset as string || '0', 10);
    const result = await searchManga(q, offset);
    res.json(result);
  } catch (err) {
    console.error('MangaDex search error:', err);
    res.status(502).json({ error: 'MangaDex search failed' });
  }
});

// Get manga detail
router.get('/discover/manga/:id', async (req, res) => {
  try {
    const manga = await getMangaDetail(req.params.id);
    if (!manga) { res.status(404).json({ error: 'Manga not found' }); return; }
    res.json(manga);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch manga details' });
  }
});

// Get chapter list for a manga
router.get('/discover/manga/:id/chapters', async (req, res) => {
  try {
    const lang = (req.query.lang as string) || 'en';
    const chapters = await getChapterList(req.params.id, lang);
    res.json(chapters);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch chapters' });
  }
});

// Proxy MangaDex cover images (avoids CORS)
router.get('/discover/cover/:mangaId/:filename', async (req, res) => {
  try {
    const url = `https://uploads.mangadex.org/covers/${req.params.mangaId}/${req.params.filename}`;
    const response = await fetch(url);
    if (!response.ok) { res.status(response.status).end(); return; }
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch {
    res.status(502).end();
  }
});

// Start download
router.post('/discover/download', (req, res) => {
  const { mangaDexId, mangaTitle, shelfId, chapters, metadata } = req.body;
  if (!mangaDexId || !mangaTitle || !shelfId || !chapters?.length) {
    res.status(400).json({ error: 'mangaDexId, mangaTitle, shelfId, and chapters required' });
    return;
  }

  const job = queueDownload(mangaDexId, mangaTitle, shelfId, chapters, metadata);
  res.json(job);
});

// Get download queue
router.get('/discover/queue', (_req, res) => {
  res.json(getQueue());
});

// Cancel an active or queued download
router.post('/discover/queue/:id/cancel', (req, res) => {
  const cancelled = cancelDownload(req.params.id);
  if (cancelled) {
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'Job not found or already complete' });
  }
});

// Remove a completed/errored job from queue
router.delete('/discover/queue/:id', (req, res) => {
  removeFromQueue(req.params.id);
  res.json({ ok: true });
});

// Get tracked manga
router.get('/discover/tracked', (_req, res) => {
  res.json(getTrackedList());
});

// SSE progress stream
router.get('/discover/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const cleanup = onProgress((job) => {
    res.write(`data: ${JSON.stringify(job)}\n\n`);
  });

  req.on('close', cleanup);
});

export default router;
