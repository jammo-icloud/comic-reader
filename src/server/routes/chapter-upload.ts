import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { slugify, loadAllSeries, saveSeries, loadComics, writeComics, addToCollection, NSFW_TAGS, type SeriesRecord, type ComicRecord } from '../data.js';
import { shortHash } from '../hash.js';
import { importCrz } from '../crz-handler.js';

const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';
const IMPORT_DIR = path.join(LIBRARY_DIR, 'import');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB per image max
const uploadFiles = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(IMPORT_DIR)) fs.mkdirSync(IMPORT_DIR, { recursive: true });
      cb(null, IMPORT_DIR);
    },
    filename: (_req, file, cb) => cb(null, file.originalname),
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB per file
});

const router = Router();

/**
 * POST /api/import/chapter-images
 *
 * Receives images from browser-side connectors.
 * Assembles them into a PDF and saves to the library.
 *
 * Body (multipart/form-data):
 *   - seriesName: string (display name)
 *   - chapterNumber: string (e.g. "1", "2.5")
 *   - sourceId: string (which source it came from)
 *   - images: File[] (ordered page images)
 */
router.post('/import/chapter-images', upload.array('images', 500), async (req, res) => {
  const { seriesName, chapterNumber, sourceId } = req.body;
  const files = req.files as Express.Multer.File[];

  if (!seriesName || !chapterNumber || !files?.length) {
    res.status(400).json({ error: 'seriesName, chapterNumber, and images required' });
    return;
  }

  const seriesId = slugify(seriesName);
  const destDir = path.join(LIBRARY_DIR, 'comics', seriesId);

  try {
    // Ensure series directory
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    // Assemble images into PDF
    const pdf = await PDFDocument.create();
    const PDF_WIDTH = 800;

    for (const file of files) {
      try {
        const metadata = await sharp(file.buffer).metadata();
        const width = metadata.width || PDF_WIDTH;
        const height = metadata.height || 1200;

        const jpegBuffer = await sharp(file.buffer)
          .resize({ width: PDF_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();

        const jpegImage = await pdf.embedJpg(jpegBuffer);
        const scaledHeight = Math.round(height * (PDF_WIDTH / width));
        const page = pdf.addPage([PDF_WIDTH, scaledHeight]);
        page.drawImage(jpegImage, { x: 0, y: 0, width: PDF_WIDTH, height: scaledHeight });
      } catch (err) {
        console.error(`  Skipping page: ${(err as Error).message}`);
      }
    }

    if (pdf.getPageCount() === 0) {
      res.status(400).json({ error: 'No valid images to assemble' });
      return;
    }

    // Save PDF
    const chapterNum = chapterNumber.padStart(3, '0');
    const filename = `chapter-${chapterNum}.pdf`;
    const pdfPath = path.join(destDir, filename);
    const pdfBytes = await pdf.save();
    fs.writeFileSync(pdfPath, pdfBytes);

    // Get page count from the raw PDF bytes
    const pageCount = pdf.getPageCount();

    // Auto-tag based on source
    const SOURCE_TAGS: Record<string, string[]> = {
      mangadex: ['manga'],
      mangafox: ['manga'],
      mangahub: ['manga'],
      mangadna: ['manga'],
      manga18fx: ['manga', 'adult'],
      omegascans: ['manhwa', 'adult'],
      hentainexus: ['hentai', 'adult'],
      weebcentral: ['manga'],
      readallcomics: ['western', 'comics'],
    };

    // Create/update series record
    let series = loadAllSeries().find((s) => s.id === seriesId);
    if (!series) {
      const autoTags = SOURCE_TAGS[sourceId] || [];
      series = {
        id: seriesId,
        type: 'comic',
        name: seriesName,
        coverFile: null,
        score: null,
        synopsis: null,
        tags: autoTags,
        status: null,
        year: null,
        malId: null,
        mangaDexId: null,
        englishTitle: null,
        placeholder: 'manga.png',
      };
      saveSeries(series);
    }

    // Download cover art if provided and series doesn't have one yet
    const coverUrl = req.body.coverUrl;
    console.log(`  Cover URL received: ${coverUrl ? coverUrl.slice(0, 80) + '...' : 'none'}`);
    if (coverUrl && !series.coverFile) {
      try {
        const DATA_DIR = process.env.DATA_DIR || './data';
        const coversDir = path.join(DATA_DIR, 'series-covers');
        if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });

        const coverRes = await fetch(coverUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        if (coverRes.ok) {
          const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
          const filename = `${shortHash(seriesId)}.jpg`;
          await sharp(coverBuffer)
            .resize(300, 450, { fit: 'cover' })
            .jpeg({ quality: 85 })
            .toFile(path.join(coversDir, filename));

          series.coverFile = filename;
          saveSeries(series);
          console.log(`  Set cover for "${seriesName}" from ${coverUrl.slice(0, 60)}...`);
        }
      } catch (err) {
        console.error(`  Cover download failed:`, (err as Error).message);
      }
    }

    // Add comic to series JSONL
    const comics = loadComics(seriesId);
    const exists = comics.find((c) => c.file === filename);
    if (!exists) {
      comics.push({
        file: filename,
        pages: pageCount,
        currentPage: 0,
        isRead: false,
        order: parseFloat(chapterNumber) || 0,
        lastReadAt: null,
      });
      comics.sort((a, b) => a.order - b.order);
      writeComics(seriesId, comics);
    }

    // Add to user's collection
    // Extension can pass username in form data, otherwise use session or default
    const username = req.body.username || req.username || process.env.DEFAULT_USER || 'local';
    addToCollection(username, seriesId);

    console.log(`  Imported chapter ${chapterNumber} of "${seriesName}": ${pageCount} pages → ${filename} [user: ${username}]`);
    res.json({ ok: true, file: filename, pages: pageCount, seriesId });
  } catch (err) {
    console.error(`Chapter upload failed: ${(err as Error).message}`);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/import/upload-files
 * Upload comic files (PDF/CBR/CBZ) directly via drag & drop or file picker.
 * Files are saved to the import folder for processing.
 */
router.post('/import/upload-files', uploadFiles.array('files', 100), (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  const uploaded = files.map((f) => ({
    name: f.originalname,
    size: f.size,
    path: f.path,
  }));

  console.log(`  Uploaded ${uploaded.length} files to import folder`);
  res.json({ ok: true, files: uploaded, importDir: IMPORT_DIR });
});

/**
 * GET /api/import/watch-folder
 * Check what's in the NAS import folder
 */
router.get('/import/watch-folder', (_req, res) => {
  if (!fs.existsSync(IMPORT_DIR)) {
    fs.mkdirSync(IMPORT_DIR, { recursive: true });
  }

  const entries = fs.readdirSync(IMPORT_DIR, { withFileTypes: true });
  const items = entries
    .filter((e) => !e.name.startsWith('.') && e.name !== '@eaDir' && e.name !== '#recycle' && e.name !== '@tmp')
    .map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      size: e.isFile() ? fs.statSync(path.join(IMPORT_DIR, e.name)).size : null,
    }));

  res.json({ path: IMPORT_DIR, items });
});

/**
 * POST /api/import/crz
 * Import a .crz (Comic Reader Zip) file — chapters + metadata + cover.
 */
const crzUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB
router.post('/import/crz', crzUpload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No .crz file uploaded' });
    return;
  }

  // Peek at manifest to check for NSFW tags before importing
  if (!req.isAdmin) {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file.buffer);
      const manifestFile = zip.file('manifest.json');
      if (manifestFile) {
        const manifest = JSON.parse(await manifestFile.async('string'));
        const tags: string[] = [...(manifest.tags || [])];
        // Also check source-based tags
        const sourceId = manifest.sourceId?.toLowerCase();
        if (sourceId === 'hentainexus' || sourceId === 'manga18fx' || sourceId === 'omegascans') {
          tags.push('adult');
        }
        if (tags.some((t: string) => NSFW_TAGS.has(t.toLowerCase()))) {
          res.status(403).json({ error: 'Only admins can import adult content' });
          return;
        }
      }
    } catch {
      // If we can't peek, let importCrz handle it
    }
  }

  try {
    const result = await importCrz(file.buffer, req.username);
    res.json(result);
  } catch (err) {
    console.error(`CRZ import failed: ${(err as Error).message}`);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
