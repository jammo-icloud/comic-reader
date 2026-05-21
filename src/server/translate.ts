/**
 * Manga translation — two-pass pipeline (Ollama).
 *
 * Pass 1 — EXTRACT (vision model): renders each PDF page to JPEG and OCRs it
 *   into ordered text bubbles. Cached per page as extract-p<N>.json. This is
 *   the slow, page-by-page pass.
 *
 * Pass 2 — LOCALIZE (text model): takes the whole chapter's transcript plus
 *   series context (synopsis, genres, AniList character list) and a honorific
 *   policy, and produces polished English for every line in a single call.
 *   Seeing the entire chapter at once is what keeps character names, places
 *   and tone consistent. Written per page as p<N>.json — the format the
 *   reader consumes.
 *
 * The two prompts live as editable markdown files under data/prompts/ so they
 * can be tuned without a rebuild; they are seeded from the defaults below on
 * first run.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import * as mupdf from 'mupdf';
import { resolveComicPath } from './scanner.js';
import { getSeries, type SeriesCharacter } from './data.js';
import { shortHash } from './hash.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const TRANSLATIONS_DIR = path.join(DATA_DIR, 'translations');
const PROMPTS_DIR = path.join(DATA_DIR, 'prompts');
const CONFIG_FILE = path.join(DATA_DIR, 'translation-config.json');
const EXTRACT_PROMPT_FILE = path.join(PROMPTS_DIR, 'translate-extract.md');
const LOCALIZE_PROMPT_FILE = path.join(PROMPTS_DIR, 'translate-localize.md');

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

/** A single text region found on a page during Pass 1 (OCR/extract). */
export interface ExtractedBubble {
  order: number;
  text: string;       // original-language text, transcribed verbatim
  type: string;       // speech | thought | narration | sfx | sign
  bbox: BBox | null;  // where the text sits on the page (null if not located)
}

/** Pass 1 result for one page — cached as extract-p<N>.json. */
export interface PageExtraction {
  page: number;
  bubbles: ExtractedBubble[];
  modelUsed: string;
  extractedAt: string;
  durationMs: number;
}

/**
 * A translated bubble. `japanese` holds the ORIGINAL text whatever the source
 * language actually is — the field name is kept for backwards compatibility
 * with the reader's cached p<N>.json files. `type` and `bbox` ride through
 * from Pass 1 so the reader can draw the English back into the bubble.
 */
export interface TranslatedBubble {
  order: number;
  japanese: string;
  english: string;
  type: string;
  bbox: BBox | null;
}

/** Pass 2 result for one page — cached as p<N>.json, consumed by the reader. */
export interface PageTranslation {
  bubbles: TranslatedBubble[];
  modelUsed: string;
  translatedAt: string;
  durationMs: number;
}

export type HonorificPolicy = 'keep' | 'drop' | 'localize';

export interface TranslationConfig {
  url: string;                     // Ollama base URL, e.g. "http://5090.local:11434"
  visionModel: string;             // Pass 1 — OCR/extract (must be vision-capable)
  textModel: string;               // Pass 2 — localize (a text-only model is fine)
  honorificPolicy: HonorificPolicy; // how -san/-kun/-chan etc. are handled
}

// ==================== Defaults ====================

// Pass 1 needs more than vision — it must LOCATE each text box on the page,
// so the default is qwen3-vl, the grounding-tuned model. Pass 2 is pure text
// (no image), so the larger qwen3.6 carries the localization quality.
const DEFAULT_CONFIG: TranslationConfig = {
  url: '',
  visionModel: 'qwen3-vl',
  textModel: 'qwen3.6',
  honorificPolicy: 'keep',
};

function isHonorificPolicy(v: any): v is HonorificPolicy {
  return v === 'keep' || v === 'drop' || v === 'localize';
}

