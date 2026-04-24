/**
 * Manga translation via vision-capable LLM (Ollama).
 *
 * - Renders a PDF page to JPEG via mupdf
 * - Posts to Ollama with a translation prompt
 * - Caches result per page at data/translations/{seriesId}/{fileHash}/p{N}.json
 *
 * Works with any vision-capable Ollama model. Qwen2.5-VL is recommended.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import * as mupdf from 'mupdf';
import { loadPreferences } from './data.js';
import { resolveComicPath } from './scanner.js';
import { shortHash } from './hash.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const TRANSLATIONS_DIR = path.join(DATA_DIR, 'translations');

export interface TranslatedBubble {
  order: number;
  japanese: string;
  english: string;
}

export interface PageTranslation {
  bubbles: TranslatedBubble[];
  modelUsed: string;
  translatedAt: string;
  durationMs: number;
}

// --- Config ---

interface TranslationConfig {
  url: string;            // e.g. "http://5090.local:11434"
  model: string;          // e.g. "qwen2.5vl:7b"
  prompt: string;         // system prompt — advanced users can tune
}

const CONFIG_FILE = path.join(DATA_DIR, 'translation-config.json');

const DEFAULT_PROMPT = `You are translating a manga/manhwa page to English.

Identify every piece of text — speech bubbles, thought bubbles, narration, sound effects, signs. For each, provide:
- "order": 1-indexed reading order (manga reads right-to-left, top-to-bottom; webtoons top-to-bottom)
- "japanese": the original text (this field holds the original even if it's actually Korean or Chinese — note the language in type if helpful)
- "english": a natural English translation that preserves tone, emotion, and character voice
- "type": "speech" | "thought" | "narration" | "sfx" | "sign"

IMPORTANT: For long repeated sound effects (like "あああああ" or "!!!!"), abbreviate to at most 4-5 characters (e.g. "あああ..." or "!!!"). Do not transcribe 30 characters of screaming.

Return STRICT JSON array only — no prose, no markdown fences. Example:
[{"order":1,"japanese":"こんにちは","english":"Hello","type":"speech"}]

If the page has no text, return [].`;

const DEFAULT_CONFIG: TranslationConfig = {
  url: '',
  model: 'qwen2.5vl:7b',
  prompt: DEFAULT_PROMPT,
};

export function getTranslationConfig(): TranslationConfig {
  if (!fs.existsSync(CONFIG_FILE)) return { ...DEFAULT_CONFIG };
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveTranslationConfig(partial: Partial<TranslationConfig>): TranslationConfig {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const current = getTranslationConfig();
  const next = { ...current, ...partial };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

export function isTranslationEnabled(): boolean {
  const cfg = getTranslationConfig();
  return !!cfg.url;
}

// --- Cache ---

function translationDir(seriesId: string, file: string): string {
  return path.join(TRANSLATIONS_DIR, seriesId, shortHash(file));
}

function translationPath(seriesId: string, file: string, pageNum: number): string {
  return path.join(translationDir(seriesId, file), `p${pageNum}.json`);
}

export function getCachedTranslation(seriesId: string, file: string, pageNum: number): PageTranslation | null {
  const p = translationPath(seriesId, file, pageNum);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function saveTranslationCache(seriesId: string, file: string, pageNum: number, result: PageTranslation): void {
  const dir = translationDir(seriesId, file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(translationPath(seriesId, file, pageNum), JSON.stringify(result, null, 2));
}

/**
 * List pages that already have cached translations for a file.
 */
