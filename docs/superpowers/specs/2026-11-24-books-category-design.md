# Books category, type-aware sources, shared file preview — design

**Date:** 2026-11-24
**Status:** builder check done; awaiting final approval
**Related:** `docs/superpowers/specs/2026-11-21-archiveorg-books-design.md` (the Books source this builds on)

## Intent

Bindery's library has two categories, Manga and Mags, backed by a `type` field
on every series (`comic` | `magazine`). The new Internet Archive Books source
produces prose books, which must live in their own category, **Books**, so a
title such as *Dungeon Crawler Carl* can exist twice: once as a manga series
and once as a book series. Light novels that manga are based on get the same
home, and the light novels already misfiled under Manga must be movable into
Books from the series editor.

Three defects surfaced while adding the Books source and are fixed here:

1. **Wrong "already downloaded" state, and a latent overwrite.** Discover
   matches a result to the library by title alone. The Books result for
   *Dungeon Crawler Carl* resolves to the manga series, so books 1–7 show as
   downloaded. The downloader merges by title the same way, so a download would
   have written book PDFs into the manga folder under the same chapter filenames
   and replaced manga chapters 1–7.
2. **Instant reader broken for file sources.** The preview reader renders what
   `getPageUrls` returns as `<img>` tags. Both archive.org sources return one
   PDF/EPUB URL, so the viewer shows a broken image. This has never worked for
   the archive.org comics source either.
3. **The Books source is missing from the Chrome extension.** The extension
   (`manga-finder`) compiles shared add-ons into its own bundle from a
   hand-maintained registry; the Books add-on was never registered there and the
   extension was not rebuilt. The extension also special-cases the string
   `archiveorg` in its preview path and has no single-file branch in its
   download path, so archive.org downloads through the extension are mangled.

## Goals

- A third series type `book`, stored under `LIBRARY_DIR/books/<id>`, shown as a
  **Books** segment (lucide `Library` icon) beside Manga and Mags.
- Source add-ons declare which type they produce; the Books add-on produces
  `book`. Discover matching and series creation respect the type, so a book and
  a manga with the same title are separate series.
- Changing a series' type in the editor moves its folder on disk and updates
  the index, keeping the series id and everything keyed by it.
- One preview viewer, shared by Bindery and the extension, that shows the first
  pages of a PDF returned by a file source. EPUB/CBZ/CBR show a clear
  "download to read" message instead of a broken image.
- The Books add-on appears in the extension; extension preview and download
  handle single-file sources by URL shape, not source id; extension CRZ
  packages carry the series type so Bindery files them correctly.

## Non-goals

- New novel-only sources (web novel sites). Light novels arrive through the
  Books source in this round.
- Cross-linking a book series and a manga series of the same title on the
  series page.
- Re-filing existing series automatically. Moves are manual, from the editor.
- EPUB preview rendering. EPUBs download fine (converted on ingest); only the
  preview shows a message.
- Books-specific reader features (reflowable text, font size). Books are read
  as PDFs through the existing reader.

## Anti-goals

- Any code path that decides behaviour from a hardcoded source id
  (`sourceId === 'archiveorg'`). Behaviour comes from the manifest or the URL.
- Changing series ids on a type move. Progress, collections, favorites, pins,
  thumbnails and offline caches are keyed by id and must keep working.
- A second viewer implementation in the extension.

## Constraints

- Series ids are global (one `seriesCache` keyed by id); two series can never
  share an id even across types.
- Two runtimes share code by Vite alias: `@addons/*` →
  `comic-reader/addons`, `@bindery/discover` → `comic-reader/src/client/discover`,
  `@bindery/addon-api` → `packages/addon-api/src`. Anything the extension needs
  must live in those three places or in `manga-finder/src`.
- The extension is Manifest V3. It bundles pdf-lib (write-only) but not pdf.js;
  Bindery ships `pdfjs-dist ^4.10` with a `?url` worker import in
  `src/client/lib/pdf.ts`.
- CRZ: extension writes `formatVersion: 1` manifests (no `type`); server
  validates `formatVersion: 2` exports with `type: enum ['comic','magazine']`.
- Chapter-number matching in sync and Discover is per series id; unchanged.
- The addon-api manifest is validated in `src/server/addons/loader.ts`; new
  fields are optional and default so existing add-ons keep loading.

## Approaches considered

### Category model

