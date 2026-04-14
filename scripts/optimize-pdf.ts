#!/usr/bin/env tsx
/**
 * PDF Optimizer — test script.
 * Re-renders oversized PDF pages to a capped resolution.
 * Detects cover pages (different aspect ratio) and moves them to front.
 *
 * Usage:
 *   npx tsx scripts/optimize-pdf.ts input.pdf [max-dimension] [quality]
 *
 * Examples:
 *   npx tsx scripts/optimize-pdf.ts ~/Photos/met-art-book.pdf
 *   npx tsx scripts/optimize-pdf.ts ~/Photos/met-art-book.pdf 2400
 *   npx tsx scripts/optimize-pdf.ts ~/Photos/met-art-book.pdf 1800 85
 *
 * Analyze only (no output file):
 *   npx tsx scripts/optimize-pdf.ts ~/Photos/met-art-book.pdf --analyze
 */
import fs from 'fs';
import path from 'path';
import * as mupdf from 'mupdf';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const inputPath = process.argv[2];
const analyzeOnly = process.argv.includes('--analyze');
const MAX_DIM = parseInt(process.argv.find((a) => /^\d+$/.test(a) && a !== inputPath) || '2400', 10);
const qualityArg = process.argv.find((a, i) => /^\d+$/.test(a) && i > 2 && a !== String(MAX_DIM));
const QUALITY = parseInt(qualityArg || '90', 10);

// Optimization trigger: if any page exceeds this, the PDF needs optimization
const TRIGGER_DIM = 2400;
// File size fast-check: skip mupdf inspection for files under this size
const MIN_FILE_SIZE = 50 * 1024 * 1024; // 50MB

if (!inputPath || inputPath === '--analyze') {
  console.log('Usage: npx tsx scripts/optimize-pdf.ts <input.pdf> [max-dimension] [quality]');
  console.log('       npx tsx scripts/optimize-pdf.ts <input.pdf> --analyze');
  console.log('');
  console.log('  max-dimension  Longest edge in pixels (default: 2400)');
  console.log('  quality        JPEG quality 1-100 (default: 90)');
  console.log('  --analyze      Just inspect pages, don\'t create output');
  console.log('');
  console.log('Try different values to compare:');
  console.log('  2400 = high quality reading (recommended)');
  console.log('  1800 = balanced, smaller files');
  console.log('  1200 = fast loading, visible quality loss on zoom');
  process.exit(1);
}

