/**
 * EPUB → PDF converter.
 *
 * EPUBs are zip files containing:
 *   - META-INF/container.xml — points to the OPF file
 *   - {book}.opf — manifest (files) + spine (reading order)
 *   - XHTML files referencing images
 *   - Images in OEBPS/images/ or similar
 *
 * Two strategies, chosen per file by `chooseEpubStrategy`:
 *
 *   - `images`: walk the spine and copy every referenced image into the PDF
 *     at its native resolution. Right for manga and comic EPUBs, where each
 *     spine item is one page image and the prose is at most a credits page.
 *   - `render`: hand the whole EPUB to mupdf, lay it out at paperback
 *     proportions and rasterise each page. Right for novels and anything
 *     else where the text is the content. Images in the book still render,
 *     just at screen resolution.
 *
 * Why not always render? Rasterising a manga EPUB through mupdf would
 * downscale every page to the layout size and re-encode it, which is a
 * visible quality loss against copying the original JPEGs, and it loses the
 * native page size. Why not always extract? That is what this module did
 * before, and a prose novel came out as a handful of illustrations. The
 * split keeps the better result for each kind of book.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import * as mupdf from 'mupdf';

export type EpubStrategy = 'images' | 'render';

export interface EpubContentStats {
  /** Distinct images reachable from the spine (or, failing that, in the zip). */
  imageCount: number;
  /** Characters of visible text across all XHTML spine items. */
  textChars: number;
}

/**
 * Visible text budget per image before a book counts as prose. A manga
 * chapter has tens to hundreds of images and a few hundred characters of
 * chapter titles and credits; a novel has a cover and maybe a few plates
 * against tens of thousands of characters. 600 sits well clear of both.
 */
export const TEXT_CHARS_PER_IMAGE = 600;

/**
 * Pick the conversion strategy from what the spine walk found.
 *
 * Prose dominates when there is more than `TEXT_CHARS_PER_IMAGE` characters
 * of text for every image (at least one image is assumed so a text-only
 * book with a short preface still renders). A book with no images at all
 * can only be rendered, whatever its text length.
 */
export function chooseEpubStrategy(stats: EpubContentStats): EpubStrategy {
  if (stats.imageCount === 0) return 'render';
  const budget = TEXT_CHARS_PER_IMAGE * Math.max(stats.imageCount, 1);
  return stats.textChars > budget ? 'render' : 'images';
}

/**
 * Length of the text a reader would see in an XHTML document: head, style
 * and script blocks dropped, tags removed, entities counted as one
 * character, whitespace collapsed.
 */
export function visibleTextLength(html: string): number {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head\b[\s\S]*?<\/head>/gi, ' ')
    .replace(/<(style|script|title)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, 'x')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length;
}

/**
 * Minimal regex-based XML extraction — avoids adding a full XML parser dependency.
 * Good enough for EPUB OPF and XHTML parsing.
 */
function extractAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i');
  const m = re.exec(tag);
  return m ? m[1] : null;
}

