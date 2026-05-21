/**
 * The story bible — a living, per-series document the translation pipeline
 * grows and reads as it works.
 *
 * The vision model translates a manga page by page. With each page it is
 * handed the current bible (cast, world glossary, story-so-far) and returns,
 * alongside the page's translation, proposed additions — characters it just
 * met, terms it just saw, an updated recap. The bible therefore deepens as the
 * model reads; and because it lives at the SERIES level (not the chapter
 * level), chapter 2 starts already knowing chapter 1's cast and world.
 *
 * It is also a plain, editable JSON file. An admin can correct a name, pin a
 * term's English rendering, or sharpen a character's voice, and the next run
 * honors it. Stored at data/translations/<seriesId>/bible.json.
 */
import fs from 'fs';
import path from 'path';
import { getSeries } from './data.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const TRANSLATIONS_DIR = path.join(DATA_DIR, 'translations');

// ==================== Types ====================

/** One member of the cast. */
export interface BibleCharacter {
  name: string;            // the chosen English name — the single source of truth
  native: string | null;   // native-script name, if known
  aliases: string[];       // other names / titles / nicknames this character goes by
  role: string;            // main | supporting | minor
  voice: string;           // how they speak — register, tone, verbal tics
}

/** One world term — a place, technique, concept, organization, etc. */
export interface GlossaryEntry {
  term: string;            // the original term as it appears in the manga
  english: string;         // the chosen English rendering
  note: string;            // a short gloss of what it is
}

/** The living per-series story bible. */
export interface StoryBible {
  characters: BibleCharacter[];
  glossary: GlossaryEntry[];
  recap: string;           // a running "story so far", a few sentences
  updatedAt: string;
}

/**
 * The additions a page's translation call proposes back. Every field is
 * optional — most pages introduce nothing new.
 */
export interface BibleUpdates {
  characters?: BibleCharacter[]; // new characters, or refinements to known ones
  glossary?: GlossaryEntry[];    // new world terms
  recap?: string;                // the recap rewritten to include this page
}

// ==================== Persistence ====================

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function biblePath(seriesId: string): string {
  return path.join(TRANSLATIONS_DIR, seriesId, 'bible.json');
}

export function emptyBible(): StoryBible {
  return { characters: [], glossary: [], recap: '', updatedAt: new Date().toISOString() };
}

/**
 * Load a series' bible. If none exists on disk it is seeded from the series'
 * AniList enrichment and persisted, so the first translation run already
 * starts with whatever cast and synopsis we know.
 */
export function loadBible(seriesId: string): StoryBible {
  const p = biblePath(seriesId);
  if (fs.existsSync(p)) {
    try {
      return normalizeBible(JSON.parse(fs.readFileSync(p, 'utf-8')));
    } catch {
      console.error(`  Corrupt story bible for "${seriesId}" — reseeding`);
    }
  }
  const seeded = seedBible(seriesId);
  saveBible(seriesId, seeded);
  return seeded;
}

export function saveBible(seriesId: string, bible: StoryBible): void {
  ensureDir(path.join(TRANSLATIONS_DIR, seriesId));
  const out: StoryBible = { ...bible, updatedAt: new Date().toISOString() };
  fs.writeFileSync(biblePath(seriesId), JSON.stringify(out, null, 2));
}

/**
 * Build a fresh bible from a series' AniList enrichment — the character list
 * and synopsis. Works fine with no enrichment at all (an empty bible); the
 * model fills it in as it reads.
 */
export function seedBible(seriesId: string): StoryBible {
  const series = getSeries(seriesId);
  const bible = emptyBible();
  if (!series) return bible;

  for (const c of series.characters || []) {
    if (!c.name?.trim()) continue;
    bible.characters.push({
      name: c.name.trim(),
      native: c.nativeName?.trim() || null,
      aliases: [],
      role: c.role || 'supporting',
      voice: '',
    });
  }
  if (series.synopsis?.trim()) bible.recap = series.synopsis.trim();
  return bible;
}

