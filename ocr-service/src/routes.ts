import { Router } from 'express';
import { queueOcr, getQueue, getCachedResult, cancelJob, removeJob, onProgress } from './queue.js';
import { healthCheck } from './ocr.js';
import { ollamaHealth } from './summarizer.js';
import { getGenres } from './prompts.js';

const router = Router();

// Health check
router.get('/health', async (_req, res) => {
  const [ocr, ollama] = await Promise.all([healthCheck(), ollamaHealth()]);
  res.json({
    ocr,
    ollama,
    genres: getGenres(),
  });
});

// Queue an OCR + summarization job
router.post('/process', (req, res) => {
  const { filePath, comicKey, title, genre } = req.body;
  if (!filePath || !comicKey) {
    res.status(400).json({ error: 'filePath and comicKey required' });
    return;
  }

  const job = queueOcr(filePath, comicKey, title || comicKey, genre);
  res.json(job);
});

// Get cached result
router.get('/results/:key', (req, res) => {
  const comicKey = Buffer.from(req.params.key, 'base64url').toString();
  const result = getCachedResult(comicKey);
  if (result) {
    res.json(result);
  } else {
    res.status(404).json({ error: 'No result found' });
  }
});

// Get queue
router.get('/queue', (_req, res) => {
  res.json(getQueue());
});

// Cancel a job
router.post('/cancel/:id', (req, res) => {
  const ok = cancelJob(req.params.id);
  if (ok) res.json({ ok: true });
  else res.status(404).json({ error: 'Job not found or already complete' });
});

// Remove a completed/errored job
router.delete('/queue/:id', (req, res) => {
  removeJob(req.params.id);
  res.json({ ok: true });
});

// SSE progress stream
router.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const cleanup = onProgress((job) => {
    res.write(`data: ${JSON.stringify(job)}\n\n`);
  });

  req.on('close', cleanup);
});

export default router;
