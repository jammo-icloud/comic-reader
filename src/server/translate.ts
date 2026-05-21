/**
 * Manga translation — per-page vision pipeline with a living story bible.
 *
 * The translator SEES each page. One vision-model call per page reads every
 * bubble in true layout order, locates it, and writes the English — with the
 * page's art in front of it (who is speaking, their expression, the scene).
 * That visual context is what a flat text transcript could never give.
 *
 * Consistency across pages comes from the story bible (see bible.ts): each
 * page call is handed the current bible — cast, glossary, story-so-far — and
 * returns, alongside the translation, proposed additions. The bible threads
 * forward page to page and is persisted per series, so it deepens as the
 * model reads and a later chapter starts already knowing the world.
 *
 * Output is written per page as p<N>.json — the format the reader overlay
 * consumes. The translation prompt is an editable markdown file under
 * data/prompts/, seeded from the default below on first run.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import * as mupdf from 'mupdf';
import { resolveComicPath } from './scanner.js';
import { getSeries } from './data.js';
import { shortHash } from './hash.js';
import {
  loadBible, saveBible, applyBibleUpdates, formatBibleForPrompt,
  type StoryBible, type BibleUpdates,
} from './bible.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const TRANSLATIONS_DIR = path.join(DATA_DIR, 'translations');
const PROMPTS_DIR = path.join(DATA_DIR, 'prompts');
const CONFIG_FILE = path.join(DATA_DIR, 'translation-config.json');
const TRANSLATE_PROMPT_FILE = path.join(PROMPTS_DIR, 'translate-page.md');

// ==================== Types ====================

/**
 * A bounding box, expressed as fractions of the page (0–1). x,y is the
 * top-left corner. Lets the reader draw the translation back over the
 * original text regardless of how big the page is rendered.
 */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A translated bubble. `japanese` holds the ORIGINAL text whatever the source
 * language actually is — the field name is kept for backwards compatibility
 * with the reader's cached p<N>.json files.
 */
export interface TranslatedBubble {
  order: number;
  japanese: string;
  english: string;
  type: string;
  bbox: BBox | null;
}

/** One page's translation — cached as p<N>.json, consumed by the reader. */
export interface PageTranslation {
  bubbles: TranslatedBubble[];
  modelUsed: string;
  translatedAt: string;
  durationMs: number;
}

export type HonorificPolicy = 'keep' | 'drop' | 'localize';

export interface TranslationConfig {
  url: string;                      // Ollama base URL, e.g. "http://5090.local:11434"
  translateModel: string;           // the multimodal model that sees + translates each page
  honorificPolicy: HonorificPolicy; // how -san/-kun/-chan etc. are handled
}

// ==================== Defaults ====================

// One multimodal model now does the whole job — it sees the page and writes
// the translation. The default is qwen3.6 (a large vision-capable model);
// bigger is better here, since this call carries all of the quality.
const DEFAULT_CONFIG: TranslationConfig = {
  url: '',
  translateModel: 'qwen3.6',
  honorificPolicy: 'keep',
};

function isHonorificPolicy(v: any): v is HonorificPolicy {
  return v === 'keep' || v === 'drop' || v === 'localize';
}

/**
 * The translation prompt — the tunable one. Placeholders filled per call:
 * {{title}} {{honorificPolicy}} {{bible}}. Edit data/prompts/translate-page.md
 * to iterate without a rebuild.
 */
