import fs from 'fs';
import path from 'path';
import * as mupdf from 'mupdf';
import Tesseract from 'tesseract.js';

let worker: Tesseract.Worker | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (!worker) {
    worker = await Tesseract.createWorker('eng');
  }
  return worker;
}

export interface OcrPageResult {
  page: number;
  text: string;
  confidence: number;
}

export interface OcrResult {
  pages: OcrPageResult[];
  fullText: string;
  avgConfidence: number;
  pageCount: number;
}

/**
 * OCR a single page of a PDF — renders to image then runs tesseract
 */
export async function ocrPage(pdfData: Buffer, pageIndex: number): Promise<OcrPageResult> {
  const doc = mupdf.Document.openDocument(pdfData, 'application/pdf');
  const page = doc.loadPage(pageIndex);

  // Render at 2x scale for better OCR quality
  const scale = 2.0;
  const pixmap = page.toPixmap(
    mupdf.Matrix.scale(scale, scale),
    mupdf.ColorSpace.DeviceRGB,
    false,
    true
  );

  const pngBuffer = Buffer.from(pixmap.asPNG());

  const w = await getWorker();
  const { data } = await w.recognize(pngBuffer);

  return {
    page: pageIndex,
    text: data.text.trim(),
    confidence: data.confidence,
  };
}

/**
 * OCR all pages of a PDF file
 */
export async function ocrPdf(
  filePath: string,
  onPageDone?: (pageResult: OcrPageResult, current: number, total: number) => void,
): Promise<OcrResult> {
  const pdfData = fs.readFileSync(filePath);
  const doc = mupdf.Document.openDocument(pdfData, 'application/pdf');
  const pageCount = doc.countPages();

  const pages: OcrPageResult[] = [];
  let totalConfidence = 0;

  for (let i = 0; i < pageCount; i++) {
    try {
      const result = await ocrPage(pdfData, i);
      pages.push(result);
      totalConfidence += result.confidence;
      onPageDone?.(result, i + 1, pageCount);
    } catch (err) {
      console.error(`  OCR failed on page ${i + 1}:`, (err as Error).message);
      pages.push({ page: i, text: '', confidence: 0 });
      onPageDone?.({ page: i, text: '', confidence: 0 }, i + 1, pageCount);
    }
  }

  const fullText = pages.map((p) => p.text).filter(Boolean).join('\n\n');
  const avgConfidence = pages.length > 0 ? totalConfidence / pages.length : 0;

  return { pages, fullText, avgConfidence, pageCount };
}

/**
 * Quick check: can we OCR at all?
 */
export async function healthCheck(): Promise<{ ok: boolean; error?: string }> {
  try {
    const w = await getWorker();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
