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

## Porting from Hakuneko

The [Hakuneko](https://github.com/manga-download/hakuneko) project has 1000+
connectors. Many can be ported to Bindery addons with straightforward
translation. This section maps Hakuneko's connector structure to ours.

### Architecture differences

Hakuneko connectors are ES classes that extend a base `Connector` class (or a
CMS-specific template like `HeanCms`, `WordPressMadara`, `MangaReaderCMS`).
They run inside an Electron browser window and use `fetchDOM` to parse live DOM
and `Engine.Request.fetchUI` to execute JavaScript in a headless page context.

Bindery addons are plain modules that export a `MangaSource` object — no class
hierarchy, no browser DOM. They use `createFetch` for HTTP requests and parse
HTML with string regex or a lightweight parser. If a Hakuneko connector relies
heavily on `fetchUI` or in-page JS execution, it probably belongs as an
extension-only connector in `manga-finder/src/connectors/` rather than a shared
addon.

### Method mapping

| Hakuneko method | Bindery equivalent | Notes |
|---|---|---|
| `_getMangas()` / `_getMangasFromPage(page)` | `search(query, limit)` | Hakuneko crawls the full manga directory upfront; Bindery searches on demand. Port the search API/endpoint, not the full-crawl logic. |
| `_getMangaFromURI(uri)` | _(not needed)_ | Bindery identifies manga by `mangaId` strings, not URI objects. |
| `_getChapters(manga)` | `getChapters(mangaId)` | Return `ChapterResult[]`. Hakuneko passes a `Manga` object; Bindery passes the `mangaId` string. |
| `_getPages(chapter)` | `getPageUrls(chapterId)` | Return plain image URL strings. Hakuneko often wraps URLs in `createConnectorURI` for its download pipeline — strip that, return raw URLs. |
| `_handleConnectorURI(payload)` | _(handled by downloader)_ | Bindery's downloader/extension handles image fetching. CDN referer headers come from the addon manifest. |

### Constructor → manifest + module

Hakuneko's constructor sets identity and config on `this`:

```js
// Hakuneko
constructor() {
    super();
    super.id = 'omegascans';
    super.label = 'OmegaScans';
    this.tags = ['webtoon', 'scanlation', 'english', 'hentai'];
    this.url = 'https://omegascans.org';
    this.api = 'https://api.omegascans.org';
}
```

In Bindery, identity lives in `addon.json` and runtime config is module-scoped:

```json
{
  "id": "omegascans",
  "name": "Omega Scans",
  "hosts": ["omegascans.org", "api.omegascans.org", "media.omegascans.org"],
  "tags": ["manhwa", "adult"],
  "url": "https://omegascans.org"
}
```

```ts
// index.ts
const SITE = 'https://omegascans.org';
const API  = 'https://api.omegascans.org';
const get  = createFetch({ rateLimitMs: 300, referer: `${SITE}/` });
```

### Headers and referers

Hakuneko sets headers via `this.requestOptions.headers.set('x-referer', ...)`.
The `x-referer` and `x-cookie` prefixed headers are rewritten by Hakuneko's
Electron request interceptor.

In Bindery:
- **Server addons** — `createFetch({ referer: '...' })` sets the `Referer`
  header directly. Additional per-request headers go in the `fetch` init.
- **Extension** — `fetch()` silently drops `Referer` in browser context.
  Instead, CDN hosts in `addon.json` `hosts[]` generate `declarativeNetRequest`
  rules that inject the header at the network layer.
- **Downloader** — the server-side downloader reads `hosts[]` and `url` from
  the manifest to build referer mappings. No manual table entry needed.

### Template connectors

Hakuneko has ~30 template classes under `connectors/templates/` for common CMS
platforms (HeanCms, WordPressMadara, MangaReaderCMS, FoolSlide, etc.). A
concrete connector often just sets `this.url` and `this.api` in its
constructor, inheriting all scraping logic.

Bindery doesn't have an equivalent template system yet. When porting a
template-based connector:

1. Read the Hakuneko template to understand the API pattern (REST JSON, GraphQL,
   DOM scraping).
2. Reimplement the `search`/`getChapters`/`getPageUrls` methods directly in the
   addon's `index.ts`, using `createFetch` for HTTP.
3. If several sites share the same CMS, consider extracting a shared helper
   module under `packages/` — but only after the second site proves the pattern.

### Quick checklist

- [ ] Create `addons/<id>/addon.json` with `hosts`, `tags`, `url`
- [ ] Create `addons/<id>/index.ts` implementing `MangaSource`
- [ ] Replace `fetchDOM` calls with `createFetch` + regex/string parsing
- [ ] Replace `createConnectorURI` / `_handleConnectorURI` with plain URL returns
- [ ] Map `x-referer` headers to `createFetch({ referer })` or manifest `hosts[]`
- [ ] If the connector uses `fetchUI` (in-page JS), move to extension-only
- [ ] Test with `npm run build` + Discover page search

## Porting from Hakuneko

[Hakuneko](https://github.com/manga-download/hakuneko) has 1 300+ connectors.
Many map straightforwardly to a Bindery addon. This section explains the
translation.

### Architecture comparison

| Concept | Hakuneko | Bindery |
|---|---|---|
| Connector file | `src/web/mjs/connectors/<Name>.mjs` | `addons/<id>/index.ts` |
| Base class | extends `Connector` (or a template) | implements `MangaSource` from `@bindery/addon-api` |
| Identity | `super.id`, `super.label` in constructor | `addon.json` manifest `id`/`name` + `MangaSource.id`/`.name` |
| Tags | `this.tags = ['manga', 'english']` | `addon.json` `"tags": ["manga"]` |
| Site URL | `this.url = 'https://...'` | `addon.json` `"url": "https://..."` |
| Request headers | `this.requestOptions.headers.set(...)` | `createFetch({ referer, userAgent })` |
| CDN hosts | implicit in fetch URLs | `addon.json` `"hosts": [...]` (drives referer mappings) |

### Method mapping

Hakuneko connectors override underscore-prefixed methods on the base `Connector`
class. Bindery addons implement the `MangaSource` interface directly.

| Hakuneko method | Bindery method | Returns |
|---|---|---|
| `_getMangas()` / `_getMangasFromPage(page)` | `search(query, limit)` | Hakuneko enumerates the full catalog; Bindery searches on demand. Port the search endpoint, not the directory scrape. |
| `_getMangaFromURI(uri)` | _(not needed)_ | Bindery identifies manga by `mangaId` from search results. |
| `_getChapters(manga)` | `getChapters(mangaId)` | Both return a list of chapters. Hakuneko passes a `Manga` object with `.id`; Bindery passes the `mangaId` string directly. |
| `_getPages(chapter)` | `getPageUrls(chapterId)` | Hakuneko returns `ConnectorURI` objects or image URLs; Bindery returns plain image URL strings. |
| `_handleConnectorURI(payload)` | _(not needed)_ | Bindery's downloader and the extension's `fetch()` + `declarativeNetRequest` handle CDN auth. Put hosts in the manifest instead. |

### Step-by-step porting guide

1. **Pick a Hakuneko connector** — open the `.mjs` file and identify which
   template it extends (e.g. `WordPressMadara`, `HeanCms`, `FoolSlide`, or
   the base `Connector`). The template tells you what CMS the site runs, which
   helps predict the scraping strategy.

2. **Create the addon scaffold:**
   ```
   addons/<id>/
     addon.json
     index.ts
   ```

3. **Translate the constructor → `addon.json`:**
   ```js
   // Hakuneko
   super.id = 'omegascans';
   super.label = 'OmegaScans';
   this.tags = ['webtoon', 'scanlation', 'english', 'hentai'];
   this.url = 'https://omegascans.org';
   this.api = 'https://api.omegascans.org';
   ```
   becomes:
   ```json
   {
     "id": "omegascans",
     "name": "Omega Scans",
     "hosts": ["omegascans.org", "api.omegascans.org", "media.omegascans.org"],
     "tags": ["manhwa", "adult"],
     "url": "https://omegascans.org"
   }
   ```
   Key differences:
   - Hakuneko `tags` include language (`english`) — Bindery doesn't; drop those.
   - List every CDN/API hostname in `hosts` so referer mapping works.
   - Hakuneko `this.url` → both `addon.json` `"url"` and the `referer` passed
     to `createFetch`.

4. **Translate `_getMangas` → `search`:**

   Hakuneko crawls the entire site catalog; Bindery only needs search. Look for
   the site's search API (check the Hakuneko connector for `/search`, `/api`,
   or AJAX endpoints). If the Hakuneko connector only does full-catalog scraping
   with no search, you'll need to find the site's search endpoint yourself —
   most sites have one in their navigation bar.

   ```ts
   // Bindery
   async search(query: string, limit = 20): Promise<SearchResult[]> {
     const res = await get(`${SITE_URL}/api/search?q=${encodeURIComponent(query)}`);
     const data = await res.json();
     return data.results.slice(0, limit).map(item => ({
       sourceId: 'my-source',
       sourceName: 'My Source',
       mangaId: item.slug,
       title: item.title,
       coverUrl: item.cover ? `${SITE_URL}${item.cover}` : null,
       description: item.description || '',
       status: item.status || 'unknown',
       year: null,
       tags: [],
     }));
   }
   ```

5. **Translate `_getChapters` → `getChapters`:**

   Usually a direct port. Hakuneko passes `manga.id`; Bindery passes
   `mangaId` (the same value from your search results).

   ```ts
   async getChapters(mangaId: string): Promise<ChapterResult[]> {
     const html = await fetchPage(`${SITE_URL}/manga/${mangaId}`);
     // Port the DOM query from the Hakuneko connector
     // e.g. Hakuneko: this.queryChapters = 'li.wp-manga-chapter > a'
     const chapters: ChapterResult[] = [];
     // ... parse chapter links from HTML ...
     return chapters;
   }
   ```

6. **Translate `_getPages` → `getPageUrls`:**

   This is where Hakuneko and Bindery diverge most. Hakuneko's `_getPages`
   often uses `Engine.Request.fetchUI` to execute JavaScript in a browser
   context — Bindery addons can't do that (they're HTTP-only). You need to:

   - **Find the image URLs without JS execution.** Check the page's HTML
     source for `<img>` tags, JSON-LD data, or inline JavaScript variables
     that contain the image list.
   - **If the images require JS decryption** (e.g. HentaiNexus, MangaFire),
     the source can only work as an extension-only connector in `manga-finder`,
     not as a shared addon.

   ```ts
   async getPageUrls(chapterId: string): Promise<string[]> {
     const html = await fetchPage(`${SITE_URL}/chapter/${chapterId}`);
     // Extract image URLs — common patterns:
     //   <img class="wp-manga-chapter-img" src="...">
     //   JSON array in a <script> tag
     //   data-src attributes on lazy-loaded images
     const pages: string[] = [];
     // ... parse image URLs from HTML ...
     return pages;
   }
   ```

