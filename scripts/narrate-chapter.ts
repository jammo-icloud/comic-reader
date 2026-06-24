/**
 * Narrate one chapter end to end — per-page vision narration, bible growth,
 * then the chapter re-calibration pass. A standalone harness for testing the
 * narration pipeline against a real chapter, independent of the dev server.
 *
 * Run with the dev env vars set so it finds the library and writes cache to
 * the right data dir:
 *
 *   LIBRARY_DIR=.../local-library DATA_DIR=.../data \
 *     npx tsx scripts/narrate-chapter.ts <seriesId> "<file>"
 */
import { translateChapter } from '../src/server/translate.js';

const [, , seriesId, file] = process.argv;
if (!seriesId || !file) {
  console.error('usage: tsx scripts/narrate-chapter.ts <seriesId> "<file>"');
  process.exit(1);
}

const ts = () => new Date().toLocaleTimeString();
console.log(`[${ts()}] narrating ${seriesId} / ${file}`);

translateChapter(seriesId, file, {
  onProgress: (done, total) => console.log(`[${ts()}] page ${done}/${total}`),
})
  .then((stats) => {
    console.log(`[${ts()}] DONE — ${JSON.stringify(stats)}`);
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error(`[${ts()}] FAILED — ${err instanceof Error ? err.stack : String(err)}`);
    process.exit(1);
  });