export function getCachedPageNumbers(seriesId: string, file: string): number[] {
  const dir = translationDir(seriesId, file);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map((f) => {
      const m = f.match(/^p(\d+)\.json$/);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
}

// --- Page rendering ---

/**
 * Render a PDF page to JPEG buffer at a reasonable resolution for OCR.
 * Too small and text is unreadable, too large wastes time/tokens.
 * ~1600px on the long edge is a good balance.
 */
async function renderPageToJpeg(pdfPath: string, pageNum: number, maxDim = 1600): Promise<Buffer> {
  const data = fs.readFileSync(pdfPath);
  const doc = mupdf.Document.openDocument(data, 'application/pdf');
  const page = doc.loadPage(pageNum);

  const bounds = page.getBounds();
  const w = bounds[2] - bounds[0];
  const h = bounds[3] - bounds[1];
  const longest = Math.max(w, h);
  const scale = longest > maxDim ? maxDim / longest : 2.0; // upscale small PDFs to 2x

  const pixmap = page.toPixmap(
    mupdf.Matrix.scale(scale, scale),
    mupdf.ColorSpace.DeviceRGB,
    false,
    true,
  );
  const pngBuffer = pixmap.asPNG();

  return await sharp(Buffer.from(pngBuffer))
    .jpeg({ quality: 85 })
    .toBuffer();
}

// --- Ollama call ---

async function callOllama(imageBase64: string, cfg: TranslationConfig): Promise<TranslatedBubble[]> {
  const url = cfg.url.replace(/\/+$/, '') + '/api/generate';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      prompt: cfg.prompt,
      images: [imageBase64],
      stream: false,
      // NOTE: Removed format:'json' — it caused Qwen2.5-VL to return
      // empty {} instead of doing the vision work. We parse JSON from
      // the response text ourselves (with markdown fence fallback).
      options: {
        temperature: 0.2,
        // Reduce from Qwen2.5-VL's default 128k to something sane.
        // A single manga page + short JSON output needs ~4k at most.
        // Keeping the default forces Ollama to allocate ~45GB KV cache
        // which exceeds consumer GPU VRAM and forces CPU fallback.
        num_ctx: 8192,
        // Allow enough tokens for a page with many bubbles (default 128 is too small)
        num_predict: 2048,
        // Prevent repetition loops ("wow, wow, wow, wow..." from long SFX/screams)
        repeat_penalty: 1.3,
        repeat_last_n: 256,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}: ${await res.text().catch(() => '')}`);
  }

  const json = await res.json();
  const raw = (json.response || '').trim();

  // Parse the JSON response with progressive fallbacks:
  // 1. Direct JSON.parse
  // 2. Strip markdown fences
  // 3. Extract everything between [ and ]
  // 4. Recover from truncated arrays (find complete objects inside)
  let parsed: any;

  // Step 1: try direct parse
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Step 2: strip markdown fences if present
    const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
    let candidate = fenced ? fenced[1].trim() : raw;

    try {
      parsed = JSON.parse(candidate);
    } catch {
      // Step 3: find the start of an array, try to parse it
      const arrStart = candidate.indexOf('[');
      if (arrStart >= 0) {
        // Cut to content starting at [
        candidate = candidate.slice(arrStart);

        try {
          // Try as-is (maybe the array is valid)
          parsed = JSON.parse(candidate);
        } catch {
          // Step 4: truncated or malformed — extract complete {...} objects
          // Use a manual scanner since regex can't handle nested/escaped content well
          const objects: any[] = [];
          let depth = 0, start = -1;
          let inString = false, escape = false;
          for (let i = 0; i < candidate.length; i++) {
            const c = candidate[i];
            if (escape) { escape = false; continue; }
            if (inString) {
              if (c === '\\') escape = true;
              else if (c === '"') inString = false;
              continue;
            }
            if (c === '"') inString = true;
            else if (c === '{') { if (depth === 0) start = i; depth++; }
            else if (c === '}') {
              depth--;
              if (depth === 0 && start >= 0) {
                try { objects.push(JSON.parse(candidate.slice(start, i + 1))); } catch {}
                start = -1;
              }
            }
          }
          if (objects.length > 0) {
            parsed = objects;
            console.warn(`  Translate: recovered ${objects.length} bubbles from truncated response`);
          } else {
            throw new Error(`Model returned non-JSON: ${raw.slice(0, 200)}`);
          }
        }
      } else {
        throw new Error(`Model returned non-JSON: ${raw.slice(0, 200)}`);
      }
    }
  }

  const bubbles: TranslatedBubble[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.bubbles) ? parsed.bubbles
    : Array.isArray(parsed.text) ? parsed.text
    : parsed && typeof parsed === 'object' && parsed.japanese ? [parsed] // single object
    : [];

  return bubbles
    .filter((b) => b && typeof b.japanese === 'string' && typeof b.english === 'string')
    .map((b, i) => ({
      order: typeof b.order === 'number' ? b.order : i + 1,
      japanese: b.japanese,
      english: b.english,
    }))
    .sort((a, b) => a.order - b.order);
}

// --- Public API ---

/**
 * Translate a single page. Returns cached result if available.
 */
export async function translatePage(
  seriesId: string,
  file: string,
  pageNum: number,
  force = false,
): Promise<PageTranslation> {
  if (!force) {
    const cached = getCachedTranslation(seriesId, file, pageNum);
    if (cached) return cached;
  }

  const cfg = getTranslationConfig();
  if (!cfg.url) throw new Error('Translation service not configured. Set the URL in admin settings.');

  const pdfPath = resolveComicPath(seriesId, file);
  if (!pdfPath || !fs.existsSync(pdfPath)) throw new Error(`File not found: ${seriesId}/${file}`);

  const t0 = Date.now();
  const jpeg = await renderPageToJpeg(pdfPath, pageNum);
  const imageBase64 = jpeg.toString('base64');
  const bubbles = await callOllama(imageBase64, cfg);
  const durationMs = Date.now() - t0;

  const result: PageTranslation = {
    bubbles,
    modelUsed: cfg.model,
    translatedAt: new Date().toISOString(),
    durationMs,
  };
  saveTranslationCache(seriesId, file, pageNum, result);
  return result;
}

/**
 * Translate an entire chapter (PDF) page-by-page. Reports progress via callback.
 * Skips pages that are already cached (unless force=true).
 */
export async function translateChapter(
  seriesId: string,
  file: string,
  opts: { force?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ translated: number; cached: number; failed: number; totalMs: number }> {
  const cfg = getTranslationConfig();
  if (!cfg.url) throw new Error('Translation service not configured');

  const pdfPath = resolveComicPath(seriesId, file);
  if (!pdfPath || !fs.existsSync(pdfPath)) throw new Error(`File not found: ${seriesId}/${file}`);

  // Read page count from PDF
  const data = fs.readFileSync(pdfPath);
  const doc = mupdf.Document.openDocument(data, 'application/pdf');
  const totalPages = doc.countPages();

  let translated = 0, cached = 0, failed = 0;
  const t0 = Date.now();

  for (let i = 0; i < totalPages; i++) {
    try {
      const existing = !opts.force && getCachedTranslation(seriesId, file, i);
      if (existing) {
        cached++;
      } else {
        await translatePage(seriesId, file, i, opts.force);
        translated++;
      }
    } catch (err) {
      console.error(`  Translate page ${i + 1}/${totalPages} failed: ${(err as Error).message}`);
      failed++;
    }
    opts.onProgress?.(i + 1, totalPages);
  }

  return { translated, cached, failed, totalMs: Date.now() - t0 };
}