const DEFAULT_TRANSLATE_PROMPT = `# Manga Page Translation

You are translating one page of the manga **{{title}}** into natural English.
You can SEE the page — the panels, the characters' faces and body language,
the action. Use all of it. Manga is a visual medium: the art tells you who is
speaking, their mood, and the beat of the scene.

## What matters most

**Narration over literal accuracy.** The goal is an enjoyable, natural read —
the reader should forget this was ever another language. Rephrase freely,
localize idioms, and let each character's dialogue sound like a real person in
that moment. Word-for-word fidelity is NOT the goal; a translation that reads
well and stays true to the scene is.

Read every text element on the page — speech, thought, narration, signs and
sound effects — in correct reading order (Japanese manga reads right-to-left,
top-to-bottom; Korean/Chinese webtoons top-to-bottom).

## The story so far

This is what is known about this series. Treat the character names and the
glossary as canon — use those exact spellings, and never invent a new
romanization for a character or term already listed.

{{bible}}

## Honorifics

{{honorificPolicy}}

## Your job — two things

1. **Translate the page.** For every text element give its reading order, the
   original text, your English, its type, and its bounding box.
2. **Grow the story bible.** As you read this page, note what is NEW: a
   character who appears (with a short *voice* note — how they speak), a place,
   technique or term worth keeping consistent, and a refreshed one-or-two
   sentence recap of the story including this page. Only report what is new or
   changed; omit a field if this page added nothing to it.

## Output

Return STRICT JSON only — no prose, no markdown code fences. A single object:

{
  "bubbles": [
    {"order": 1, "original": "こんにちは", "english": "Hi there.", "type": "speech", "box": [610, 80, 880, 300]}
  ],
  "bible": {
    "characters": [{"name": "Sora", "native": "ソラ", "role": "main", "voice": "casual, warm"}],
    "glossary": [{"term": "...", "english": "...", "note": "..."}],
    "recap": "..."
  }
}

- \`type\` is one of: speech, thought, narration, sfx, sign.
- \`box\` is [x1, y1, x2, y2] in pixels of this image — the text's bounding box.
- If the page has no text, return \`"bubbles": []\`.
- If this page added nothing to the bible, return \`"bible": {}\`.
`;

/** Honorific policy → an instruction paragraph for the {{honorificPolicy}} slot. */
const HONORIFIC_INSTRUCTIONS: Record<HonorificPolicy, string> = {
  keep:
    'Keep Japanese honorifics (-san, -kun, -chan, -sama, -senpai, -sensei and ' +
    'similar) attached to names. They carry relationship and respect ' +
    'information the story leans on — a character pointedly dropping an ' +
    'honorific is often a deliberate beat of growing closeness, so preserving ' +
    'them keeps those moments intact.',
  drop:
    'Drop Japanese honorifics entirely. Render every name plainly, with no ' +
    '-san, -kun, -chan, -sama, -senpai or -sensei suffix.',
  localize:
    'Do not leave raw Japanese honorifics in the text. Instead convey the same ' +
    'respect or familiarity through natural English — "Mr." or "Ms.", a ' +
    'first-name basis, a nickname, or simply tone. A bare -san or -kun must ' +
    'never appear in the final output.',
};

