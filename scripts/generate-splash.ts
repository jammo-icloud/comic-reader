/**
 * Generate iOS splash screens for the standalone PWA.
 *
 * iOS shows a static PNG during PWA launch (before any JS runs). The image is
 * picked from <link rel="apple-touch-startup-image"> tags in index.html via
 * device-size media queries. iOS picks the nearest match for outliers so we
 * don't need to cover every model — a handful of common iPhone sizes is enough.
 *
 * Run:
 *   npx tsx scripts/generate-splash.ts
 *
 * The script picks one image from public/login-bg/ (the same well that
 * /api/auth/login-bg samples from for the LoginPage), composites it onto each
 * device-size canvas with a blurred-cover backdrop matching LoginPage's vibe,
 * and writes PNGs to public/splash/splash-<w>x<h>.png.
 *
 * Re-run after swapping login-bg art if you want the splash to follow.
 *
 * To swap which login-bg is used as the splash source, set SPLASH_SOURCE.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOGIN_BG_DIR = path.join(ROOT, 'public', 'login-bg');
const OUT_DIR = path.join(ROOT, 'public', 'splash');

// Common iPhone portrait native resolutions. iOS scales the nearest match for
// devices not listed here, so these four cover the real-world fleet adequately.
// Add iPad / landscape later if you want; the link tags in index.html follow
// the same shape.
const TARGETS: Array<{ w: number; h: number; ratio: number; label: string }> = [
  // iPhone 15 Pro Max / 14 Pro Max / 13 Pro Max
  { w: 1290, h: 2796, ratio: 3, label: 'iPhone 14-15 Pro Max' },
  // iPhone 15 Pro / 14 Pro
  { w: 1179, h: 2556, ratio: 3, label: 'iPhone 14-15 Pro' },
  // iPhone 15 / 14 / 13 / 12
  { w: 1170, h: 2532, ratio: 3, label: 'iPhone 12-15 standard' },
  // iPhone SE 3rd gen / 8 / 7 / 6s — older + SE line
  { w: 750, h: 1334, ratio: 2, label: 'iPhone SE / 8 / older' },
];

function pickSplashSource(): string {
  const override = process.env.SPLASH_SOURCE;
  if (override) {
    if (!fs.existsSync(override)) {
      throw new Error(`SPLASH_SOURCE not found: ${override}`);
    }
    return override;
  }
  if (!fs.existsSync(LOGIN_BG_DIR)) {
    throw new Error(`login-bg directory missing: ${LOGIN_BG_DIR}`);
  }
  const files = fs
    .readdirSync(LOGIN_BG_DIR)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  if (files.length === 0) {
    throw new Error(`no splash candidates in ${LOGIN_BG_DIR}`);
  }
  // Pick deterministically (first alphabetically) so the splash is stable
  // across rebuilds. Override SPLASH_SOURCE to choose a specific one.
  files.sort();
  return path.join(LOGIN_BG_DIR, files[0]);
}

async function generateOne(sourcePath: string, w: number, h: number): Promise<void> {
  // Backdrop: source resized to cover, blurred heavily — same trick as the
  // SeriesPage cover hero. Reads "premium" rather than letterboxed.
  const backdrop = await sharp(sourcePath)
    .resize(w, h, { fit: 'cover' })
    .blur(40)
    .modulate({ brightness: 0.6 }) // dim the blur so the foreground pops
    .toBuffer();

  // Foreground: source as a centered square, ~62% of the smaller dimension.
  // Same proportion as iOS app-launch artwork. Soft shadow via 4-pass extend.
  const foregroundSize = Math.round(Math.min(w, h) * 0.62);
  const foreground = await sharp(sourcePath)
    .resize(foregroundSize, foregroundSize, { fit: 'cover' })
    .toBuffer();

  // Composite backdrop + centered foreground
  const out = await sharp(backdrop)
    .composite([
      {
        input: foreground,
        top: Math.round((h - foregroundSize) / 2),
        left: Math.round((w - foregroundSize) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const outPath = path.join(OUT_DIR, `splash-${w}x${h}.png`);
  fs.writeFileSync(outPath, out);
  const kb = Math.round(out.length / 1024);
  console.log(`  ${w}×${h}  (${kb} KB)  → ${path.relative(ROOT, outPath)}`);
}

function emitLinkTagsHint(): void {
  console.log('\nPaste these into index.html <head> (already wired in this repo):');
  console.log('---8<---');
  for (const { w, h, ratio } of TARGETS) {
    const dwPt = w / ratio;
    const dhPt = h / ratio;
    const media =
      `(device-width: ${dwPt}px) and (device-height: ${dhPt}px) ` +
      `and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`;
    console.log(
      `<link rel="apple-touch-startup-image" media="${media}" ` +
        `href="/splash/splash-${w}x${h}.png" />`,
    );
  }
  console.log('--->8---');
}

async function main(): Promise<void> {
  const source = pickSplashSource();
  console.log(`Splash source: ${path.relative(ROOT, source)}`);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\nGenerating ${TARGETS.length} iPhone portrait splashes:`);
  for (const t of TARGETS) {
    await generateOne(source, t.w, t.h);
  }

  emitLinkTagsHint();
  console.log('\nDone. Re-run after swapping login-bg art.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
