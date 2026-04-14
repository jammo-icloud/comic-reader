/**
 * Merge two series into one.
 * Admin picks which chapters and metadata to keep from each side.
 */
import fs from 'fs';
import path from 'path';
import {
  getSeries, loadComics, writeComics, saveSeries,
  removeSeries as deleteSeriesRecord,
  type SeriesRecord, type ComicRecord, type CollectionEntry, type UserProgressRecord,
} from './data.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const LIBRARY_DIR = process.env.LIBRARY_DIR || '/library';
const USERS_DIR = path.join(DATA_DIR, 'users');

// --- Types ---

export interface MergeSlot {
  order: number;
  keepChapter: ComicRecord | null;
  removeChapter: ComicRecord | null;
}

export interface MergePreviewResult {
  keep: SeriesRecord & { count: number };
  remove: SeriesRecord & { count: number };
  slots: MergeSlot[];
}

export interface MergeChapterChoice {
  file: string;
  from: 'keep' | 'remove';
}

export interface MergeMetadataChoice {
  name?: 'keep' | 'remove';
  englishTitle?: 'keep' | 'remove';
  coverFile?: 'keep' | 'remove';
  score?: 'keep' | 'remove';
  synopsis?: 'keep' | 'remove';
  tags?: 'keep' | 'remove';
  status?: 'keep' | 'remove';
  year?: 'keep' | 'remove';
  malId?: 'keep' | 'remove';
  mangaDexId?: 'keep' | 'remove';
}

export interface MergeRequest {
  keepId: string;
  removeId: string;
  chapters: MergeChapterChoice[];
  metadata: MergeMetadataChoice;
}

// --- Preview: build chapter alignment ---

export function buildMergePreview(keepId: string, removeId: string): MergePreviewResult {
  const keepSeries = getSeries(keepId);
  const removeSeries = getSeries(removeId);
  if (!keepSeries) throw new Error(`Series not found: ${keepId}`);
  if (!removeSeries) throw new Error(`Series not found: ${removeId}`);

  const keepComics = loadComics(keepId);
  const removeComics = loadComics(removeId);

  // Index by order
  const keepByOrder = new Map<number, ComicRecord>();
  for (const c of keepComics) keepByOrder.set(c.order, c);

  const removeByOrder = new Map<number, ComicRecord>();
  for (const c of removeComics) removeByOrder.set(c.order, c);

  // Collect all unique orders
  const allOrders = new Set<number>([...keepByOrder.keys(), ...removeByOrder.keys()]);
  const sortedOrders = [...allOrders].sort((a, b) => a - b);

  const slots: MergeSlot[] = sortedOrders.map((order) => ({
    order,
    keepChapter: keepByOrder.get(order) || null,
    removeChapter: removeByOrder.get(order) || null,
  }));

  return {
    keep: { ...keepSeries, count: keepComics.length },
    remove: { ...removeSeries, count: removeComics.length },
    slots,
  };
}

// --- Execute merge ---

