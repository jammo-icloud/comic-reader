/**
 * Add-on loader. Scans the bundled `dist/addons/` directory and
 * `<DATA_DIR>/addons/`, validates each `addon.json`, imports the module it
 * names, and hands sources to the registry.
 *
 * Add-ons are trusted code running inside the server. A bad one is logged and
 * skipped; it never stops Bindery from starting.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { ADDON_API_VERSION, type AddonManifest, type MangaSource } from '@bindery/addon-api';

export interface LoadedAddon {
  manifest: AddonManifest;
  dir: string;
  /** 'bundled' ships with Bindery; 'installed' lives in DATA_DIR. */
  origin: 'bundled' | 'installed';
  source?: MangaSource;
  /** Set when the add-on was skipped. */
  error?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Bundled add-ons sit beside the server output: `dist/addons` next to
 * `dist/server` in production, `addons` next to `src` in dev (where tsx runs
 * the .ts directly and the add-ons' `main` resolves to their .ts too).
 */
function bundledAddonsDir(): string {
  const inDist = path.resolve(__dirname, '../../addons');       // dist/server/addons -> dist/addons
  if (fs.existsSync(inDist)) return inDist;
  return path.resolve(__dirname, '../../../addons');            // src/server/addons -> addons
}

function addonRoots(): { dir: string; origin: LoadedAddon['origin'] }[] {
  const DATA_DIR = process.env.DATA_DIR || './data';
  return [
    { dir: bundledAddonsDir(), origin: 'bundled' },
    { dir: path.resolve(DATA_DIR, 'addons'), origin: 'installed' },
  ];
}

function readManifest(dir: string): AddonManifest {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'addon.json'), 'utf-8'));
  for (const key of ['id', 'name', 'version', 'kind'] as const) {
    if (typeof raw[key] !== 'string' || !raw[key]) throw new Error(`addon.json: "${key}" is required`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(raw.id)) throw new Error(`addon.json: id "${raw.id}" must be lowercase letters, digits, dashes`);
  if (raw.api !== ADDON_API_VERSION) throw new Error(`needs add-on API ${raw.api}, this Bindery provides ${ADDON_API_VERSION}`);
  if (!['source', 'art', 'converter'].includes(raw.kind)) throw new Error(`addon.json: unknown kind "${raw.kind}"`);
  return raw as AddonManifest;
}

/** The module to import: `main` from the manifest, with .ts beside it in dev. */
function resolveMain(dir: string, main: string): string {
  const full = path.resolve(dir, main);
  if (!full.startsWith(dir + path.sep)) throw new Error('"main" must be inside the add-on folder');
  if (fs.existsSync(full)) return full;
  const ts = full.replace(/\.js$/, '.ts');
  if (ts !== full && fs.existsSync(ts)) return ts;
  throw new Error(`"main" not found: ${main}`);
}

async function loadOne(dir: string, origin: LoadedAddon['origin']): Promise<LoadedAddon> {
  let manifest: AddonManifest;
  try {
    manifest = readManifest(dir);
  } catch (err) {
    const id = path.basename(dir);
    return { manifest: { id, name: id, version: '?', api: 0, kind: 'source' }, dir, origin, error: (err as Error).message };
  }
  if (manifest.enabled === false) return { manifest, dir, origin, error: 'disabled in addon.json' };

  if (manifest.kind === 'source') {
    try {
      // A cache-busting query so a reload picks up a replaced add-on, not the module Node already has.
      const mod = await import(pathToFileURL(resolveMain(dir, manifest.main || 'index.js')).href + `?t=${Date.now()}`);
      const source: MangaSource | undefined = mod.default ?? Object.values(mod).find(
        (v: any) => v && typeof v.search === 'function' && typeof v.getPageUrls === 'function',
      );
      if (!source) throw new Error(`${manifest.main || 'index.js'} does not export a source`);
      if (source.id !== manifest.id) throw new Error(`source id "${source.id}" does not match addon.json id "${manifest.id}"`);
      return { manifest, dir, origin, source };
    } catch (err) {
      return { manifest, dir, origin, error: (err as Error).message };
    }
  }
  // Art packs and converters have no code to load yet; they are discovered
  // here so the admin page can list them.
  return { manifest, dir, origin };
}

let loaded: LoadedAddon[] = [];

/** Load every add-on. Later roots win on id collisions (installed overrides bundled). */
export async function loadAddons(): Promise<LoadedAddon[]> {
  const byId = new Map<string, LoadedAddon>();
  for (const { dir: root, origin } of addonRoots()) {
    if (!fs.existsSync(root)) continue;
    const entries = fs.readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, d.name, 'addon.json')))
      .map((d) => d.name)
      .sort();
    for (const name of entries) {
      const addon = await loadOne(path.join(root, name), origin);
      byId.set(addon.manifest.id, addon);
    }
  }
  loaded = [...byId.values()];
  const ok = loaded.filter((a) => !a.error);
  const skipped = loaded.filter((a) => a.error);
  console.log(`Add-ons: ${ok.length} loaded${skipped.length ? `, ${skipped.length} skipped` : ''}`);
  for (const a of skipped) console.log(`  skipped ${a.manifest.id}: ${a.error}`);
  return loaded;
}

export function getLoadedAddons(): LoadedAddon[] {
  return loaded;
}

export function installedAddonsDir(): string {
  const dir = path.resolve(process.env.DATA_DIR || './data', 'addons');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Validate a manifest's JSON text the same way the loader does, without
 * touching disk. Used before an install writes anything.
 */
export function validateManifestText(text: string): AddonManifest {
  const tmp = fs.mkdtempSync(path.join(installedAddonsDir(), '.validate-'));
  try {
    fs.writeFileSync(path.join(tmp, 'addon.json'), text);
    return readManifest(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
