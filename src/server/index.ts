import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import libraryRoutes from './routes/library.js';
import readerRoutes from './routes/reader.js';
import discoverRoutes from './routes/discover.js';
import { scanLibrary } from './scanner.js';
import { flushLibrary } from './library.js';
import { resumeIncompleteDownloads } from './downloader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.SERVER_PORT || '3000', 10);

const app = express();
app.use(express.json());

// API routes
app.use('/api', libraryRoutes);
app.use('/api', readerRoutes);
app.use('/api', discoverRoutes);

// Serve frontend in production
const clientDir = path.join(__dirname, '../client');

// Service worker must not be cached by the browser
app.get('/sw.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(clientDir, 'sw.js'));
});

app.use(express.static(clientDir));

// SPA fallback — skip API routes and static files
app.get('{*path}', (req, res) => {
  // Don't intercept workbox chunks or manifest
  if (req.path.endsWith('.js') || req.path.endsWith('.webmanifest')) {
    res.status(404).end();
    return;
  }
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Flush library data on shutdown
process.on('SIGINT', () => {
  flushLibrary();
  process.exit(0);
});
process.on('SIGTERM', () => {
  flushLibrary();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Comic Reader running on http://localhost:${PORT}`);

  // Scan shelves on startup (thumbnails generate lazily on first access)
  scanLibrary()
    .then(() => resumeIncompleteDownloads())
    .catch((err) => console.error('Startup scan failed:', err));
});
