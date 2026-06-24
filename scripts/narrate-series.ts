/**
 * Narrate every chapter of a series, in order — the overnight batch harness.
 * The story bible threads across chapters (it is per-series), so later
 * chapters narrate with the cast and recap the earlier ones built.
 *
 * Run with the dev env vars set so it finds the library and the data dir:
 *
 *   LIBRARY_DIR=.../local-library DATA_DIR=.../data \
 *     npx tsx scripts/narrate-series.ts <seriesId> [--force]
 *
 * --force re-narrates every page (use after a prompt change); without it,
 * already-cached pages are skipped and only re-calibration re-runs.
 */
import fs from 'fs';
import path from 'path';
import { translateChapter } from '../src/server/translate.js';

const seriesId = process.argv[2];
const force = process.argv.includes('--force');
if (!seriesId) {
  console.error('usage: tsx scripts/narrate-series.ts <seriesId> [--force]');
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR || './data';
const comicsFile = path.join(DATA_DIR, 'comics', `${seriesId}.jsonl`);

const comics = fs.readFileSync(comicsFile, 'utf-8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as { file: string; order?: number })
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const ts = () => new Date().toLocaleTimeString();
const t0 = Date.now();
console.log(`[${ts()}] narrating ${comics.length} chapters of ${seriesId} (force=${force})`);

for (let i = 0; i < comics.length; i++) {
  const file = comics[i].file;
  console.log(`[${ts()}] === chapter ${i + 1}/${comics.length}: ${file} ===`);
  try {
    const stats = await translateChapter(seriesId, file, {
      force,
      onProgress: (done, total) => {
        if (done % 10 === 0 || done === total) console.log(`[${ts()}]   page ${done}/${total}`);
      },
    });
    console.log(`[${ts()}] === chapter ${i + 1} done — ${JSON.stringify(stats)} ===`);
  } catch (err) {
    // One bad chapter must not abandon the rest of the overnight run.
    console.error(`[${ts()}] === chapter ${i + 1} FAILED — ${err instanceof Error ? err.message : String(err)} ===`);
  }
}

console.log(`[${ts()}] ALL DONE — ${comics.length} chapters in ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(0);
