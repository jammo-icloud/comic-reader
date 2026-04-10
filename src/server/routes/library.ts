import { Router } from 'express';
import pathMod from 'path';
import fs from 'fs';
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

// --- Series cover upload (for magazines/manual) ---

router.post('/series/:id/cover', async (req, res) => {
  const series = loadAllSeries().find((s) => s.id === req.params.id);
  if (!series) { res.status(404).json({ error: 'Series not found' }); return; }

  const DATA_DIR = process.env.DATA_DIR || './data';
  const coversDir = pathMod.join(DATA_DIR, 'series-covers');
  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });

  // Read raw body as image data
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);

  // Check if it's multipart form data or raw image
  const contentType = req.headers['content-type'] || '';
  let imageBuffer: Buffer;

  if (contentType.includes('multipart')) {
    // Simple multipart parse — find the image data after the headers
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) { res.status(400).json({ error: 'Missing boundary' }); return; }
    const parts = body.toString('binary').split(`--${boundary}`);
    const imagePart = parts.find((p) => p.includes('Content-Type: image'));
    if (!imagePart) { res.status(400).json({ error: 'No image found in upload' }); return; }
    const dataStart = imagePart.indexOf('\r\n\r\n') + 4;
    const dataEnd = imagePart.lastIndexOf('\r\n');
    imageBuffer = Buffer.from(imagePart.slice(dataStart, dataEnd), 'binary');
  } else {
    imageBuffer = body;
  }

  try {
    const sharp = (await import('sharp')).default;
    const filename = `${shortHash(series.id)}.jpg`;
    await sharp(imageBuffer)
      .resize(300, 450, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toFile(pathMod.join(coversDir, filename));

    series.coverFile = filename;
    saveSeries(series);
    res.json({ ok: true, coverFile: filename });
  } catch (err) {
    res.status(500).json({ error: `Image processing failed: ${(err as Error).message}` });
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
