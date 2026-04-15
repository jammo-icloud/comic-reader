#!/usr/bin/env tsx
/**
 * PDF Optimizer — local batch script.
 * Re-renders oversized PDF pages to a capped resolution.
 * Detects cover pages buried at the end and moves them to front.
 *
 * Single file:
 *   npx tsx scripts/optimize-pdf.ts input.pdf [max-dimension] [quality]
 *
 * Batch (entire folder):
 *   npx tsx scripts/optimize-pdf.ts /path/to/folder [max-dimension] [quality]
 *
 * Analyze only (no output):
 *   npx tsx scripts/optimize-pdf.ts input.pdf --analyze
 *
 * Output: overwrites the original file (or creates .optimized copy with --copy)
 *
 * Examples:
 *   npx tsx scripts/optimize-pdf.ts ~/Met-Art/
 *   npx tsx scripts/optimize-pdf.ts ~/Met-Art/ 2400 90
 *   npx tsx scripts/optimize-pdf.ts ~/Met-Art/ --analyze
 *   npx tsx scripts/optimize-pdf.ts single-file.pdf --copy
 */
import fs from 'fs';
import path from 'path';
import * as mupdf from 'mupdf';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const analyzeOnly = args.includes('--analyze');
const copyMode = args.includes('--copy');
const numArgs = args.filter((a) => /^\d+$/.test(a));
const MAX_DIM = parseInt(numArgs[0] || '2400', 10);
const QUALITY = parseInt(numArgs[1] || '90', 10);

const TRIGGER_DIM = 2400;
const MIN_FILE_SIZE = 50 * 1024 * 1024;

if (!inputPath) {
  console.log('PDF Optimizer — shrink oversized pages, detect and move covers');
  console.log('');
  console.log('Usage:');
  console.log('  npx tsx scripts/optimize-pdf.ts <file-or-folder> [max-dim] [quality] [flags]');
  console.log('');
  console.log('Arguments:');
  console.log('  max-dim    Longest edge in pixels (default: 2400)');
  console.log('  quality    JPEG quality 1-100 (default: 90)');
  console.log('');
  console.log('Flags:');
  console.log('  --analyze  Inspect pages without modifying');
  console.log('  --copy     Write .optimized.pdf instead of overwriting original');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx scripts/optimize-pdf.ts ~/Met-Art/              # batch optimize folder');
  console.log('  npx tsx scripts/optimize-pdf.ts ~/Met-Art/ --analyze    # just inspect');
  console.log('  npx tsx scripts/optimize-pdf.ts file.pdf 1800 85       # custom settings');
  process.exit(1);
}

const resolved = path.resolve(inputPath);
if (!fs.existsSync(resolved)) {
  console.error(`Not found: ${resolved}`);
  process.exit(1);
}

interface PageInfo {
  index: number;
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'portrait' | 'landscape' | 'square';
  longestEdge: number;
  needsResize: boolean;
}

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
      index: i, width: Math.round(w), height: Math.round(h),
      aspectRatio: w / h,
      orientation: Math.abs(w - h) < 10 ? 'square' : w > h ? 'landscape' : 'portrait',
      longestEdge: Math.round(longestEdge),
      needsResize: longestEdge > TRIGGER_DIM,
    });
  }
  return pages;
}

function detectCover(pages: PageInfo[]): number {
  if (pages.length < 3) return -1;

  const ratios = pages.map((p) => Math.round(p.aspectRatio * 100) / 100);
  const ratioCounts = new Map<number, number>();
  for (const r of ratios) ratioCounts.set(r, (ratioCounts.get(r) || 0) + 1);
  let dominantRatio = 0, dominantCount = 0;
  for (const [r, count] of ratioCounts) { if (count > dominantCount) { dominantRatio = r; dominantCount = count; } }

  const orientCounts = { portrait: 0, landscape: 0, square: 0 };
  for (const p of pages) orientCounts[p.orientation]++;
  const dominantOrientation = orientCounts.portrait >= orientCounts.landscape ? 'portrait' : 'landscape';

  const last = pages[pages.length - 1];
  const ratioDiff = Math.abs(last.aspectRatio - dominantRatio);
  if (last.orientation !== dominantOrientation && last.orientation !== 'square') return last.index;
  if (ratioDiff > 0.15) return last.index;
  if (last.longestEdge < pages[0].longestEdge * 0.7) return last.index;
  return -1;
}

