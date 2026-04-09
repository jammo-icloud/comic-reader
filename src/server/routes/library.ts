import { Router } from 'express';
import pathMod from 'path';
import { getAllComics, getComic } from '../library.js';
import { scanLibrary } from '../scanner.js';
import { getThumbnailPath, generateThumbnail } from '../thumbnails.js';
import { enrichSeries, enrichSingle, getSeriesCoverPath, loadSeriesMetadata, saveOverride } from '../enrich.js';
import { loadShelves, addShelf, removeShelf } from '../shelves.js';

const router = Router();

// --- Shelf routes ---

router.get('/shelves', (_req, res) => {
  res.json(loadShelves());
});

router.post('/shelves', (req, res) => {
  try {
    const { name, path } = req.body;
    if (!name || !path) {
      res.status(400).json({ error: 'name and path required' });
      return;
    }
    const shelf = addShelf(name, path);
    res.json(shelf);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
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
  const seriesMap = new Map<string, { count: number; readCount: number; latestReadAt: string | null }>();

  for (const c of comics) {
    const existing = seriesMap.get(c.series);
    if (!existing) {
      seriesMap.set(c.series, {
        count: 1,
        readCount: c.isRead ? 1 : 0,
        latestReadAt: c.lastReadAt,
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

  const series = Array.from(seriesMap.entries())
    .map(([name, data]) => ({
      name,
      ...data,
      malTitle: metadata[name]?.malTitle || null,
      score: metadata[name]?.score || null,
      synopsis: metadata[name]?.synopsis || null,
      hasCover: !!metadata[name]?.coverPath,
    }))
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
