import { Router } from 'express';
import { searchAllSources, getChaptersFromSource, getPageUrlsFromSource, getAllSources, getSource, getCdnReferer, getMangaUrl, getSourceType } from '../sources/index.js';
import { queueDownload, getQueue, removeFromQueue, cancelDownload, onProgress } from '../downloader.js';
import { loadAllSeries, isInCollection, NSFW_TAGS } from '../data.js';
import { resolveTargetSeries } from '../series-resolve.js';

const router = Router();

// List available sources
router.get('/discover/sources', (_req, res) => {
  res.json(getAllSources());
});

// Unified search across all sources
router.get('/discover/search', async (req, res) => {
  const q = req.query.q as string;
  const sourceFilter = req.query.source as string | undefined;
  if (!q) { res.status(400).json({ error: 'Query parameter "q" required' }); return; }

  try {
    let results: any[];
    if (sourceFilter) {
      // Single-source search (used by subscription picker)
      const source = getSource(sourceFilter);
      if (!source) { res.status(404).json({ error: `Unknown source: ${sourceFilter}` }); return; }
      results = await source.search(q);
    } else {
      results = await searchAllSources(q);
    }

    // Annotate results with local library matches
    const allSeries = loadAllSeries();
    const username = req.username;

    const annotated = results.map((r: any) => {
      // Same resolution the downloader uses: subscription first, then title
      // within the source's series type — never a same-titled series of another type.
      const { existing } = resolveTargetSeries(allSeries, {
        title: r.title || '',
        sourceId: r.sourceId,
        mangaId: r.mangaId,
        type: getSourceType(r.sourceId),
      });
      const localId = existing?.id ?? null;
      return {
        ...r,
        coverUrl: r.coverUrl && r.coverUrl.startsWith('http')
          ? `/api/discover/proxy-image?url=${encodeURIComponent(r.coverUrl)}`
          : r.coverUrl,
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

    if (metadata?.coverUrl && metadata.coverUrl.startsWith('http')) {
      metadata.coverUrl = `/api/discover/proxy-image?url=${encodeURIComponent(metadata.coverUrl)}`;
    }

    res.json({ chapters, metadata });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch chapters' });
  }
});

// Get page image URLs for a single chapter (used by preview reader)
router.get('/discover/pages/:sourceId', async (req, res) => {
  try {
    const chapterId = req.query.chapterId as string;
    if (!chapterId) { res.status(400).json({ error: 'chapterId query param required' }); return; }
    const pages = await getPageUrlsFromSource(req.params.sourceId, chapterId);
    const proxied = pages.map((url) =>
      `/api/discover/proxy-image?url=${encodeURIComponent(url)}`
    );
    res.json({ pages: proxied });
  } catch (err) {
    console.error('Pages error:', err);
    res.status(502).json({ error: 'Failed to fetch pages' });
  }
});

// Resolve the URL to view a manga on its source website
router.get('/discover/manga-url/:sourceId/:mangaId', async (req, res) => {
  const url = await getMangaUrl(req.params.sourceId, req.params.mangaId);
  if (!url) { res.status(404).json({ error: 'No URL available' }); return; }
  res.json({ url });
});

function getReferer(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return getCdnReferer(hostname) || new URL(url).origin + '/';
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

  // Block non-admin from downloading NSFW content
  if (!req.isAdmin && metadata?.tags) {
    const hasNsfw = (metadata.tags as string[]).some((t: string) => NSFW_TAGS.has(t.toLowerCase()));
    if (hasNsfw) {
      res.status(403).json({ error: 'Only admins can download adult content' });
      return;
    }
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

// SSE progress — only sends events for the connected user's downloads
router.get('/discover/progress', (req, res) => {
  const username = req.username;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Disable proxy buffering so live progress streams through nginx-based reverse
  // proxies (Synology's reverse proxy, Cloudflare) instead of being held back.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const cleanup = onProgress((job) => {
    if (job.username === username) {
      res.write(`data: ${JSON.stringify(job)}\n\n`);
    }
  });
  req.on('close', cleanup);
});

export default router;
