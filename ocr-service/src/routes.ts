import { Router } from 'express';
import {
  startScan, getCurrentScanJob, getReadyImports, getPendingCount,
  confirmImport, skipPendingImport, clearAllPending, onImportProgress,
  loadPending,
} from './import-scanner.js';

const router = Router();

// ==================== Health ====================

router.get('/health', (_req, res) => {
  res.json({ ok: true, pendingImports: getPendingCount() });
});

// ==================== Import Scanning ====================

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

router.get('/import/scan-status', (_req, res) => {
  const job = getCurrentScanJob();
  res.json(job || { status: 'idle' });
});

router.get('/import/ready', (_req, res) => {
  res.json(getReadyImports());
});

router.get('/import/count', (_req, res) => {
  res.json({ count: getPendingCount() });
});

router.get('/import/all', (_req, res) => {
  res.json(loadPending());
});

router.post('/import/confirm', (req, res) => {
  const { sourceFolder } = req.body;
  if (!sourceFolder) { res.status(400).json({ error: 'sourceFolder required' }); return; }
  confirmImport(sourceFolder);
  res.json({ ok: true });
});

router.post('/import/skip', (req, res) => {
  const { sourceFolder } = req.body;
  if (!sourceFolder) { res.status(400).json({ error: 'sourceFolder required' }); return; }
  skipPendingImport(sourceFolder);
  res.json({ ok: true });
});

router.post('/import/clear', (_req, res) => {
  clearAllPending();
  res.json({ ok: true });
});

// ==================== SSE Progress ====================

router.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const cleanup = onImportProgress((data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  req.on('close', cleanup);
});

export default router;
