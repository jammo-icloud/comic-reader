import fs from 'fs';
import path from 'path';
import { shortHash } from './hash.js';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

/**
 * Assemble a list of image buffers into a single PDF
 */
async function imagesToPdf(images: { name: string; data: Buffer }[], outputPath: string): Promise<void> {
  const pdf = await PDFDocument.create();

  // Sort images by filename (natural order)
  images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  for (const img of images) {
    try {
      // Normalize to JPEG
      const metadata = await sharp(img.data).metadata();
      const width = metadata.width || 800;
      const height = metadata.height || 1200;

      const jpegBuffer = await sharp(img.data)
        .jpeg({ quality: 90 })
        .toBuffer();

      const jpegImage = await pdf.embedJpg(jpegBuffer);
      const page = pdf.addPage([width, height]);
      page.drawImage(jpegImage, { x: 0, y: 0, width, height });
    } catch (err) {
      console.error(`  Skipping image ${img.name}: ${(err as Error).message}`);
    }
  }

  if (pdf.getPageCount() === 0) {
    throw new Error('No valid images found to create PDF');
  }

  const pdfBytes = await pdf.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

/**
 * Convert a CBZ (ZIP) file to PDF
 */
export async function cbzToPdf(cbzPath: string, outputPath: string): Promise<void> {
  const unzipper = await import('unzipper');
  const directory = await unzipper.Open.file(cbzPath);

  const images: { name: string; data: Buffer }[] = [];

  for (const file of directory.files) {
    if (file.type === 'File' && isImageFile(file.path)) {
      const data = await file.buffer();
      images.push({ name: file.path, data });
    }
  }

  if (images.length === 0) throw new Error('No images found in CBZ');

  console.log(`  CBZ: ${images.length} images → PDF`);
  await imagesToPdf(images, outputPath);
}

/**
 * Convert a CBR (RAR) file to PDF
 */
export async function cbrToPdf(cbrPath: string, outputPath: string): Promise<void> {
  const { createExtractorFromData } = await import('node-unrar-js');
  const data = fs.readFileSync(cbrPath);
  const extractor = await createExtractorFromData({ data: new Uint8Array(data).buffer as ArrayBuffer });

  const list = extractor.getFileList();
  const fileHeaders = [...list.fileHeaders].filter(
    (h) => !h.flags.directory && isImageFile(h.name)
  );

  if (fileHeaders.length === 0) throw new Error('No images found in CBR');

  const extracted = extractor.extract({ files: fileHeaders.map((h) => h.name) });
  const images: { name: string; data: Buffer }[] = [];

  for (const file of extracted.files) {
    if (file.extraction) {
      images.push({
        name: file.fileHeader.name,
        data: Buffer.from(file.extraction),
      });
    }
  }

  console.log(`  CBR: ${images.length} images → PDF`);
  await imagesToPdf(images, outputPath);
}

/**
 * Convert a folder of images to a single PDF
 */
export async function imageFolderToPdf(folderPath: string, outputPath: string): Promise<void> {
  const files = fs.readdirSync(folderPath)
    .filter(isImageFile)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) throw new Error('No images found in folder');

  const images = files.map((f) => ({
    name: f,
    data: fs.readFileSync(path.join(folderPath, f)),
  }));

  console.log(`  Image folder: ${images.length} images → PDF`);
  await imagesToPdf(images, outputPath);
}

/**
 * Check if a directory contains image files (is an image set)
 */
export function isImageFolder(dirPath: string): boolean {
  try {
    const files = fs.readdirSync(dirPath);
    return files.some(isImageFile);
  } catch {
    return false;
  }
}

/**
 * Get the converted PDF path for a source file
 * Stored in DATA_DIR/converted/{base64url_hash}.pdf
 */
const DATA_DIR = process.env.DATA_DIR || './data';
const CONVERTED_DIR = path.join(DATA_DIR, 'converted');
const TASKS_DIR = path.join(DATA_DIR, 'tasks');

// --- Task tracking for crash recovery ---

export interface ConversionTask {
  sourcePath: string;
  outputPath: string;
  type: 'cbr' | 'cbz' | 'image-folder';
  status: 'pending' | 'converting' | 'archiving' | 'complete' | 'error';
  error?: string;
  startedAt: string;
}

function ensureTaskDir() {
  if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });
}

function taskPath(sourcePath: string): string {
  const hash = shortHash(sourcePath);
  return path.join(TASKS_DIR, `${hash}.conversion.json`);
}

function saveTask(task: ConversionTask) {
  ensureTaskDir();
  fs.writeFileSync(taskPath(task.sourcePath), JSON.stringify(task, null, 2));
}

function loadTask(sourcePath: string): ConversionTask | null {
  const p = taskPath(sourcePath);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  return null;
}

