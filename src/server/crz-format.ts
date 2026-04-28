/**
 * Comic Reader Zip (.crz) format spec.
 *
 * v1: import-only legacy format. Carries the bare minimum (title, tags, synopsis,
 *     chapters, cover) plus a sourceId hint. Loses score/malId/englishTitle/etc.
 * v2: round-trip format. Adds the missing SeriesRecord fields, per-chapter `order`
 *     (preserves .5 chapters), per-chapter pre-counted `pages`, provenance, NSFW flag,
 *     and an optional translations bundle.
 *
 * Importers must dispatch on `formatVersion`. v1 must remain readable forever.
 *
 * Out of scope for v2 (deferred to backup-mode formats):
 *   - per-user reading progress
 *   - subscription binding (syncSource / lastSyncAt)
 *   - thumbnails (re-derivable from PDFs)
 *   - any other instance-local state
 *
 * Zip layout for v2:
 *   manifest.json
 *   cover.jpg                            (optional; may be omitted in parts > 0)
 *   chapters/<original-filename>.pdf     (one per chapter in this part)
 *   translations/<original-filename>/p<N>.json   (optional, only if hasTranslations)
 *
 * Translations are keyed by chapter FILENAME inside the zip, not by hash.
 * On disk they live at  data/translations/<seriesId>/<shortHash(file)>/p<N>.json
 * Exporting hashes the source filename to find them; importing re-hashes the
 * destination filename (which may differ after conflict resolution) to place them.
 *
 * --- Multi-part contract (Pattern A: self-contained parts) ---
 *
 * Multi-part export is a *producer-side* concern — comic-reader's server can
 * stream gigabytes to HTTP with no memory pressure, so it always emits a single
 * part (partIndex: 0, totalParts: 1). Manga-finder MUST split because Chrome
 * MV3 service workers cap working memory and JSZip builds zips in memory.
 *
 * Contract:
 *   - Every part carries the full series manifest (title, tags, score, etc.).
 *     Any individual part is independently importable as a working series with
 *     just its slice of chapters.
 *   - `chapters[]` contains ONLY the chapters in this part.
 *   - `coverFile` MAY be `null` in parts > 0 to avoid duplicating cover bytes.
 *     The importer keeps the first cover it sees.
 *   - Importer is additive and stateless across parts: each part is merged in
 *     independently (skip-by-filename). No "wait for all parts" logic.
 *   - If only K of N parts ever arrive, the series has K parts' worth of
 *     chapters and is otherwise complete.
 *   - Group key: `originSeriesId`. The importer slug-or-title-matches the
 *     destination series the same way for every part.
 */

// ============================================================
// v1 — legacy, import-only
// ============================================================

export interface CrzManifestV1 {
  formatVersion: 1;
  title: string;
  sourceId: string;
  tags: string[];
  synopsis: string | null;
  status: string | null;
  year: number | null;
  coverFile: string | null;
  chapters: Array<{ file: string; chapter: string }>;
  partIndex: number;
  totalParts: number;
}

// ============================================================
// v2 — current format
// ============================================================

export interface CrzManifestV2 {
  formatVersion: 2;

  // --- Provenance ---
  /** Hostname of the instance that produced this CRZ. Diagnostic only. */
  exportedFrom: string;
  /** ISO 8601 timestamp of export. */
  exportedAt: string;
  /** package.json version of the exporter. Diagnostic only. */
  exporterVersion: string;
  /** The series.id on the source instance. Lets importers detect re-imports. */
  originSeriesId: string;

  // --- Multi-part (Pattern A: self-contained parts) ---
  /** 0-based part index. 0 for single-part exports. */
  partIndex: number;
  /** Total number of parts in this export set. 1 for single-part exports. */
  totalParts: number;

  // --- Series metadata (mirrors SeriesRecord, minus instance-local fields) ---
  type: 'comic' | 'magazine';
  /** Maps to SeriesRecord.name on import. */
  title: string;
  englishTitle: string | null;
  synopsis: string | null;
  status: string | null;
  year: number | null;
  score: number | null;
  malId: number | null;
  mangaDexId: string | null;
  tags: string[];
  placeholder: string;
  /** Computed from tags. Surfaced at top level so safeMode can warn pre-extraction. */
  nsfw: boolean;

  // --- Assets ---
  /** Path inside the zip (typically "cover.jpg"), or null if no cover. */
  coverFile: string | null;

  /**
   * Each entry's `file` is the path inside the zip
   * (typically "chapters/<original-filename>.pdf").
   * `chapter` is the human label ("5", "5.5", "Oneshot").
   * `order` preserves sort fidelity (.5 chapters survive).
   * `pages` is pre-counted at export time so importers can skip the recount.
   */
  chapters: Array<{
    file: string;
    chapter: string;
    order: number;
    pages: number;
  }>;

  /**
   * If true, the zip contains a translations/ tree keyed by chapter filename.
   * If false, no translations were bundled (either none existed or the user opted out).
   */
  hasTranslations: boolean;
}

export type CrzManifest = CrzManifestV1 | CrzManifestV2;

// ============================================================
// Type guards
// ============================================================

export function isV1(m: { formatVersion: number }): m is CrzManifestV1 {
  return m.formatVersion === 1;
}

export function isV2(m: { formatVersion: number }): m is CrzManifestV2 {
  return m.formatVersion === 2;
}

