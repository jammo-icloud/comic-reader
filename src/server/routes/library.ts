import { Router } from 'express';
import pathMod from 'path';
import { loadAllSeries, loadComics, getSeriesStats, saveSeries, type SeriesRecord } from '../data.js';
import { shortHash } from '../hash.js';
import { getThumbnailPath, generateThumbnail } from '../thumbnails.js';
import { enrichSeries, enrichSingle } from '../enrich.js';

const router = Router();

// --- Series ---

router.get('/series', (req, res) => {
  const allSeries = loadAllSeries();
  const { type } = req.query; // filter by type: 'comic' or 'magazine'

  let filtered = allSeries;
  if (type && typeof type === 'string') {
    filtered = filtered.filter((s) => s.type === type);
  }

  const result = filtered.map((s) => ({
    ...s,
    ...getSeriesStats(s.id),
  }));

  res.json(result);
});

router.get('/series/:id', (req, res) => {
  const allSeries = loadAllSeries();
  const series = allSeries.find((s) => s.id === req.params.id);
  if (!series) { res.status(404).json({ error: 'Series not found' }); return; }
  res.json({ ...series, ...getSeriesStats(series.id) });
});

// --- Comics in a series ---

router.get('/series/:id/comics', (req, res) => {
  const comics = loadComics(req.params.id);
  const withHashes = comics.map((c) => ({
    ...c,
    thumbHash: shortHash(`${req.params.id}/${c.file}`),
  }));
  res.json(withHashes);
});

// --- Continue reading ---

router.get('/continue-reading', (_req, res) => {
  const allSeries = loadAllSeries();
  const results: any[] = [];

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
