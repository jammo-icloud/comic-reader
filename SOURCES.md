# Sources

Bindery uses an **addon system** for all content sources. Each source is a
self-contained folder under `addons/<name>/` with an `addon.json` manifest and
a TypeScript module implementing the `MangaSource` interface from
`@bindery/addon-api`.

The same addon code runs in two runtimes:

- **Server** — the Bindery server loads addons from `addons/` at startup.
  Search, chapter listing, and page-image fetching happen server-side over HTTP.
- **Chrome extension** (`manga-finder`) — Vite aliases (`@addons/*`) resolve
  to the same `addons/` directory, so shared addons compile into the extension
  bundle. The extension also has its own connectors for sites that need a real
  browser session (Cloudflare, encrypted pages, strict bot detection).

## Addon catalog

Every addon lives in `addons/<id>/`. The manifest declares the source's CDN
hosts, auto-tags, display order, and presentation metadata — the server and
extension derive CDN referer mappings and tag assignments from the manifest
rather than maintaining separate hardcoded tables.

| Source | Addon | Tags | Type | Shared | Notes |
|---|---|---|---|---|---|
| **MangaDex** | `mangadex` | manga | REST API | server | Community scanlations. Official API, stable URLs. Cover proxy via `/api/discover/cover/`. Extension has its own browser-optimized connector. |
| **MangaFox** (fanfox.net) | `mangafox` | manga | HTML scrape | both | Long-running. Image CDNs gated on Referer (`zjcdn.mangafox.me`, `fmcdn.mfcdn.net`). |
| **MangaTown** | `mangatown` | manga | HTML scrape | both | Same operator as MangaFox. CDN occasionally 403s individual pages — partial-chapter tracking catches these. Multi-pattern image-URL fallback survives CDN rotation. |
| **Rawkuma** | `rawkuma` | manga | HTML scrape | both | Raw Japanese manga, often before translations. Pairs with the Translate feature (Ollama vision model). |
| **ReadAllComics** | `readallcomics` | western, comics | HTML scrape | both | DC, Marvel, Image. Images on Blogger CDN (`bp.blogspot.com`). |
| **ReadComicsOnline** | `readcomicsonline` | western, comics | HTML scrape | both | Western comics, alternate library. |
| **Archive.org** | `archiveorg` | — | REST API | both | Public-domain comics, magazines, manga. Single-file downloads (PDF/CBR/CBZ/EPUB) instead of per-page assembly. |
| **Elf Toon** | `elftoon` | manhwa | HTML scrape | both | Manhwa, manhua & comics. Next.js site with JSON search API. |
| **Omega Scans** | `omegascans` | manhwa, adult | HTML scrape | both | Adult manhwa and webtoons. NSFW; admin-only. |
| **MyAnimeList** (Jikan) | `mal` | — | REST API | server | **Metadata only** — covers, scores, synopsis, tags. No downloads. Fallback search when no other source matches. |

