import fs from 'fs';
import path from 'path';
import { loadShelves, type Shelf } from './shelves.js';
import { loadAllSeries, writeAllSeries, loadComics, writeComics, slugify, type SeriesRecord, type ComicRecord } from './data.js';
import { convertToPdf, isImageFolder } from './converter.js';

const COMIC_EXTENSIONS = new Set(['.pdf', '.cbr', '.cbz']);

function extractOrder(filename: string): number {
  const numbers = filename.match(/\d+(\.\d+)?/g);
  if (!numbers || numbers.length === 0) return 0;
  return parseFloat(numbers[numbers.length - 1]);
}

function extractNestedOrder(relativePath: string): number {
  const parts = relativePath.split(path.sep);
  if (parts.length <= 1) return extractOrder(parts[0]);

  let yearMultiplier = 0;
  for (let i = 0; i < parts.length - 1; i++) {
    const yearMatch = parts[i].match(/^(\d{4})$/);
    if (yearMatch) yearMultiplier = parseInt(yearMatch[1], 10) * 10000;
  }
  return yearMultiplier + extractOrder(parts[parts.length - 1]);
}

interface FoundItem {
  fullPath: string;
  type: 'pdf' | 'cbr' | 'cbz' | 'image-folder';
}

function walkDir(dir: string): FoundItem[] {
  const results: FoundItem[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (isImageFolder(fullPath)) {
        const hasSubdirs = fs.readdirSync(fullPath, { withFileTypes: true })
          .some((e) => e.isDirectory() && !e.name.startsWith('.'));
        if (!hasSubdirs) {
          results.push({ fullPath, type: 'image-folder' });
          continue;
        }
      }
      results.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.pdf') results.push({ fullPath, type: 'pdf' });
      else if (ext === '.cbr') results.push({ fullPath, type: 'cbr' });
      else if (ext === '.cbz') results.push({ fullPath, type: 'cbz' });
    }
  }
  return results;
}

