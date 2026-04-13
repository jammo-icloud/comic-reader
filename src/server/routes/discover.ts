import { Router } from 'express';
import { searchAllSources, getChaptersFromSource, getPageUrlsFromSource, getAllSources, getSource } from '../sources/index.js';
import { queueDownload, getQueue, removeFromQueue, cancelDownload, onProgress, getTrackedList } from '../downloader.js';
import { loadAllSeries, isInCollection } from '../data.js';

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

    // Annotate results with local library matches
    const allSeries = loadAllSeries();
    const byMangaDexId = new Map(allSeries.filter((s) => s.mangaDexId).map((s) => [s.mangaDexId!, s.id]));
    const byTitle = new Map(allSeries.map((s) => [s.name.toLowerCase(), s.id]));
    const byEnglish = new Map(allSeries.filter((s) => s.englishTitle).map((s) => [s.englishTitle!.toLowerCase(), s.id]));
    const username = req.username;

    const annotated = results.map((r: any) => {
      const localId = byMangaDexId.get(r.mangaId) || byTitle.get(r.title?.toLowerCase()) || byEnglish.get(r.title?.toLowerCase()) || null;
      return {
        ...r,
        localSeriesId: localId,
        inCollection: localId ? isInCollection(username, localId) : false,
      };
    });

    res.json({ results: annotated, total: annotated.length });
  } catch (err) {
    console.error('Search error:', err);
    res.status(502).json({ error: 'Search failed' });
  }
});

// Get chapters for a manga from a specific source
router.get('/discover/chapters/:sourceId/:mangaId', async (req, res) => {
  try {
    const source = getSource(req.params.sourceId);
    const chapters = await getChaptersFromSource(req.params.sourceId, req.params.mangaId);

    // Include metadata if the source extracted it (e.g., ReadAllComics)
    const metadata = (source as any)?.lastMetadata || null;
    if (source) (source as any).lastMetadata = null; // Reset after reading

    res.json({ chapters, metadata });
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

// Known CDN → referer mappings
const cdnReferers: Record<string, string> = {
  'fmcdn.mfcdn.net': 'https://fanfox.net/',
  'zjcdn.mangafox.me': 'https://fanfox.net/',
  'mfcdn.net': 'https://fanfox.net/',
};

function getReferer(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    for (const [cdn, referer] of Object.entries(cdnReferers)) {
      if (hostname.includes(cdn)) return referer;
    }
    return new URL(url).origin + '/';
  } catch {
    return '';
  }
}

// Generic image proxy (for any source's cover/page images)
router.get('/discover/proxy-image', async (req, res) => {
  const url = req.query.url as string;
  if (!url) { res.status(400).end(); return; }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': getReferer(url),
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
  const job = queueDownload(mangaDexId, mangaTitle, shelfId, chapters, metadata, req.username);
  res.json(job);
});

// Download queue — filtered to current user's downloads
router.get('/discover/queue', (req, res) => {
  const userJobs = getQueue().filter((j) => j.username === req.username);
  res.json(userJobs);
});

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

// SSE progress — only sends events for the connected user's downloads
router.get('/discover/progress', (req, res) => {
  const username = req.username;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const cleanup = onProgress((job) => {
    if (job.username === username) {
      res.write(`data: ${JSON.stringify(job)}\n\n`);
    }
  });
  req.on('close', cleanup);
});

export default router;