/** Pass 1 default. Stable — this is an OCR + grounding instruction. */
const DEFAULT_EXTRACT_PROMPT = `# Manga Page Text Extraction

You are extracting text from a single comic page so it can be translated
later, and locating each piece of text so the translation can be drawn back
in its place. This is an OCR + grounding pass — do not translate anything.

Find every piece of text on the page: speech bubbles, thought bubbles,
narration boxes, sound effects, and signs or background text. For each one,
record four things:

- **order** — reading order as a 1-indexed number. Japanese manga reads
  right-to-left, top-to-bottom. Korean and Chinese webtoons read
  top-to-bottom. Place narration and signs where a reader would naturally
  encounter them.
- **text** — the original text exactly as printed, in its original language.
  Do not translate, romanize, or "correct" it.
- **type** — one of: speech, thought, narration, sfx, sign.
- **box** — the bounding box of the text, as [x1, y1, x2, y2]: the top-left
  and bottom-right corners enclosing the printed characters. Coordinates are
  integers from 0 to 1000, measured from the top-left of the page (0,0 is the
  top-left corner, 1000,1000 the bottom-right). Enclose the text snugly — the
  translation is drawn into this box, so it should sit within the bubble's
  clear interior, not spill onto the artwork.

Rules:

- For long stretched sound effects or screams ("あああああ", "!!!!!"), record
  at most 4-5 characters. Never transcribe 30 characters of screaming.
- Skip empty or unreadable bubbles.
- If the page has no text at all, return an empty array.

Return STRICT JSON only — no prose, no markdown code fences. An array of
objects:

[{"order": 1, "text": "こんにちは", "type": "speech", "box": [610, 80, 880, 300]}]
`;

/**
 * Pass 2 default — the tunable one. Placeholders are filled at request time:
 * {{title}} {{synopsis}} {{genres}} {{characters}} {{honorificPolicy}}
 * {{transcript}}. Edit data/prompts/translate-localize.md to iterate.
 */