function findAllTags(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}\\b[^>]*/?>`, 'gi');
  return xml.match(re) || [];
}

/**
 * Resolve a relative path (like "images/001.jpg") against a base path
 * (like "OEBPS/text/page1.xhtml") to produce "OEBPS/images/001.jpg".
 */
function resolveRelative(basePath: string, relPath: string): string {
  const baseDir = path.dirname(basePath);
  return path.posix.normalize(path.posix.join(baseDir, relPath));
}

interface EpubScan {
  files: Map<string, any>;
  imagePaths: string[];
  stats: EpubContentStats;
}

/**
 * Walk the spine: collect image paths in reading order and measure how much
 * visible text the XHTML items carry.
 */
async function scanEpub(epubPath: string): Promise<EpubScan> {
  const unzipper = await import('unzipper');
  const directory = await unzipper.Open.file(epubPath);

  // Build a map of path → entry (lazy — only read what we need)
  const files = new Map<string, any>();
  for (const f of directory.files) {
    if (f.type === 'File') files.set(f.path, f);
  }

  // Step 1: find OPF path via container.xml
  const containerFile = files.get('META-INF/container.xml');
  if (!containerFile) throw new Error('EPUB: missing META-INF/container.xml');
  const containerXml = (await containerFile.buffer()).toString('utf-8');
  const rootfileTag = /<rootfile\b[^>]+>/i.exec(containerXml);
  if (!rootfileTag) throw new Error('EPUB: no rootfile in container.xml');
  const opfPath = extractAttr(rootfileTag[0], 'full-path');
  if (!opfPath) throw new Error('EPUB: rootfile missing full-path');

  // Step 2: parse OPF for manifest + spine
  const opfFile = files.get(opfPath);
  if (!opfFile) throw new Error(`EPUB: OPF file not found: ${opfPath}`);
  const opfXml = (await opfFile.buffer()).toString('utf-8');

  // Manifest: <item id="..." href="..." media-type="..."/>
  const manifestTags = findAllTags(opfXml, 'item');
  const manifest = new Map<string, { href: string; mediaType: string }>();
  for (const tag of manifestTags) {
    const id = extractAttr(tag, 'id');
    const href = extractAttr(tag, 'href');
    const mediaType = extractAttr(tag, 'media-type') || '';
    if (id && href) manifest.set(id, { href, mediaType });
  }

  // Spine: <itemref idref="..."/>
  const itemrefs = findAllTags(opfXml, 'itemref');
  const spineIds: string[] = [];
  for (const tag of itemrefs) {
    const idref = extractAttr(tag, 'idref');
    if (idref) spineIds.push(idref);
  }

  // Step 3: collect images in reading order and measure the prose
  const imagePaths: string[] = [];
  const seenImages = new Set<string>();
  let textChars = 0;

  for (const spineId of spineIds) {
    const item = manifest.get(spineId);
    if (!item) continue;
    const itemPath = resolveRelative(opfPath, item.href);
    const itemFile = files.get(itemPath);
    if (!itemFile) continue;

    // Image-only spine items (manga EPUBs sometimes do this directly)
    if (/^image\//i.test(item.mediaType)) {
      if (!seenImages.has(itemPath)) {
        seenImages.add(itemPath);
        imagePaths.push(itemPath);
      }
      continue;
    }

    // XHTML/HTML spine items: extract <img src="..."> or <svg><image xlink:href="...">
    const html = (await itemFile.buffer()).toString('utf-8');
    textChars += visibleTextLength(html);
    const imgTags = findAllTags(html, 'img');
    const svgImageTags = findAllTags(html, 'image');

    for (const tag of [...imgTags, ...svgImageTags]) {
      const src = extractAttr(tag, 'src') || extractAttr(tag, 'xlink:href') || extractAttr(tag, 'href');
      if (!src) continue;
      const imgPath = resolveRelative(itemPath, src);
      if (!seenImages.has(imgPath)) {
        seenImages.add(imgPath);
        imagePaths.push(imgPath);
      }
    }
  }

  // Fallback: if the spine referenced no images, consider every image file
  // in the zip (some manga EPUBs load pages from CSS or scripts).
  if (imagePaths.length === 0) {
    const imageExts = /\.(jpg|jpeg|png|gif|webp)$/i;
    const allImages = [...files.keys()]
      .filter((p) => imageExts.test(p))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (allImages.length > 0) console.log(`  EPUB: spine had no images, found ${allImages.length} image files in the zip`);
    imagePaths.push(...allImages);
  }

  return { files, imagePaths, stats: { imageCount: imagePaths.length, textChars } };
}

/**
 * Assemble the spine's images into a PDF, one page per image at native size.
 */
async function imagesToPdf(scan: EpubScan, outputPath: string): Promise<void> {
  console.log(`  EPUB: assembling ${scan.imagePaths.length} images into PDF`);

  const pdf = await PDFDocument.create();
  let embedded = 0;

  for (const imgPath of scan.imagePaths) {
    const imgFile = scan.files.get(imgPath);
    if (!imgFile) continue;

    try {
      const rawBuffer = await imgFile.buffer();
      // Normalize to JPEG — pdf-lib only supports JPEG and PNG
      const metadata = await sharp(rawBuffer).metadata();
      const width = metadata.width || 800;
      const height = metadata.height || 1200;

      const jpegBuffer = await sharp(rawBuffer).jpeg({ quality: 88 }).toBuffer();
      const image = await pdf.embedJpg(jpegBuffer);
      const page = pdf.addPage([width, height]);
      page.drawImage(image, { x: 0, y: 0, width, height });
      embedded++;
    } catch (err) {
      console.warn(`  EPUB: skipping image ${imgPath}: ${(err as Error).message}`);
    }
  }

  if (embedded === 0) {
    throw new Error('EPUB: failed to embed any images');
  }

  const pdfBytes = await pdf.save();
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`  EPUB → PDF: ${embedded} pages → ${path.basename(outputPath)}`);
}

/** Layout box for reflowable EPUBs, in points: a trade paperback page. */
const RENDER_LAYOUT_WIDTH = 480;
const RENDER_LAYOUT_HEIGHT = 720;
/** Body font size for the layout, in points. */
const RENDER_EM = 12;
/** Rendered page height in pixels; width follows the layout's 2:3 ratio (800 px). */
const RENDER_PAGE_HEIGHT = 1200;
const RENDER_JPEG_QUALITY = 80;

/**
 * Render an EPUB page by page with mupdf and assemble the rasters into a
 * PDF. The reader draws PDF pages as images anyway, so a rasterised PDF
 * reads the same as a vector one; it is just larger on disk.
 */
export async function renderEpubToPdf(epubPath: string, outputPath: string): Promise<void> {
  const data = fs.readFileSync(epubPath);
  const doc = mupdf.Document.openDocument(data, 'application/epub+zip');
  try {
    doc.layout(RENDER_LAYOUT_WIDTH, RENDER_LAYOUT_HEIGHT, RENDER_EM);
    const pageCount = doc.countPages();
    if (pageCount === 0) throw new Error('EPUB: mupdf laid out zero pages');
    console.log(`  EPUB: rendering ${pageCount} pages with mupdf`);

    const pdf = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      try {
        const bounds = page.getBounds();
        const pageHeight = bounds[3] - bounds[1];
        const scale = RENDER_PAGE_HEIGHT / (pageHeight || RENDER_LAYOUT_HEIGHT);
        const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
        try {
          const width = pixmap.getWidth();
          const height = pixmap.getHeight();
          // PNG out of mupdf, JPEG via sharp's mozjpeg: about a fifth smaller
          // than mupdf's own encoder at the same quality on text pages.
          const jpegBuffer = await sharp(Buffer.from(pixmap.asPNG()))
            .jpeg({ quality: RENDER_JPEG_QUALITY, mozjpeg: true })
            .toBuffer();
          const jpeg = await pdf.embedJpg(jpegBuffer);
          const outPage = pdf.addPage([width, height]);
          outPage.drawImage(jpeg, { x: 0, y: 0, width, height });
        } finally {
          pixmap.destroy();
        }
      } finally {
        page.destroy();
      }
      if ((i + 1) % 100 === 0) console.log(`  EPUB: rendered ${i + 1}/${pageCount}`);
    }

    const pdfBytes = await pdf.save();
    fs.writeFileSync(outputPath, pdfBytes);
    console.log(`  EPUB → PDF: ${pageCount} rendered pages → ${path.basename(outputPath)}`);
  } finally {
    doc.destroy();
  }
}

/**
 * Convert an EPUB file to PDF, extracting images for picture books and
 * rendering with mupdf for prose. See the module comment for the split.
 */
export async function epubToPdf(epubPath: string, outputPath: string): Promise<void> {
  const scan = await scanEpub(epubPath);
  const { imageCount, textChars } = scan.stats;
  if (imageCount === 0 && textChars === 0) {
    throw new Error('EPUB: no images or text found in spine');
  }

  const strategy = chooseEpubStrategy(scan.stats);
  console.log(`  EPUB: ${imageCount} images, ${textChars} text chars → ${strategy}`);

  if (strategy === 'images') {
    await imagesToPdf(scan, outputPath);
  } else {
    await renderEpubToPdf(epubPath, outputPath);
  }
}
