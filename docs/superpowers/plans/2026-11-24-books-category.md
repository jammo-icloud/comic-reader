# Books Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third library category, Books, make sources declare the category they produce so same-titled books and manga stay separate, let a series be moved between categories from the editor, give file-based sources a working instant reader shared by Bindery and the Chrome extension, and register the Books source in the extension.

**Architecture:** `type` on a series grows a third value `book` with a `books/` folder, resolved everywhere through one `typeDir()` helper. Add-on manifests gain `seriesType`; a pure `resolveTargetSeries()` picks the destination series by subscription first, then title within type, minting `<slug>-<type>` on a cross-type collision, and is shared by the downloader, the CRZ importer and Discover's annotation. A `moveSeriesType()` moves the folder and record. A `PdfPreview` component in the shared `src/client/discover/` folder renders the first pages of a PDF with pdf.js for both runtimes; the extension's preview and download paths branch on URL shape via an `isFileUrl()` helper in `@bindery/addon-api`.

**Tech Stack:** TypeScript, Express, React 19, pdfjs-dist 4.10, node:test via `tsx --test`, Vite + crxjs (extension).

**Spec:** `docs/superpowers/specs/2026-11-24-books-category-design.md`

## Global Constraints

- Series ids never change on a type move; nothing keyed by id (progress, collections, favorites, pins, reader prefs, thumbnails, offline caches) is touched.
- No behaviour keyed on a hardcoded source id. Category comes from the manifest, file handling from the URL.
- Code the extension needs lives only in `addons/`, `src/client/discover/`, `packages/addon-api/src/`, or `manga-finder/src/`.
- Existing add-ons without `seriesType` keep loading and default to `comic`.
- CRZ v1 manifests stay readable; `type` on them is optional.
- Books segment icon is lucide `Library`. Labels: Manga / Mags / Books.
- Books imported through the wizard use the comic filename convention (numbered chapter files).
- Test command for server and add-on code: `npm test` (runs `addons/**/*.test.ts` and `src/server/**/*.test.ts`). Type-check: `npx tsc -p tsconfig.server.json --noEmit` and `npx tsc --noEmit` (client).

## Review Focus

1. A series subscribed to a comic-type source that the user has moved to Books: the next sync must land in that same series, not create `<slug>-comic`. Pinned by `resolveTargetSeries` test "syncSource match wins over type" (Task 3).
2. A series whose record type disagrees with its folder on disk (type was editable without a move): moving it must find the folder and succeed. Pinned by `moveSeriesDir` test "finds folder under another type dir" (Task 4).
3. A cross-type slug collision where `<slug>-<type>` is also taken by yet another type: must still mint a unique id and never return an id owned by another type. Pinned by test "collision suffix increments" (Task 3).
4. A proxy-image request for a PDF with a `Range` header: must return 206 with `Content-Range` so pdf.js can stream, and must not buffer the whole body. Pinned by a manual curl check in Task 6 (no HTTP test harness exists in the repo).
5. Extension download of a single-file CBZ/EPUB chapter: must mark that chapter failed with the explanatory message and continue with the next chapter, not feed the archive into the JPEG transcoder. Pinned by manual verification in Task 7 (extension has no test runner).

---

### Task 1: `SeriesType`, `typeDir()`, and the third category on the server

**Files:**
- Modify: `src/server/data.ts:62` (SeriesRecord.type), add helper near `slugify` (`:31`)
- Modify: `src/server/scanner.ts:19`, `src/server/cleanup.ts:60-68,102`, `src/server/merge.ts:102`, `src/server/pdf-optimizer.ts:205`, `src/server/importer.ts:53,62,118,233,258,337`, `src/server/crz-handler.ts:143,151,245`, `src/server/downloader.ts:380`, `src/server/routes/library.ts:483`, `src/server/routes/admin.ts:70,147,229,277`, `src/server/routes/chapter-upload.ts:101`
- Modify: `src/server/crz-format.ts:98,186-188,275`
- Create: `public/placeholders/book.png`
- Test: `src/server/data.test.ts` (new), `src/server/crz-format.test.ts` (new)

**Interfaces:**
- Produces: `export type SeriesType = 'comic' | 'magazine' | 'book'` and `export function typeDir(type: SeriesType): 'comics' | 'magazines' | 'books'` in `src/server/data.ts`; `export function placeholderFor(type: SeriesType): 'manga.png' | 'magazine.png' | 'book.png'` in the same file. `SeriesRecord.type: SeriesType`.

- [ ] **Step 1: Write the failing tests**