const DEFAULT_LOCALIZE_PROMPT = `# Manga Chapter Localization

You are localizing a full comic chapter into natural English. A vision model
has already transcribed every text bubble; your job is to turn that raw
transcript into the final English script.

## What matters most

**Narration over literal accuracy.** The goal is an enjoyable read that
flows — the reader should forget this was ever another language. Consistent
character names, place names and recurring terms matter far more than
word-for-word fidelity. When a literal rendering would read awkwardly,
rewrite it so it reads well in English.

You can see the entire chapter at once. Use that: keep each character's voice
and tone consistent from the first page to the last, and resolve ambiguous
lines using the lines around them.

## Series context

**Title:** {{title}}

**Synopsis:** {{synopsis}}

**Genres & themes:** {{genres}}

**Characters** — use exactly these spellings for character names; do not
invent your own romanizations:

{{characters}}

## Honorifics

{{honorificPolicy}}

## Transcript

Each line is formatted \`page.order [type] original text\`. Translate the text
of every line. Lines of type \`sfx\` may stay as short English onomatopoeia.

{{transcript}}

## Output

Return STRICT JSON only — no prose, no markdown code fences. An array with one
object per transcript line, in the same order:

[{"page": 0, "order": 1, "english": "Hello there."}]

Every page/order pair from the transcript must appear exactly once.
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
 * Normalize a stored config to the current shape. v1 had a single `model`
 * field plus an inline `prompt`; v2 splits the model into visionModel +
 * textModel and moves prompts to editable markdown files. An old `model`
 * value seeds BOTH new model fields so an upgraded install keeps working.
 */
function migrateConfig(raw: any): TranslationConfig {
  const cfg: TranslationConfig = { ...DEFAULT_CONFIG };
  if (typeof raw?.url === 'string') cfg.url = raw.url;
  if (typeof raw?.visionModel === 'string' && raw.visionModel.trim()) {
    cfg.visionModel = raw.visionModel.trim();
  } else if (typeof raw?.model === 'string' && raw.model.trim()) {
    cfg.visionModel = raw.model.trim();
  }
  if (typeof raw?.textModel === 'string' && raw.textModel.trim()) {
    cfg.textModel = raw.textModel.trim();
  } else if (typeof raw?.model === 'string' && raw.model.trim()) {
    cfg.textModel = raw.model.trim();
  }
  if (isHonorificPolicy(raw?.honorificPolicy)) cfg.honorificPolicy = raw.honorificPolicy;
  return cfg;
}

export function saveTranslationConfig(partial: Partial<TranslationConfig>): TranslationConfig {
  ensureDir(DATA_DIR);
  const current = getTranslationConfig();
  // Whitelist v2 keys only — never persist legacy `model` / `prompt` fields.
  const next: TranslationConfig = {
    url: typeof partial.url === 'string' ? partial.url.trim() : current.url,
    visionModel: typeof partial.visionModel === 'string' && partial.visionModel.trim()
      ? partial.visionModel.trim() : current.visionModel,
    textModel: typeof partial.textModel === 'string' && partial.textModel.trim()
      ? partial.textModel.trim() : current.textModel,
    honorificPolicy: isHonorificPolicy(partial.honorificPolicy)
      ? partial.honorificPolicy : current.honorificPolicy,
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

export function isTranslationEnabled(): boolean {
  return !!getTranslationConfig().url;
}

// ==================== Prompt files ====================

/**
 * Read a prompt markdown file, seeding it with the bundled default the first
 * time. After the first run the file exists on disk for the admin to edit.
 */
function readOrSeedPrompt(file: string, fallback: string): string {
  if (fs.existsSync(file)) {
    // The file exists — a read failure here is a real error and must surface,
    // not silently re-seed (that would clobber an admin's edited prompt).
    const content = fs.readFileSync(file, 'utf-8');
    return content.trim() ? content : fallback;
  }
  ensureDir(PROMPTS_DIR);
  fs.writeFileSync(file, fallback);
  console.log(`  Seeded default translation prompt: ${file}`);
  return fallback;
}

// ==================== Cache ====================

function translationDir(seriesId: string, file: string): string {
  return path.join(TRANSLATIONS_DIR, seriesId, shortHash(file));
}

function extractionPath(seriesId: string, file: string, page: number): string {
  return path.join(translationDir(seriesId, file), `extract-p${page}.json`);
}

function translationPath(seriesId: string, file: string, page: number): string {
  return path.join(translationDir(seriesId, file), `p${page}.json`);
}

export function getCachedExtraction(seriesId: string, file: string, page: number): PageExtraction | null {
  const p = extractionPath(seriesId, file, page);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
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

function saveExtraction(seriesId: string, file: string, page: number, result: PageExtraction): void {
  ensureDir(translationDir(seriesId, file));
  fs.writeFileSync(extractionPath(seriesId, file, page), JSON.stringify(result, null, 2));
}

function saveTranslation(seriesId: string, file: string, page: number, result: PageTranslation): void {
  ensureDir(translationDir(seriesId, file));
  fs.writeFileSync(translationPath(seriesId, file, page), JSON.stringify(result, null, 2));
}

function scanCacheNumbers(seriesId: string, file: string, re: RegExp): number[] {
  const dir = translationDir(seriesId, file);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map((f) => {
      const m = f.match(re);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
}

/** Pages with a finished Pass 2 translation (p<N>.json). */
export function getCachedPageNumbers(seriesId: string, file: string): number[] {
  return scanCacheNumbers(seriesId, file, /^p(\d+)\.json$/);
}

/** Pages with a cached Pass 1 extraction (extract-p<N>.json). */
export function getExtractedPageNumbers(seriesId: string, file: string): number[] {
  return scanCacheNumbers(seriesId, file, /^extract-p(\d+)\.json$/);
}

// ==================== In-progress tracking ====================

// Chapters currently being translated (in-memory; cleared on restart). The
// status endpoint exposes this so the admin UI can show live progress even
// when re-localizing a chapter whose p<N>.json files already exist.
const activeChapters = new Set<string>();
const chapterKey = (seriesId: string, file: string): string => `${seriesId} ${file}`;

export function isChapterTranslating(seriesId: string, file: string): boolean {
  return activeChapters.has(chapterKey(seriesId, file));
}

// ==================== Page rendering ====================

/**
 * Render a PDF page to a JPEG buffer at a resolution good for OCR. Too small
 * and text is unreadable; too large wastes time and tokens. ~1600px on the
 * long edge is a good balance.
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
  return await sharp(Buffer.from(pixmap.asPNG()))
    .jpeg({ quality: 85 })
    .toBuffer();
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
      stream: false,
      // think:false — the Qwen 3.5/3.6 generation is thinking-capable, but a
      // chain-of-thought on an OCR / structured-JSON task only burns tokens
      // and risks polluting the output. Disable it. Harmless on non-thinking
      // models (verified: response stays clean, no separate thinking field).
      think: false,
      // NOTE: no format:'json' — it makes Qwen-VL return an empty {} instead
      // of doing the vision work. We parse JSON from the response ourselves.
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
  const json = await res.json();
  return (json.response || '').trim();
}

// ==================== JSON recovery ====================

/**
 * Scan a string for complete top-level {...} objects, JSON-parsing each. Used
 * to recover usable data from a response truncated mid-array by the token
 * limit.
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
        // A malformed trailing object is expected on a truncated response;
        // skip it and keep the complete ones already scanned.
        try { objects.push(JSON.parse(text.slice(start, i + 1))); } catch { /* skip */ }
        start = -1;
      }
    }
  }
  return objects;
}

/**
 * Parse a JSON array out of a model response, with progressive fallbacks for
 * the ways local models go off-script: markdown fences, leading prose, and
 * arrays truncated by the token limit. Throws if nothing usable is found.
 */
function parseModelArray(raw: string): any[] {
  // 1. Clean parse.
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.bubbles)) return v.bubbles;
    if (v && Array.isArray(v.lines)) return v.lines;
    if (v && typeof v === 'object') return [v];
  } catch { /* try the next strategy */ }

  // 2. Strip a markdown code fence if the model added one.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
  let candidate = (fenced ? fenced[1] : raw).trim();

  // 3. Drop any leading prose before the array.
  const arrStart = candidate.indexOf('[');
  if (arrStart > 0) candidate = candidate.slice(arrStart);
  try {
    const v = JSON.parse(candidate);
    if (Array.isArray(v)) return v;
  } catch { /* fall through to recovery */ }

  // 4. Recover whatever complete objects we can from a truncated array.
  const recovered = scanObjects(candidate);
  if (recovered.length > 0) {
    console.warn(`  Translate: recovered ${recovered.length} objects from a malformed response`);
    return recovered;
  }

  throw new Error(`Model returned unparseable output: ${raw.slice(0, 200)}`);
}

// ==================== Pass 1 — Extract ====================

/**
 * Convert a model-supplied bounding box to a normalized BBox (0–1 page
 * fractions). The extract prompt asks for [x1,y1,x2,y2] integers on a 0–1000
 * grid; this tolerates swapped corners and clamps the result inside the page.
 * Returns null for a missing or degenerate box so the reader can skip it.
 */
function parseBox(box: any): BBox | null {
  if (!Array.isArray(box) || box.length < 4) return null;
  const n = box.slice(0, 4).map(Number);
  if (n.some((v) => !Number.isFinite(v))) return null;
  const x = Math.max(0, Math.min(1, Math.min(n[0], n[2]) / 1000));
  const y = Math.max(0, Math.min(1, Math.min(n[1], n[3]) / 1000));
  const w = Math.max(0, Math.min(1 - x, Math.abs(n[2] - n[0]) / 1000));
  const h = Math.max(0, Math.min(1 - y, Math.abs(n[3] - n[1]) / 1000));
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

/**
 * Pass 1 — OCR a single page into ordered text bubbles. Returns the cached
 * extraction unless `force` is set.
 */
export async function extractPage(
  seriesId: string,
  file: string,
  page: number,
  force = false,
): Promise<PageExtraction> {
  if (!force) {
    const cached = getCachedExtraction(seriesId, file, page);
    if (cached) return cached;
  }

  const cfg = getTranslationConfig();
  if (!cfg.url) throw new Error('Translation service not configured. Set the URL in admin settings.');

  const pdfPath = resolveComicPath(seriesId, file);
  if (!pdfPath || !fs.existsSync(pdfPath)) throw new Error(`File not found: ${seriesId}/${file}`);

  const t0 = Date.now();
  const jpeg = await renderPageToJpeg(pdfPath, page);
  const raw = await callOllama({
    cfg,
    model: cfg.visionModel,
    prompt: readOrSeedPrompt(EXTRACT_PROMPT_FILE, DEFAULT_EXTRACT_PROMPT),
    images: [jpeg.toString('base64')],
    numCtx: 8192,
    numPredict: 2048,
    temperature: 0.2,
    repeatPenalty: 1.3, // suppresses "あああ..."-style SFX repetition loops
  });

  const bubbles: ExtractedBubble[] = parseModelArray(raw)
    .filter((b) => b && typeof b.text === 'string' && b.text.trim())
    .map((b, i) => ({
      order: typeof b.order === 'number' ? b.order : i + 1,
      text: String(b.text).trim(),
      type: typeof b.type === 'string' ? b.type : 'speech',
      bbox: parseBox(b.box),
    }))
    .sort((a, b) => a.order - b.order);

  const result: PageExtraction = {
    page,
    bubbles,
    modelUsed: cfg.visionModel,
    extractedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
  };
  saveExtraction(seriesId, file, page, result);
  return result;
}

// ==================== Pass 2 — Localize ====================

/** Render the AniList cast as a bullet list for the {{characters}} slot. */
function formatCharacters(characters: SeriesCharacter[] | null | undefined): string {
  if (!characters || characters.length === 0) return '(no character list available)';
  return characters
    .map((c) => {
      const native = c.nativeName ? ` (${c.nativeName})` : '';
      const role = c.role ? ` — ${c.role}` : '';
      return `- ${c.name}${native}${role}`;
    })
    .join('\n');
}

/** Substitute {{placeholder}} tokens; unknown placeholders are left intact. */
function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => (key in vars ? vars[key] : `{{${key}}}`));
}

/**
 * Pass 2 — localize a whole chapter from its page extractions in a single
 * model call, then write the per-page p<N>.json files the reader consumes.
 *
 * A page that had text but came back empty (usually Pass 2 output truncation)
 * is left untouched and counted as failed, so a re-run can finish it without
 * destroying a translation that already exists.
 */
async function localizeChapter(
  seriesId: string,
  file: string,
  extractions: PageExtraction[],
): Promise<{ localizedPages: number; failedPages: number }> {
  const cfg = getTranslationConfig();

  // Build the transcript: one line per bubble, "page.order [type] text".
  const lines: string[] = [];
  for (const ex of extractions) {
    for (const b of ex.bubbles) {
      lines.push(`${ex.page}.${b.order} [${b.type}] ${b.text}`);
    }
  }

  // A chapter of entirely blank pages still needs p<N>.json so the reader and
  // the progress UI see it as done.
  if (lines.length === 0) {
    for (const ex of extractions) {
      saveTranslation(seriesId, file, ex.page, {
        bubbles: [],
        modelUsed: cfg.textModel,
        translatedAt: new Date().toISOString(),
        durationMs: 0,
      });
    }
    return { localizedPages: extractions.length, failedPages: 0 };
  }

  const series = getSeries(seriesId);
  const prompt = fillTemplate(readOrSeedPrompt(LOCALIZE_PROMPT_FILE, DEFAULT_LOCALIZE_PROMPT), {
    title: series?.englishTitle || series?.name || '(unknown title)',
    synopsis: series?.synopsis?.trim() || '(no synopsis available)',
    genres: series?.tags?.length ? series.tags.join(', ') : '(none listed)',
    characters: formatCharacters(series?.characters),
    honorificPolicy: HONORIFIC_INSTRUCTIONS[cfg.honorificPolicy],
    transcript: lines.join('\n'),
  });

  const t0 = Date.now();
  const raw = await callOllama({
    cfg,
    model: cfg.textModel,
    prompt,
    numCtx: 32768,    // whole-chapter transcript + prompt + the JSON response
    numPredict: 8192,
    temperature: 0.4, // a little room for natural prose
    repeatPenalty: 1.1,
  });
  const durationMs = Date.now() - t0;

  // Map the localized lines back by "page.order".
  const englishByKey = new Map<string, string>();
  for (const item of parseModelArray(raw)) {
    if (item && typeof item.page === 'number' && typeof item.order === 'number'
        && typeof item.english === 'string') {
      englishByKey.set(`${item.page}.${item.order}`, item.english.trim());
    }
  }

  let localizedPages = 0, failedPages = 0;
  for (const ex of extractions) {
    const bubbles: TranslatedBubble[] = ex.bubbles.map((b) => ({
      order: b.order,
      japanese: b.text,
      english: englishByKey.get(`${ex.page}.${b.order}`) || '',
      type: b.type,
      bbox: b.bbox,
    }));

    // A page that had text but got nothing back was missed by Pass 2. Leave
    // its existing p<N>.json (if any) so a re-run can finish it.
    if (ex.bubbles.length > 0 && !bubbles.some((b) => b.english)) {
      failedPages++;
      continue;
    }
    saveTranslation(seriesId, file, ex.page, {
      bubbles,
      modelUsed: cfg.textModel,
      translatedAt: new Date().toISOString(),
      durationMs,
    });
    localizedPages++;
  }

  return { localizedPages, failedPages };
}

// ==================== Orchestration ====================

export interface ChapterTranslateStats {
  totalPages: number;
  extracted: number;      // pages OCR'd successfully in Pass 1
  ocrFailed: number;      // pages Pass 1 could not OCR
  localizedPages: number; // pages with a finished Pass 2 translation
  localizeFailed: number; // pages Pass 2 missed (e.g. output truncation)
  totalMs: number;
}

/**
 * Translate an entire chapter end to end.
 *
 *  - force=true       re-runs OCR on every page (ignores cached extractions)
 *  - relocalize=true  reuses cached OCR, only re-runs Pass 2 — the fast loop
 *                     for iterating on translate-localize.md
 *  - neither          OCRs pages not cached yet, then localizes if any page
 *                     still lacks a translation
 *
 * Both force and relocalize re-run Pass 2 unconditionally.
 */
export async function translateChapter(
  seriesId: string,
  file: string,
  opts: {
    force?: boolean;
    relocalize?: boolean;
    onProgress?: (done: number, total: number) => void;
  } = {},
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
    // --- Pass 1: extract every page ---
    const extractions: PageExtraction[] = [];
    let extracted = 0, ocrFailed = 0;
    for (let i = 0; i < totalPages; i++) {
      try {
        extractions.push(await extractPage(seriesId, file, i, opts.force));
        extracted++;
      } catch (err) {
        console.error(`  Extract page ${i + 1}/${totalPages} failed: ${(err as Error).message}`);
        ocrFailed++;
      }
      opts.onProgress?.(i + 1, totalPages);
    }

    // --- Pass 2: localize the chapter as a whole ---
    const alreadyTranslated = new Set(getCachedPageNumbers(seriesId, file));
    const incomplete = extractions.some((ex) => !alreadyTranslated.has(ex.page));
    let localizedPages = alreadyTranslated.size, localizeFailed = 0;

    if (extractions.length > 0 && (opts.force || opts.relocalize || incomplete)) {
      console.log(`  Localizing "${seriesId}/${file}" — ${extractions.length} pages in one pass`);
      const r = await localizeChapter(seriesId, file, extractions);
      localizedPages = r.localizedPages;
      localizeFailed = r.failedPages;
    }

    return { totalPages, extracted, ocrFailed, localizedPages, localizeFailed, totalMs: Date.now() - t0 };
  } finally {
    activeChapters.delete(chapterKey(seriesId, file));
  }
}