**Shared = both** means the addon code compiles into the Chrome extension via
Vite aliases. **Shared = server** means the addon runs server-side only; the
extension has a separate implementation (or doesn't use it).

## Extension-only connectors

These live in `manga-finder/src/connectors/` and are not part of the addon
system. They run only in the Chrome extension, where a real browser session
handles Cloudflare challenges, encrypted pages, and strict bot detection.

| Source | Notes |
|---|---|
| **MangaDex** | Browser-side implementation for when the server source is rate-limited. |
| **MangaHub** | Cloudflare-protected; needs a real browser session. |
| **HentaiNexus** | XOR-encrypted page images require JS decryption (NSFW; admin-only). |
| **MangaDNA** | WordPress Madara template; server-side returns empty. |
| **WeebCentral** | Cloudflare-protected. |
| **Manga18FX** | NSFW; admin-only. |
| **NovelCool** | Anti-bot detection. |

## CDN referer mappings

Many image hosts gate on `Referer` to block hotlinking. Rather than maintaining
a hardcoded lookup table, referer mappings are **derived from addon manifests**:

- Each addon's `hosts[]` lists the CDN hostnames it talks to.
- The addon's `url` field is the source's homepage.
- At build/load time, every hostname in `hosts` maps to `url + '/'` as the
  Referer header.

The server's downloader and the extension's `cdn-referers.ts` both use this
approach — add a CDN host to the addon manifest and the referer mapping follows
automatically.

Some CDNs (notably MangaTown's `zjcdn.mangahere.org`) gate on the *exact
chapter reader URL*, not just the homepage. For those, the downloader builds a
per-chapter Referer via `chapterReaderUrl()`.

In the Chrome extension, `fetch()` silently drops forbidden headers like
`Referer` and `User-Agent`. The extension uses `declarativeNetRequest` rules
(`rules.json`) to inject these headers at the network layer instead.

## Adding a new source

### As a shared addon (server + extension)

1. **Create the addon directory** — `addons/<id>/` with two files:

   `addon.json`:
   ```json
   {
     "id": "my-source",
     "name": "My Source",
     "version": "1.0.0",
     "api": 1,
     "kind": "source",
     "order": 10,
     "main": "index.js",
     "hosts": ["cdn.example.com", "api.example.com"],
     "tags": ["manga"],
     "color": "#0284c7",
     "description": "What this source is good for.",
     "url": "https://example.com",
     "favicon": "https://example.com/favicon.ico"
   }
   ```

   `index.ts`:
   ```ts
   import { createFetch, type MangaSource, type SearchResult, type ChapterResult } from '@bindery/addon-api';

   const get = createFetch({ rateLimitMs: 300, referer: 'https://example.com/' });

   export const mySourceSource: MangaSource = {
     id: 'my-source',
     name: 'My Source',
     async search(query, limit = 20): Promise<SearchResult[]> { /* ... */ },
     async getChapters(mangaId): Promise<ChapterResult[]> { /* ... */ },
     async getPageUrls(chapterId): Promise<string[]> { /* ... */ },
     getMangaUrl(mangaId) { return `https://example.com/manga/${mangaId}`; },
   };

   export default mySourceSource;
   ```

2. **The server picks it up automatically** — the addon loader scans `addons/`
   at startup. CDN referer mappings, auto-tags, and source-picker metadata all
   come from `addon.json`. No registration code to edit.

3. **To share with the extension** — import it in
   `manga-finder/src/connectors/index.ts` using the `@addons/` alias and add
   it to the `sources` map and `ALL_SOURCES` config array.

4. **Rebuild the extension** — `cd manga-finder && npm run build`, then copy
   `dist/` to `comic-reader/public/manga-finder-extension/` and reload in
   Chrome.

### Manifest fields reference

| Field | Required | Description |
|---|---|---|
| `id` | yes | Stable identifier, lowercase. Must match the source's `MangaSource.id`. |
| `name` | yes | Display name in the source picker. |
| `version` | yes | Addon's own version (semver). |
| `api` | yes | `ADDON_API_VERSION` this addon was written against. Currently `1`. |
| `kind` | yes | `"source"` for content sources. |
| `main` | yes | Module to import, relative to the addon directory. |
| `hosts` | — | CDN hostnames the source talks to. Drives referer mappings. |
| `tags` | — | Auto-tags for series from this source (e.g. `["manga"]`, `["manhwa", "adult"]`). |
| `order` | — | Display order in the source picker. Lower = first. |
| `color` | — | Hex color for the source pill in Discover. |
| `description` | — | One-line description shown in the source picker. |
| `url` | — | Source homepage. Used as the default Referer for CDN requests. |
| `favicon` | — | Favicon URL for the source pill. |
| `nsfw` | — | `true` hides the source from safe-mode users and non-admin downloads. |
| `metadataOnly` | — | `true` for sources that search but can't download (e.g. MAL). |
| `enabled` | — | Set `false` to ship an addon without loading it. Default `true`. |

### The `@bindery/addon-api` package

The shared contract lives in `packages/addon-api/src/index.ts`. It exports:

- **`MangaSource`** — the interface every source addon implements (`search`,
  `getChapters`, `getPageUrls`, optional `getMangaUrl`).
- **`SearchResult`**, **`ChapterResult`** — return types for search and chapter
  listing.
- **`createFetch(opts)`** — a rate-limited `fetch` wrapper that sets `Referer`
  and `User-Agent` headers. Each source gets its own instance so rate limits
  are per-site.
- **`defineSource(source)`** — identity helper that gives TypeScript authors
  type checking and completion.

## Diagnostic logging

When a source breaks silently, the downloader's logs make it visible:

- **`Cover fetch: <url> [referer=<x>, source=<y>]`** before every cover
  request. Success: `Set cover for "<title>" (<bytes> from <url>)`.
  Failure: explicit HTTP status + URL.
- **`Failed page N/M: HTTP 403 ... URL: <url>`** on first + last failed page
  of every chapter.
- **`Partial chapter: ... got 13/14 pages (sidecar written, retry #N)`** when
  a chapter completes with missing pages. The sidecar tracks what's missing for
  retry via the SeriesPage admin menu.

## Historical decisions

- **MangaFreak** — 404'd on every search endpoint. Removed.
- **MangaFire** (mangafire.to) — HeanCms-style page tile obfuscation required
  JS execution. Server-side approach abandoned. Could be added to manga-finder.
- **Headless browser on the server** — once considered for Cloudflare-protected
  sites. Replaced by manga-finder (browser-side, uses the user's existing
  session) — better UX, no Docker image bloat, no bot-detection arms race.