export function executeMerge(req: MergeRequest): { ok: true; chaptersMoved: number; usersUpdated: number } {
  const keepSeries = getSeries(req.keepId);
  const removeSeries = getSeries(req.removeId);
  if (!keepSeries) throw new Error(`Series not found: ${req.keepId}`);
  if (!removeSeries) throw new Error(`Series not found: ${req.removeId}`);
  if (keepSeries.type !== removeSeries.type) {
    throw new Error(`Cannot merge different types: ${keepSeries.type} vs ${removeSeries.type}`);
  }

  const typeDir = keepSeries.type === 'comic' ? 'comics' : 'magazines';
  const keepDir = path.join(LIBRARY_DIR, typeDir, req.keepId);
  const removeDir = path.join(LIBRARY_DIR, typeDir, req.removeId);

  const keepComics = loadComics(req.keepId);
  const removeComics = loadComics(req.removeId);

  const keepByFile = new Map(keepComics.map((c) => [c.file, c]));
  const removeByFile = new Map(removeComics.map((c) => [c.file, c]));

  // Build set of files to keep from each side
  const keepFiles = new Set<string>();
  const removeFiles = new Set<string>();
  for (const ch of req.chapters) {
    if (ch.from === 'keep') keepFiles.add(ch.file);
    else removeFiles.add(ch.file);
  }

  // Step 1: Delete discarded chapters from keep directory
  // (chapters that exist in keepDir but weren't chosen)
  for (const comic of keepComics) {
    if (!keepFiles.has(comic.file)) {
      const filePath = path.join(keepDir, comic.file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`  Merge: deleted discarded keep chapter ${comic.file}`);
      }
    }
  }

  // Step 2: Move chosen chapters from remove directory to keep directory
  let chaptersMoved = 0;
  if (!fs.existsSync(keepDir)) fs.mkdirSync(keepDir, { recursive: true });

  for (const ch of req.chapters) {
    if (ch.from !== 'remove') continue;

    const srcPath = path.join(removeDir, ch.file);
    let destFile = ch.file;
    let destPath = path.join(keepDir, destFile);

    // Handle filename collision — rename if a different file exists at dest
    if (fs.existsSync(destPath)) {
      const ext = path.extname(destFile);
      const base = path.basename(destFile, ext);
      destFile = `${base}_merged${ext}`;
      destPath = path.join(keepDir, destFile);
    }

    if (fs.existsSync(srcPath)) {
      // Copy + delete (safe for cross-device)
      fs.copyFileSync(srcPath, destPath);
      fs.unlinkSync(srcPath);
      chaptersMoved++;
      console.log(`  Merge: moved ${ch.file} → ${destFile}`);

      // Update file reference if renamed
      if (destFile !== ch.file) {
        ch.file = destFile;
      }
    }
  }

  // Step 3: Build merged comics list
  const mergedComics: ComicRecord[] = [];
  for (const ch of req.chapters) {
    const record = ch.from === 'keep'
      ? keepByFile.get(ch.file)
      : removeByFile.get(ch.file);

    if (record) {
      mergedComics.push({
        ...record,
        file: ch.file, // May have been renamed
      });
    }
  }
  mergedComics.sort((a, b) => a.order - b.order);
  writeComics(req.keepId, mergedComics);

  // Step 4: Build merged metadata
  const merged: SeriesRecord = { ...keepSeries };
  const metaFields: (keyof MergeMetadataChoice)[] = [
    'name', 'englishTitle', 'coverFile', 'score', 'synopsis',
    'tags', 'status', 'year', 'malId', 'mangaDexId',
  ];
  for (const field of metaFields) {
    if (req.metadata[field] === 'remove') {
      (merged as any)[field] = (removeSeries as any)[field];
    }
  }

  // Handle cover: if we chose remove's cover, copy it before deleting
  if (req.metadata.coverFile === 'remove' && removeSeries.coverFile) {
    const srcCover = path.join(DATA_DIR, 'series-covers', removeSeries.coverFile);
    if (fs.existsSync(srcCover)) {
      // Keep the same filename — it's already set in merged.coverFile
      // Just ensure it won't be deleted in step 7
    }
  }

  saveSeries(merged);

  // Step 5: Migrate user collections and progress
  let usersUpdated = 0;
  if (fs.existsSync(USERS_DIR)) {
    const userDirs = fs.readdirSync(USERS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    // Track which files were renamed (remove side)
    const fileRenames = new Map<string, string>();
    for (const ch of req.chapters) {
      if (ch.from === 'remove') {
        const origRecord = removeByFile.get(ch.file) || [...removeByFile.values()].find((r) => ch.file.startsWith(r.file.replace(/\.pdf$/, '')));
        // If the file was renamed during move, record the mapping
        // (ch.file is already the renamed version at this point)
      }
    }

    for (const username of userDirs) {
      let updated = false;

      // Migrate collection
      const collPath = path.join(USERS_DIR, username, 'collection.jsonl');
      if (fs.existsSync(collPath)) {
        try {
          const lines = fs.readFileSync(collPath, 'utf-8').split('\n').filter(Boolean);
          const entries: CollectionEntry[] = lines.map((l) => JSON.parse(l));

          const hasKeep = entries.some((e) => e.seriesId === req.keepId);
          const hasRemove = entries.some((e) => e.seriesId === req.removeId);

          if (hasRemove) {
            let newEntries: CollectionEntry[];
            if (hasKeep) {
              // Has both — just remove the removeId entry
              newEntries = entries.filter((e) => e.seriesId !== req.removeId);
            } else {
              // Only has remove — swap to keepId
              newEntries = entries.map((e) =>
                e.seriesId === req.removeId ? { ...e, seriesId: req.keepId } : e
              );
            }
            fs.writeFileSync(collPath, newEntries.map((e) => JSON.stringify(e)).join('\n') + '\n');
            updated = true;
          }
        } catch (err) {
          console.error(`  Merge: failed to migrate collection for ${username}: ${(err as Error).message}`);
        }
      }

      // Migrate progress
      const progPath = path.join(USERS_DIR, username, 'progress.jsonl');
      if (fs.existsSync(progPath)) {
        try {
          const lines = fs.readFileSync(progPath, 'utf-8').split('\n').filter(Boolean);
          const entries: UserProgressRecord[] = lines.map((l) => JSON.parse(l));

          const hasRemoveProgress = entries.some((e) => e.seriesId === req.removeId);
          if (hasRemoveProgress) {
            // Build set of final chapter files (from the chosen side)
            const finalFiles = new Set(mergedComics.map((c) => c.file));

            // Build map of keep-side progress for conflict resolution
            const keepProgress = new Map<string, UserProgressRecord>();
            for (const e of entries) {
              if (e.seriesId === req.keepId) keepProgress.set(e.file, e);
            }

            const newEntries: UserProgressRecord[] = [];
            for (const e of entries) {
              if (e.seriesId === req.removeId) {
                // Check if this file is in the final merged set
                if (finalFiles.has(e.file)) {
                  const existing = keepProgress.get(e.file);
                  if (existing) {
                    // Conflict: keep the one with higher progress
                    if (e.currentPage > existing.currentPage || (e.isRead && !existing.isRead)) {
                      // Remove side has more progress — update the keep entry
                      keepProgress.set(e.file, { ...e, seriesId: req.keepId });
                    }
                    // Either way, skip adding the remove entry
                  } else {
                    // No conflict — remap to keepId
                    newEntries.push({ ...e, seriesId: req.keepId });
                  }
                }
                // If file not in final set, discard progress
              } else if (e.seriesId === req.keepId) {
                // Will be handled via keepProgress map
              } else {
                newEntries.push(e);
              }
            }

            // Add back keep-side progress (possibly updated)
            for (const e of keepProgress.values()) {
              newEntries.push(e);
            }

            fs.writeFileSync(progPath, newEntries.map((e) => JSON.stringify(e)).join('\n') + '\n');
            updated = true;
          }
        } catch (err) {
          console.error(`  Merge: failed to migrate progress for ${username}: ${(err as Error).message}`);
        }
      }

      if (updated) usersUpdated++;
    }
  }

  // Step 6: Delete the remove series
  // Delete cover (unless we chose to keep it — in which case it's already been preserved via merged.coverFile)
  if (removeSeries.coverFile && req.metadata.coverFile !== 'remove') {
    const coverPath = path.join(DATA_DIR, 'series-covers', removeSeries.coverFile);
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
  }

  // Delete remove series directory
  if (fs.existsSync(removeDir)) {
    fs.rmSync(removeDir, { recursive: true, force: true });
  }

  // Delete thumbnails for remove series
  const thumbDir = path.join(DATA_DIR, 'thumbnails', req.removeId);
  if (fs.existsSync(thumbDir)) {
    fs.rmSync(thumbDir, { recursive: true, force: true });
  }

  // Remove metadata
  deleteSeriesRecord(req.removeId);

  console.log(`  Merge complete: "${removeSeries.name}" → "${keepSeries.name}" (${chaptersMoved} chapters moved, ${usersUpdated} users updated)`);

  return { ok: true, chaptersMoved, usersUpdated };
}
