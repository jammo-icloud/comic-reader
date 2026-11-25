/**
 * Filesystem side of changing a series' type: its folder lives at
 * <libraryDir>/<typeDir(type)>/<id>, so a type change moves the folder.
 * Pure over `libraryDir` so it can be tested against a temp directory;
 * data.ts `moveSeriesType` wraps it with LIBRARY_DIR and cache updates.
 */
import fs from 'fs';
import path from 'path';
import { typeDir, type SeriesType } from './data.js';

const ALL_TYPES: SeriesType[] = ['comic', 'magazine', 'book'];

/**
 * Locate a series folder. Checks the preferred type's dir first, then the
 * others (comic, magazine, book) — records may disagree with disk when the
 * type was edited before type changes moved folders.
 */
export function findSeriesDir(libraryDir: string, id: string, preferred: SeriesType): string | null {
  const order = [preferred, ...ALL_TYPES.filter((t) => t !== preferred)];
  for (const type of order) {
    const dir = path.join(libraryDir, typeDir(type), id);
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

/**
 * Move a series folder to the dir for `to`. Returns `{ moved: false, from: null }`
 * when no folder exists anywhere (record-only change). Throws an Error with
 * `code === 'EEXIST'` when a different folder already occupies the target.
 */
export function moveSeriesDir(
  libraryDir: string,
  id: string,
  from: SeriesType,
  to: SeriesType,
): { moved: boolean; from: string | null; to: string } {
  const target = path.join(libraryDir, typeDir(to), id);
  const source = findSeriesDir(libraryDir, id, from);

  if (!source) return { moved: false, from: null, to: target };
  if (source === target) return { moved: false, from: source, to: target };

  if (fs.existsSync(target)) {
    const err = new Error(`Target folder already exists: ${target}`) as NodeJS.ErrnoException;
    err.code = 'EEXIST';
    throw err;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.renameSync(source, target);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
    // Different filesystems (e.g. separate mounts per type dir): copy then remove.
    try {
      fs.cpSync(source, target, { recursive: true, preserveTimestamps: true });
    } catch (copyErr) {
      // Drop the partial copy so a retry isn't blocked by EEXIST; source is intact.
      fs.rmSync(target, { recursive: true, force: true });
      throw copyErr;
    }
    fs.rmSync(source, { recursive: true, force: true });
  }
  return { moved: true, from: source, to: target };
}