/** Coerce a loaded or hand-edited JSON blob into a well-formed StoryBible. */
function normalizeBible(raw: any): StoryBible {
  const b = emptyBible();
  if (Array.isArray(raw?.characters)) {
    b.characters = raw.characters
      .filter((c: any) => c && typeof c.name === 'string' && c.name.trim())
      .map((c: any): BibleCharacter => ({
        name: String(c.name).trim(),
        native: typeof c.native === 'string' && c.native.trim() ? c.native.trim() : null,
        aliases: Array.isArray(c.aliases)
          ? c.aliases.filter((a: any) => typeof a === 'string' && a.trim()).map((a: string) => a.trim())
          : [],
        role: typeof c.role === 'string' && c.role.trim() ? c.role.trim() : 'supporting',
        voice: typeof c.voice === 'string' ? c.voice.trim() : '',
      }));
  }
  if (Array.isArray(raw?.glossary)) {
    b.glossary = raw.glossary
      .filter((g: any) => g && typeof g.term === 'string' && g.term.trim())
      .map((g: any): GlossaryEntry => ({
        term: String(g.term).trim(),
        english: typeof g.english === 'string' ? g.english.trim() : '',
        note: typeof g.note === 'string' ? g.note.trim() : '',
      }));
  }
  if (typeof raw?.recap === 'string') b.recap = raw.recap.trim();
  return b;
}

// ==================== Merge ====================

/**
 * Fold a page's proposed updates into the bible and return the new bible.
 * Characters merge by name, glossary by term — both case-insensitive. A known
 * entry is *refined* (only non-empty incoming fields overwrite); an unknown
 * one is added. The recap is replaced outright with the model's latest.
 */
export function applyBibleUpdates(bible: StoryBible, updates: BibleUpdates | null | undefined): StoryBible {
  if (!updates) return bible;

  const next: StoryBible = {
    characters: bible.characters.map((c) => ({ ...c, aliases: [...c.aliases] })),
    glossary: bible.glossary.map((g) => ({ ...g })),
    recap: bible.recap,
    updatedAt: bible.updatedAt,
  };

  for (const raw of updates.characters || []) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name) continue;
    const native = typeof raw.native === 'string' && raw.native.trim() ? raw.native.trim() : null;
    const role = typeof raw.role === 'string' && raw.role.trim() ? raw.role.trim() : '';
    const voice = typeof raw.voice === 'string' ? raw.voice.trim() : '';
    const aliases = Array.isArray(raw.aliases)
      ? raw.aliases.filter((a: any) => typeof a === 'string' && a.trim()).map((a: string) => a.trim())
      : [];

    const existing = next.characters.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (native) existing.native = native;
      if (role) existing.role = role;
      if (voice) existing.voice = voice;
      for (const a of aliases) {
        if (!existing.aliases.some((x) => x.toLowerCase() === a.toLowerCase())) existing.aliases.push(a);
      }
    } else {
      next.characters.push({ name, native, aliases, role: role || 'supporting', voice });
    }
  }

  for (const raw of updates.glossary || []) {
    const term = typeof raw?.term === 'string' ? raw.term.trim() : '';
    if (!term) continue;
    const english = typeof raw.english === 'string' ? raw.english.trim() : '';
    const note = typeof raw.note === 'string' ? raw.note.trim() : '';

    const existing = next.glossary.find((e) => e.term.toLowerCase() === term.toLowerCase());
    if (existing) {
      if (english) existing.english = english;
      if (note) existing.note = note;
    } else {
      next.glossary.push({ term, english, note });
    }
  }

  if (typeof updates.recap === 'string' && updates.recap.trim()) {
    next.recap = updates.recap.trim();
  }
  return next;
}

// ==================== Prompt rendering ====================

/**
 * Render the bible as a plain-text block to drop into the translation prompt.
 * Empty sections become an explicit instruction to start filling them in, so
 * the model knows it is expected to grow the bible.
 */
export function formatBibleForPrompt(bible: StoryBible): string {
  const parts: string[] = [];

  if (bible.characters.length) {
    parts.push('CHARACTERS — use these exact English names; never invent a new spelling for a known character:');
    for (const c of bible.characters) {
      const head = [`- ${c.name}`];
      if (c.native) head.push(`(${c.native})`);
      if (c.aliases.length) head.push(`— also called: ${c.aliases.join(', ')}`);
      if (c.role) head.push(`[${c.role}]`);
      parts.push(head.join(' '));
      if (c.voice) parts.push(`    voice: ${c.voice}`);
    }
  } else {
    parts.push('CHARACTERS — none recorded yet. Add every character you can identify on this page.');
  }

  parts.push('');
  if (bible.glossary.length) {
    parts.push('GLOSSARY — use these exact renderings for recurring terms:');
    for (const g of bible.glossary) {
      parts.push(`- ${g.term} -> ${g.english || '(undecided)'}${g.note ? ` — ${g.note}` : ''}`);
    }
  } else {
    parts.push('GLOSSARY — none recorded yet. Add place names, techniques, organizations and special terms as they appear.');
  }

  parts.push('');
  parts.push(`STORY SO FAR: ${bible.recap || '(this is the start — no recap yet)'}`);

  return parts.join('\n');
}
