import { Router } from 'express';
import pathMod from 'path';
import { loadAllSeries, loadComics, getSeriesStats, saveSeries, type SeriesRecord } from '../data.js';
import { scanLibrary } from '../scanner.js';
import { shortHash } from '../hash.js';
import { getThumbnailPath, generateThumbnail } from '../thumbnails.js';
import { enrichSeries, enrichSingle, getSeriesCoverPath, saveOverride } from '../enrich.js';
import { loadShelves, addShelf, removeShelf, updateShelf, listPlaceholders } from '../shelves.js';

const router = Router();

// --- Shelf routes ---

router.get('/shelves', (_req, res) => {
  res.json(loadShelves());
});

router.post('/shelves', (req, res) => {
  try {
    const { name, path, placeholder } = req.body;
    if (!name || !path) { res.status(400).json({ error: 'name and path required' }); return; }
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

router.get('/placeholders', (_req, res) => {
  const clientDir = pathMod.join(pathMod.dirname(new URL(import.meta.url).pathname), '../../client');
  let placeholders = listPlaceholders(clientDir);
  if (placeholders.length === 0) placeholders = listPlaceholders(pathMod.resolve('public'));
  res.json(placeholders);
});

router.delete('/shelves/:id', (req, res) => {
  const removed = removeShelf(req.params.id);
  if (removed) res.json({ ok: true });
  else res.status(404).json({ error: 'Shelf not found' });
});

// --- Series ---

router.get('/series', (_req, res) => {
  const allSeries = loadAllSeries();
  const shelves = loadShelves();
  const shelfMap = new Map(shelves.map((s) => [s.id, s]));

  const result = allSeries.map((s) => {
    const stats = getSeriesStats(s.id);
    return {
      ...s,
      ...stats,
      placeholder: shelfMap.get(s.shelfId)?.placeholder || s.placeholder,
    };
  });

  res.json(result);
});

router.get('/series/:id', (req, res) => {
  const allSeries = loadAllSeries();
  const series = allSeries.find((s) => s.id === req.params.id);
  if (!series) { res.status(404).json({ error: 'Series not found' }); return; }
  const stats = getSeriesStats(series.id);
  res.json({ ...series, ...stats });
});

// --- Comics in a series ---

router.get('/series/:id/comics', (req, res) => {
  const comics = loadComics(req.params.id);
  // Add thumbnail hash for static serving
  const withHashes = comics.map((c) => ({
    ...c,
    thumbHash: shortHash(`${req.params.id}/${c.file}`),
  }));
  res.json(withHashes);
});

// --- Continue reading (across all series) ---

router.get('/continue-reading', (_req, res) => {
  const allSeries = loadAllSeries();
  const results: { seriesId: string; seriesName: string; file: string; currentPage: number; pages: number; lastReadAt: string; thumbHash: string }[] = [];

  for (const s of allSeries) {
    const comics = loadComics(s.id);
    for (const c of comics) {
      if (c.currentPage > 0 && !c.isRead && c.lastReadAt) {
        results.push({
          seriesId: s.id,
          seriesName: s.name,
          file: c.file,
          currentPage: c.currentPage,
          pages: c.pages,
          lastReadAt: c.lastReadAt,
          thumbHash: shortHash(`${s.id}/${c.file}`),
        });
      }
    }
  }

  results.sort((a, b) => new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime());
  res.json(results.slice(0, 10));
});

// --- Scan ---

router.post('/scan', async (_req, res) => {
  try {
    const result = await scanLibrary();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Scan failed' });
  }
});

// --- Enrichment ---

router.post('/enrich', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await enrichSeries(force);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Enrichment failed' });
  }
});

router.post('/series-override', async (req, res) => {
  try {
    const { seriesId, malId } = req.body;
    if (!seriesId || !malId) { res.status(400).json({ error: 'seriesId and malId required' }); return; }
    const result = await enrichSingle(seriesId, malId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Override failed' });
  }
});

// --- Series cover ---

router.get('/series-cover/:id', (req, res) => {
  const series = loadAllSeries().find((s) => s.id === req.params.id);
  if (!series?.coverFile) { res.status(404).json({ error: 'No cover' }); return; }

  const DATA_DIR = process.env.DATA_DIR || './data';
  const coverPath = pathMod.join(DATA_DIR, 'series-covers', series.coverFile);
  if (!pathMod.resolve(coverPath)) { res.status(404).json({ error: 'Cover not found' }); return; }

  res.sendFile(pathMod.resolve(coverPath), (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Cover not found' });
  });
});

// --- Thumbnails ---

router.get('/thumbnails/:seriesId/{*file}', async (req, res) => {
  const seriesId = req.params.seriesId;
  const rawFile = req.params.file;
  const file = Array.isArray(rawFile) ? rawFile.join('/') : rawFile;
  const key = `${seriesId}/${file}`;

  let thumbFile = getThumbnailPath(key);
  if (!thumbFile) {
    thumbFile = await generateThumbnail(key);
  }

  if (thumbFile) {
    res.sendFile(pathMod.resolve(thumbFile), (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Thumbnail not available' });
    });
  } else {
    res.status(404).json({ error: 'Thumbnail not available' });
  }
});

export default router;