7. **Translate request headers → `createFetch` + manifest `hosts`:**

   ```js
   // Hakuneko
   this.requestOptions.headers.set('x-referer', this.url);
   this.requestOptions.headers.set('x-cookie', 'isAdult=1');
   ```
   becomes:
   ```ts
   // Bindery
   const get = createFetch({ rateLimitMs: 300, referer: `${SITE_URL}/` });
   ```
   Hakuneko uses `x-referer` and `x-cookie` headers (the `x-` prefix is an
   internal convention — its engine rewrites them to real `Referer`/`Cookie`
   headers). In Bindery, `createFetch` sets `Referer` directly, and CDN hosts
   in `addon.json` drive the referer map for image downloads.

### Common Hakuneko templates and their Bindery equivalents

| Hakuneko template | CMS | Porting strategy |
|---|---|---|
| `WordPressMadara` | Madara WordPress theme | Scrape `div.page-break source` for images. Search via the WP AJAX API or the site's own search bar. Many Madara sites work with the same addon — parameterize the URL. |
| `HeanCms` | HeanCms | REST API at `/api`. Usually the cleanest to port — JSON endpoints for search, chapters, and pages. |
| `FoolSlide` | FoolSlide | JSON API at `/directory/`. Chapter pages via `/read/` URLs. |
| `MangaReaderCMS` | Generic manga reader | HTML scrape. Chapters in select dropdowns or link lists. Images on numbered pages. |
| `BloggerManga` | Blogger | Images hosted on `bp.blogspot.com`. Port `_getPages` image list parsing. |
| `LineWebtoon` | LINE Webtoon | Official API. Needs authentication for premium content. |
| Base `Connector` | Custom site | No template shortcut — port each method by inspecting the site's DOM and APIs. |

### What won't port (extension-only)

Some Hakuneko connectors rely on executing JavaScript in a browser window
(`Engine.Request.fetchUI`). If the site requires this for its core page-image
URLs (not just for anti-bot initialization), it can't be a shared addon — make
it an extension-only connector in `manga-finder/src/connectors/` instead.

Signs you need extension-only:
- Hakuneko's `_getPages` uses `fetchUI` with a JS `script` to decrypt or
  assemble image URLs
- The site's chapter pages are fully client-rendered (no image URLs in HTML
  source)
- Cloudflare or similar bot protection blocks server-side HTTP entirely

## Historical decisions

- **MangaFreak** — 404'd on every search endpoint. Removed.
- **MangaFire** (mangafire.to) — HeanCms-style page tile obfuscation required
  JS execution. Server-side approach abandoned. Could be added to manga-finder.
- **Headless browser on the server** — once considered for Cloudflare-protected
  sites. Replaced by manga-finder (browser-side, uses the user's existing
  session) — better UX, no Docker image bloat, no bot-detection arms race.
