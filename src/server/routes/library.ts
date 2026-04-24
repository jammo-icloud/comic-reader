import { Router } from 'express';
import pathMod from 'path';
import fs from 'fs';
import {
  loadAllSeries, loadComics, saveSeries, removeSeries,
  loadComicsForUser, getSeriesStatsForUser,
  loadCollection, addToCollection, removeFromCollection, isInCollection,
  loadUserProgress, updateUserProgress,
  loadPreferences, savePreferences,
  isNsfwSeries, VALID_THEMES,
  type SeriesRecord,
} from '../data.js';
import { shortHash } from '../hash.js';
import { getThumbnailPath, generateThumbnail } from '../thumbnails.js';
import { enrichSeries, enrichSingle } from '../enrich.js';
import { syncSeries, markSeriesSeen } from '../sync.js';

const router = Router();

// --- Series ---

router.get('/series', (req, res) => {
  const allSeries = loadAllSeries();
  const { type, scope } = req.query;
  const username = req.username;

  // scope=catalog returns all series (for browse/search dedup)
  // default returns only user's collection
  let filtered: SeriesRecord[];
  if (scope === 'catalog') {
    filtered = allSeries;
  } else {
    const collection = new Set(loadCollection(username).map((e) => e.seriesId));
    filtered = allSeries.filter((s) => collection.has(s.id));
  }

  if (type && typeof type === 'string') {
    filtered = filtered.filter((s) => s.type === type);
  }

  // Safe mode: filter out NSFW series unless user has disabled safe mode
  const prefs = loadPreferences(username);
  if (prefs.safeMode) {
    filtered = filtered.filter((s) => !isNsfwSeries(s));
  }

  const collectionSet = new Set(loadCollection(username).map((e) => e.seriesId));
  const result = filtered.map((s) => ({
    ...s,
    ...getSeriesStatsForUser(s.id, username),
    inCollection: collectionSet.has(s.id),
  }));

  res.json(result);
});

router.get('/series/:id', (req, res) => {
  const allSeries = loadAllSeries();
  const series = allSeries.find((s) => s.id === req.params.id);
  if (!series) { res.status(404).json({ error: 'Series not found' }); return; }

  // Clear "new chapters" badge when user opens the series
  if (series.newChapterCount && series.newChapterCount > 0) {
    markSeriesSeen(series.id);
  }

  res.json({
    ...series,
    ...getSeriesStatsForUser(series.id, req.username),
    inCollection: isInCollection(req.username, series.id),
  });
});

// List series with unseen new chapters for the notification dropdown
router.get('/subscriptions/new', (req, res) => {
  const allSeries = loadAllSeries();
  const collection = new Set(loadCollection(req.username).map((e) => e.seriesId));
  const prefs = loadPreferences(req.username);

  const result = allSeries
    .filter((s) => s.newChapterCount && s.newChapterCount > 0)
    .filter((s) => collection.has(s.id))
    .filter((s) => !prefs.safeMode || !isNsfwSeries(s))
    .map((s) => ({
      id: s.id,
      name: s.name,
      englishTitle: s.englishTitle,
      coverFile: s.coverFile,
      newChapterCount: s.newChapterCount,
      lastSyncAt: s.lastSyncAt,
    }))
    .sort((a, b) => (b.lastSyncAt || '').localeCompare(a.lastSyncAt || ''));

  res.json(result);
});