// ============================================================
// Runtime validator (cheap; covers shape, not deep semantic checks)
// ============================================================

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateManifest(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['manifest is not an object'] };
  }
  const m = input as Record<string, unknown>;
  const v = m.formatVersion;
  if (v !== 1 && v !== 2) {
    return { ok: false, errors: [`unsupported formatVersion: ${String(v)}`] };
  }

  if (typeof m.title !== 'string' || !m.title) errors.push('title must be a non-empty string');
  if (!Array.isArray(m.chapters)) errors.push('chapters must be an array');
  else if (m.chapters.length === 0) errors.push('chapters must not be empty');

  if (v === 2) {
    const required: Array<[string, string]> = [
      ['exportedAt', 'string'],
      ['originSeriesId', 'string'],
      ['type', 'string'],
      ['placeholder', 'string'],
    ];
    for (const [k, t] of required) {
      if (typeof m[k] !== t) errors.push(`${k} must be a ${t}`);
    }
    if (m.type !== 'comic' && m.type !== 'magazine') {
      errors.push(`type must be 'comic' or 'magazine'`);
    }
    if (typeof m.nsfw !== 'boolean') errors.push('nsfw must be a boolean');
    if (typeof m.hasTranslations !== 'boolean') errors.push('hasTranslations must be a boolean');
    if (typeof m.partIndex !== 'number' || m.partIndex < 0) {
      errors.push('partIndex must be a non-negative integer');
    }
    if (typeof m.totalParts !== 'number' || m.totalParts < 1) {
      errors.push('totalParts must be a positive integer');
    }
    if (
      typeof m.partIndex === 'number' &&
      typeof m.totalParts === 'number' &&
      m.partIndex >= m.totalParts
    ) {
      errors.push(`partIndex (${m.partIndex}) must be less than totalParts (${m.totalParts})`);
    }
    if (!Array.isArray(m.tags)) errors.push('tags must be an array');
    if (Array.isArray(m.chapters)) {
      for (let i = 0; i < (m.chapters as unknown[]).length; i++) {
        const c = (m.chapters as unknown[])[i] as Record<string, unknown> | null;
        if (!c || typeof c !== 'object') {
          errors.push(`chapters[${i}] must be an object`);
          continue;
        }
        if (typeof c.file !== 'string') errors.push(`chapters[${i}].file must be a string`);
        if (typeof c.chapter !== 'string') errors.push(`chapters[${i}].chapter must be a string`);
        if (typeof c.order !== 'number') errors.push(`chapters[${i}].order must be a number`);
        if (typeof c.pages !== 'number') errors.push(`chapters[${i}].pages must be a number`);
        // Path safety: no zip-slip
        if (typeof c.file === 'string' && (c.file.includes('..') || c.file.startsWith('/'))) {
          errors.push(`chapters[${i}].file is unsafe: ${c.file}`);
        }
      }
    }
    if (m.coverFile != null) {
      if (typeof m.coverFile !== 'string') errors.push('coverFile must be a string or null');
      else if (m.coverFile.includes('..') || m.coverFile.startsWith('/')) {
        errors.push(`coverFile is unsafe: ${m.coverFile}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// ============================================================
// JSON Schema for v2 — for cross-language validators (e.g. manga-finder)
// ============================================================

export const CRZ_V2_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://comic-reader.local/schemas/crz-v2.json',
  title: 'CrzManifestV2',
  type: 'object',
  required: [
    'formatVersion',
    'exportedFrom',
    'exportedAt',
    'exporterVersion',
    'originSeriesId',
    'partIndex',
    'totalParts',
    'type',
    'title',
    'englishTitle',
    'synopsis',
    'status',
    'year',
    'score',
    'malId',
    'mangaDexId',
    'tags',
    'placeholder',
    'nsfw',
    'coverFile',
    'chapters',
    'hasTranslations',
  ],
  additionalProperties: false,
  properties: {
    formatVersion: { const: 2 },
    exportedFrom: { type: 'string' },
    exportedAt: { type: 'string', format: 'date-time' },
    exporterVersion: { type: 'string' },
    originSeriesId: { type: 'string' },
    partIndex: { type: 'integer', minimum: 0 },
    totalParts: { type: 'integer', minimum: 1 },
    type: { enum: ['comic', 'magazine'] },
    title: { type: 'string', minLength: 1 },
    englishTitle: { type: ['string', 'null'] },
    synopsis: { type: ['string', 'null'] },
    status: { type: ['string', 'null'] },
    year: { type: ['integer', 'null'] },
    score: { type: ['number', 'null'] },
    malId: { type: ['integer', 'null'] },
    mangaDexId: { type: ['string', 'null'] },
    tags: { type: 'array', items: { type: 'string' } },
    placeholder: { type: 'string' },
    nsfw: { type: 'boolean' },
    coverFile: { type: ['string', 'null'] },
    chapters: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['file', 'chapter', 'order', 'pages'],
        additionalProperties: false,
        properties: {
          file: { type: 'string' },
          chapter: { type: 'string' },
          order: { type: 'number' },
          pages: { type: 'integer', minimum: 0 },
        },
      },
    },
    hasTranslations: { type: 'boolean' },
  },
} as const;

// ============================================================
// Helpers shared by export + import
// ============================================================

/**
 * Derive a human chapter label ("5", "5.5") from a stored chapter filename
 * ("chapter-005.pdf", "chapter-005.5.pdf"). Falls back to filename without .pdf.
 */
export function chapterLabelFromFile(file: string): string {
  const m = file.match(/chapter-0*(\d+(?:\.\d+)?)\.pdf$/i);
  if (m) return m[1];
  return file.replace(/\.pdf$/i, '');
}
