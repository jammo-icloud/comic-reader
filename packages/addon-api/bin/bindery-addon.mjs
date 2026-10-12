#!/usr/bin/env node
/**
 * bindery-addon — test and package a Bindery add-on from the terminal.
 *
 *   bindery-addon test <dir> [--query "naruto"] [--chapter N] [--timeout ms] [--json]
 *       Load the add-on and run search → chapters → pages against the live
 *       site, printing what each step returned. Exits non-zero if any step
 *       fails or returns nothing, so it works in CI.
 *
 *   bindery-addon pack <dir> [--out file.zip]
 *       Zip the add-on folder (addon.json at the root) ready to install from
 *       the Bindery admin page. The folder must already contain built .js —
 *       run your build first if you write TypeScript.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ADDON_API_VERSION = 1;

const args = process.argv.slice(2);
const cmd = args[0];
const dir = args[1] && !args[1].startsWith('--') ? path.resolve(args[1]) : null;
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

function usage(code = 1) {
  console.log(`usage:
  bindery-addon test <dir> [--query "naruto"] [--chapter N] [--timeout ms] [--json]
  bindery-addon pack <dir> [--out file.zip]`);
  process.exit(code);
}

function readManifest(d) {
  const file = path.join(d, 'addon.json');
  if (!fs.existsSync(file)) throw new Error(`no addon.json in ${d}`);
  const m = JSON.parse(fs.readFileSync(file, 'utf-8'));
  for (const k of ['id', 'name', 'version', 'kind']) {
    if (typeof m[k] !== 'string' || !m[k]) throw new Error(`addon.json: "${k}" is required`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(m.id)) throw new Error(`addon.json: id "${m.id}" must be lowercase letters, digits, dashes`);
  if (m.api !== ADDON_API_VERSION) throw new Error(`addon.json: api ${m.api} — this tool and Bindery expect ${ADDON_API_VERSION}`);
  return m;
}

async function loadSource(d, m) {
  const mainRel = m.main || 'index.js';
  let main = path.resolve(d, mainRel);
  if (!fs.existsSync(main)) {
    const ts = main.replace(/\.js$/, '.ts');
    if (fs.existsSync(ts)) main = ts; else throw new Error(`"main" not found: ${mainRel}`);
  }
  if (main.endsWith('.ts')) {
    // Let tsx handle TypeScript if it's around (dev checkouts); production
    // add-ons ship .js and never hit this.
    try { createRequire(import.meta.url).resolve('tsx'); } catch {
      throw new Error('main is TypeScript but tsx is not installed — build to .js first, or `npm i -D tsx`');
    }
    const { register } = await import('tsx/esm/api');
    register();
  }
  const mod = await import(pathToFileURL(main).href);
  const src = mod.default ?? Object.values(mod).find((v) => v && typeof v.search === 'function' && typeof v.getPageUrls === 'function');
  if (!src) throw new Error(`${mainRel} does not export a source`);
  if (src.id !== m.id) throw new Error(`source id "${src.id}" does not match addon.json id "${m.id}"`);
  return src;
}

/** Run a step with a deadline — a dead host should fail in seconds, not minutes. */
const TIMEOUT_MS = Number(opt('timeout', 30000));
function withTimeout(promise, label) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} took longer than ${TIMEOUT_MS / 1000}s — is the site reachable?`)), TIMEOUT_MS);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

const t0 = () => performance.now();
const ms = (t) => `${Math.round(performance.now() - t)} ms`;

async function test() {
  if (!dir) usage();
  const json = flag('json');
  const out = { addon: null, search: null, chapters: null, pages: null, ok: false };
  const log = (...a) => { if (!json) console.log(...a); };
  const fail = (step, err) => {
    out[step] = { ...(out[step] || {}), error: String(err?.message || err) };
    if (json) console.log(JSON.stringify(out, null, 2)); else console.error(`\n✗ ${step}: ${err?.message || err}`);
    process.exit(1);
  };

  let m, src;
  try { m = readManifest(dir); src = await loadSource(dir, m); }
  catch (e) { fail('addon', e); }
  out.addon = { id: m.id, name: m.name, version: m.version, kind: m.kind };
  log(`${m.name} v${m.version} (${m.id}) — ${m.kind}`);
  if (m.kind !== 'source') { log('Not a source add-on; nothing to run.'); out.ok = true; if (json) console.log(JSON.stringify(out, null, 2)); return; }

  const query = opt('query', 'naruto');
  let t = t0();
  let results;
  try { results = await withTimeout(src.search(query, 10), 'search'); } catch (e) { fail('search', e); }
  out.search = { query, count: results.length, first: results[0] ?? null, ms: ms(t) };
  log(`\nsearch("${query}") → ${results.length} result(s) in ${ms(t)}`);
  if (results.length === 0) fail('search', new Error('no results — the site may have changed, or try --query with a title it has'));
  for (const r of results.slice(0, 3)) log(`  · ${r.title}  [${r.mangaId}]${r.coverUrl ? '' : '  (no cover)'}`);
  for (const r of results) {
    if (r.sourceId !== m.id) fail('search', new Error(`result sourceId "${r.sourceId}" ≠ "${m.id}"`));
    if (!r.mangaId || !r.title) fail('search', new Error('a result is missing mangaId or title'));
  }

  t = t0();
  let chapters;
  try { chapters = await withTimeout(src.getChapters(results[0].mangaId), 'getChapters'); } catch (e) { fail('chapters', e); }
  out.chapters = { mangaId: results[0].mangaId, count: chapters.length, first: chapters[0] ?? null, last: chapters.at(-1) ?? null, ms: ms(t) };
  log(`\ngetChapters("${results[0].mangaId}") → ${chapters.length} chapter(s) in ${ms(t)}`);
  if (chapters.length === 0) fail('chapters', new Error('no chapters'));
  log(`  first: ch ${chapters[0].chapter}  [${chapters[0].chapterId}]`);
  log(`  last:  ch ${chapters.at(-1).chapter}  [${chapters.at(-1).chapterId}]`);

  // Default to the most recent chapter: it's the one most likely to still be
  // on the site, and the one a reader will download next.
  const want = opt('chapter', null);
  const pick = want != null
    ? chapters.find((c) => String(c.chapter) === String(want)) ?? chapters.at(-1)
    : chapters.at(-1);
  t = t0();
  let pages;
  try { pages = await withTimeout(src.getPageUrls(pick.chapterId), 'getPageUrls'); } catch (e) { fail('pages', e); }
  const isFile = pages.length === 1 && /\.(pdf|cbz|cbr|epub)(\?|$)/i.test(pages[0]);
  out.pages = { chapterId: pick.chapterId, count: pages.length, first: pages[0] ?? null, wholeFile: isFile, ms: ms(t) };
  log(`\ngetPageUrls(ch ${pick.chapter}) → ${pages.length} ${isFile ? 'file' : 'page(s)'} in ${ms(t)}`);
  if (pages.length === 0) {
    fail('pages', new Error(`no pages for ch ${pick.chapter} — if the site still shows that chapter, the parser has drifted; if not, re-run with --query for a title the site currently carries`));
  }
  log(`  ${pages[0]}`);
  if (pages.length > 1) log(`  … ${pages.at(-1)}`);

  // One real image fetch: catches hotlink protection the URL list can't show.
  if (!isFile) {
    t = t0();
    try {
      const res = await fetch(pages[0], { headers: { Referer: m.url ? `${m.url}/` : '' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      const type = res.headers.get('content-type') || '';
      out.pages.firstImage = { status: res.status, type, ms: ms(t) };
      if (!res.ok || !type.startsWith('image/')) {
        fail('pages', new Error(`first page fetch: HTTP ${res.status} ${type || '(no content-type)'} — CDN may need a different Referer`));
      }
      log(`  first page fetch: ${res.status} ${type} in ${ms(t)}`);
    } catch (e) { fail('pages', e); }
  }

  out.ok = true;
  if (json) console.log(JSON.stringify(out, null, 2)); else console.log('\n✓ all steps passed');
}

function pack() {
  if (!dir) usage();
  const m = readManifest(dir);
  const outFile = path.resolve(opt('out', `${m.id}-${m.version}.zip`));
  const main = path.resolve(dir, m.main || 'index.js');
  if (!fs.existsSync(main)) throw new Error(`"main" not found: ${m.main || 'index.js'} — build to .js before packing`);
  fs.rmSync(outFile, { force: true });
  // zip with addon.json at the root; skip source maps, node_modules, dotfiles.
  execFileSync('zip', ['-qr', outFile, '.', '-x', '*.map', 'node_modules/*', '.*', '*/.*'], { cwd: dir, stdio: 'inherit' });
  const size = fs.statSync(outFile).size;
  console.log(`packed ${m.id} v${m.version} → ${outFile} (${(size / 1024).toFixed(1)} KB)`);
  console.log('Install it from Bindery → Admin → Add-ons → Install from zip.');
}

try {
  if (cmd === 'test') await test();
  else if (cmd === 'pack') pack();
  else usage(cmd ? 1 : 0);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