`src/server/data.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typeDir, placeholderFor } from './data.js';

test('typeDir maps each series type to its library folder', () => {
  assert.equal(typeDir('comic'), 'comics');
  assert.equal(typeDir('magazine'), 'magazines');
  assert.equal(typeDir('book'), 'books');
});

test('placeholderFor maps each series type to its placeholder image', () => {
  assert.equal(placeholderFor('comic'), 'manga.png');
  assert.equal(placeholderFor('magazine'), 'magazine.png');
  assert.equal(placeholderFor('book'), 'book.png');
});
```

`src/server/crz-format.test.ts` — use the existing exported v2 validator (read `crz-format.ts:160-200` for its name and the minimal valid manifest shape; build a fixture from the schema at `:268-300`):
```ts
test('v2 manifest accepts type "book"', () => {
  const r = validateManifestV2({ ...minimalV2, type: 'book' });
  assert.equal(r.ok, true, JSON.stringify(r));
});
test('v2 manifest still rejects unknown type', () => {
  const r = validateManifestV2({ ...minimalV2, type: 'novel' });
  assert.equal(r.ok, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | tail -20`
Expected: FAIL — `typeDir` / `placeholderFor` not exported; `type "book"` rejected with `type must be 'comic' or 'magazine'`.

- [ ] **Step 3: Add `SeriesType`, `typeDir`, `placeholderFor` to `data.ts`; widen `SeriesRecord.type`**

- [ ] **Step 4: Replace every `=== 'comic' ? 'comics' : 'magazines'` ternary with `typeDir(series.type)`**

Files and lines listed above. In `cleanup.ts:60-68` compute `parentExists` by checking `fs.existsSync(path.join(LIBRARY_DIR, typeDir(series.type)))` (cache the three results in a small map instead of two booleans). In `routes/admin.ts:70` sum `getDirSize` over all three dirs. In `importer.ts:233` widen `canonicalFilename(sourceFile, type: SeriesType)` and treat `book` like `comic` (numbered chapter files); `:337` uses `placeholderFor(type)`; `:53,:62` widen to `SeriesType`. `chapter-upload.ts:101`: read an optional `type` field from the request body, validate it is one of the three, default `'comic'`, use it for the record and `typeDir` for the destination dir (`destDir` is computed above `:85`; follow it up to where `comics` is hardcoded).

- [ ] **Step 5: CRZ format: widen `type` at `crz-format.ts:98` to `SeriesType`, schema enum at `:275` to `['comic','magazine','book']`, and the v2 check at `:186-188` to the same three with message `type must be 'comic', 'magazine' or 'book'`. Make `CrzManifestV1.type?: SeriesType` optional (around `:61`).**

- [ ] **Step 6: Create `public/placeholders/book.png`**

Same dimensions as `public/placeholders/manga.png` (check with `sips -g pixelWidth -g pixelHeight`), same muted style, a simple closed-book glyph. Any quick method is fine (e.g. render an SVG to PNG with `sips` or a Node script using `sharp` if present in `node_modules`; otherwise copy `manga.png` as a stand-in and note it in the ledger).

- [ ] **Step 7: Run tests and type-check**

Run: `npm test 2>&1 | tail -20 && npx tsc -p tsconfig.server.json --noEmit`
Expected: all tests PASS; no type errors (the compiler will flag any ternary you missed because `'books'` isn't in the old union).

- [ ] **Step 8: Commit**

```bash
git add src/server public/placeholders/book.png
git commit -m "feat(library): third series type 'book' with typeDir() and books/ folder"
```

---

### Task 2: Sources declare their type; `isFileUrl` helper

**Files:**
- Modify: `packages/addon-api/src/index.ts` (AddonManifest ~`:18-45`; add exports)
- Modify: `src/server/addons/loader.ts:46-52`
- Modify: `src/server/sources/index.ts:62-70,168-170`
- Modify: `addons/archiveorg-books/addon.json`
- Test: `packages/addon-api/src/index.test.ts` (new; add `"packages/addon-api/src/**/*.test.ts"` to the `test` script glob in `package.json:16`)

**Interfaces:**
- Produces, in `@bindery/addon-api`: `export type SeriesType = 'comic' | 'magazine' | 'book'`; `AddonManifest.seriesType?: SeriesType`; `export function isFileUrl(url: string): boolean` (single URL whose pathname, ignoring query/hash, ends in `.pdf|.cbz|.cbr|.epub|.zip`, case-insensitive); `export function fileKind(url: string): 'pdf' | 'archive' | 'epub' | null` (`archive` for cbz/cbr/zip).
- Produces, in `src/server/sources/index.ts`: `export function getSourceType(sourceId: string): SeriesType` (manifest `seriesType` or `'comic'`); `getAllSources()` entries gain `seriesType`.
- `src/server/data.ts` re-exports `SeriesType` from `@bindery/addon-api` instead of declaring its own (one definition).

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFileUrl, fileKind } from './index.js';

