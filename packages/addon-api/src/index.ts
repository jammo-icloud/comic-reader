/**
 * @bindery/addon-api — the contract between Bindery and its add-ons.
 *
 * An add-on is a folder containing an `addon.json` manifest and the module it
 * names as `main`. Bindery loads add-ons from its bundled `addons/` directory
 * and from `<DATA_DIR>/addons/` (for add-ons installed by an admin).
 *
 * Add-ons run inside the Bindery server with the same access it has. They are
 * trusted code, installed deliberately — not sandboxed.
 */

/** Bump when the shape of this contract changes incompatibly. */
export const ADDON_API_VERSION = 1;

export type AddonKind = 'source' | 'art' | 'converter';

/** `addon.json`. */
export interface AddonManifest {
  /** Stable identifier, lowercase; a source's `id` must match. */
  id: string;
  /** Display name. */
  name: string;
  /** Add-on's own version, semver. */
  version: string;
  /** The ADDON_API_VERSION this add-on was written against. */
  api: number;
  kind: AddonKind;
  /** Module to import, relative to the manifest (sources and converters). */
  main?: string;
  /** Set false to ship an add-on without loading it. Default true. */
  enabled?: boolean;
  /** Adult content: hidden from safe-mode users and non-admin downloads. */
  nsfw?: boolean;
  /** Where the add-on talks to — shown to admins, not enforced. */
  hosts?: string[];
  homepage?: string;
  /** Auto-tags for series created from this source (e.g. ["manga"], ["manhwa", "adult"]). */
  tags?: string[];
  /** True for sources that can search but not download (metadata-only fallback). */
  metadataOnly?: boolean;
  /** Display order in the Discover source picker. Lower = first. Unset sorts alphabetically after ordered addons. */
  order?: number;
  /** Presentation in the Discover source picker (sources only). */
  color?: string;
  description?: string;
  url?: string;
  favicon?: string;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export interface SearchResult {
  sourceId: string;          // the add-on's id
  sourceName: string;        // the add-on's display name
  mangaId: string;           // source-specific ID
  title: string;
  coverUrl: string | null;   // absolute, or proxied via /api/discover/proxy-image?url=
  description: string;
  status: string;            // ongoing, completed, etc.
  year: number | null;
  tags: string[];
}

export interface ChapterResult {
  sourceId: string;
  chapterId: string;
  chapter: string | null;    // "1", "2.5", etc.
  title: string | null;
  pages: number;
  scanlationGroup: string | null;
}

/**
 * A place Bindery can search and download from. `getPageUrls` returns one
 * image URL per page — or a single URL to a whole PDF/CBZ/CBR/EPUB, which
 * Bindery downloads and converts instead of stitching pages.
 */
export interface MangaSource {
  id: string;
  name: string;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  getChapters(mangaId: string): Promise<ChapterResult[]>;
  getPageUrls(chapterId: string): Promise<string[]>;
  getMangaUrl?(mangaId: string): string | Promise<string>;
}

/** Identity helper that gives authors type checking and completion. */
export function defineSource(source: MangaSource): MangaSource {
  return source;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface FetchOptions {
  /** Minimum gap between requests to this source, in ms. Default 300. */
  rateLimitMs?: number;
  /** Sent with every request; most sites want the site's own homepage. */
  referer?: string;
  userAgent?: string;
}

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

/**
 * A `fetch` that spaces requests out and sets the headers scraping sources
 * usually need. Each source gets its own instance so limits are per-site.
 */
export function createFetch(opts: FetchOptions = {}): (url: string, init?: RequestInit) => Promise<Response> {
  const gap = opts.rateLimitMs ?? 300;
  let last = 0;
  return async (url, init) => {
    const wait = Math.max(0, gap - (Date.now() - last));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const headers: Record<string, string> = {
      'User-Agent': opts.userAgent ?? DEFAULT_UA,
      ...(opts.referer ? { Referer: opts.referer } : {}),
      ...((init?.headers as Record<string, string>) || {}),
    };
    return fetch(url, { ...init, headers, credentials: 'include' });
  };
}
