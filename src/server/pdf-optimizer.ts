/**
 * PDF Optimizer — detects oversized PDF pages (high-res photos) and
 * re-renders them to a reading-friendly resolution. Also detects
 * cover pages buried at the end and moves them to the front.
 */
import fs from 'fs';
import path from 'path';
import * as mupdf from 'mupdf';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { loadAllSeries, loadComics, writeComics, getSeries, type SeriesRecord } from './data.js';

const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';

// Pages exceeding this dimension trigger optimization
const TRIGGER_DIM = 2400;
// Output cap
const MAX_DIM = 2400;
// JPEG quality for re-rendered pages
const QUALITY = 90;
// Skip files smaller than this (fast pre-check)
const MIN_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface PageInfo {
  index: number;
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'portrait' | 'landscape' | 'square';
  longestEdge: number;
  needsResize: boolean;
}

/**
 * Analyze a PDF's pages for dimensions and cover detection.
 */
function analyzePages(filePath: string): PageInfo[] {
  const data = fs.readFileSync(filePath);
  const doc = mupdf.Document.openDocument(data, 'application/pdf');
  const pageCount = doc.countPages();

  const pages: PageInfo[] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const bounds = page.getBounds();
    const w = bounds[2] - bounds[0];
    const h = bounds[3] - bounds[1];
    const longestEdge = Math.max(w, h);
    pages.push({
      index: i,
      width: Math.round(w),
      height: Math.round(h),
      aspectRatio: w / h,
      orientation: Math.abs(w - h) < 10 ? 'square' : w > h ? 'landscape' : 'portrait',
      longestEdge: Math.round(longestEdge),
      needsResize: longestEdge > TRIGGER_DIM,
    });
  }
  return pages;
}

/**
 * Detect if the last page is a cover (different aspect/orientation/size from the majority).
 * Returns the page index to move to front, or -1.
 */
function detectCover(pages: PageInfo[]): number {
  if (pages.length < 3) return -1;

  // Find dominant aspect ratio
  const ratios = pages.map((p) => Math.round(p.aspectRatio * 100) / 100);
  const ratioCounts = new Map<number, number>();
  for (const r of ratios) ratioCounts.set(r, (ratioCounts.get(r) || 0) + 1);
  let dominantRatio = 0;
  let dominantCount = 0;
  for (const [r, count] of ratioCounts) {
    if (count > dominantCount) { dominantRatio = r; dominantCount = count; }
  }

  // Find dominant orientation
  const orientCounts = { portrait: 0, landscape: 0, square: 0 };
  for (const p of pages) orientCounts[p.orientation]++;
  const dominantOrientation = orientCounts.portrait >= orientCounts.landscape ? 'portrait' : 'landscape';

  // Only check the last page
  const last = pages[pages.length - 1];
  const ratioDiff = Math.abs(last.aspectRatio - dominantRatio);
  const isOrientationOutlier = last.orientation !== dominantOrientation && last.orientation !== 'square';
  const isSizeOutlier = last.longestEdge < pages[0].longestEdge * 0.7;
  const isRatioOutlier = ratioDiff > 0.15;

  if (isOrientationOutlier || isRatioOutlier || isSizeOutlier) {
    return last.index;
  }
  return -1;
}

/**
 * Check if a PDF file needs optimization (without modifying it).
 */
export function needsOptimization(filePath: string): boolean {
  const stat = fs.statSync(filePath);
  if (stat.size < MIN_FILE_SIZE) return false;

  try {
    const pages = analyzePages(filePath);
    return pages.some((p) => p.needsResize);
  } catch {
    return false;
  }
}

/**
 * Optimize a single PDF file in-place. Re-renders oversized pages
 * and moves cover from last page to first if detected.
 * Returns stats or null if no optimization was needed.
 */