test('isFileUrl recognises file downloads by path extension, ignoring query', () => {
  assert.equal(isFileUrl('https://archive.org/download/x/Book%201.pdf'), true);
  assert.equal(isFileUrl('https://archive.org/download/x/vol1.CBZ?download=1'), true);
  assert.equal(isFileUrl('https://archive.org/download/x/book.epub#frag'), true);
  assert.equal(isFileUrl('https://cdn.example.com/pages/001.jpg'), false);
  assert.equal(isFileUrl('node|hash|file.jpg'), false);
});

test('fileKind classifies pdf, archive and epub', () => {
  assert.equal(fileKind('https://a/b.pdf'), 'pdf');
  assert.equal(fileKind('https://a/b.cbr'), 'archive');
  assert.equal(fileKind('https://a/b.zip'), 'archive');
  assert.equal(fileKind('https://a/b.epub'), 'epub');
  assert.equal(fileKind('https://a/b.jpg'), null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -20`
Expected: FAIL — `isFileUrl` is not exported.

- [ ] **Step 3: Implement `SeriesType`, `seriesType`, `isFileUrl`, `fileKind` in `packages/addon-api/src/index.ts`; document `seriesType` in the manifest JSDoc ("Library category series from this source are filed under. Default comic.")**

Parse with `new URL(url)` inside try/catch; a non-URL returns false/null.

- [ ] **Step 4: Loader validation** — in `readManifest` (`loader.ts:46-52`) add: if `raw.seriesType !== undefined && !['comic','magazine','book'].includes(raw.seriesType)` throw `addon.json: seriesType "<v>" must be comic, magazine or book`.

- [ ] **Step 5: `getSourceType` in `sources/index.ts` next to `getSourceTags`; add `seriesType: m?.seriesType ?? 'comic'` to the `getAllSources()` return type and object.**

- [ ] **Step 6: `addons/archiveorg-books/addon.json`: add `"seriesType": "book"`. `src/server/data.ts`: replace the local `SeriesType` with `import type { SeriesType } from '@bindery/addon-api'` and `export type { SeriesType }`.**

- [ ] **Step 7: Run tests, type-check, rebuild addon-api**

Run: `npm run build -w @bindery/addon-api && npm test 2>&1 | tail -20 && npx tsc -p tsconfig.server.json --noEmit`
Expected: PASS, no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/addon-api src/server/addons/loader.ts src/server/sources/index.ts src/server/data.ts addons/archiveorg-books/addon.json package.json
git commit -m "feat(addon-api): seriesType manifest field and isFileUrl helper"
```

---

### Task 3: `resolveTargetSeries` — subscription first, then title within type, collision suffix

**Files:**
- Create: `src/server/series-resolve.ts`
- Modify: `src/server/downloader.ts:360-396`, `src/server/crz-handler.ts:124-135` (v1), `src/server/routes/discover.ts:30-55`
- Test: `src/server/series-resolve.test.ts`

**Interfaces:**
- Consumes: `SeriesRecord`, `SeriesType`, `slugify` from `data.ts`; `getSourceType` from `sources/index.ts`.
- Produces:
  ```ts
  export interface ResolveInput { title: string; sourceId: string; mangaId?: string | null; type: SeriesType }
  export interface Resolved { existing: SeriesRecord | null; id: string }
  export function resolveTargetSeries(all: SeriesRecord[], input: ResolveInput): Resolved
  ```
  Rules, in order: (1) `existing` = series with `syncSource?.sourceId === sourceId && syncSource?.mangaId === mangaId` (only when `mangaId` is non-empty); (2) else series with `type === input.type` and (`id === slugify(title)` or `name`/`englishTitle` equal to title case-insensitively); (3) else `existing = null` and `id` = `slugify(title)` if no series of any type owns it, else `${slug}-${type}`, else `${slug}-${type}-2`, `-3`, … until free. When `existing` is set, `id = existing.id`.

- [ ] **Step 1: Write the failing tests**

Build records with a small `mk(id, type, extra?)` helper (fill required `SeriesRecord` fields with nulls/empty).
```ts
test('syncSource match wins over type', () => {
  const moved = mk('dcc', 'book', { syncSource: { sourceId: 'mangadex', mangaId: 'm1' }, name: 'Dungeon Crawler Carl' });
  const r = resolveTargetSeries([moved], { title: 'Dungeon Crawler Carl', sourceId: 'mangadex', mangaId: 'm1', type: 'comic' });
  assert.equal(r.existing?.id, 'dcc');
});
test('same title, other type → new id with type suffix', () => {
  const manga = mk('dungeon-crawler-carl', 'comic', { name: 'Dungeon Crawler Carl' });
  const r = resolveTargetSeries([manga], { title: 'Dungeon Crawler Carl', sourceId: 'archiveorg-books', mangaId: 'series:dcc', type: 'book' });
  assert.equal(r.existing, null);
  assert.equal(r.id, 'dungeon-crawler-carl-book');
});
test('same title, same type → merges into existing', () => { /* expects existing.id === 'dungeon-crawler-carl' */ });
test('collision suffix increments', () => {
  const all = [mk('x', 'comic', { name: 'X' }), mk('x-book', 'magazine', { name: 'X other' })];
  const r = resolveTargetSeries(all, { title: 'X', sourceId: 's', type: 'book' });
  assert.equal(r.id, 'x-book-2');
});
test('english title matches within type only', () => { /* englishTitle on a magazine must not match a comic job */ });
test('no mangaId skips the syncSource rule', () => { /* mangaId undefined → falls to title rule */ });
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -20` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `series-resolve.ts`**

- [ ] **Step 4: Run tests** — Expected: PASS.

- [ ] **Step 5: Wire the downloader** (`downloader.ts:360-396`): replace `slugName`/`existingBySlug`/`existingByEnglish` with
`const type = getSourceType(job.metadata?.sourceId || '')` and `const { existing, id: actualSlug } = resolveTargetSeries(loadAllSeries(), { title: job.mangaTitle, sourceId: job.metadata?.sourceId || '', mangaId: job.mangaDexId, type })`. Series dir uses `typeDir(type)` for a new series, `typeDir(existing.type)` for an existing one. New record: `type`, `placeholder: placeholderFor(type)`.

- [ ] **Step 6: Wire CRZ v1** (`crz-handler.ts:124-135`): `const type = manifest.type ?? getSourceType(manifest.sourceId)`; `resolveTargetSeries(allExisting, { title: manifest.title, sourceId: manifest.sourceId, mangaId: null, type })`; new record gets `type` and `placeholderFor(type)`; `seriesDir` uses `typeDir(series.type)` (replacing the hardcoded `'comics'` at `:143`). Read `resolveDestinationSeriesV2` and apply the same type-within-match filter there if it matches by title; v2 manifests carry `type` already.

- [ ] **Step 7: Wire Discover annotation** (`routes/discover.ts:30-55`): per result, `const { existing } = resolveTargetSeries(allSeries, { title: r.title, sourceId: r.sourceId, mangaId: r.mangaId, type: getSourceType(r.sourceId) })`; `localSeriesId = existing?.id ?? null`. Remove the four now-unused maps/finds. Keep the `byMalId` map only if it is still used elsewhere in the handler.

- [ ] **Step 8: Type-check and full test run**

Run: `npx tsc -p tsconfig.server.json --noEmit && npm test 2>&1 | tail -20` — Expected: clean, PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/series-resolve.ts src/server/series-resolve.test.ts src/server/downloader.ts src/server/crz-handler.ts src/server/routes/discover.ts
git commit -m "feat(downloader): resolve target series by subscription, then title within type"
```

---

### Task 4: Move a series between categories

**Files:**
- Create: `src/server/series-move.ts`
- Modify: `src/server/data.ts` (add `moveSeriesType`, export `invalidateComics(seriesId)`)
- Modify: `src/server/routes/admin.ts:194-216`
- Modify: `src/client/components/SeriesEditModal.tsx:272-281`, `src/client/components/PendingList.tsx:18,204-230`
- Test: `src/server/series-move.test.ts`

**Interfaces:**
- Produces, `series-move.ts`:
  ```ts
  export function findSeriesDir(libraryDir: string, id: string, preferred: SeriesType): string | null  // first existing of preferred dir, then the other two
  export function moveSeriesDir(libraryDir: string, id: string, from: SeriesType, to: SeriesType): { moved: boolean; from: string | null; to: string }
  ```
  `moveSeriesDir` throws `Error` with `code = 'EEXIST'` when the target exists and differs from the source; returns `{ moved: false, from: null, to }` when no folder exists anywhere; renames (falls back to copy+remove on `EXDEV`).
- Produces, `data.ts`: `export function moveSeriesType(id: string, newType: SeriesType): SeriesRecord` — no-op returning the record if unchanged; calls `moveSeriesDir(LIBRARY_DIR, id, series.type, newType)`; on success sets `type`, `placeholder = placeholderFor(newType)`, `saveSeries`, `invalidateComics(id)` (deletes the `comicsCache` entry), returns the record. Throws before touching the record if the move throws.

- [ ] **Step 1: Write the failing tests** (`series-move.test.ts`, using `fs.mkdtempSync` for a temp library)

```ts
test('moves folder from comics/ to books/', ...);            // creates lib/comics/x/a.pdf; after move lib/books/x/a.pdf exists, lib/comics/x gone
test('finds folder under another type dir when record disagrees', ...); // folder in magazines/, from='comic' → still moved to books/
test('record-only when no folder exists', ...);              // returns { moved: false, from: null }
test('throws EEXIST when target already exists', ...);
test('same type is a no-op', ...);                            // from === to → { moved: false }
```

- [ ] **Step 2: Run to verify failure** — Expected: module not found.

- [ ] **Step 3: Implement `series-move.ts`, then `moveSeriesType` and `invalidateComics` in `data.ts`**

- [ ] **Step 4: Run tests** — Expected: PASS.

- [ ] **Step 5: Admin route** (`admin.ts:194-216`): before the editable-fields loop, `if (req.body.type !== undefined && req.body.type !== series.type)`: validate it is a `SeriesType` (400 otherwise), `try { moveSeriesType(id, req.body.type) } catch (e) { 409 if e.code === 'EEXIST', else 500 with message; return }`; then reload the series and continue with the other fields (drop `'type'` from `editable` so the loop does not overwrite it).

- [ ] **Step 6: Client editor**: `SeriesEditModal.tsx:279` add `<option value="book">Book</option>`; the state type at `:37` is inferred from `series.type`, which widens via `types.ts` in Task 5 (temporarily cast if needed). `PendingList.tsx`: widen `editType` state to `'comic' | 'magazine' | 'book'`, add a third button `Library` icon + "Book" following the two existing buttons; the MAL match block (`editType === 'comic'`) stays comic-only; the brand image block stays magazine-only.

- [ ] **Step 7: Type-check server and client**

Run: `npx tsc -p tsconfig.server.json --noEmit && npx tsc --noEmit` — Expected: clean (client may show errors in `types.ts` consumers until Task 5; if so, do Task 5 Step 3 first and re-run).

- [ ] **Step 8: Commit**

```bash
git add src/server/series-move.ts src/server/series-move.test.ts src/server/data.ts src/server/routes/admin.ts src/client/components/SeriesEditModal.tsx src/client/components/PendingList.tsx
git commit -m "feat(admin): changing a series type moves its folder and index"
```

---

### Task 5: Books tab in the library client

**Files:**
- Modify: `src/client/lib/types.ts:10,112`, `src/client/lib/api.ts:115,264,648`
- Modify: `src/client/components/LibraryToolbar.tsx:34-36,157-160,185`
- Modify: `src/client/pages/LibraryPage.tsx:29-32`
- Modify: `src/client/discover/types.ts` (`DiscoverSourceConfig.seriesType?: SeriesType`)

**Interfaces:**
- Produces: `export type SeriesType = 'comic' | 'magazine' | 'book'` in `src/client/lib/types.ts`; `Series.type: SeriesType`; `ImportPreview.suggestedType: SeriesType`; `getCatalog(type?: SeriesType)`, `getSeries(type?: SeriesType)`, `confirmImport(..., type: SeriesType, ...)`; `LibraryToolbarProps.typeFilter: SeriesType`, `onTypeChange: (t: SeriesType) => void`.

- [ ] **Step 1: Widen the types and API params listed above.**

- [ ] **Step 2: `LibraryToolbar.tsx`**: import `Library` from `lucide-react`; add `{ value: 'book', label: 'Books', icon: <Library size={13} /> }` as the third option; placeholder becomes a small map `{ comic: 'manga', magazine: 'magazines', book: 'books' }` → `` `Search ${noun}…` ``.

- [ ] **Step 3: `LibraryPage.tsx:29-32`**: state type `SeriesType`; initialiser `saved === 'magazine' || saved === 'book' ? saved : 'comic'`. Confirm the `typeFilter`-dependent effects (`:64,:82,:127`) compile unchanged.

- [ ] **Step 4: Type-check and build the client**

Run: `npx tsc --noEmit && npx vite build 2>&1 | tail -5` — Expected: clean.

- [ ] **Step 5: Verify in the browser** (preview_start `comic-reader`, sign in with any dev credentials): the toolbar shows Manga / Mags / Books with the Library icon; selecting Books shows an empty state; reload keeps Books selected; the series editor type dropdown lists Book; the import wizard type picker shows Book.

- [ ] **Step 6: Commit**

```bash
git add src/client
git commit -m "feat(library): Books segment beside Manga and Mags"
```

---

### Task 6: Shared PDF preview for file sources (Bindery side)

**Files:**
- Modify: `src/server/routes/discover.ts:84-98` (pages route), `:116-135` (proxy-image)
- Modify: `src/client/lib/api.ts:722-724`
- Create: `src/client/discover/PdfPreview.tsx`, `src/client/discover/FilePreviewNotice.tsx`
- Modify: `src/client/pages/DiscoverPage.tsx:35-37,200-215,532-540`
- Test: none automated for React; the pages route contract is checked by curl below.

**Interfaces:**
- Produces: `GET /api/discover/pages/:sourceId` → `{ pages: string[]; fileUrl?: string }` where `fileUrl` is set (and `pages` is `[]`) when the source returned exactly one URL and `isFileUrl` is true; `fileUrl` is the proxied form `/api/discover/proxy-image?url=<encoded original>`.
- Produces: `discoverPages()` return type `Promise<{ pages: string[]; fileUrl?: string }>`.
- Produces components (both default-exported, props exported):
  ```ts
  // PdfPreview.tsx
  export interface PdfPreviewProps { fileUrl: string; chapterLabel: string; mangaTitle: string; onClose: () => void; maxPages?: number /* default 20 */ }
  // FilePreviewNotice.tsx
  export interface FilePreviewNoticeProps { kind: 'archive' | 'epub'; chapterLabel: string; mangaTitle: string; onClose: () => void; onDownload?: () => void }
  ```
  `PdfPreview` imports `pdfjs-dist` through `../lib/pdf` (which already sets `workerSrc`); add to `lib/pdf.ts` one export `export function openPdf(url: string): Promise<PdfDoc>` that calls `pdfjsLib.getDocument({ url, rangeChunkSize: 262144 }).promise` (no cache lookup; previews are never cached). `PdfPreview` renders page 1..min(numPages, maxPages) sequentially to a canvas at a width of 1200px, converts each to a blob URL (`canvas.toBlob` → `URL.createObjectURL`), appends to a `pages` state array, passes `pages` and `loading={pages.length < target}` to `PreviewReader`, revokes all blob URLs on unmount, and renders an inline error panel (same top bar as PreviewReader) if `openPdf` rejects.
  `FilePreviewNotice` renders a fixed full-screen panel with the reader's top bar (title, chapter label, close X) and the copy: `Preview isn't available for ${kind === 'epub' ? 'EPUB' : 'CBZ/CBR'} files — download the chapter to read it.` plus a Download button when `onDownload` is given.

- [ ] **Step 1: Pages route**: after `getPageUrls`, `if (pages.length === 1 && isFileUrl(pages[0])) { res.json({ pages: [], fileUrl: proxied(pages[0]) }); return; }` (import `isFileUrl` from `@bindery/addon-api`).

- [ ] **Step 2: Proxy streaming** (`:116-135`): forward `Range` from the request to the upstream fetch; copy `Content-Type`, `Content-Length`, `Content-Range`, `Accept-Ranges` from the upstream response; set `res.status(response.status)` (200 or 206); pipe `response.body` to `res` via `Readable.fromWeb(response.body as any).pipe(res)` instead of buffering. Keep the `Cache-Control` header. Non-OK upstream statuses still end the response with that status.

- [ ] **Step 3: Verify the proxy with curl** (dev server running on 5880; `--cookie` with a dev session if the route is behind auth — check `src/server/index.ts` for whether `/api/discover` requires auth; in dev any credentials sign in):

```bash
curl -s -o /dev/null -D - -H 'Range: bytes=0-1023' "http://localhost:5880/api/discover/proxy-image?url=https%3A%2F%2Farchive.org%2Fdownload%2Fprideandprejudice00aust_2%2Fprideandprejudice00aust_2.pdf" | head -12
```
Expected: `HTTP/1.1 206`, `Content-Range: bytes 0-1023/...`, `Content-Type: application/pdf`. (If that identifier 404s, pick any PDF from `https://archive.org/advancedsearch.php?q=title%3A%28pride+and+prejudice%29+AND+mediatype%3Atexts&fl%5B%5D=identifier&rows=3&output=json`.)

- [ ] **Step 4: `api.ts:722`** return type widened to `{ pages: string[]; fileUrl?: string }`.

- [ ] **Step 5: Create `PdfPreview.tsx` and `FilePreviewNotice.tsx`; add `openPdf` to `lib/pdf.ts`.**

- [ ] **Step 6: Wire `DiscoverPage.tsx`**: add state `filePreview: { url: string; kind: 'pdf' | 'archive' | 'epub' } | null`. In `handlePreview`, after `discoverPages`: if `data.fileUrl`, `const kind = fileKind(decodeURIComponent(new URL(data.fileUrl, location.origin).searchParams.get('url') || ''))` (import `fileKind` from `@bindery/addon-api`; fall back to `'pdf'` when null and the response says fileUrl), set `filePreview`, set `previewPages(null)`, return. Render `PdfPreview` when `filePreview?.kind === 'pdf'`, `FilePreviewNotice` otherwise (its `onDownload` queues that single chapter through the same `startDownload` call the detail sheet uses), both with `onClose={() => setFilePreview(null)}`.

- [ ] **Step 7: Type-check and verify in the browser**: on Discover pick Internet Archive Books, search "pride and prejudice", open a result, click the preview (play) icon on a PDF chapter → the preview reader shows rendered pages, page counter advances while scrolling, close works. Find an EPUB-only chapter (search "emma", look for an `.epub` result, or temporarily test with the comics source) → the notice appears with the download button. Image sources (MangaDex) still preview as before.

Run: `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/server/routes/discover.ts src/client/lib/api.ts src/client/lib/pdf.ts src/client/discover/PdfPreview.tsx src/client/discover/FilePreviewNotice.tsx src/client/pages/DiscoverPage.tsx
git commit -m "feat(discover): instant reader for PDF file sources, notice for EPUB/CBZ"
```

---

### Task 7: Extension — register Books, file-aware preview and download, typed CRZ

**Files (all under `/Users/jamesmorris/Documents/source/manga-finder`):**
- Modify: `src/connectors/index.ts` (imports, `sources`, `ALL_SOURCES`), `src/connectors/cdn-referers.ts:5-19`
- Create: `src/connectors/source-types.ts`
- Modify: `src/background/service-worker.ts:88-96` (GET_PAGES), `:193-262` (download loop)
- Modify: `src/background/crz-packager.ts:10-22,80-96`
- Modify: `src/popup/App.tsx:127-154`, `src/reader/ReaderApp.tsx`
- Modify: `manifest.json` (version `1.8.0`), `package.json` (add `pdfjs-dist` at the same version as comic-reader if Vite cannot resolve it through the alias)
- Modify (comic-reader): `SOURCES.md`, `public/manga-finder-extension.zip`

**Interfaces:**
- Consumes: `archiveorgBooksSource` from `@addons/archiveorg-books/index`; `isFileUrl`, `fileKind`, `SeriesType` from `@bindery/addon-api`; `PdfPreview`, `FilePreviewNotice` from `@bindery/discover/...`.
- Produces: `export function getSourceType(sourceId: string): SeriesType` in `source-types.ts` (reads `seriesType` from each imported `addon.json`, default `comic`); `CrzManifest.type: SeriesType`; `GET_PAGES` response `{ type: 'PAGES', pages: string[], fileUrl?: string }` (unchanged shape, new trigger); `previewData` in `chrome.storage.session` gains `fileUrl?: string` and `fileKind?: 'pdf' | 'archive' | 'epub'`.

- [ ] **Step 1: Register the source**: in `connectors/index.ts` import `archiveorgBooksSource`, add `'archiveorg-books': archiveorgBooksSource` to `sources`, and append to `ALL_SOURCES` `{ id: 'archiveorg-books', name: 'Internet Archive Books', color: '#7c3aed', url: 'https://archive.org', favicon: 'https://archive.org/favicon.ico', description: 'Books, novels and non-fiction (PDF/EPUB), grouped by series.' }`. In `cdn-referers.ts` import `archiveorgBooks from '@addons/archiveorg-books/addon.json'` and add it to `manifests`.

- [ ] **Step 2: `source-types.ts`**: import the same ten shared `addon.json` files plus `archiveorg-books`; build `Map<id, seriesType ?? 'comic'>`; export `getSourceType`.

- [ ] **Step 3: GET_PAGES** (`service-worker.ts:88-96`): replace the `request.sourceId === 'archiveorg'` block with `if (pages.length === 1 && isFileUrl(pages[0])) return { type: 'PAGES', pages: [], fileUrl: pages[0] };`.

- [ ] **Step 4: Download loop** (`service-worker.ts` right after the `pageEntries.length === 0` check, before `getChapterImageCount`): 
  ```
  if (pageEntries.length === 1 && isFileUrl(pageEntries[0])) {
    if (fileKind(pageEntries[0]) !== 'pdf') { console.warn(`Ch.${chapterNum}: ${kind} files can only be downloaded through Bindery's Discover — skipping`); skippedCount++; continue; }
    fetch with the same headers/referer logic as the image branch → blob → putPdf(job.id, i, blob); update progress (pagesDownloaded = pagesTotal = 1); broadcast; continue;
  }
  ```
  If the job's existing "skipped chapters" summary surfaces `skippedCount` to the user (check how `skippedCount` is reported at the end of the loop), make sure the reason string reaches it; otherwise set `job.error` text for an all-skipped job to `Only PDF files can be downloaded by the extension — use Bindery's Discover for this one`.

- [ ] **Step 5: CRZ manifest**: add `type: SeriesType` to `CrzManifest` and `type: getSourceType(job.sourceId)` to the manifest object at `:80-96`.

- [ ] **Step 6: Popup and reader**: in `App.tsx:138-141` replace `chrome.tabs.create({ url: res.fileUrl })` with storing `{ pages: [], fileUrl: res.fileUrl, fileKind: fileKind(res.fileUrl) ?? 'pdf', chapterLabel, mangaTitle }` in `previewData` and opening `reader.html` as the image path does. In `ReaderApp.tsx`, when `data.fileUrl` is set render `PdfPreview` for `fileKind === 'pdf'` and `FilePreviewNotice` otherwise (no `onDownload` in the reader tab; `onClose={() => window.close()}`).

- [ ] **Step 7: Build**: `cd /Users/jamesmorris/Documents/source/manga-finder && npm run build 2>&1 | tail -20`. Expected: success. If Vite fails to resolve `pdfjs-dist` from the aliased `lib/pdf.ts`, `npm i pdfjs-dist@<comic-reader version>` in the extension and rebuild. If the built reader page cannot load the pdf.js worker (check the service-worker/reader console after Step 9), accept pdf.js's main-thread fallback and note it in the ledger; do not add `web_accessible_resources` unless the fallback also fails.

- [ ] **Step 8: Version and package**: set `manifest.json` version to `1.8.0`; run `./package-extension.sh`; copy `manga-finder-extension.zip` to `/Users/jamesmorris/Documents/source/comic-reader/public/manga-finder-extension.zip`.

- [ ] **Step 9: Manual verification in Chrome** (load unpacked from `manga-finder/dist`): the source picker shows "Internet Archive Books"; search "pride and prejudice", open a result, preview a PDF chapter → the shared viewer renders pages in the reader tab; preview an EPUB chapter → the notice; download one PDF chapter → a `.crz` lands in Downloads whose `manifest.json` has `"type": "book"`; import that `.crz` into the Bindery dev server → the series appears under Books. Also confirm an image source (MangaDex) still previews and downloads. Record the results in the ledger; if Chrome is unavailable in this session, say so plainly in the final report instead of claiming verification.

- [ ] **Step 10: Commit (two repos)**

```bash
cd /Users/jamesmorris/Documents/source/manga-finder && git add -A src manifest.json package.json package-lock.json && git commit -m "feat: Internet Archive Books source, file-aware preview and download, typed CRZ (v1.8.0)"
cd /Users/jamesmorris/Documents/source/comic-reader && git add public/manga-finder-extension.zip && git commit -m "chore(extension): ship Manga Finder 1.8.0 with Internet Archive Books"
```

---

### Task 8: Docs

**Files:**
- Modify: `SOURCES.md` (catalog row, "Adding a new source" step 3, manifest field table)

- [ ] **Step 1**: In "Adding a new source" step 3 add: also import the manifest in `cdn-referers.ts` and `source-types.ts`. In the manifest fields table add `seriesType` — "Library category for series from this source: comic (default), magazine or book." Confirm the Books row says Shared = both (now true).

- [ ] **Step 2: Commit**

```bash
git add SOURCES.md
git commit -m "docs(sources): seriesType field and extension registration steps"
```
