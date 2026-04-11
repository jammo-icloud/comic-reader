import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { slugify, loadAllSeries, saveSeries, loadComics, writeComics, type SeriesRecord, type ComicRecord } from '../data.js';

const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB per image max

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

    // Create/update series record
    const existingSeries = loadAllSeries().find((s) => s.id === seriesId);
    if (!existingSeries) {
      const series: SeriesRecord = {
        id: seriesId,
        type: 'comic',
        name: seriesName,
        coverFile: null,
        score: null,
        synopsis: null,
        tags: [],
        status: null,
        year: null,
        malId: null,
        mangaDexId: null,
        placeholder: 'manga.png',
      };
      saveSeries(series);
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

    console.log(`  Imported chapter ${chapterNumber} of "${seriesName}": ${pageCount} pages → ${filename}`);
    res.json({ ok: true, file: filename, pages: pageCount, seriesId });
  } catch (err) {
    console.error(`Chapter upload failed: ${(err as Error).message}`);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
