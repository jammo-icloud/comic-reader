import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { importSeries, scanSourceFolder, getPendingImports, skipImport as skipPending, clearPending } from '../importer.js';
import { enrichSingle, searchMalForName } from '../enrich.js';
import { addToCollection } from '../data.js';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:3001';
const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';
const IMPORT_DIR = path.join(LIBRARY_DIR, 'import');

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

// Confirm import — responds immediately, processes in background
router.post('/import/confirm', async (req, res) => {
  const { sourceFolder, type, name, malId } = req.body;
  if (!sourceFolder || !type || !name) {
    res.status(400).json({ error: 'sourceFolder, type, and name required' });
    return;
  }

  const username = req.username;
  console.log(`  Import confirm: "${name}" (${type}) from ${sourceFolder} [user: ${username}]`);

  // Respond immediately — import runs in background
  res.json({ ok: true, status: 'importing', name });

  // Background processing
  try {
    const series = await importSeries({ sourceFolder, type, name, malId });

    if (malId) {
      await enrichSingle(series.id, malId);
    }

    await fetch(`${OCR_SERVICE_URL}/import/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceFolder }),
    }).catch(() => {});

    addToCollection(username, series.id);
    console.log(`  Import complete: "${series.name}" → ${username}'s collection (${series.id})`);

    if (sourceFolder.startsWith(IMPORT_DIR) && fs.existsSync(sourceFolder)) {
      fs.rmSync(sourceFolder, { recursive: true, force: true });
      console.log(`  Cleaned up import source: ${sourceFolder}`);
    }
  } catch (err) {
    console.error(`  Import failed for "${name}": ${(err as Error).message}`);
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

// ==================== Local scan (no orchestrator needed) ====================

// Scan the import folder directly — each subfolder becomes a pending import
// Also searches MAL for each comic folder in the background
router.post('/import/scan-local', async (_req, res) => {
  try {
    if (!fs.existsSync(IMPORT_DIR)) {
      fs.mkdirSync(IMPORT_DIR, { recursive: true });
    }
    const result = scanSourceFolder(IMPORT_DIR);

    // Search MAL for each pending comic (inline, with rate limiting)
    const pending = getPendingImports();
    for (const p of pending) {
      if (p.suggestedType === 'comic' && !p.malMatch) {
        const match = await searchMalForName(p.folderName);
        if (match) p.malMatch = match;
        // Brief rate limit between requests
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    res.json({ ok: true, count: result.count });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get locally-scanned pending imports (no orchestrator)
router.get('/import/local-ready', (_req, res) => {
  const pending = getPendingImports();
  // Map to the shape PendingList expects
  const mapped = pending.map((p) => ({
    sourceFolder: p.sourceFolder,
    folderName: p.folderName,
    suggestedType: p.suggestedType,
    fileCount: p.fileCount,
    files: p.files,
    malMatch: p.malMatch,
    status: 'ready' as const,
  }));
  res.json(mapped);
});

// Get local pending count
router.get('/import/local-count', (_req, res) => {
  res.json({ count: getPendingImports().length });
});

// Skip a local pending import
router.post('/import/local-skip', (req, res) => {
  const { sourceFolder } = req.body;
  if (sourceFolder) skipPending(sourceFolder);
  res.json({ ok: true });
});

// Clear local pending
router.post('/import/local-clear', (_req, res) => {
  clearPending();
  res.json({ ok: true });
});

export default router;
