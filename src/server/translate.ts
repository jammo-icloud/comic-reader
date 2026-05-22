/**
 * Manga narration — per-page vision pipeline with a living story bible.
 *
 * Bindery does not "translate" a page so much as NARRATE it. One vision-model
 * call per page sees the art — panels, faces, action — and tells that page's
 * story in strong English. It is source-agnostic: Japanese, Korean, or rough
 * English bubbles all become good English narration (a poor English scan is
 * simply retold properly). The bubbles are still recorded as a citation layer.
 *
 * Consistency across pages comes from the story bible (see bible.ts): each
 * page call is handed the current bible — cast, glossary, story-so-far — and
 * returns proposed additions. The bible threads forward and is persisted per
 * series, so it deepens as the model reads and a later chapter starts knowing
 * the world.
 *
 * Output is written per page as p<N>.json. The narration prompt is an
 * editable markdown file under data/prompts/, seeded from the default below.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import * as mupdf from 'mupdf';
import { resolveComicPath } from './scanner.js';
import { getSeries } from './data.js';
import { shortHash } from './hash.js';
import {
  loadBible, saveBible, applyBibleUpdates, formatBibleForPrompt, emptyBible,
  type StoryBible, type BibleUpdates,
} from './bible.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const TRANSLATIONS_DIR = path.join(DATA_DIR, 'translations');
const PROMPTS_DIR = path.join(DATA_DIR, 'prompts');
const CONFIG_FILE = path.join(DATA_DIR, 'translation-config.json');
const NARRATION_PROMPT_FILE = path.join(PROMPTS_DIR, 'narrate-page.md');
const RECALIBRATION_PROMPT_FILE = path.join(PROMPTS_DIR, 'recalibrate-chapter.md');

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

/**
 * One page's narration — cached as p<N>.json, consumed by the reader.
 * `narration` is the told-story passage; `bubbles` is the citation layer
 * (each text element with its location), kept so the reader can show which
 * bubble a line came from.
 */