export async function optimizePdf(filePath: string): Promise<{
  originalSize: number;
  optimizedSize: number;
  pagesResized: number;
  coverMoved: boolean;
} | null> {
  const stat = fs.statSync(filePath);
  const originalSize = stat.size;

  let pages: PageInfo[];
  try {
    pages = analyzePages(filePath);
  } catch (err) {
    console.error(`  Optimizer: failed to analyze ${path.basename(filePath)}: ${(err as Error).message}`);
    return null;
  }

  const oversized = pages.filter((p) => p.needsResize);
  const coverIndex = detectCover(pages);

  if (oversized.length === 0 && coverIndex < 0) return null;

  console.log(`  Optimizing ${path.basename(filePath)}: ${oversized.length} oversized pages${coverIndex >= 0 ? ', cover detected at end' : ''}`);

  const data = fs.readFileSync(filePath);
  const doc = mupdf.Document.openDocument(data, 'application/pdf');
  const outPdf = await PDFDocument.create();

  // Page order — move cover to front if detected
  const pageOrder = pages.map((p) => p.index);
  if (coverIndex > 0) {
    pageOrder.splice(pageOrder.indexOf(coverIndex), 1);
    pageOrder.unshift(coverIndex);
  }

  let pagesResized = 0;
  for (const pageIdx of pageOrder) {
    const info = pages[pageIdx];
    const page = doc.loadPage(pageIdx);

    const needsResize = info.longestEdge > MAX_DIM;
    const scale = needsResize ? MAX_DIM / info.longestEdge : 1.0;
    const renderW = Math.round(info.width * scale);
    const renderH = Math.round(info.height * scale);

    if (needsResize) pagesResized++;

    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(scale, scale),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true
    );
    const pngBuffer = pixmap.asPNG();

    const jpegBuffer = await sharp(Buffer.from(pngBuffer))
      .jpeg({ quality: QUALITY })
      .toBuffer();

    const jpegImage = await outPdf.embedJpg(jpegBuffer);
    const outPage = outPdf.addPage([renderW, renderH]);
    outPage.drawImage(jpegImage, { x: 0, y: 0, width: renderW, height: renderH });
  }

  const pdfBytes = await outPdf.save();

  // Write to temp file, then rename over original (atomic-ish)
  const tmpPath = filePath + '.optimizing';
  fs.writeFileSync(tmpPath, pdfBytes);
  fs.renameSync(tmpPath, filePath);

  const optimizedSize = pdfBytes.length;
  console.log(`  ${path.basename(filePath)}: ${(originalSize / 1024 / 1024).toFixed(1)} MB → ${(optimizedSize / 1024 / 1024).toFixed(1)} MB (${pagesResized} pages resized${coverIndex >= 0 ? ', cover moved to front' : ''})`);

  return { originalSize, optimizedSize, pagesResized, coverMoved: coverIndex >= 0 };
}

/**
 * Optimize all PDFs in a series. Returns stats.
 */
export async function optimizeSeries(seriesId: string): Promise<{
  filesOptimized: number;
  filesSkipped: number;
  totalSaved: number;
}> {
  const series = getSeries(seriesId);
  if (!series) throw new Error(`Series not found: ${seriesId}`);

  const typeDir = series.type === 'comic' ? 'comics' : 'magazines';
  const seriesDir = path.join(LIBRARY_DIR, typeDir, seriesId);
  if (!fs.existsSync(seriesDir)) throw new Error(`Series directory not found: ${seriesDir}`);

  const comics = loadComics(seriesId);
  let filesOptimized = 0;
  let filesSkipped = 0;
  let totalSaved = 0;

  for (const comic of comics) {
    const filePath = path.join(seriesDir, comic.file);
    if (!fs.existsSync(filePath)) { filesSkipped++; continue; }

    const stat = fs.statSync(filePath);
    if (stat.size < MIN_FILE_SIZE) { filesSkipped++; continue; }

    try {
      const result = await optimizePdf(filePath);
      if (result) {
        filesOptimized++;
        totalSaved += result.originalSize - result.optimizedSize;

        // Update page count — optimization may have changed it if cover was moved
        // Re-read the page count from the optimized file
        try {
          const optimizedData = fs.readFileSync(filePath);
          const tail = optimizedData.slice(Math.max(0, optimizedData.length - 10240));
          const text = tail.toString('ascii');
          const match = text.match(/\/Count\s+(\d+)/);
          if (match) {
            const newPageCount = parseInt(match[1], 10);
            if (newPageCount !== comic.pages) {
              comic.pages = newPageCount;
            }
          }
        } catch {}
      } else {
        filesSkipped++;
      }
    } catch (err) {
      console.error(`  Optimizer failed for ${comic.file}: ${(err as Error).message}`);
      filesSkipped++;
    }
  }

  // Rewrite comics if any page counts changed
  if (filesOptimized > 0) {
    writeComics(seriesId, comics);
  }

  return { filesOptimized, filesSkipped, totalSaved };
}

/**
 * Optimize a single PDF during import. Called after a file is placed
 * in the library. Only processes files that need it (fast no-op for small files).
 */
export async function optimizeOnImport(filePath: string): Promise<boolean> {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < MIN_FILE_SIZE) return false;

    const result = await optimizePdf(filePath);
    return result !== null;
  } catch (err) {
    console.error(`  Import optimizer failed for ${path.basename(filePath)}: ${(err as Error).message}`);
    return false;
  }
}
