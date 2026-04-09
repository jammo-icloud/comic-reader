import { Router } from 'express';
import pathMod from 'path';
import { getAllComics, getComic } from '../library.js';
import { scanLibrary } from '../scanner.js';
import { getThumbnailPath, generateThumbnail } from '../thumbnails.js';
import { enrichSeries, enrichSingle, getSeriesCoverPath, loadSeriesMetadata, saveOverride } from '../enrich.js';
import { loadShelves, addShelf, removeShelf, updateShelf, listPlaceholders } from '../shelves.js';
import { loadTracked } from '../downloader.js';

const router = Router();

// --- Shelf routes ---

router.get('/shelves', (_req, res) => {
  res.json(loadShelves());
});

router.post('/shelves', (req, res) => {
  try {
    const { name, path, placeholder } = req.body;
    if (!name || !path) {
      res.status(400).json({ error: 'name and path required' });
      return;
    }
    const shelf = addShelf(name, path, placeholder || 'manga.png');
    res.json(shelf);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.patch('/shelves/:id', (req, res) => {
  const { name, placeholder } = req.body;
  const shelf = updateShelf(req.params.id, { name, placeholder });
  if (shelf) res.json(shelf);
  else res.status(404).json({ error: 'Shelf not found' });
});

// List available placeholder images
router.get('/placeholders', (_req, res) => {
  const clientDir = pathMod.join(pathMod.dirname(new URL(import.meta.url).pathname), '../../client');
  // In dev, public dir is at project root; in prod, it's copied into dist/client
  const publicDir = process.env.NODE_ENV === 'production' ? clientDir : pathMod.resolve('public');
  // Try both paths
  let placeholders = listPlaceholders(clientDir);
  if (placeholders.length === 0) placeholders = listPlaceholders(pathMod.resolve('public'));
  res.json(placeholders);
});

router.delete('/shelves/:id', (req, res) => {
  const removed = removeShelf(req.params.id);
  if (removed) {
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'Shelf not found' });
  }
});

// List all comics, optionally filtered
router.get('/comics', (req, res) => {
  const comics = getAllComics();
  const { search, series, sort, shelf } = req.query;

  let filtered = comics;

  if (shelf && typeof shelf === 'string') {
    filtered = filtered.filter((c) => c.shelfId === shelf);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.series.toLowerCase().includes(q)
    );
  }

  if (series && typeof series === 'string') {
    filtered = filtered.filter((c) => c.series === series);
  }

  // Sort
  const sortBy = typeof sort === 'string' ? sort : 'series';
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'recent':
        return (
          new Date(b.lastReadAt || 0).getTime() -
          new Date(a.lastReadAt || 0).getTime()
        );
      case 'added':
        return (
          new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        );
      case 'series':
      default:
        if (a.series !== b.series) return a.series.localeCompare(b.series);
        return a.seriesOrder - b.seriesOrder;
    }
  });

  res.json(filtered);
});

// List series
router.get('/series', (_req, res) => {
  const comics = getAllComics();
  const shelves = loadShelves();
  const shelfMap = new Map(shelves.map((s) => [s.id, s]));
  const seriesMap = new Map<string, { count: number; readCount: number; latestReadAt: string | null; shelfId: string }>();

  for (const c of comics) {
    const existing = seriesMap.get(c.series);
    if (!existing) {
      seriesMap.set(c.series, {
        count: 1,
        readCount: c.isRead ? 1 : 0,
        latestReadAt: c.lastReadAt,
        shelfId: c.shelfId,
      });
    } else {
      existing.count++;
      if (c.isRead) existing.readCount++;
      if (c.lastReadAt && (!existing.latestReadAt || c.lastReadAt > existing.latestReadAt)) {
        existing.latestReadAt = c.lastReadAt;
      }
    }
  }

  const metadata = loadSeriesMetadata();
  const tracked = loadTracked();

  // Build a lookup: series title → tracked manga data
  const trackedByTitle = new Map<string, (typeof tracked)[string]>();
  for (const t of Object.values(tracked)) {
    trackedByTitle.set(t.title, t);
  }

  const series = Array.from(seriesMap.entries())
    .map(([name, data]) => {
      const mal = metadata[name];
      const mdx = trackedByTitle.get(name);
      return {
        name,
        ...data,
        malTitle: mal?.malTitle || null,
        score: mal?.score || null,
        synopsis: mal?.synopsis || mdx?.description || null,
        hasCover: !!mal?.coverPath,
        // MangaDex metadata (from downloads)
        year: mdx?.year || null,
        tags: mdx?.tags || null,
        status: mdx?.status || null,
        mangaDexId: mdx?.mangaDexId || null,
        source: mdx ? 'mangadex' : mal ? 'mal' : null,
        placeholder: shelfMap.get(data.shelfId)?.placeholder || 'manga.png',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json(series);
});

// Get comics currently being read
router.get('/continue-reading', (_req, res) => {
  const comics = getAllComics();
  const inProgress = comics
    .filter((c) => c.currentPage > 0 && !c.isRead)
    .sort(
      (a, b) =>
        new Date(b.lastReadAt || 0).getTime() -
        new Date(a.lastReadAt || 0).getTime()
    )
    .slice(0, 10);

  res.json(inProgress);
});

// Trigger library scan
router.post('/scan', async (_req, res) => {
  try {
    const result = await scanLibrary();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Scan failed' });
  }
});

// Trigger series enrichment from MyAnimeList
router.post('/enrich', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await enrichSeries(force);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Enrichment failed' });
  }
});

// Override MAL ID for a series and re-fetch metadata
router.post('/series-override', async (req, res) => {
  try {
    const { seriesName, malId } = req.body;
    if (!seriesName || !malId) {
      res.status(400).json({ error: 'seriesName and malId required' });
      return;
    }
    saveOverride(seriesName, malId);
    const result = await enrichSingle(seriesName, malId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Override failed' });
  }
});

// Get series cover image
router.get('/series-cover/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const coverFile = getSeriesCoverPath(name);
  if (coverFile) {
    res.sendFile(pathMod.resolve(coverFile));
  } else {
    res.status(404).json({ error: 'No cover available' });
  }
});

// Get thumbnail for a comic
router.get('/thumbnails/{*path}', async (req, res) => {
  const rawPath = req.params.path;
  const relativePath = Array.isArray(rawPath) ? rawPath.join('/') : rawPath;
  if (!relativePath) {
    res.status(400).json({ error: 'Missing path' });
    return;
  }

  let thumbFile = getThumbnailPath(relativePath);
  if (!thumbFile) {
    thumbFile = await generateThumbnail(relativePath);
  }

  if (thumbFile) {
    res.sendFile(pathMod.resolve(thumbFile));
  } else {
    res.status(404).json({ error: 'Thumbnail not available' });
  }
});

export default router;