async function optimizeFile(filePath: string): Promise<{ originalSize: number; optimizedSize: number; pagesResized: number; coverMoved: boolean } | null> {
  const stat = fs.statSync(filePath);
  const originalSize = stat.size;
  const basename = path.basename(filePath);

  let pages: PageInfo[];
  try {
    pages = analyzePages(filePath);
  } catch (err) {
    console.error(`  ${basename}: failed to analyze — ${(err as Error).message}`);
    return null;
  }

  const oversized = pages.filter((p) => p.needsResize);
  const coverIndex = detectCover(pages);

  if (analyzeOnly) {
    const dimGroups = new Map<string, number[]>();
    for (const p of pages) {
      const key = `${p.width}x${p.height}`;
      if (!dimGroups.has(key)) dimGroups.set(key, []);
      dimGroups.get(key)!.push(p.index + 1);
    }
    console.log(`  ${basename}: ${pages.length} pages, ${(originalSize / 1024 / 1024).toFixed(1)} MB`);
    for (const [dim, nums] of dimGroups) {
      const longest = Math.max(...dim.split('x').map(Number));
      const flag = longest > TRIGGER_DIM ? ' OVERSIZED' : '';
      console.log(`    ${dim} — ${nums.length} pages${flag}`);
    }
    if (coverIndex >= 0) console.log(`    Cover: page ${coverIndex + 1}`);
    if (oversized.length === 0 && coverIndex < 0) console.log(`    -> No optimization needed`);
    else console.log(`    -> ${oversized.length} pages to resize${coverIndex >= 0 ? ', cover to move' : ''}`);
    return null;
  }

  if (oversized.length === 0 && coverIndex < 0) {
    console.log(`  ${basename}: already optimized`);
    return null;
  }

  process.stdout.write(`  ${basename}: ${pages.length}p, ${(originalSize / 1024 / 1024).toFixed(1)} MB → `);

  const data = fs.readFileSync(filePath);
  const doc = mupdf.Document.openDocument(data, 'application/pdf');
  const outPdf = await PDFDocument.create();

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

    const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
    const pngBuffer = pixmap.asPNG();
    const jpegBuffer = await sharp(Buffer.from(pngBuffer)).jpeg({ quality: QUALITY }).toBuffer();
    const jpegImage = await outPdf.embedJpg(jpegBuffer);
    const outPage = outPdf.addPage([renderW, renderH]);
    outPage.drawImage(jpegImage, { x: 0, y: 0, width: renderW, height: renderH });
  }

  const pdfBytes = await outPdf.save();
  const optimizedSize = pdfBytes.length;

  // Skip if the "optimized" version is larger than the original
  if (optimizedSize >= originalSize) {
    console.log(`${(optimizedSize / 1024 / 1024).toFixed(1)} MB (larger — skipping, keeping original)`);
    return null;
  }

  if (copyMode) {
    const ext = path.extname(filePath);
    const base = filePath.slice(0, -ext.length);
    const outPath = `${base}.optimized${ext}`;
    fs.writeFileSync(outPath, pdfBytes);
  } else {
    const tmpPath = filePath + '.optimizing';
    fs.writeFileSync(tmpPath, pdfBytes);
    // unlink original first — direct rename-over fails on macOS with restricted permissions
    fs.unlinkSync(filePath);
    fs.renameSync(tmpPath, filePath);
  }

  const saved = ((1 - optimizedSize / originalSize) * 100).toFixed(0);
  console.log(`${(optimizedSize / 1024 / 1024).toFixed(1)} MB (${saved}% smaller, ${pagesResized} resized${coverIndex >= 0 ? ', cover moved' : ''})`);

  return { originalSize, optimizedSize, pagesResized, coverMoved: coverIndex >= 0 };
}

async function run() {
  const stat = fs.statSync(resolved);

  if (stat.isFile()) {
    console.log(`Optimizing: ${path.basename(resolved)} (max ${MAX_DIM}px, q${QUALITY})`);
    console.log('');
    await optimizeFile(resolved);
    return;
  }

  if (stat.isDirectory()) {
    // Find all PDFs recursively
    const pdfs: string[] = [];
    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === '@eaDir') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) pdfs.push(full);
      }
    }
    walk(resolved);

    if (pdfs.length === 0) {
      console.log('No PDF files found.');
      return;
    }

    console.log(`Found ${pdfs.length} PDFs in ${resolved}`);
    console.log(`Settings: max ${MAX_DIM}px, JPEG quality ${QUALITY}${analyzeOnly ? ' (analyze only)' : ''}${copyMode ? ' (copy mode)' : ' (in-place)'}`);
    console.log('');

    let totalOptimized = 0, totalSkipped = 0, totalFailed = 0, totalSaved = 0;

    for (let i = 0; i < pdfs.length; i++) {
      try {
        const result = await optimizeFile(pdfs[i]);
        if (result) {
          totalOptimized++;
          totalSaved += result.originalSize - result.optimizedSize;
        } else {
          totalSkipped++;
        }
      } catch (err) {
        const basename = path.basename(pdfs[i]);
        console.log(`  ${basename}: FAILED — ${(err as Error).message}`);
        // Clean up orphaned temp file
        const tmpPath = pdfs[i] + '.optimizing';
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        totalFailed++;
      }
    }

    if (!analyzeOnly) {
      console.log('');
      console.log(`Done! ${totalOptimized} optimized, ${totalSkipped} skipped, ${totalFailed} failed, ${(totalSaved / 1024 / 1024).toFixed(1)} MB saved`);
    }
    return;
  }

  console.error('Not a file or directory');
  process.exit(1);
}

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