1. **Third `type` value** (chosen). Extend `comic | magazine` with `book`,
   folder `books/`, manifest field for the source's type. Fits every existing
   switch (library tabs, folders, import, CRZ, editor).
2. Tag-only category. Keeps one folder and leaves the title-match overwrite in
   place. Rejected.
3. Type-prefixed series ids. Breaks every existing URL, progress record and
   offline cache. Rejected.

### Same title in two categories (user chose 1)

1. **Suffix on collision only**: `dungeon-crawler-carl-book`. Ids stay clean
   when there is no clash.
2. Always suffix book ids. Rejected: every book URL pays for a rare clash.

### Instant reader for file sources (user asked for one viewer serving both)

1. Server renders first pages with mupdf. Rejected: the extension has no server
   in its preview path.
2. **Shared client-side PDF preview** (chosen): a component in
   `src/client/discover/` renders the first pages with pdf.js and feeds the
   existing `PreviewReader`. Bindery points it at the proxied URL, the
   extension at archive.org directly. pdf.js streams by byte range so the first
   page appears before the file finishes.

## Design

### 1. Series type `book`

- `SeriesRecord.type` and the client `Series.type` become
  `'comic' | 'magazine' | 'book'`. Export a `SeriesType` union from
  `src/server/data.ts` and `src/client/lib/types.ts`.
- New helper in `src/server/data.ts`:
  `typeDir(type: SeriesType): 'comics' | 'magazines' | 'books'`. Every
  `series.type === 'comic' ? 'comics' : 'magazines'` ternary (data, scanner,
  cleanup, merge, importer, pdf-optimizer, crz-handler, downloader, routes
  library/admin) calls it instead. `cleanup.ts` and the admin library-size
  stat include the `books` dir.
- Placeholder image `public/placeholders/book.png` (same style as the
  existing `public/placeholders/manga.png`; note there is no `magazine.png` on
  disk today, which is a pre-existing gap and not in scope); series created as
  books get `placeholder: 'book.png'`. Importer `guessType` stays
  comic/magazine; the import type picker (`PendingList`) and the series editor
  (`SeriesEditModal`) gain a **Book** option. Books imported through the
  wizard follow the **comic filename convention** (`canonicalFilename` renames
  to numbered chapter files): a book series is one chapter per book, so
  numbered files keep chapter-number parsing, sync and Discover dedupe working
  the same way as for downloaded books.
- CRZ: server schema `type: enum ['comic','magazine','book']`; validator
  message updated. Extension v1 manifests may carry an optional `type`; the
  server's CRZ handler uses `manifest.type` when present, else the source's
  declared type (section 2), else `comic`.
- Library UI (`LibraryToolbar`): third segment `{ value: 'book', label:
  'Books', icon: <Library size={13} /> }`; search placeholder "Search books…";
  the persisted `bindery-type-filter` accepts `book`. `LibraryPage` and the
  offline filter already compare `s.type === typeFilter` and need no change
  beyond the type.

### 2. Sources declare their type

- `AddonManifest.seriesType?: 'comic' | 'magazine' | 'book'` in
  `packages/addon-api/src/index.ts`, default `comic`. Loader validates the
  enum when present. `addons/archiveorg-books/addon.json` sets
  `"seriesType": "book"`.
- `src/server/sources/index.ts`: `getSourceType(sourceId): SeriesType`
  beside `getSourceTags`, reading the manifest with the default.
- `GET /api/discover/sources` already returns manifests; the client
  `SourceConfig` gains `seriesType` so Discover can label results if wanted
  (not required by this design).

### 3. Type-aware matching and creation

- **Discover search annotation** (`routes/discover.ts`): for each result,
  candidates are `allSeries.filter(s => s.type === getSourceType(r.sourceId))`
  and the existing title/English/MAL matching runs over that subset only.
- **Downloader** (`downloader.ts`, series resolution in `processQueue`):
  resolution order is
  1. a series whose `syncSource` equals `{ sourceId, mangaId }` of the job
     (this is how sync-queued downloads and re-downloads find a series that
     was moved to another category, or a Books-source series created before
     this change while still typed `comic`);
  2. otherwise `const type = getSourceType(job.metadata?.sourceId)` and the
     existing lookup (by slug, English title, name) filtered to
     `s.type === type`.
  A match by `syncSource` wins even when its type differs from the source's
  declared type; the series keeps its category. If no match and
  `slug` is taken by a series of another type, the new id is `${slug}-${type}`
  (if that is also taken by another type, `${slug}-${type}-2`, and so on;
  this is a corner the builder handles with a small loop). The series dir is
  `path.join(LIBRARY_DIR, typeDir(type), actualSlug)`; the record gets `type`
  and the matching placeholder.
