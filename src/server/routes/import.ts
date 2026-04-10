import { Router } from 'express';
import { scanSourceFolder, getPendingImports, getNextPending, skipImport, skipAllImports, importSeries, clearPending } from '../importer.js';
import { enrichSingle } from '../enrich.js';

const router = Router();

// Scan a source folder for subfolders to import
router.post('/import/scan', (req, res) => {
  const { path } = req.body;
  if (!path) { res.status(400).json({ error: 'path required' }); return; }

  try {
    const result = scanSourceFolder(path);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Get all pending imports
router.get('/import/pending', (_req, res) => {
  res.json(getPendingImports());
});

// Get next pending import (for wizard)
router.get('/import/next', (_req, res) => {
  const next = getNextPending();
  if (next) {
    res.json(next);
  } else {
    res.json(null);
  }
});

// Confirm import — move files, create metadata
router.post('/import/confirm', async (req, res) => {
  const { sourceFolder, type, name, malId } = req.body;
  if (!sourceFolder || !type || !name) {
    res.status(400).json({ error: 'sourceFolder, type, and name required' });
    return;
  }

  try {
    const series = await importSeries({ sourceFolder, type, name, malId });

    // If MAL ID provided, enrich immediately
    if (malId) {
      await enrichSingle(series.id, malId);
    }

    res.json(series);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Skip current import
router.post('/import/skip', (req, res) => {
  const { sourceFolder } = req.body;
  if (sourceFolder) skipImport(sourceFolder);
  res.json({ ok: true });
});

// Skip all remaining
router.post('/import/skip-all', (_req, res) => {
  skipAllImports();
  res.json({ ok: true });
});

// Clear pending queue
router.post('/import/clear', (_req, res) => {
  clearPending();
  res.json({ ok: true });
});

export default router;
