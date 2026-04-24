/**
 * EPUB → PDF converter.
 *
 * EPUBs are zip files containing:
 *   - META-INF/container.xml — points to the OPF file
 *   - {book}.opf — manifest (files) + spine (reading order)
 *   - XHTML files referencing images
 *   - Images in OEBPS/images/ or similar
 *
 * For image-heavy manga EPUBs this produces a good PDF. For text-heavy
 * EPUBs we extract every image found (small, doesn't include actual prose),
 * so text novels come through as a list of illustrations only.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

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
 * Get the path to the OPF file from the EPUB's container.xml.
 */
function findOpfPath(zip: any): string {
  const containerFile = zip.files.find((f: any) => f.path === 'META-INF/container.xml');
  if (!containerFile) throw new Error('EPUB missing META-INF/container.xml');
  return ''; // placeholder — actual logic in extract()
}

/**
 * Resolve a relative path (like "images/001.jpg") against a base path
 * (like "OEBPS/text/page1.xhtml") to produce "OEBPS/images/001.jpg".
 */
function resolveRelative(basePath: string, relPath: string): string {
  const baseDir = path.dirname(basePath);
  return path.posix.normalize(path.posix.join(baseDir, relPath));
}

/**
 * Convert an EPUB file to PDF by extracting images in spine order.
 */
export async function epubToPdf(epubPath: string, outputPath: string): Promise<void> {
  const unzipper = await import('unzipper');
  const directory = await unzipper.Open.file(epubPath);

  // Build a map of path → buffer (lazy — only read what we need)
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

  // Step 3: collect images in reading order
  const imagePaths: string[] = [];
  const seenImages = new Set<string>();

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

  // Fallback: if spine didn't yield any images, walk all image files in the zip
  if (imagePaths.length === 0) {
    console.log('  EPUB: spine had no images, falling back to all image files');
    const imageExts = /\.(jpg|jpeg|png|gif|webp)$/i;
    const allImages = [...files.keys()]
      .filter((p) => imageExts.test(p))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    imagePaths.push(...allImages);
  }

  if (imagePaths.length === 0) {
    throw new Error('EPUB: no images found (text-only EPUB not supported)');
  }

  console.log(`  EPUB: assembling ${imagePaths.length} images into PDF`);

  // Step 4: assemble images into PDF
  const pdf = await PDFDocument.create();
  let embedded = 0;

  for (const imgPath of imagePaths) {
    const imgFile = files.get(imgPath);
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
