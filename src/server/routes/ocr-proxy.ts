import { Router } from 'express';
import { getComicFullPath } from '../scanner.js';
import { getComic } from '../library.js';
import { getShelf } from '../shelves.js';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:3001';

const router = Router();

// Proxy: start OCR processing for a comic
router.post('/ocr/process', async (req, res) => {
  const { comicKey, genre } = req.body;
  if (!comicKey) {
    res.status(400).json({ error: 'comicKey required' });
    return;
  }

  const filePath = getComicFullPath(comicKey);
  if (!filePath) {
    res.status(404).json({ error: 'Comic file not found' });
    return;
  }

  const comic = getComic(comicKey);
  const shelf = comic ? getShelf(comic.shelfId) : null;

  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath,
        comicKey,
        title: comic?.title || comicKey,
        genre: genre || 'general',
      }),
    });
    const data = await ocrRes.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: `OCR service unreachable: ${(err as Error).message}` });
  }
});

// Proxy: get cached result
router.get('/ocr/results/:key', async (req, res) => {
  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/results/${req.params.key}`);
    if (ocrRes.ok) {
      res.json(await ocrRes.json());
    } else {
      res.status(ocrRes.status).json(await ocrRes.json());
    }
  } catch (err) {
    res.status(502).json({ error: 'OCR service unreachable' });
  }
});

// Proxy: get queue
router.get('/ocr/queue', async (_req, res) => {
  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/queue`);
    res.json(await ocrRes.json());
  } catch (err) {
    res.status(502).json({ error: 'OCR service unreachable' });
  }
});

// Proxy: SSE progress passthrough
router.get('/ocr/progress', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/progress`);
    if (!ocrRes.body) { res.end(); return; }

    const reader = ocrRes.body.getReader();
    const decoder = new TextDecoder();

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value));
      }
    };

    pump().catch(() => {});
    req.on('close', () => reader.cancel());
  } catch {
    res.end();
  }
});

// Proxy: health check
router.get('/ocr/health', async (_req, res) => {
  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/health`);
    res.json(await ocrRes.json());
  } catch (err) {
    res.status(502).json({ error: 'OCR service unreachable' });
  }
});

// Proxy: cancel
router.post('/ocr/cancel/:id', async (req, res) => {
  try {
    const ocrRes = await fetch(`${OCR_SERVICE_URL}/cancel/${req.params.id}`, { method: 'POST' });
    res.json(await ocrRes.json());
  } catch (err) {
    res.status(502).json({ error: 'OCR service unreachable' });
  }
});

export default router;