// ==================== Config ====================

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getTranslationConfig(): TranslationConfig {
  if (!fs.existsSync(CONFIG_FILE)) return { ...DEFAULT_CONFIG };
  try {
    return migrateConfig(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')));
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Normalize a stored config to the current shape. Earlier versions had a
 * single `model`, then a `visionModel` + `textModel` split. The pipeline is
 * now one multimodal call, so any of those older fields seed `translateModel`.
 */
function migrateConfig(raw: any): TranslationConfig {
  const cfg: TranslationConfig = { ...DEFAULT_CONFIG };
  if (typeof raw?.url === 'string') cfg.url = raw.url;
  const model = [raw?.translateModel, raw?.visionModel, raw?.textModel, raw?.model]
    .find((m) => typeof m === 'string' && m.trim());
  if (model) cfg.translateModel = model.trim();
  if (isHonorificPolicy(raw?.honorificPolicy)) cfg.honorificPolicy = raw.honorificPolicy;
  return cfg;
}

export function saveTranslationConfig(partial: Partial<TranslationConfig>): TranslationConfig {
  ensureDir(DATA_DIR);
  const current = getTranslationConfig();
  const next: TranslationConfig = {
    url: typeof partial.url === 'string' ? partial.url.trim() : current.url,
    translateModel: typeof partial.translateModel === 'string' && partial.translateModel.trim()
      ? partial.translateModel.trim() : current.translateModel,
    honorificPolicy: isHonorificPolicy(partial.honorificPolicy)
      ? partial.honorificPolicy : current.honorificPolicy,
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

export function isTranslationEnabled(): boolean {
  return !!getTranslationConfig().url;
}

// ==================== Prompt file ====================

/**
 * Read the translation prompt, seeding it with the bundled default the first
 * time. After the first run the file exists on disk for the admin to edit.
 */
function getTranslatePrompt(): string {
  if (fs.existsSync(TRANSLATE_PROMPT_FILE)) {
    // A read failure here is a real error and must surface — never silently
    // re-seed, that would clobber an admin's edited prompt.
    const content = fs.readFileSync(TRANSLATE_PROMPT_FILE, 'utf-8');
    return content.trim() ? content : DEFAULT_TRANSLATE_PROMPT;
  }
  ensureDir(PROMPTS_DIR);
  fs.writeFileSync(TRANSLATE_PROMPT_FILE, DEFAULT_TRANSLATE_PROMPT);
  console.log(`  Seeded default translation prompt: ${TRANSLATE_PROMPT_FILE}`);
  return DEFAULT_TRANSLATE_PROMPT;
}

/** Substitute {{placeholder}} tokens; unknown placeholders are left intact. */
function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => (key in vars ? vars[key] : `{{${key}}}`));
}

// ==================== Cache ====================

function translationDir(seriesId: string, file: string): string {
  return path.join(TRANSLATIONS_DIR, seriesId, shortHash(file));
}

function translationPath(seriesId: string, file: string, page: number): string {
  return path.join(translationDir(seriesId, file), `p${page}.json`);
}

export function getCachedTranslation(seriesId: string, file: string, page: number): PageTranslation | null {
  const p = translationPath(seriesId, file, page);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function saveTranslation(seriesId: string, file: string, page: number, result: PageTranslation): void {
  ensureDir(translationDir(seriesId, file));
  fs.writeFileSync(translationPath(seriesId, file, page), JSON.stringify(result, null, 2));
}

/** Pages with a finished translation (p<N>.json). */
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

// ==================== In-progress tracking ====================

// Chapters currently being translated (in-memory; cleared on restart). The
// status endpoint exposes this so the admin UI can show live progress.
const activeChapters = new Set<string>();
const chapterKey = (seriesId: string, file: string): string => `${seriesId} ${file}`;

export function isChapterTranslating(seriesId: string, file: string): boolean {
  return activeChapters.has(chapterKey(seriesId, file));
}

// ==================== Page rendering ====================

/**
 * Render a PDF page to a JPEG buffer at a resolution good for the vision
 * model. Caps the long edge at maxDim; upscales small pages up to 2x but
 * never past maxDim.
 */
async function renderPageToJpeg(
  pdfPath: string,
  pageNum: number,
  maxDim = 1600,
): Promise<{ jpeg: Buffer; width: number; height: number }> {
  const data = fs.readFileSync(pdfPath);
  const doc = mupdf.Document.openDocument(data, 'application/pdf');
  const page = doc.loadPage(pageNum);

  const bounds = page.getBounds();
  const w = bounds[2] - bounds[0];
  const h = bounds[3] - bounds[1];
  const longest = Math.max(w, h);
  const scale = Math.min(2.0, maxDim / longest);

  const pixmap = page.toPixmap(
    mupdf.Matrix.scale(scale, scale),
    mupdf.ColorSpace.DeviceRGB,
    false,
    true,
  );
  const jpeg = await sharp(Buffer.from(pixmap.asPNG()))
    .jpeg({ quality: 85 })
    .toBuffer();
  // The model reports boxes in pixels of this image, so the caller needs its
  // exact dimensions to normalize them.
  const meta = await sharp(jpeg).metadata();
  return { jpeg, width: meta.width || 0, height: meta.height || 0 };
}

// ==================== Ollama ====================

interface OllamaOpts {
  cfg: TranslationConfig;
  model: string;
  prompt: string;
  images?: string[];
  numCtx: number;
  numPredict: number;
  temperature: number;
  repeatPenalty: number;
}

async function callOllama(opts: OllamaOpts): Promise<string> {
  const url = opts.cfg.url.replace(/\/+$/, '') + '/api/generate';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      ...(opts.images && opts.images.length ? { images: opts.images } : {}),
      // Stream the response. With stream:false the HTTP headers don't arrive
      // until generation is completely finished — a multi-minute local-LLM
      // call then trips undici's 300s headers timeout (UND_ERR_HEADERS_TIMEOUT).
      // Streaming keeps data flowing the whole time.
      stream: true,
      // think:false — a chain-of-thought on a structured-JSON task only burns
      // tokens. If a model ignores the flag its reasoning streams in `thinking`
      // chunks, which we drop — only `response` chunks are accumulated below.
      think: false,
      options: {
        temperature: opts.temperature,
        num_ctx: opts.numCtx,
        num_predict: opts.numPredict,
        repeat_penalty: opts.repeatPenalty,
        repeat_last_n: 256,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}: ${await res.text().catch(() => '')}`);
  }
  if (!res.body) throw new Error('Ollama returned an empty response stream');

  // Ollama streams newline-delimited JSON: one object per line, each carrying
  // a `response` fragment; the final object has done:true.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let obj: any;
      try { obj = JSON.parse(line); } catch { continue; } // skip a partial line
      if (obj.error) throw new Error(`Ollama error: ${obj.error}`);
      if (typeof obj.response === 'string') full += obj.response;
    }
  }
  return full.trim();
}

// ==================== Response parsing ====================

/**
 * Scan a string for complete top-level {...} objects, JSON-parsing each. Used
 * to recover usable data from a response truncated mid-structure.
 */
function scanObjects(text: string): any[] {
  const objects: any[] = [];
  let depth = 0, start = -1, inString = false, escape = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
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
        try { objects.push(JSON.parse(text.slice(start, i + 1))); } catch { /* skip */ }
        start = -1;
      }
    }
  }
  return objects;
}

/**
 * Parse a page-translation response: a JSON object with `bubbles` (required)
 * and `bible` (optional). Falls back, for a malformed/truncated response, to
 * recovering the bubble objects by their shape — the bible is sacrificed in
 * that case, which is harmless (the next page still carries the prior bible).
 */
function parseTranslateResponse(raw: string): { bubbles: any[]; bible: BibleUpdates | null } {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
  const text = (fenced ? fenced[1] : raw).trim();

  try {
    const v = JSON.parse(text);
    if (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.bubbles)) {
      return { bubbles: v.bubbles, bible: (v.bible && typeof v.bible === 'object') ? v.bible : null };
    }
    if (Array.isArray(v)) return { bubbles: v, bible: null }; // model returned a bare array
  } catch { /* fall through to recovery */ }

  // Recovery — scan every object, keep the bubble-shaped ones (have english /
  // original). Bible-update objects are dropped; that's an acceptable loss.
  const bubbles = scanObjects(text).filter(
    (o) => o && (typeof o.english === 'string' || typeof o.original === 'string'),
  );
  if (bubbles.length === 0) {
    throw new Error(`Model returned unparseable output: ${raw.slice(0, 200)}`);
  }
  console.warn(`  Translate: recovered ${bubbles.length} bubbles from a malformed response`);
  return { bubbles, bible: null };
}

/**
 * Convert a model-supplied bounding box to a normalized BBox (0–1 page
 * fractions). The box is divided by the rendered image's dimensions; swapped
 * corners are tolerated and the result is clamped inside the page. Returns
 * null for a missing or degenerate box so the reader can simply skip it.
 */
function parseBox(box: any, imgW: number, imgH: number): BBox | null {
  if (!Array.isArray(box) || box.length < 4 || imgW <= 0 || imgH <= 0) return null;
  const n = box.slice(0, 4).map(Number);
  if (n.some((v) => !Number.isFinite(v))) return null;
  const x = Math.max(0, Math.min(1, Math.min(n[0], n[2]) / imgW));
  const y = Math.max(0, Math.min(1, Math.min(n[1], n[3]) / imgH));
  const w = Math.max(0, Math.min(1 - x, Math.abs(n[2] - n[0]) / imgW));
  const h = Math.max(0, Math.min(1 - y, Math.abs(n[3] - n[1]) / imgH));
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

// ==================== Per-page translation ====================

/**
 * Translate a single page: render it, hand the image + the current story
 * bible to the vision model, and parse back the page's bubbles and the
 * bible updates the model proposes.
 */
async function translatePage(
  seriesId: string,
  file: string,
  page: number,
  bible: StoryBible,
  cfg: TranslationConfig,
): Promise<{ translation: PageTranslation; bibleUpdates: BibleUpdates | null }> {
  const pdfPath = resolveComicPath(seriesId, file);
  if (!pdfPath || !fs.existsSync(pdfPath)) throw new Error(`File not found: ${seriesId}/${file}`);

  const series = getSeries(seriesId);
  const t0 = Date.now();
  const { jpeg, width, height } = await renderPageToJpeg(pdfPath, page);

  const prompt = fillTemplate(getTranslatePrompt(), {
    title: series?.englishTitle || series?.name || '(unknown title)',
    honorificPolicy: HONORIFIC_INSTRUCTIONS[cfg.honorificPolicy],
    bible: formatBibleForPrompt(bible),
  });

  const raw = await callOllama({
    cfg,
    model: cfg.translateModel,
    prompt,
    images: [jpeg.toString('base64')],
    numCtx: 16384,    // prompt + bible + image + the JSON response
    numPredict: 4096, // one page's bubbles + bible updates is small
    temperature: 0.4, // a little room for natural prose
    repeatPenalty: 1.1,
  });

  const { bubbles: rawBubbles, bible: bibleUpdates } = parseTranslateResponse(raw);

  const bubbles: TranslatedBubble[] = rawBubbles
    .filter((b) => b && (typeof b.english === 'string' || typeof b.original === 'string'))
    .map((b, i) => ({
      order: typeof b.order === 'number' ? b.order : i + 1,
      japanese: String(b.original ?? b.japanese ?? '').trim(),
      english: String(b.english ?? '').trim(),
      type: typeof b.type === 'string' ? b.type : 'speech',
      bbox: parseBox(b.box, width, height),
    }))
    .sort((a, b) => a.order - b.order);

  return {
    translation: {
      bubbles,
      modelUsed: cfg.translateModel,
      translatedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
    },
    bibleUpdates,
  };
}

// ==================== Orchestration ====================

export interface ChapterTranslateStats {
  totalPages: number;
  translated: number; // pages translated this run (or already cached)
  failed: number;     // pages the model could not translate
  totalMs: number;
}

/**
 * Translate an entire chapter, page by page in reading order. The story bible
 * is loaded once, threaded through every page, and persisted after each page
 * (so progress and the growing bible survive a crash).
 *
 *  - force=true   re-translates every page, even already-cached ones
 *  - force=false  skips pages that already have a p<N>.json
 */
export async function translateChapter(
  seriesId: string,
  file: string,
  opts: { force?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<ChapterTranslateStats> {
  const cfg = getTranslationConfig();
  if (!cfg.url) throw new Error('Translation service not configured');

  const pdfPath = resolveComicPath(seriesId, file);
  if (!pdfPath || !fs.existsSync(pdfPath)) throw new Error(`File not found: ${seriesId}/${file}`);

  const pdfData = fs.readFileSync(pdfPath);
  const totalPages = mupdf.Document.openDocument(pdfData, 'application/pdf').countPages();
  const t0 = Date.now();

  activeChapters.add(chapterKey(seriesId, file));
  try {
    let bible = loadBible(seriesId);
    let translated = 0, failed = 0;

    for (let i = 0; i < totalPages; i++) {
      if (!opts.force && getCachedTranslation(seriesId, file, i)) {
        translated++;
        opts.onProgress?.(i + 1, totalPages);
        continue;
      }
      try {
        const { translation, bibleUpdates } = await translatePage(seriesId, file, i, bible, cfg);
        saveTranslation(seriesId, file, i, translation);
        if (bibleUpdates) {
          bible = applyBibleUpdates(bible, bibleUpdates);
          saveBible(seriesId, bible);
        }
        translated++;
      } catch (err) {
        console.error(`  Translate page ${i + 1}/${totalPages} failed: ${(err as Error).message}`);
        failed++;
      }
      opts.onProgress?.(i + 1, totalPages);
    }

    return { totalPages, translated, failed, totalMs: Date.now() - t0 };
  } finally {
    activeChapters.delete(chapterKey(seriesId, file));
  }
}