- **CRZ handler** (`crz-handler.ts`): same lookup and collision rule, using
  the resolved type from section 1.
- **Chapter upload route** (`chapter-upload.ts`) creates `type: 'comic'`
  today; it gains an optional `type` body field, default `comic`.
- Sync (`sync.ts`) queues downloads with the series' `syncSource`, so rule 1
  above routes them back to the same series; `moveSeriesType` leaves
  `syncSource` untouched. The Discover local-chapter lookup is by series id.
  Neither needs a change. No migration of existing records: a Books-source
  series created before this change stays where it is until the user moves it
  from the editor (consistent with the "no automatic re-filing" non-goal).

### 4. Moving a series between categories

- New `moveSeriesType(id: string, newType: SeriesType): SeriesRecord` in
  `src/server/data.ts` (or a sibling module if data.ts is already large):
  1. Load the series; no-op if the type is unchanged.
  2. Locate the folder: `from` is the first of
     `LIBRARY_DIR/<dir>/id` over all three type dirs that exists (the record's
     own dir first). The type field has been editable without a move until
     now, so a record may already disagree with disk; this finds the folder
     wherever it is. `to = LIBRARY_DIR/typeDir(new)/id`. If `to` exists and
     is not `from`, throw a conflict error (409 at the route).
  3. If `from` exists and differs from `to`: `fs.mkdirSync(dirname(to))`,
     `fs.renameSync(from, to)`. Same volume is assumed (library is one tree);
     if rename fails with `EXDEV`, fall back to copy-then-remove. If no folder
     exists anywhere (empty series), skip the move and update the record only.
  4. Update the record: `type`, `placeholder` (`manga.png` / `magazine.png` /
     `book.png`), `saveSeries`. Invalidate the comics cache for that id so the
     next `loadComics` re-reads from the new path.
  5. Return the updated record.
- `PATCH /api/admin/catalog/:id` calls `moveSeriesType` when `req.body.type`
  differs from the current type, before applying the other editable fields.
  Failure to move leaves the record untouched and returns the error.
- Thumbnails are keyed by a hash of series id + file and live under
  `DATA_DIR/thumbnails`, so they survive. Reading progress, collections,
  favorites, pins, reader prefs and offline caches are keyed by series id and
  survive. The client refetches the series after save and the card moves to
  the other tab.

### 5. Shared file preview

All in `src/client/discover/` so both runtimes compile it:

- `fileUrl.ts`: `isFileUrl(url): boolean` (path, ignoring query, ends in
  `.pdf|.cbz|.cbr|.epub|.zip`) and `fileKind(url): 'pdf' | 'archive' | 'epub'
  | null`. The check works on the original URL; Bindery's proxy wraps the
  original in a `url=` query param, so the server decides (below) rather than
  the client decoding the proxy URL.
- Response contract for "pages" in both runtimes becomes
  `{ pages: string[]; fileUrl?: string }`:
  - Bindery `GET /api/discover/pages/:sourceId`: when `getPageUrls` returns a
    single URL and `isFileUrl` is true (server-side copy of the same helper or
    a shared util under `packages/addon-api`), respond
    `{ pages: [], fileUrl: '/api/discover/proxy-image?url=…' }`. The proxy
    already forwards the upstream content type; it must also forward `Range`
    request headers and `Content-Range`/`Accept-Ranges`/`Content-Length`
    response headers so pdf.js can stream (today it buffers the whole body;
    builder may switch it to piping).
  - Extension `GET_PAGES`: replace the `sourceId === 'archiveorg'` check with
    `isFileUrl(pages[0]) && pages.length === 1`.
- `PdfPreview` component (`PdfPreview.tsx`): props `{ fileUrl, chapterLabel,
  mangaTitle, onClose, maxPages = 20 }`. Opens the document with pdf.js
  (`getDocument({ url, rangeChunkSize })`), renders pages 1..min(n, maxPages)
  to canvases → blob URLs as they complete, and renders `PreviewReader` with
  those URLs (`loading` while fewer than the target are ready). Revokes blob
  URLs on unmount. Shows an inline error if the document fails to open.