function removeTask(sourcePath: string) {
  const p = taskPath(sourcePath);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function ensureConvertedDir() {
  if (!fs.existsSync(CONVERTED_DIR)) fs.mkdirSync(CONVERTED_DIR, { recursive: true });
}

export function getConvertedPath(sourcePath: string): string {
  const hash = shortHash(sourcePath);
  return path.join(CONVERTED_DIR, `${hash}.pdf`);
}

export function hasConverted(sourcePath: string): boolean {
  return fs.existsSync(getConvertedPath(sourcePath));
}

/**
 * Convert a file/folder to PDF if needed. Returns the PDF path.
 * Uses task tracking so conversion can resume after crashes.
 */
export async function convertToPdf(sourcePath: string): Promise<string | null> {
  ensureConvertedDir();
  const outputPath = getConvertedPath(sourcePath);

  // Already converted
  if (fs.existsSync(outputPath)) return outputPath;

  // Check for an incomplete task from a previous run
  const existingTask = loadTask(sourcePath);
  if (existingTask?.status === 'complete' && fs.existsSync(outputPath)) {
    removeTask(sourcePath);
    return outputPath;
  }

  const ext = path.extname(sourcePath).toLowerCase();
  const type = ext === '.cbr' ? 'cbr' : ext === '.cbz' ? 'cbz' : 'image-folder';

  const task: ConversionTask = {
    sourcePath,
    outputPath,
    type: type as ConversionTask['type'],
    status: 'converting',
    startedAt: new Date().toISOString(),
  };
  saveTask(task);

  try {
    if (ext === '.cbr') {
      await cbrToPdf(sourcePath, outputPath);
    } else if (ext === '.cbz') {
      await cbzToPdf(sourcePath, outputPath);
    } else if (fs.statSync(sourcePath).isDirectory() && isImageFolder(sourcePath)) {
      await imageFolderToPdf(sourcePath, outputPath);
    } else {
      removeTask(sourcePath);
      return null;
    }

    task.status = 'complete';
    saveTask(task);
    return outputPath;
  } catch (err) {
    task.status = 'error';
    task.error = (err as Error).message;
    saveTask(task);
    console.error(`  Conversion failed for ${sourcePath}: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Resume any incomplete conversion tasks from a previous run
 */
/**
 * Clean up completed/errored conversion tasks and stale converted PDFs.
 * Converted PDFs are staging files — once copied to the library, they can be removed.
 */
export function cleanupConversions(): number {
  let cleaned = 0;

  // Clean completed/errored conversion task files
  if (fs.existsSync(TASKS_DIR)) {
    const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.conversion.json'));
    for (const file of files) {
      try {
        const task: ConversionTask = JSON.parse(fs.readFileSync(path.join(TASKS_DIR, file), 'utf-8'));
        if (task.status === 'complete' || task.status === 'error') {
          fs.unlinkSync(path.join(TASKS_DIR, file));
          cleaned++;
        }
      } catch {
        // Corrupt task file — remove it
        fs.unlinkSync(path.join(TASKS_DIR, file));
        cleaned++;
      }
    }
  }

  // Clean up converted/ staging directory — these are temp files from CBR/CBZ conversion
  if (fs.existsSync(CONVERTED_DIR)) {
    const pdfs = fs.readdirSync(CONVERTED_DIR).filter((f) => f.endsWith('.pdf'));
    for (const pdf of pdfs) {
      try {
        fs.unlinkSync(path.join(CONVERTED_DIR, pdf));
        cleaned++;
      } catch {}
    }
    // Remove the directory itself if empty
    try {
      const remaining = fs.readdirSync(CONVERTED_DIR);
      if (remaining.length === 0) fs.rmdirSync(CONVERTED_DIR);
    } catch {}
  }

  return cleaned;
}

/**
 * Resume any incomplete conversion tasks from a previous run
 */
export async function resumeConversions(): Promise<number> {
  ensureTaskDir();
  if (!fs.existsSync(TASKS_DIR)) return 0;

  const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.conversion.json'));
  let resumed = 0;

  for (const file of files) {
    try {
      const task: ConversionTask = JSON.parse(fs.readFileSync(path.join(TASKS_DIR, file), 'utf-8'));
      if (task.status === 'converting' || task.status === 'archiving') {
        console.log(`  Resuming conversion: ${task.sourcePath}`);
        // Clean up partial output and retry
        if (fs.existsSync(task.outputPath)) fs.unlinkSync(task.outputPath);
        await convertToPdf(task.sourcePath);
        resumed++;
      } else if (task.status === 'complete') {
        removeTask(task.sourcePath);
      }
    } catch (err) {
      console.error(`  Failed to resume task ${file}: ${(err as Error).message}`);
    }
  }

  return resumed;
}
