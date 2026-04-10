import { Router } from 'express';
import { queueOcr, getQueue, getCachedResult, cancelJob, removeJob, onProgress } from './queue.js';
import { healthCheck } from './ocr.js';
import { ollamaHealth } from './summarizer.js';
import { getGenres } from './prompts.js';
import {
  startScan, getCurrentScanJob, getReadyImports, getPendingCount,
  confirmImport, skipPendingImport, clearAllPending, onImportProgress,
  loadPending, type PendingImport,
} from './import-scanner.js';

const router = Router();

// ==================== Health ====================

router.get('/health', async (_req, res) => {
  const [ocr, ollama] = await Promise.all([healthCheck(), ollamaHealth()]);
  res.json({ ocr, ollama, genres: getGenres(), pendingImports: getPendingCount() });
});

// ==================== OCR ====================

router.post('/process', (req, res) => {
  const { filePath, comicKey, title, genre } = req.body;
  if (!filePath || !comicKey) { res.status(400).json({ error: 'filePath and comicKey required' }); return; }
  res.json(queueOcr(filePath, comicKey, title || comicKey, genre));
});

router.get('/results/:key', (req, res) => {
  const comicKey = Buffer.from(req.params.key, 'base64url').toString();
  const result = getCachedResult(comicKey);
  if (result) res.json(result);
  else res.status(404).json({ error: 'No result found' });
});

router.get('/queue', (_req, res) => { res.json(getQueue()); });

router.post('/cancel/:id', (req, res) => {
  const ok = cancelJob(req.params.id);
  if (ok) res.json({ ok: true });
  else res.status(404).json({ error: 'Job not found' });
});

router.delete('/queue/:id', (req, res) => { removeJob(req.params.id); res.json({ ok: true }); });

// ==================== Import Scanning ====================

// Start scanning a source folder (async — returns immediately)
router.post('/import/scan', async (req, res) => {
  const { path } = req.body;
  if (!path) { res.status(400).json({ error: 'path required' }); return; }
  try {
    const job = await startScan(path);
    res.json(job);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Get current scan job status
router.get('/import/scan-status', (_req, res) => {
  const job = getCurrentScanJob();
  res.json(job || { status: 'idle' });
});

// Get all pending imports (ready for confirmation)
router.get('/import/ready', (_req, res) => {
  res.json(getReadyImports());
});

// Get pending count
router.get('/import/count', (_req, res) => {
  res.json({ count: getPendingCount() });
});

// Get all pending (any status)
router.get('/import/all', (_req, res) => {
  res.json(loadPending());
});

// Confirm an import
router.post('/import/confirm', (req, res) => {
  const { sourceFolder } = req.body;
  if (!sourceFolder) { res.status(400).json({ error: 'sourceFolder required' }); return; }
  confirmImport(sourceFolder);
  res.json({ ok: true });
});

// Skip an import
router.post('/import/skip', (req, res) => {
  const { sourceFolder } = req.body;
  if (!sourceFolder) { res.status(400).json({ error: 'sourceFolder required' }); return; }
  skipPendingImport(sourceFolder);
  res.json({ ok: true });
});

// Clear all pending
router.post('/import/clear', (_req, res) => {
  clearAllPending();
  res.json({ ok: true });
});

// ==================== SSE — unified progress stream ====================

router.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // OCR progress
  const cleanupOcr = onProgress((job) => {
    res.write(`data: ${JSON.stringify({ type: 'ocr', payload: job })}\n\n`);
  });

  // Import scanning progress
  const cleanupImport = onImportProgress((data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  req.on('close', () => { cleanupOcr(); cleanupImport(); });
});

export default router;
