import { Router } from 'express';
import { importSeries } from '../importer.js';
import { enrichSingle } from '../enrich.js';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:3001';

const router = Router();

// --- Proxy to OCR service for scanning ---

// Start scanning a source folder (proxied to orchestrator)
router.post('/import/scan', async (req, res) => {
  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/import/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.status(ocrRes.status).json(await ocrRes.json());
  } catch (err) {
    res.status(502).json({ error: 'OCR service unreachable' });
  }
});

// Get scan status
router.get('/import/scan-status', async (_req, res) => {
  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/import/scan-status`);
    res.json(await ocrRes.json());
  } catch { res.status(502).json({ error: 'OCR service unreachable' }); }
});

// Get ready imports (proxied)
router.get('/import/ready', async (_req, res) => {
  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/import/ready`);
    res.json(await ocrRes.json());
  } catch { res.status(502).json({ error: 'OCR service unreachable' }); }
});

// Get pending count
router.get('/import/count', async (_req, res) => {
  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/import/count`);
    res.json(await ocrRes.json());
  } catch { res.json({ count: 0 }); }
});

// Confirm import — this happens on the main app (moves files, creates metadata)
router.post('/import/confirm', async (req, res) => {
  const { sourceFolder, type, name, malId } = req.body;
  if (!sourceFolder || !type || !name) {
    res.status(400).json({ error: 'sourceFolder, type, and name required' });
    return;
  }

  try {
    // Execute the import (rename + move files, create metadata)
    const series = await importSeries({ sourceFolder, type, name, malId });

    // Enrich with MAL if provided
    if (malId) {
      await enrichSingle(series.id, malId);
    }

    // Tell orchestrator this one is confirmed
    await fetch(`${OCR_SERVICE_URL}/import/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceFolder }),
    }).catch(() => {});

    res.json(series);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Skip import (proxied)
router.post('/import/skip', async (req, res) => {
  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/import/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await ocrRes.json());
  } catch { res.status(502).json({ error: 'OCR service unreachable' }); }
});

// Clear all pending (proxied)
router.post('/import/clear', async (_req, res) => {
  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/import/clear`, { method: 'POST' });
    res.json(await ocrRes.json());
  } catch { res.status(502).json({ error: 'OCR service unreachable' }); }
});

export default router;