- `FilePreviewNotice` (same file or sibling): for `fileKind` `epub` or
  `archive`, a modal with the same top bar as the reader saying "Preview isn't
  available for EPUB/CBZ files — download the chapter to read it", with a
  Download button that calls the same `onDownload` the detail sheet uses.
- Wiring: `DiscoverPage.handlePreview` and the extension popup's preview
  handler both branch on the response: `fileUrl` + pdf → `PdfPreview`;
  `fileUrl` + other → `FilePreviewNotice`; otherwise the existing image
  `PreviewReader`. The extension's reader page (`reader.html`) receives
  `fileUrl` through `chrome.storage.session` alongside `pages`.
- pdf.js in the extension: `src/client/lib/pdf.ts` sets `workerSrc` via a
  `?url` import; under crxjs the worker must be reachable from the reader page.
  Builder verifies; if the worker cannot load, pdf.js falls back to its
  main-thread fake worker, which is acceptable for a 20-page preview. The
  extension's `pdfjs-dist` resolves from `comic-reader/node_modules` through
  the alias path; if Vite refuses, add `pdfjs-dist` to the extension's
  dependencies at the same version.

### 6. Extension registration and file handling (`manga-finder`)

- `src/connectors/index.ts`: import `archiveorgBooksSource` from
  `@addons/archiveorg-books/index`, add to `sources`, add an `ALL_SOURCES`
  entry `{ id: 'archiveorg-books', name: 'Internet Archive Books', color:
  '#7c3aed', url: 'https://archive.org', favicon:
  'https://archive.org/favicon.ico', description: … }`. Add the manifest to
  `cdn-referers.ts`.
- New `src/connectors/source-types.ts`: imports each shared `addon.json` and
  exports `getSourceType(sourceId): 'comic' | 'magazine' | 'book'` (default
  `comic`; extension-only connectors are `comic`).
- Download pipeline (`service-worker.ts` chapter loop): after `getPageUrls`,
  if `pageEntries.length === 1 && isFileUrl(pageEntries[0])`:
  - `fileKind === 'pdf'`: fetch the blob and store it directly as the chapter
    PDF (`putPdf`), skipping image storage and `assembleChapterPdf`.
  - otherwise: mark the chapter failed with "Only PDF files can be downloaded
    by the extension — use Bindery's Discover for this one" and continue with
    the next chapter. (CBZ/EPUB conversion stays server-side.)
- `crz-packager.ts`: manifest gains `type: getSourceType(job.sourceId)`.
  `CrzManifest` type updated. Server side reads it (section 1).
- Version bump to 1.8.0; rebuild (`npm run build`), package
  (`./package-extension.sh`), copy the zip to
  `comic-reader/public/manga-finder-extension.zip`.
- `SOURCES.md`: Books row stays "both" once registered; the "Adding a new
  source" section gains the `seriesType` field and the source-types map step
  so the next add-on is not missed.

## Verification

- Unit (`npm test`): `typeDir`, collision id rule, `isFileUrl`/`fileKind`,
  `moveSeriesType` on a temp library dir (moves folder, updates record, 409 on
  existing target, no-op on same type, finds a folder under the wrong type
  dir, record-only when no folder), downloader resolution prefers a
  `syncSource` match over title+type, Discover annotation picks the same-type
  series and ignores the other type.
- Manual, Bindery dev server: library shows Manga / Mags / Books; download
  *Pride and Prejudice* (public domain) from Books with a same-named manga
  present → new `…-book` series under `books/`, manga chapters untouched;
  change a series' type in the editor → folder moves, card changes tab,
  reading progress intact; preview a Books PDF → pages render; preview an
  EPUB → notice.
- Manual, extension: load the rebuilt zip; Internet Archive Books pill
  present; preview a Books PDF through the shared viewer; download one PDF →
  CRZ with `type: 'book'` → import into Bindery lands under Books.

## Left to the builder

- Exact placement of `moveSeriesType` and the cache invalidation call.
- Whether `isFileUrl` lives in `packages/addon-api` (importable by server and
  client) or is duplicated once server-side.
- Proxy streaming details (pipe vs buffer, header allow-list).
- `book.png` artwork.
- Collision loop bound and error text.
