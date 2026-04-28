/**
 * CRZ export — share-mode (one series at a time).
 *
 * GET /api/admin/series/:id/export?translations=1
 *
 * Streams a v2 .crz zip directly to the response. PDFs are stored without
 * recompression (they're already DEFLATE-compressed inside) so big series
 * stream out at near-disk-read speed with no CPU cost.
 *
 * Out of scope here: backup-mode, system-mode, scheduled exports. Those land
 * in subsequent rollout steps and will use a different route + format.
 */
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { getSeries, loadComics, isNsfwSeries, resolveComicPath } from '../data.js';
import { shortHash } from '../hash.js';
import { APP_VERSION } from '../version.js';
import { chapterLabelFromFile, type CrzManifestV2 } from '../crz-format.js';

const router = Router();
const DATA_DIR = process.env.DATA_DIR || './data';

// Admin-only — share-mode export pulls full chapter PDFs. Per-user "share my
// own collection" can be revisited later if useful.
router.use((req, res, next) => {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
});

// GET /api/admin/series/:id/export?translations=1
router.get('/admin/series/:id/export', async (req, res) => {
  const { id } = req.params;
  const includeTranslations = req.query.translations === '1';

  const series = getSeries(id);
  if (!series) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }

  const comics = loadComics(id);
  if (comics.length === 0) {
    res.status(400).json({ error: 'Series has no chapters to export' });
    return;
  }

  // --- Discover translations on disk (synchronous, cheap) ---
  // Translations live at  data/translations/<seriesId>/<shortHash(chapterFile)>/p<N>.json.
  // We remap them inside the zip to  translations/<chapterFile>/p<N>.json  so the
  // importer can re-hash the destination filename (which may differ post-conflict).
  const translationsDir = path.join(DATA_DIR, 'translations', id);
  const translationBundle: Array<{ chapterFile: string; pages: string[]; srcDir: string }> = [];
  if (includeTranslations && fs.existsSync(translationsDir)) {
    for (const c of comics) {
      const srcDir = path.join(translationsDir, shortHash(c.file));
      if (fs.existsSync(srcDir)) {
        const pages = fs.readdirSync(srcDir).filter((f) => f.endsWith('.json'));
        if (pages.length > 0) translationBundle.push({ chapterFile: c.file, pages, srcDir });
      }
    }
  }

  // --- Build manifest ---
  const manifest: CrzManifestV2 = {
    formatVersion: 2,
    exportedFrom: req.hostname || 'unknown',
    exportedAt: new Date().toISOString(),
    exporterVersion: APP_VERSION,
    originSeriesId: id,

    // Comic-reader's server streams gigabytes with no memory pressure, so we
    // never split. Manga-finder is the only producer that emits totalParts > 1.
    partIndex: 0,
    totalParts: 1,

    type: series.type,
    title: series.name,
    englishTitle: series.englishTitle,
    synopsis: series.synopsis,
    status: series.status,
    year: series.year,
    score: series.score,
    malId: series.malId,
    mangaDexId: series.mangaDexId,
    tags: series.tags,
    placeholder: series.placeholder,
    nsfw: isNsfwSeries(series),

    coverFile: series.coverFile ? 'cover.jpg' : null,

    chapters: comics.map((c) => ({
      file: `chapters/${c.file}`,
      chapter: chapterLabelFromFile(c.file),
      order: c.order,
      pages: c.pages,
    })),

    hasTranslations: translationBundle.length > 0,
  };

  // --- Headers BEFORE piping (Content-Length unknown for streamed zip — that's fine) ---
  const safeSlug = id.replace(/[^a-z0-9._-]/gi, '') || 'series';
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeSlug}.crz"`);
  res.setHeader('Cache-Control', 'no-store');

  // --- Streaming zip ---
  const archive = archiver('zip', {
    // PDFs and JPEGs are already compressed; recompressing wastes CPU for ~0% gain.
    // 'store' = no DEFLATE on entries.
    store: true,
  });

  let archiveErrored = false;
  archive.on('error', (err) => {
    archiveErrored = true;
    console.error(`CRZ export error for ${id}:`, err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.destroy();
  });
  archive.on('warning', (err) => {
    console.warn(`CRZ export warning for ${id}:`, err);
  });

  // Abort archive if client disconnects mid-stream so we stop reading PDFs from disk.
  res.on('close', () => {
    if (!res.writableEnded && !archiveErrored) archive.abort();
  });

  archive.pipe(res);

  // Cover
  if (series.coverFile) {
    const coverPath = path.join(DATA_DIR, 'series-covers', series.coverFile);
    if (fs.existsSync(coverPath)) {
      archive.file(coverPath, { name: 'cover.jpg' });
    } else {
      console.warn(`CRZ export: cover file referenced but missing on disk for ${id}: ${coverPath}`);
    }
  }

  // Chapter PDFs
  let chaptersAdded = 0;
  for (const c of comics) {
    const pdfPath = resolveComicPath(id, c.file);
    if (pdfPath && fs.existsSync(pdfPath)) {
      archive.file(pdfPath, { name: `chapters/${c.file}` });
      chaptersAdded++;
    } else {
      console.warn(`CRZ export: chapter missing on disk for ${id}: ${c.file}`);
    }
  }

  // Translations (renamed inside zip from <hash>/ to <chapterFile>/)
  for (const { chapterFile, pages, srcDir } of translationBundle) {
    for (const page of pages) {
      archive.file(path.join(srcDir, page), {
        name: `translations/${chapterFile}/${page}`,
      });
    }
  }

  // Manifest last
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  console.log(
    `CRZ export: ${id} (${chaptersAdded}/${comics.length} chapters` +
      `${includeTranslations ? `, ${translationBundle.length} chapters w/ translations` : ''})`,
  );

  await archive.finalize();
});

export default router;
