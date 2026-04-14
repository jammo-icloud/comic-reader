import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import libraryRoutes from './routes/library.js';
import readerRoutes from './routes/reader.js';
import discoverRoutes from './routes/discover.js';
import importRoutes from './routes/import.js';
import chapterUploadRoutes from './routes/chapter-upload.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import { resumeIncompleteDownloads } from './downloader.js';
import { userMiddleware, authGuard } from './middleware/user.js';
import { migrateToMultiUser } from './migrate.js';
import { runCleanup } from './cleanup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.SERVER_PORT || '3000', 10);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(userMiddleware);

// API routes — auth routes first (no guard), then guarded routes
app.use('/api', authRoutes);
app.use('/api', authGuard);
app.use('/api', libraryRoutes);
app.use('/api', readerRoutes);
app.use('/api', discoverRoutes);
app.use('/api', importRoutes);
app.use('/api', chapterUploadRoutes);
app.use('/api', adminRoutes);

// Serve data directory assets (covers, thumbnails) as static files
// This bypasses Express route handling — much faster for images
const DATA_DIR = process.env.DATA_DIR || './data';
app.use('/static/covers', express.static(path.join(DATA_DIR, 'series-covers'), {
  maxAge: '7d',
  immutable: true,
}));
app.use('/static/thumbnails', express.static(path.join(DATA_DIR, 'thumbnails'), {
  maxAge: '7d',
  immutable: true,
}));
app.use('/static/placeholders', express.static(
  path.join(__dirname, '../client/placeholders'),
  { maxAge: '30d', immutable: true }
));

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

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// Migrate single-user data to multi-user (runs once)
migrateToMultiUser();

// Compact and clean up data files
runCleanup();

app.listen(PORT, () => {
  console.log(`Comic Reader running on http://localhost:${PORT}`);

  // Resume any incomplete downloads from previous session
  resumeIncompleteDownloads();
});
