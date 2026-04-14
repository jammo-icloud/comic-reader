import fs from 'fs';
import {
  loadAllSeries,
  loadComics,
  writeComics,
  hasUserData,
  ensureUserDir,
  addToCollection,
  savePreferences,
  type ComicRecord,
  type UserProgressRecord,
} from './data.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const DEFAULT_USER = process.env.DEFAULT_USER || 'local';

/**
 * One-time migration from single-user to multi-user data model.
 * Runs on startup if data/users/ doesn't exist yet.
 *
 * 1. Creates user dir for the default user
 * 2. Adds all existing series to their collection
 * 3. Extracts reading progress from comics JSONL → user progress.jsonl
 * 4. Rewrites comics JSONL with shared fields only
 */
export function migrateToMultiUser() {
  if (hasUserData()) return; // Already migrated

  const allSeries = loadAllSeries();
  if (allSeries.length === 0) {
    // No data to migrate — just ensure the user dir exists
    ensureUserDir(DEFAULT_USER);
    savePreferences(DEFAULT_USER, { theme: 'midnight', safeMode: true });
    console.log(`Multi-user: initialized for "${DEFAULT_USER}" (empty library)`);
    return;
  }

  console.log(`Migrating to multi-user for default user "${DEFAULT_USER}"...`);
  ensureUserDir(DEFAULT_USER);

  const progressRecords: UserProgressRecord[] = [];
  let seriesMigrated = 0;
  let progressMigrated = 0;

  for (const series of allSeries) {
    // Add to default user's collection
    addToCollection(DEFAULT_USER, series.id);
    seriesMigrated++;

    // Extract progress from comics JSONL
    const comics = loadComics(series.id);
    const sharedComics: ComicRecord[] = [];

    for (const comic of comics) {
      // Extract any user-specific progress
      if (comic.currentPage > 0 || comic.isRead || comic.lastReadAt) {
        progressRecords.push({
          seriesId: series.id,
          file: comic.file,
          currentPage: comic.currentPage,
          isRead: comic.isRead,
          lastReadAt: comic.lastReadAt,
        });
        progressMigrated++;
      }

      // Keep shared fields (reset progress fields to defaults)
      sharedComics.push({
        file: comic.file,
        pages: comic.pages,
        order: comic.order,
        currentPage: 0,
        isRead: false,
        lastReadAt: null,
      });
    }

    // Rewrite comics JSONL with shared-only data
    if (comics.length > 0) {
      writeComics(series.id, sharedComics);
    }
  }

  // Write progress records
  if (progressRecords.length > 0) {
    const userDir = `${DATA_DIR}/users/${DEFAULT_USER}`;
    const content = progressRecords.map((r) => JSON.stringify(r)).join('\n') + '\n';
    fs.writeFileSync(`${userDir}/progress.jsonl`, content);
  }

  // Default preferences
  savePreferences(DEFAULT_USER, { theme: 'midnight', safeMode: true });

  console.log(`  Migrated ${seriesMigrated} series, ${progressMigrated} progress records → user "${DEFAULT_USER}"`);
  console.log(`  Multi-user migration complete.`);
}
