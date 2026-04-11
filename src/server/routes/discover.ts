import { Router } from 'express';
import { searchAllSources, getChaptersFromSource, getPageUrlsFromSource, getAllSources } from '../sources/index.js';
import { queueDownload, getQueue, removeFromQueue, cancelDownload, onProgress, getTrackedList } from '../downloader.js';

const router = Router();

// List available sources
router.get('/discover/sources', (_req, res) => {
  res.json(getAllSources());
});

// Unified search across all sources
router.get('/discover/search', async (req, res) => {
  const q = req.query.q as string;
  if (!q) { res.status(400).json({ error: 'Query parameter "q" required' }); return; }

  try {
    const results = await searchAllSources(q);
    res.json({ results, total: results.length });
  } catch (err) {
    console.error('Search error:', err);
    res.status(502).json({ error: 'Search failed' });
  }
});

// Get chapters for a manga from a specific source
router.get('/discover/chapters/:sourceId/:mangaId', async (req, res) => {
  try {
    const chapters = await getChaptersFromSource(req.params.sourceId, req.params.mangaId);
    res.json(chapters);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch chapters' });
  }
});

// Proxy cover images from MangaDex CDN (CORS workaround)
router.get('/discover/cover/:mangaId/:filename', async (req, res) => {
  try {
    const url = `https://uploads.mangadex.org/covers/${req.params.mangaId}/${req.params.filename}`;
    const response = await fetch(url);
    if (!response.ok) { res.status(response.status).end(); return; }
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.status(502).end();
  }
});

// Generic image proxy (for any source's cover/page images)
router.get('/discover/proxy-image', async (req, res) => {
  const url = req.query.url as string;
  if (!url) { res.status(400).end(); return; }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(url).origin + '/',
      },
    });
    if (!response.ok) { res.status(response.status).end(); return; }
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.send(Buffer.from(await response.arrayBuffer()));
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

// Download queue
router.get('/discover/queue', (_req, res) => { res.json(getQueue()); });

router.post('/discover/queue/:id/cancel', (req, res) => {
  const cancelled = cancelDownload(req.params.id);
  if (cancelled) res.json({ ok: true });
  else res.status(404).json({ error: 'Job not found' });
});

router.delete('/discover/queue/:id', (req, res) => {
  removeFromQueue(req.params.id);
  res.json({ ok: true });
});

// Tracked manga
router.get('/discover/tracked', (_req, res) => { res.json(getTrackedList()); });

// SSE progress
router.get('/discover/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const cleanup = onProgress((job) => { res.write(`data: ${JSON.stringify(job)}\n\n`); });
  req.on('close', cleanup);
});

export default router;