export interface PageTranslation {
  narration: string;
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
 * The narration prompt — the tunable one. Placeholders filled per call:
 * {{title}} {{honorificPolicy}} {{bible}}. Edit data/prompts/narrate-page.md
 * to iterate without a rebuild.
 */
const DEFAULT_NARRATION_PROMPT = `# Manga Page — Narration

You are telling the story of one page of **{{title}}** in strong, natural
English, for a reader who is looking at the page while you narrate.

You can SEE the page — the panels, the characters, their faces, the action,
the mood. The text in the bubbles may be Japanese, Korean, or already in
(often rough) English. Whatever it is: read it, and tell this page's story
WELL.

## Narration — the heart of the job

Write a flowing passage that tells what happens on this page. Render dialogue
vividly and in each character's voice; carry the action and the scene with
light narration where the art shows it. It should read like a gifted
storyteller telling you the page — not a list of translated lines.

- If the page is not in English, translate as you narrate.
- If the page is ALREADY in English but the writing is poor or pidgin, retell
  it properly — never pass bad prose through.
- Tell what is on the page, told well. Do not invent events that aren't there.

## Also record

- **bubbles** — every text element: reading order, the original text, a clean
  English line, its type, and its box. This is the citation layer, so the
  reader can show which bubble a line came from.
- **bible** — anything new for the story bible (below): characters (each with
  a short *voice* note — how they speak), glossary terms, and a refreshed
  one-or-two sentence recap. Omit a field if this page added nothing to it.

## The story so far — canon: use these exact names and voices

{{bible}}

## Honorifics

{{honorificPolicy}}

## Output

Return STRICT JSON only — no prose outside the JSON, no markdown code fences.
A single object:

{
  "narration": "Papa steps between his daughter and the smoking rubble. ...",
  "bubbles": [
    {"order": 1, "original": "こんにちは", "english": "Hi there.", "type": "speech", "box": [610, 80, 880, 300]}
  ],
  "bible": {
    "characters": [{"name": "Sora", "native": "ソラ", "role": "main", "voice": "casual, warm"}],
    "glossary": [{"term": "原文の用語", "english": "your English rendering", "note": "what it is"}],
    "recap": "..."
  }
}

- \`type\` is one of: speech, thought, narration, sfx, sign.
- \`box\` is [x1, y1, x2, y2] in pixels of this image.
- In \`glossary\`, "term" is the original-language term and "english" is your
  chosen English rendering.
- If the page has no text, narrate the art and return \`"bubbles": []\`.
- If this page added nothing to the bible, return \`"bible": {}\`.
`;

/**
 * The re-calibration prompt — the "tell it" pass. Placeholders: {{title}}
 * {{bible}} {{pages}}. Edit data/prompts/recalibrate-chapter.md to iterate.
 */
const DEFAULT_RECALIBRATION_PROMPT = `# Chapter Re-Calibration

A chapter of **{{title}}** has just been narrated page by page. The early
pages were written before the story bible was complete — names were guessed,
voices not yet known, the arc unclear. Now that the whole chapter has been
read, go back over it and make it consistent.

This is a POLISH, not a rewrite. Do NOT re-translate, do NOT invent events,
do NOT add or drop story content. Only:

- Fix every character name and term to match the canonical bible exactly.
- Align each character's voice and tone so they hold from the first page to
  the last.
- Smooth the narration so the chapter reads as one continuous story told in a
  single, strong narratorial voice.
- Tighten — trim the repetition a page-by-page pass inevitably leaves.

## The story bible — canon

{{bible}}

## The chapter, page by page

{{pages}}

## Output

Return STRICT JSON only — no prose outside the JSON, no markdown code fences:

{
  "pages": [
    {"page": 0, "narration": "the harmonized narration for page 0"},
    {"page": 1, "narration": "..."}
  ],
  "bible": { "characters": [...], "glossary": [...], "recap": "..." }
}

- Every page from the input must appear exactly once in "pages", with the
  same page numbers.
- "bible" is the finalized, canonical bible: merge duplicate characters, fix
  any glossary entry whose fields look reversed, and give one coherent recap
  of the whole chapter.
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
 * Read the narration prompt, seeding it with the bundled default the first
 * time. After the first run the file exists on disk for the admin to edit.
 */
function getNarrationPrompt(): string {
  if (fs.existsSync(NARRATION_PROMPT_FILE)) {
    // A read failure here is a real error and must surface — never silently
    // re-seed, that would clobber an admin's edited prompt.
    const content = fs.readFileSync(NARRATION_PROMPT_FILE, 'utf-8');
    return content.trim() ? content : DEFAULT_NARRATION_PROMPT;
  }
  ensureDir(PROMPTS_DIR);
  fs.writeFileSync(NARRATION_PROMPT_FILE, DEFAULT_NARRATION_PROMPT);
  console.log(`  Seeded default narration prompt: ${NARRATION_PROMPT_FILE}`);
  return DEFAULT_NARRATION_PROMPT;
}

/** Read the re-calibration prompt, seeding the default the first time. */
function getRecalibrationPrompt(): string {
  if (fs.existsSync(RECALIBRATION_PROMPT_FILE)) {
    const content = fs.readFileSync(RECALIBRATION_PROMPT_FILE, 'utf-8');
    return content.trim() ? content : DEFAULT_RECALIBRATION_PROMPT;
  }
  ensureDir(PROMPTS_DIR);
  fs.writeFileSync(RECALIBRATION_PROMPT_FILE, DEFAULT_RECALIBRATION_PROMPT);
  console.log(`  Seeded default re-calibration prompt: ${RECALIBRATION_PROMPT_FILE}`);
  return DEFAULT_RECALIBRATION_PROMPT;
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
 * Parse a page-narration response: a JSON object with `narration` and
 * `bubbles`, plus optional `bible`. Falls back, for a malformed/truncated
 * response, to recovering the bubble objects by their shape and the narration
 * string by a best-effort match — the bible is sacrificed, which is harmless
 * (the next page still carries the prior bible).
 */
function parseNarrationResponse(
  raw: string,
): { narration: string; bubbles: any[]; bible: BibleUpdates | null } {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
  const text = (fenced ? fenced[1] : raw).trim();

  try {
    const v = JSON.parse(text);
    if (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.bubbles)) {
      return {
        narration: typeof v.narration === 'string' ? v.narration.trim() : '',
        bubbles: v.bubbles,
        bible: (v.bible && typeof v.bible === 'object') ? v.bible : null,
      };
    }
    if (Array.isArray(v)) return { narration: '', bubbles: v, bible: null };
  } catch { /* fall through to recovery */ }

  // Recovery — scan every object, keep the bubble-shaped ones (have english /
  // original); recover the narration best-effort from its JSON string value.
  // Bible updates are dropped; that's an acceptable loss.
  const bubbles = scanObjects(text).filter(
    (o) => o && (typeof o.english === 'string' || typeof o.original === 'string'),
  );
  let narration = '';
  const nm = text.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (nm) {
    try { narration = JSON.parse(`"${nm[1]}"`); } catch { /* leave empty */ }
  }
  if (bubbles.length === 0 && !narration) {
    throw new Error(`Model returned unparseable output: ${raw.slice(0, 200)}`);
  }
  console.warn(`  Narrate: recovered ${bubbles.length} bubbles from a malformed response`);
  return { narration, bubbles, bible: null };
}

/**
 * Parse a re-calibration response: `{ pages: [{page, narration}], bible }`.
 * Recovery scans for the page-shaped objects; the bible is sacrificed on a
 * malformed response (the chapter keeps its model-built bible).
 */
function parseRecalibrationResponse(
  raw: string,
): { pages: Array<{ page: number; narration: string }>; bible: BibleUpdates | null } {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
  const text = (fenced ? fenced[1] : raw).trim();

  const pick = (arr: any[]) => arr
    .filter((p) => p && typeof p.page === 'number' && typeof p.narration === 'string')
    .map((p) => ({ page: p.page as number, narration: String(p.narration).trim() }));

  try {
    const v = JSON.parse(text);
    if (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.pages)) {
      return { pages: pick(v.pages), bible: (v.bible && typeof v.bible === 'object') ? v.bible : null };
    }
  } catch { /* fall through to recovery */ }

  // Recovery — a truncated response leaves a partial `{"pages":[ {…},{…},…`.
  // scanObjects finds only TOP-LEVEL objects, but the page objects are nested
  // inside the "pages" array — so scan the slice after the array's opening
  // bracket, where each page object is itself top-level. The trailing
  // incomplete object (and the bible) are lost; the complete pages survive.
  const pagesKey = text.indexOf('"pages"');
  const arrStart = pagesKey >= 0 ? text.indexOf('[', pagesKey) : -1;
  const pages = arrStart >= 0 ? pick(scanObjects(text.slice(arrStart + 1))) : [];
  if (pages.length === 0) {
    throw new Error(`Re-calibration returned unparseable output: ${raw.slice(0, 200)}`);
  }
  console.warn(`  Recalibrate: recovered ${pages.length} pages from a malformed response`);
  return { pages, bible: null };
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
 * Narrate a single page: render it, hand the image + the current story bible
 * to the vision model, and parse back the page's narration, its bubbles (the
 * citation layer), and the bible updates the model proposes.
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

  const prompt = fillTemplate(getNarrationPrompt(), {
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

  const { narration, bubbles: rawBubbles, bible: bibleUpdates } = parseNarrationResponse(raw);

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
      narration,
      bubbles,
      modelUsed: cfg.translateModel,
      translatedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
    },
    bibleUpdates,
  };
}

// ==================== Re-calibration ====================

/**
 * The "tell it" pass: after a chapter has been narrated page by page,
 * harmonize the whole thing against the now-complete bible. One text call (no
 * images) — fix what early pages guessed, unify the narrator's voice, smooth
 * the arc, finalize the bible. A polish, never a re-translation.
 *
 * Writes the harmonized narration back into each p<N>.json and replaces the
 * bible with the finalized one. Safe to fail: the per-page narration already
 * stands on its own; this only improves consistency.
 */
export async function recalibrateChapter(
  seriesId: string,
  file: string,
): Promise<{ recalibrated: number }> {
  const cfg = getTranslationConfig();

  // Gather the per-page narration already on disk.
  const pageNums = getCachedPageNumbers(seriesId, file);
  const pages: Array<{ page: number; narration: string }> = [];
  for (const n of pageNums) {
    const t = getCachedTranslation(seriesId, file, n);
    if (t && t.narration && t.narration.trim()) pages.push({ page: n, narration: t.narration });
  }
  if (pages.length === 0) return { recalibrated: 0 };

  const series = getSeries(seriesId);
  const prompt = fillTemplate(getRecalibrationPrompt(), {
    title: series?.englishTitle || series?.name || '(unknown title)',
    bible: formatBibleForPrompt(loadBible(seriesId)),
    pages: pages.map((p) => `--- Page ${p.page} ---\n${p.narration}`).join('\n\n'),
  });

  const raw = await callOllama({
    cfg,
    model: cfg.translateModel,
    prompt,
    numCtx: 32768,     // the whole chapter's narration + the bible + the response
    numPredict: 20480, // re-emitting every page's narration is large: a 12k cap
                       // truncated a 55-page chapter mid-JSON. Give output most
                       // of the 32k window — recovery (parseRecalibrationResponse)
                       // still salvages the pages if a very long chapter
                       // overruns even this.
    temperature: 0.4,
    repeatPenalty: 1.1,
  });

  const { pages: harmonized, bible: finalBible } = parseRecalibrationResponse(raw);

  // Write the harmonized narration back, leaving the bubbles untouched.
  const byPage = new Map(harmonized.map((h) => [h.page, h.narration]));
  let recalibrated = 0;
  for (const n of pageNums) {
    const next = byPage.get(n);
    if (!next) continue; // a page the pass missed keeps its per-page narration
    const t = getCachedTranslation(seriesId, file, n);
    if (!t) continue;
    saveTranslation(seriesId, file, n, { ...t, narration: next });
    recalibrated++;
  }

  // Replace the bible with the finalized, deduplicated one.
  if (finalBible) saveBible(seriesId, applyBibleUpdates(emptyBible(), finalBible));

  return { recalibrated };
}

// ==================== Orchestration ====================

export interface ChapterTranslateStats {
  totalPages: number;
  translated: number;   // pages narrated this run (or already cached)
  failed: number;       // pages the model could not narrate
  recalibrated: number; // pages harmonized by the re-calibration pass
  totalMs: number;
}

// A translation run is long and talks to a local model server over the
// network; transient drops ("fetch failed" / "terminated") are expected.
// Each page gets a few attempts before it's counted as failed.
const MAX_PAGE_ATTEMPTS = 3;

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
      // Retry a page a few times with a backoff — a transient network drop
      // mid-chapter shouldn't abandon it.
      for (let attempt = 1; attempt <= MAX_PAGE_ATTEMPTS; attempt++) {
        try {
          const { translation, bibleUpdates } = await translatePage(seriesId, file, i, bible, cfg);
          saveTranslation(seriesId, file, i, translation);
          if (bibleUpdates) {
            bible = applyBibleUpdates(bible, bibleUpdates);
            saveBible(seriesId, bible);
          }
          translated++;
          break;
        } catch (err) {
          const msg = (err as Error).message;
          if (attempt < MAX_PAGE_ATTEMPTS) {
            console.warn(`  Translate page ${i + 1}/${totalPages} attempt ${attempt} failed (${msg}) — retrying in ${15 * attempt}s`);
            await new Promise((r) => setTimeout(r, 15000 * attempt));
          } else {
            console.error(`  Translate page ${i + 1}/${totalPages} failed after ${MAX_PAGE_ATTEMPTS} attempts: ${msg}`);
            failed++;
          }
        }
      }
      opts.onProgress?.(i + 1, totalPages);
    }

    // Read -> tell: harmonize the whole chapter against the finished bible.
    // A polish — if it fails, the per-page narration still stands on its own.
    let recalibrated = 0;
    if (translated > 0) {
      try {
        console.log(`  Re-calibrating "${seriesId}/${file}"...`);
        recalibrated = (await recalibrateChapter(seriesId, file)).recalibrated;
      } catch (err) {
        console.error(`  Re-calibration failed: ${(err as Error).message}`);
      }
    }

    return { totalPages, translated, failed, recalibrated, totalMs: Date.now() - t0 };
  } finally {
    activeChapters.delete(chapterKey(seriesId, file));
  }
}