const resolved = path.resolve(inputPath);
if (!fs.existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
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

/**
 * Detect the cover page — looks for a page with a distinctly different
 * aspect ratio or size from the majority. Returns the index to move to front,
 * or -1 if no cover detected (or it's already page 0).
 */
function detectCover(pages: PageInfo[]): { coverIndex: number; reason: string } {
  if (pages.length < 3) return { coverIndex: -1, reason: 'too few pages' };

  // Find the dominant aspect ratio (mode of rounded ratios)
  const ratios = pages.map((p) => Math.round(p.aspectRatio * 100) / 100);
  const ratioCounts = new Map<number, number>();
  for (const r of ratios) ratioCounts.set(r, (ratioCounts.get(r) || 0) + 1);

  let dominantRatio = 0;
  let dominantCount = 0;
  for (const [r, count] of ratioCounts) {
    if (count > dominantCount) { dominantRatio = r; dominantCount = count; }
  }

  // Find the dominant orientation
  const orientations = pages.map((p) => p.orientation);
  const orientCounts = { portrait: 0, landscape: 0, square: 0 };
  for (const o of orientations) orientCounts[o]++;
  const dominantOrientation = orientCounts.portrait >= orientCounts.landscape ? 'portrait' : 'landscape';

  // Simple rule: only check the last page.
  // If the cover isn't already page 1, it's always the last page.
  const last = pages[pages.length - 1];
  const ratioDiff = Math.abs(last.aspectRatio - dominantRatio);
  const isOrientationOutlier = last.orientation !== dominantOrientation && last.orientation !== 'square';
  const isSizeOutlier = last.longestEdge < pages[0].longestEdge * 0.7;
  const isRatioOutlier = ratioDiff > 0.15;

  if (isOrientationOutlier) {
    return { coverIndex: last.index, reason: `last page has different orientation (${last.orientation} vs ${dominantOrientation})` };
  }
  if (isRatioOutlier) {
    return { coverIndex: last.index, reason: `last page has different aspect ratio (${last.aspectRatio.toFixed(2)} vs ${dominantRatio.toFixed(2)})` };
  }
  if (isSizeOutlier) {
    return { coverIndex: last.index, reason: `last page is smaller (${last.longestEdge}px vs ${pages[0].longestEdge}px)` };
  }

  return { coverIndex: -1, reason: 'last page matches the rest (no cover detected)' };
}

async function analyze(): Promise<{ pages: PageInfo[]; needsOptimization: boolean; coverIndex: number; coverReason: string }> {
  const data = fs.readFileSync(resolved);
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

  const needsOptimization = pages.some((p) => p.needsResize);
  const { coverIndex, reason: coverReason } = detectCover(pages);

  return { pages, needsOptimization, coverIndex, coverReason };
}

async function run() {
  const inputSize = fs.statSync(resolved).size;
  console.log(`File: ${path.basename(resolved)}`);
  console.log(`Size: ${(inputSize / 1024 / 1024).toFixed(1)} MB`);

  // Fast-check: skip tiny files
  if (inputSize < MIN_FILE_SIZE && !analyzeOnly) {
    console.log(`\nUnder ${MIN_FILE_SIZE / 1024 / 1024}MB — likely doesn't need optimization.`);
    console.log('Use --analyze to inspect anyway.');
    return;
  }

  console.log('\nAnalyzing pages...');
  const { pages, needsOptimization, coverIndex, coverReason } = await analyze();

  // Print page analysis
  console.log(`\nPages: ${pages.length}`);
  console.log('');

  // Group by dimensions for compact display
  const dimGroups = new Map<string, number[]>();
  for (const p of pages) {
    const key = `${p.width}x${p.height}`;
    if (!dimGroups.has(key)) dimGroups.set(key, []);
    dimGroups.get(key)!.push(p.index + 1);
  }
  for (const [dim, pageNums] of dimGroups) {
    const longestEdge = Math.max(...dim.split('x').map(Number));
    const flag = longestEdge > TRIGGER_DIM ? ' ⚠️  OVERSIZED' : ' ✓';
    if (pageNums.length <= 5) {
      console.log(`  ${dim} — pages ${pageNums.join(', ')}${flag}`);
    } else {
      console.log(`  ${dim} — ${pageNums.length} pages (${pageNums[0]}–${pageNums[pageNums.length - 1]})${flag}`);
    }
  }

  // Cover detection
  console.log('');
  if (coverIndex >= 0) {
    const cover = pages[coverIndex];
    console.log(`📖 Cover detected: page ${coverIndex + 1} (${cover.width}x${cover.height}) — ${coverReason}`);
    console.log(`   Will move to front of PDF.`);
  } else {
    console.log(`📖 Cover: ${coverReason} (no reordering needed)`);
  }

  // Optimization verdict
  console.log('');
  if (needsOptimization) {
    const oversized = pages.filter((p) => p.needsResize).length;
    console.log(`🔧 Optimization needed: ${oversized}/${pages.length} pages exceed ${TRIGGER_DIM}px`);
  } else {
    console.log(`✅ All pages within ${TRIGGER_DIM}px — no optimization needed`);
  }

  if (analyzeOnly) return;

  if (!needsOptimization && coverIndex < 0) {
    console.log('\nNothing to do! PDF is already optimized.');
    return;
  }

  // Build optimized PDF
  console.log(`\nOptimizing: max ${MAX_DIM}px, JPEG quality ${QUALITY}...`);
  console.log('');

  const data = fs.readFileSync(resolved);
  const doc = mupdf.Document.openDocument(data, 'application/pdf');
  const outPdf = await PDFDocument.create();

  // Determine page order — cover first if detected
  const pageOrder = pages.map((p) => p.index);
  if (coverIndex > 0) {
    pageOrder.splice(pageOrder.indexOf(coverIndex), 1);
    pageOrder.unshift(coverIndex);
  }

  for (const pageIdx of pageOrder) {
    const info = pages[pageIdx];
    const page = doc.loadPage(pageIdx);

    const longestEdge = info.longestEdge;
    const needsResize = longestEdge > MAX_DIM;

    const scale = needsResize ? MAX_DIM / longestEdge : 1.0;
    const renderW = Math.round(info.width * scale);
    const renderH = Math.round(info.height * scale);

    const label = coverIndex === pageIdx ? ' [COVER]' : '';
    const status = needsResize
      ? `${info.width}x${info.height} → ${renderW}x${renderH}${label}`
      : `${info.width}x${info.height} (pass-through)${label}`;
    process.stdout.write(`  Page ${pageOrder.indexOf(pageIdx) + 1}/${pages.length}: ${status}...`);

    // Render via mupdf
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(scale, scale),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true
    );
    const pngBuffer = pixmap.asPNG();

    // Compress via sharp
    const jpegBuffer = await sharp(Buffer.from(pngBuffer))
      .jpeg({ quality: QUALITY })
      .toBuffer();

    // Add to output
    const jpegImage = await outPdf.embedJpg(jpegBuffer);
    const outPage = outPdf.addPage([renderW, renderH]);
    outPage.drawImage(jpegImage, { x: 0, y: 0, width: renderW, height: renderH });

    console.log(` ${(jpegBuffer.length / 1024).toFixed(0)} KB`);
  }

  const ext = path.extname(resolved);
  const base = resolved.slice(0, -ext.length);
  const outputPath = `${base}.optimized-${MAX_DIM}px-q${QUALITY}${ext}`;

  const pdfBytes = await outPdf.save();
  fs.writeFileSync(outputPath, pdfBytes);

  const outputSize = fs.statSync(outputPath).size;
  const ratio = ((1 - outputSize / inputSize) * 100).toFixed(0);
  console.log('');
  console.log(`Output: ${(outputSize / 1024 / 1024).toFixed(1)} MB (${ratio}% smaller)`);
  if (coverIndex > 0) console.log(`Cover moved from page ${coverIndex + 1} → page 1`);
  console.log(`\nDone! Open both in Preview to compare.`);
}

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
