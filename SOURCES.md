# Sources

Comic Reader pulls from two tiers of sources: **server-side HTTP** (the
NAS does the fetching, listed below) and the **manga-finder Chrome
extension** (browser-side, for sites that need a real session — Cloudflare,
encrypted-page sources, sites with strict bot detection). Discovery in
the app surfaces both transparently.

When a server-side source breaks (CDN rotation, regex drift, anti-bot
update), partial-chapter tracking now keeps any pages that did succeed
and exposes a "Retry partial chapters" admin action — so a transient
failure doesn't strand your library.

## Server-side sources

Adapters live in `src/server/sources/`. Search/chapters/pages are HTTP-
only — no headless browser, no JS execution. Adapter contract: `search`,
`getChapters`, `getPageUrls` returning lists; downloader handles the
per-page image fetch + PDF assembly.

| Source | File | Type | Notes |
|---|---|---|---|
| **MangaDex** | `mangadex-source.ts` | REST API | Best of the lot. Community scanlations, official API, stable URLs. Cover proxy via `/api/discover/cover/`. |
| **MangaFox** (fanfox.net) | `mangafox.ts` | HTML scrape | Long-running. Image CDNs gated on Referer (zjcdn.mangafox.me, fmcdn.mfcdn.net). |
| **MangaTown** | `mangatown.ts` | HTML scrape | Same operator as MangaFox. CDN occasionally 403s individual pages — partial-chapter tracking catches these and offers retry. Multi-pattern image-URL fallback survives CDN rotation. |
| **Rawkuma** | `rawkuma.ts` | HTML scrape | Raw Japanese manga, often before translations. Pairs naturally with the Translate feature (Ollama vision model). |
| **ReadAllComics** | `readallcomics.ts` | HTML scrape | Western comics — DC, Marvel, Image. Images on Blogger CDN (`bp.blogspot.com`, `blogger.googleusercontent.com`). |
| **ReadComicsOnline** | `readcomicsonline.ts` | HTML scrape | Western comics, alternate library. |
| **Archive.org** | `archiveorg.ts` | REST API | Internet Archive — public-domain comics, magazines, manga collections. Single-file downloads (PDF/CBR/CBZ/EPUB) instead of per-page assembly. |
| **MyAnimeList** (Jikan) | `mal-source.ts` | REST API | **Metadata only** — covers, scores, synopsis, English titles, tags. No content. Used for enrichment and as fallback search when no other source matches. |

### Disabled

| Source | File | Reason |
|---|---|---|
| **MangaHub** | `mangahub.ts` | Cloudflare-protected since 2024. Code retained for reference. Reachable via the manga-finder extension. |

## manga-finder Chrome extension

Browser-side connector for sites the server can't reach. Runs in the
user's Chrome session, downloads chapters, packages them as v2 CRZ, posts
them to your Comic Reader instance. Bundled with every install at
`/manga-finder-extension.zip` and prompted from the Discover page.

Connectors (`manga-finder/src/connectors/`):

| Source | Notes |
|---|---|
| **MangaDex** | Browser-side fallback when the server-side source is rate-limited. |
| **MangaFox** | Mirror of the server-side connector, useful when CDN Referer policies block server-side access. |
| **MangaHub** | Cloudflare; works with a real browser session. |
| **MangaDNA** | WordPressMadara template, server-side returns empty — works browser-side. |
| **WeebCentral** | Cloudflare-protected. |
| **HentaiNexus** | Encrypted page images need JS decryption — only works browser-side (NSFW; admin-only). |
| **OmegaScans** | Browser-side search/download (NSFW; admin-only). |
| **Manga18FX** | NSFW; admin-only. |
| **NovelCool** | Mainstream library, anti-bot detection. |
| **ReadAllComics** | Mirror of the server-side connector. |

## CDN Referer mappings

Many image hosts gate on `Referer` to block hotlinking. The downloader's
shared `CDN_REFERERS` table (in `src/server/downloader.ts`) maps each
known CDN host to its source's home page; the same table is used for
both chapter-image fetches and cover-art downloads. When the host isn't
in the table, the per-source homepage fallback fires
(`SOURCE_HOME[sourceId]`).

Some CDNs (notably MangaTown's `zjcdn.mangahere.org`) gate on the *exact
chapter reader URL*, not just the source homepage. For those, the
downloader builds a per-chapter Referer via `chapterReaderUrl()`. Add a
new source to that switch when its CDN rejects the homepage Referer.

Current CDN map:

```
zjcdn.mangafox.me              → https://fanfox.net/
fmcdn.mfcdn.net                → https://fanfox.net/
mfcdn.net                      → https://fanfox.net/
zjcdn.mangahere.org            → https://www.mangatown.com/
mangahere.org                  → https://www.mangatown.com/
mangahere.cc                   → https://www.mangatown.com/
mangatown.com                  → https://www.mangatown.com/
rcdn.kyut.dev                  → https://rawkuma.net/
kyut.dev                       → https://rawkuma.net/
bp.blogspot.com                → https://readallcomics.com/
blogger.googleusercontent.com  → https://readallcomics.com/
uploads.mangadex.org           → https://mangadex.org/
```

## Adding a new server-side source

1. Create `src/server/sources/<name>.ts` exporting an object that satisfies
   `MangaSource` from `src/server/sources/types.ts` (search / getChapters
   / getPageUrls).
2. Register it in `src/server/sources/index.ts` — add to `primarySources`
   and add a `sourceMeta` entry (color, description, url, favicon).
3. If the source's images sit behind a CDN that gates on Referer, add the
   CDN host(s) to `CDN_REFERERS` and the source's home URL to
   `SOURCE_HOME` in `src/server/downloader.ts`.
4. If the CDN gates on the per-chapter reader URL (rare), extend
   `chapterReaderUrl()` in the same file.
5. Auto-tags for the source (e.g. `manga`, `manhwa`, `adult`) live in
   `SOURCE_TAGS` in `src/server/crz-handler.ts` and
   `src/server/routes/chapter-upload.ts` — sources that always download
   adult content tag accordingly so NSFW visibility rules apply.
6. Search — `searchAllSources` runs primary sources in parallel with a
   10s timeout each. New source plugs in for free.

## Diagnostic logging

When a source breaks silently, the downloader's logs are designed to
make it visible without re-deriving anything:

- **`Cover fetch: <url> [referer=<x>, source=<y>]`** before every
  cover request. Success: `Set cover for "<title>" (<bytes> from
  <url>)`. Failure: explicit HTTP status + URL.
- **`Failed page N/M: HTTP 403 ... URL: <url>`** on first + last
  failed page of every chapter (sample only — N×N log lines becomes
  noise on big chapters).
- **`MangaTown: could not find image URL template for ...`** falls
  back to dumping up to 3 sample `<img>` tags from the chapter page,
  so a CDN rotation can be patched in one regex addition.
- **`Partial chapter: ... got 13/14 pages (sidecar written, retry #N)`**
  when a chapter completes with missing pages. The sidecar file
  alongside the PDF tracks what's missing for later retry via the
  SeriesPage admin menu.

## Historical decisions

- **MangaFreak** — 404'd on every search endpoint when the server-side
  connector was first written. Removed; reachable via manga-finder.
- **MangaFire** (mangafire.to) — HeanCms-style page tile obfuscation
  required JS execution. Server-side approach abandoned. Could be added
  to manga-finder if there's demand.
- **Headless browser on the server** — once considered as a way to reach
  Cloudflare-protected sites server-side. Replaced by manga-finder
  (browser-side, uses the user's existing session) — better UX, no
  ~400 MB Docker image bloat, no cat-and-mouse with anti-bot detection.