// Manual sync trigger — check source for new chapters now
router.post('/series/:id/sync', async (req, res) => {
  try {
    const result = await syncSeries(req.params.id, req.username);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Assign or change the sync source for a series
router.patch('/series/:id/sync-source', (req, res) => {
  const series = loadAllSeries().find((s) => s.id === req.params.id);
  if (!series) { res.status(404).json({ error: 'Series not found' }); return; }

  const { sourceId, mangaId } = req.body;
  if (sourceId === null || sourceId === '') {
    // Unsubscribe
    saveSeries({ ...series, syncSource: null });
    res.json({ ok: true, syncSource: null });
    return;
  }

  if (!sourceId || !mangaId) {
    res.status(400).json({ error: 'sourceId and mangaId required' });
    return;
  }

  saveSeries({ ...series, syncSource: { sourceId, mangaId } });
  res.json({ ok: true, syncSource: { sourceId, mangaId } });
});

// --- Comics in a series ---

router.get('/series/:id/comics', (req, res) => {
  const comics = loadComicsForUser(req.params.id, req.username);
  const withHashes = comics.map((c) => ({
    ...c,
    thumbHash: shortHash(`${req.params.id}/${c.file}`),
  }));
  res.json(withHashes);
});

// --- Continue reading ---

router.get('/continue-reading', (req, res) => {
  const username = req.username;
  const allSeries = loadAllSeries();
  const seriesMap = new Map(allSeries.map((s) => [s.id, s]));
  const collection = new Set(loadCollection(username).map((e) => e.seriesId));
  const progress = loadUserProgress(username);
  const userPrefs = loadPreferences(username);

  const results: any[] = [];
  for (const p of progress) {
    if (!collection.has(p.seriesId)) continue;
    if (p.currentPage <= 0 || p.isRead || !p.lastReadAt) continue;
    const series = seriesMap.get(p.seriesId);
    if (!series) continue;
    if (userPrefs.safeMode && isNsfwSeries(series)) continue;

    // Get page count from shared comics
    const comics = loadComics(p.seriesId);
    const comic = comics.find((c) => c.file === p.file);

    results.push({
      seriesId: p.seriesId,
      seriesName: series.name,
      file: p.file,
      currentPage: p.currentPage,
      pages: comic?.pages || 0,
      lastReadAt: p.lastReadAt,
      thumbHash: shortHash(`${p.seriesId}/${p.file}`),
      coverFile: series.coverFile,
    });
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
    console.log(`  MAL override: series=${seriesId}, malId=${malId}`);
    const result = await enrichSingle(seriesId, malId);
    if (!result) { res.status(404).json({ error: 'Series not found' }); return; }
    if (result.error) {
      console.log(`  MAL override warning: ${result.error}`);
      res.json({ ...result.series, warning: result.error });
    } else {
      console.log(`  MAL override success: "${result.series.name}" (score: ${result.series.score})`);
      res.json(result.series);
    }
  } catch (err) {
    console.error(`  MAL override failed:`, (err as Error).message);
    res.status(500).json({ error: `Override failed: ${(err as Error).message}` });
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
  const coverPath = pathMod.resolve(pathMod.join(DATA_DIR, 'series-covers', series.coverFile));

  const exists = fs.existsSync(coverPath);
  console.log(`  Cover request: ${req.params.id} → ${coverPath} (exists: ${exists})`);

  if (!exists) {
    res.status(404).json({ error: 'Cover file not found', path: coverPath });
    return;
  }

  // Read and serve the file directly instead of sendFile (avoids Express 5 path issues)
  try {
    const data = fs.readFileSync(coverPath);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.send(data);
  } catch (err) {
    console.error(`  Cover read error: ${(err as Error).message}`);
    if (!res.headersSent) res.status(404).json({ error: 'Cover not found' });
  }
});

// --- Update series tags ---

router.patch('/series/:id/tags', (req, res) => {
  const series = loadAllSeries().find((s) => s.id === req.params.id);
  if (!series) { res.status(404).json({ error: 'Series not found' }); return; }
  const { tags } = req.body;
  if (!Array.isArray(tags)) { res.status(400).json({ error: 'tags must be an array' }); return; }
  series.tags = tags;
  saveSeries(series);
  res.json(series);
});

// --- Delete series ---

router.delete('/series/:id', (req, res) => {
  const seriesId = req.params.id;
  const series = loadAllSeries().find((s) => s.id === seriesId);
  if (!series) { res.status(404).json({ error: 'Series not found' }); return; }

  if (req.query.purge === 'true') {
    // Purge requires admin — non-admins can only remove from their collection
    if (!req.isAdmin) {
      res.status(403).json({ error: 'Admin access required to purge series' });
      return;
    }

    const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';
    const DATA_DIR = process.env.DATA_DIR || './data';

    // Move to trash instead of hard delete
    const typeDir = series.type === 'comic' ? 'comics' : 'magazines';
    const seriesDir = pathMod.join(LIBRARY_DIR, typeDir, seriesId);
    if (fs.existsSync(seriesDir)) {
      const trashDir = pathMod.join(LIBRARY_DIR, '.trash');
      if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });
      const trashDest = pathMod.join(trashDir, `${typeDir}-${seriesId}`);
      try {
        fs.renameSync(seriesDir, trashDest);
        console.log(`  Moved to trash: ${seriesDir} → ${trashDest}`);
      } catch {
        // Cross-device: fall back to hard delete
        fs.rmSync(seriesDir, { recursive: true, force: true });
        console.log(`  Hard deleted: ${seriesDir}`);
      }
    }

    if (series.coverFile) {
      const coverPath = pathMod.join(DATA_DIR, 'series-covers', series.coverFile);
      if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    }

    removeSeries(seriesId);
    console.log(`Purged series: ${series.name} (${seriesId})`);
  } else {
    // Soft delete — just remove from this user's collection
    removeFromCollection(req.username, seriesId);
    console.log(`Removed "${series.name}" from ${req.username}'s collection`);
  }

  res.json({ ok: true });
});

// --- User / Collection / Preferences ---

router.get('/me', (req, res) => {
  const prefs = loadPreferences(req.username);
  res.json({ username: req.username, preferences: prefs });
});

router.patch('/me/preferences', (req, res) => {
  const currentPrefs = loadPreferences(req.username);
  if (req.body.theme && VALID_THEMES.includes(req.body.theme)) {
    currentPrefs.theme = req.body.theme;
  }
  if (req.body.safeMode !== undefined) currentPrefs.safeMode = !!req.body.safeMode;
  savePreferences(req.username, currentPrefs);
  res.json(currentPrefs);
});

router.post('/collection/:seriesId', (req, res) => {
  const seriesId = req.params.seriesId;
  const series = loadAllSeries().find((s) => s.id === seriesId);
  if (!series) { res.status(404).json({ error: 'Series not found' }); return; }
  addToCollection(req.username, seriesId);
  res.json({ ok: true });
});

router.delete('/collection/:seriesId', (req, res) => {
  removeFromCollection(req.username, req.params.seriesId);
  res.json({ ok: true });
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

  if (!thumbFile || !fs.existsSync(thumbFile)) {
    res.status(404).json({ error: 'Thumbnail not available' });
    return;
  }

  try {
    const buffer = fs.readFileSync(thumbFile);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.send(buffer);
  } catch (err) {
    res.status(404).json({ error: 'Thumbnail read failed' });
  }
});

export default router;