async function convertAndArchive(item: FoundItem, shelfPath: string): Promise<string | null> {
  const basename = path.basename(item.fullPath, path.extname(item.fullPath));
  const dir = path.dirname(item.fullPath);
  const pdfPath = path.join(dir, `${basename}.pdf`);

  if (fs.existsSync(pdfPath)) return pdfPath;

  console.log(`  Converting: ${path.relative(shelfPath, item.fullPath)}`);
  try {
    const converted = await convertToPdf(item.fullPath);
    if (!converted) return null;
    fs.copyFileSync(converted, pdfPath);

    const originalsDir = path.join(dir, '.originals');
    if (!fs.existsSync(originalsDir)) fs.mkdirSync(originalsDir, { recursive: true });

    if (item.type === 'image-folder') {
      fs.renameSync(item.fullPath, path.join(originalsDir, path.basename(item.fullPath)));
    } else {
      fs.renameSync(item.fullPath, path.join(originalsDir, path.basename(item.fullPath)));
    }
    return pdfPath;
  } catch (err) {
    console.error(`  Conversion failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Scan a single shelf and update series + comics data
 */
async function scanShelf(
  shelf: Shelf,
  seriesMap: Map<string, SeriesRecord>,
  comicsMap: Map<string, ComicRecord[]>,
) {
  const items = walkDir(shelf.path);

  // Convert non-PDFs first
  let converted = 0;
  for (const item of items) {
    if (item.type !== 'pdf') {
      const result = await convertAndArchive(item, shelf.path);
      if (result) converted++;
    }
  }
  if (converted > 0) console.log(`  Converted ${converted} items`);

  // Now scan PDFs
  const pdfItems = walkDir(shelf.path).filter((i) => i.type === 'pdf');

  // Group by series (top-level folder)
  const bySeriesFolder = new Map<string, { rel: string; fullPath: string }[]>();

  for (const item of pdfItems) {
    const rel = path.relative(shelf.path, item.fullPath);
    const parts = rel.split(path.sep);
    const seriesFolder = parts.length > 1 ? parts[0] : 'Unsorted';

    if (!bySeriesFolder.has(seriesFolder)) {
      bySeriesFolder.set(seriesFolder, []);
    }
    bySeriesFolder.get(seriesFolder)!.push({ rel, fullPath: item.fullPath });
  }

  let added = 0;

  for (const [seriesFolder, files] of bySeriesFolder) {
    const seriesId = slugify(seriesFolder);

    // Create/update series record
    if (!seriesMap.has(seriesId)) {
      seriesMap.set(seriesId, {
        id: seriesId,
        name: seriesFolder,
        shelfId: shelf.id,
        coverFile: null,
        score: null,
        synopsis: null,
        tags: [],
        status: null,
        year: null,
        malId: null,
        mangaDexId: null,
        placeholder: shelf.placeholder || 'manga.png',
      });
    }

    // Build comic list
    const existingComics = comicsMap.get(seriesId) || [];
    const existingByFile = new Map(existingComics.map((c) => [c.file, c]));
    const newComics: ComicRecord[] = [];

    for (const { rel, fullPath } of files) {
      const parts = rel.split(path.sep);
      // File relative to the series folder
      const fileInSeries = parts.slice(1).join(path.sep);
      const filename = fileInSeries || path.basename(rel);

      const existing = existingByFile.get(filename);
      if (existing) {
        // Keep reading progress, update order
        existing.order = extractNestedOrder(rel);
        newComics.push(existing);
      } else {
        newComics.push({
          file: filename,
          pages: 0,
          currentPage: 0,
          isRead: false,
          order: extractNestedOrder(rel),
          lastReadAt: null,
        });
        added++;
      }
    }

    // Sort by order
    newComics.sort((a, b) => a.order - b.order);
    comicsMap.set(seriesId, newComics);
  }

  return { seriesCount: bySeriesFolder.size, added, converted };
}

export async function scanLibrary(): Promise<{ added: number; removed: number; total: number; converted: number }> {
  const shelves = loadShelves();

  if (shelves.length === 0) {
    console.log('No shelves configured. Add a shelf to start scanning.');
    return { added: 0, removed: 0, total: 0, converted: 0 };
  }

  // Load existing data
  const existingSeries = loadAllSeries();
  const seriesMap = new Map(existingSeries.map((s) => [s.id, s]));
  const comicsMap = new Map<string, ComicRecord[]>();
  for (const s of existingSeries) {
    comicsMap.set(s.id, loadComics(s.id));
  }

  const activeSeriesIds = new Set<string>();
  let totalAdded = 0;
  let totalConverted = 0;

  for (const shelf of shelves) {
    console.log(`Scanning shelf "${shelf.name}": ${shelf.path}`);
    const result = await scanShelf(shelf, seriesMap, comicsMap);
    // Track which series came from this scan
    for (const [id] of comicsMap) {
      const s = seriesMap.get(id);
      if (s && s.shelfId === shelf.id) activeSeriesIds.add(id);
    }
    totalAdded += result.added;
    totalConverted += result.converted;
    console.log(`  ${result.seriesCount} series, ${result.added} new comics`);
  }

  // Remove series that no longer exist on disk
  let removed = 0;
  for (const [id] of seriesMap) {
    const comics = comicsMap.get(id);
    if (!comics || comics.length === 0) {
      seriesMap.delete(id);
      comicsMap.delete(id);
      removed++;
    }
  }

  // Write everything
  writeAllSeries([...seriesMap.values()]);
  for (const [id, comics] of comicsMap) {
    writeComics(id, comics);
  }

  const totalComics = [...comicsMap.values()].reduce((sum, c) => sum + c.length, 0);
  console.log(`Scan complete: ${seriesMap.size} series, ${totalComics} comics, ${totalAdded} new, ${removed} removed, ${totalConverted} converted`);
  return { added: totalAdded, removed, total: totalComics, converted: totalConverted };
}

/**
 * Resolve a comic key (seriesId/filename) to its full path on disk
 */
export function resolveComicPath(seriesId: string, file: string): string | null {
  const series = loadAllSeries().find((s) => s.id === seriesId);
  if (!series) return null;
  const shelves = loadShelves();
  const shelf = shelves.find((s) => s.id === series.shelfId);
  if (!shelf) return null;
  return path.join(shelf.path, series.name, file);
}
