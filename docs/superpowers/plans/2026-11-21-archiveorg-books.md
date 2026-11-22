# Internet Archive Books Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `archiveorg-books` source addon that searches archive.org text items outside the comic collections, groups uploads into book series, and lists one downloadable chapter per book.

**Architecture:** The comics addon's file-picking helpers move into `addons/archiveorg/files.ts` and are imported by both addons. The new addon keeps all title parsing and grouping in a pure module, `addons/archiveorg-books/series.ts`, so it is unit-tested without network; `index.ts` only wires archive.org HTTP calls to those helpers. Chapter ids keep the `identifier|filename` shape so the downloader's single-file path is untouched.

**Tech Stack:** TypeScript addon compiled by `tsc -p tsconfig.addons.json`; `@bindery/addon-api` (`createFetch`, `MangaSource`); tests with Node's built-in `node:test` run through `tsx --test` (verified working on Node 26 with `.js`-suffixed TS imports).

**Spec:** `docs/superpowers/specs/2026-11-21-archiveorg-books-design.md`

## Global Constraints

- Addon id `archiveorg-books`; `source.id` must equal the manifest id (loader check).
- Relative imports between addon files use the `.js` suffix (`./files.js`), as `addons/mangadex/index.ts` does.
- `tsconfig.addons.json` must exclude `**/*.test.ts` so tests never land in `dist/addons`.
- The comics addon `addons/archiveorg/index.ts` keeps identical runtime behaviour; only its helpers move.
- Series ids are `series:<seriesKey>`; chapter ids are `<identifier>|<filename>`.
- Search query scope: `mediatype:texts AND NOT (<comics scopeFilter>)` where the scopeFilter is the exact OR-list in `addons/archiveorg/index.ts:143-154`.
- Work happens on branch `feature/archiveorg-books` off `main`; use `/opt/homebrew/bin/git` if bare `git` fails.
- Live verification downloads use a public-domain book (Pride and Prejudice), never the Dungeon Crawler Carl uploads.

## Review Focus

- A title ending in the author's name with no `creator` field ("Dungeon Crawler Carl Matt Dinniman", creator null) stays its own one-book group rather than being guessed into the series; pinned in Task 2.
- "Part N" that lives only in a subtitle ("Dungeon Crawler Carl: Part 1 of ...") must not become book 1 and collide with the real Book 1; pinned in Task 2.
- Many scans of one book (eight "Pride and prejudice" editions) are all unnumbered; they must get distinct chapter numbers and a year suffix in the title so a reader can tell editions apart; pinned in Task 2.
- `creator` arrives as a string, an array, or null; all three must parse; pinned in Task 2.
- An item whose only original files are OCR derivatives or unsupported formats yields no chapter rather than a broken one; pinned in Task 1 (`bestFile` returns null) and Task 3 (member dropped).

---

### Task 1: Extract the shared file picker and set up the test runner

**Files:**
- Create: `addons/archiveorg/files.ts`
- Create: `addons/archiveorg/files.test.ts`
- Modify: `addons/archiveorg/index.ts:26-134` (delete the moved code, import it)
- Modify: `package.json` (scripts), `tsconfig.addons.json` (exclude)

**Interfaces:**
- Produces, all exported from `addons/archiveorg/files.ts`:
  - `interface ArchiveFile { name: string; size: string; format: string; source: string }`
  - `extractVolumeNumber(filename: string): number | null` (moved unchanged)
  - `scoreFile(file: ArchiveFile): number` (moved unchanged)
  - `pickCanonicalFiles(files: ArchiveFile[]): { volume: number; name: string }[]` (moved unchanged)
  - `bestFile(files: ArchiveFile[]): ArchiveFile | null` (new): among files with `source === 'original'` and a `.pdf|.cbz|.cbr|.epub` name, the one with the highest `scoreFile`; `null` when none scores above 0.

- [ ] **Step 1: Add the test script and exclude tests from the addon build**

In `package.json` scripts add `"test": "tsx --test \"addons/**/*.test.ts\""`. In `tsconfig.addons.json` add `"exclude": ["addons/**/*.test.ts"]`.

- [ ] **Step 2: Write the failing characterization tests**

`addons/archiveorg/files.test.ts`, using `node:test` and `node:assert/strict`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractVolumeNumber, scoreFile, pickCanonicalFiles, bestFile, type ArchiveFile } from './files.js';

const f = (name: string, size = '1000000', source = 'original'): ArchiveFile => ({ name, size, format: '', source });

test('extractVolumeNumber reads volume, chapter and bare numbers', () => {
  assert.equal(extractVolumeNumber('No Game No Life Volume 01.pdf'), 1);
  assert.equal(extractVolumeNumber('Berserk v12 [Dark Horse].cbz'), 12);
  assert.equal(extractVolumeNumber('Akira Chapter 3.5.cbz'), 3.5);
  assert.equal(extractVolumeNumber('No Game No Life 01.pdf'), 1);
  assert.equal(extractVolumeNumber('_OceanofPDF.com_The_Gate_of_the_Feral_Gods_-_Matt_Dinniman.pdf'), null);
});

test('scoreFile prefers pdf > cbz > cbr > epub and rejects other formats', () => {
  const s = (n: string) => scoreFile(f(n));
  assert.ok(s('a.pdf') > s('a.cbz') && s('a.cbz') > s('a.cbr') && s('a.cbr') > s('a.epub'));
  assert.equal(s('a.mobi'), -1);
  assert.ok(s('a [Yen Press].pdf') > s('a.pdf'));
  assert.ok(s('a [Alternative Layout 2].pdf') < s('a.pdf'));
});

test('pickCanonicalFiles groups by volume and keeps the best file per volume', () => {
  const picks = pickCanonicalFiles([
    f('Series Vol 1.epub'), f('Series Vol 1.pdf'), f('Series Vol 2.cbz'), f('Series Vol 2 scan.jp2.zip'),
    f('Series Vol 3.pdf', '1', 'derivative'),
  ]);
  assert.deepEqual(picks, [{ volume: 1, name: 'Series Vol 1.pdf' }, { volume: 2, name: 'Series Vol 2.cbz' }]);
});

test('bestFile returns the single highest-scoring original file, or null', () => {
  assert.equal(bestFile([f('Book - Author.epub'), f('Book - Author.pdf'), f('Book_djvu.txt', '1', 'derivative')])!.name, 'Book - Author.pdf');
  assert.equal(bestFile([f('Book_djvu.txt'), f('Book.mobi'), f('Book.pdf', '1', 'derivative')]), null);
  assert.equal(bestFile([]), null);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, cannot find module `./files.js`.

- [ ] **Step 4: Create `addons/archiveorg/files.ts`**

Move `ArchiveFile`, `extractVolumeNumber`, `scoreFile` and `pickCanonicalFiles` verbatim from `addons/archiveorg/index.ts` (lines 26-134, including their doc comments) and export them. Add `bestFile` per the Interfaces block.

- [ ] **Step 5: Update `addons/archiveorg/index.ts`**

Delete the moved code and add `import { pickCanonicalFiles, type ArchiveFile } from './files.js';`. Nothing else in the file changes.

- [ ] **Step 6: Run the tests and the addon build**

Run: `npm test`
Expected: 4 tests pass.
Run: `npx tsc -p tsconfig.addons.json --noEmit && ls dist 2>/dev/null | head -1`
Expected: no type errors; the `--noEmit` run writes nothing.

- [ ] **Step 7: Commit**

```bash
git checkout -b feature/archiveorg-books
git add addons/archiveorg/files.ts addons/archiveorg/files.test.ts addons/archiveorg/index.ts package.json tsconfig.addons.json docs/superpowers
git commit -m "refactor(archiveorg): extract file picker into files.ts, add node:test runner"
```

---

### Task 2: Title parsing and series grouping

**Files:**
- Create: `addons/archiveorg-books/series.ts`
- Create: `addons/archiveorg-books/series.test.ts`

**Interfaces:**
- Produces, exported from `series.ts`:
  - `interface ArchiveDoc { identifier: string; title: string; creator?: string | string[] | null; date?: string | null; description?: string | string[] | null; language?: string | string[] | null }`
  - `interface ParsedTitle { seriesTitle: string; seriesKey: string; bookNumber: number | null }`
  - `parseBookTitle(title: string, creator?: string | string[] | null): ParsedTitle`
  - `normalizeKey(text: string): string` — lowercase, keep letters/digits/spaces only, collapse whitespace, trim, drop a leading `the `. Idempotent, so `normalizeKey(seriesKey) === seriesKey`.
  - `type ParsedDoc = ArchiveDoc & ParsedTitle`
  - `interface SeriesGroup { seriesKey: string; seriesTitle: string; members: ParsedDoc[] }`
  - `groupBySeries(docs: ArchiveDoc[]): SeriesGroup[]` — groups in first-appearance order; `seriesTitle` from the first member.
  - `orderMembers(members: ParsedDoc[]): (ParsedDoc & { chapter: number; chapterTitle: string })[]`
  - `creatorString(creator: ArchiveDoc['creator']): string | null` — arrays joined with `, `.

`parseBookTitle` algorithm (the tests below pin it):
1. `creator` present: strip a trailing creator name, case-insensitive, allowing an optional ` - `, ` by ` or `, ` before it.
2. Remove a bracketed marker anywhere: `(Book N)`, `[Vol. N]` etc. (`book|vol|vol.|volume|part|no|no.|#`), capturing N.
3. Split on the first `:`, ` - `, ` – ` or ` — `; keep the left side when non-empty.
4. In what remains, find the first unbracketed marker (same marker words, or `#N`) and keep only the text before it, capturing N if step 2 did not. Otherwise a trailing bare integer of 1-3 digits (optionally followed by `.`) is N and is removed.
5. Trim and strip trailing `.,:;-–—` and whitespace for `seriesTitle`; `seriesKey = normalizeKey(seriesTitle)`.

`orderMembers`: members with `bookNumber` first, ascending (ties keep input order); then unnumbered members sorted by `date` ascending with null dates last, then by `identifier`, numbered consecutively from `max(bookNumber) + 1` (from 1 when nothing is numbered). `chapterTitle` is the raw `title` with trailing `.,:;` and whitespace removed; unnumbered members with a parseable 4-digit year in `date` get ` (YYYY)` appended.

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBookTitle, normalizeKey, groupBySeries, orderMembers, creatorString } from './series.js';

test('parseBookTitle strips "Book N. Subtitle" and captures the number', () => {
  assert.deepEqual(parseBookTitle('Dungeon Crawler Carl. Book 7. This Inevitable Ruin'),
    { seriesTitle: 'Dungeon Crawler Carl', seriesKey: 'dungeon crawler carl', bookNumber: 7 });
  assert.equal(parseBookTitle('Dungeon Crawler Carl. Book 1.').bookNumber, 1);
  assert.equal(parseBookTitle('Dungeon Crawler Carl. Book 4. The Gate Of The Feral Gods.').seriesKey, 'dungeon crawler carl');
});

test('parseBookTitle ignores Part N inside a subtitle', () => {
  const p = parseBookTitle('Dungeon Crawler Carl: Part 1 of "Backstage At The Pineapple Cabaret"', 'Matt Dinniman');
  assert.equal(p.seriesKey, 'dungeon crawler carl');
  assert.equal(p.bookNumber, null);
});

test('parseBookTitle reads bracketed markers after a subtitle', () => {
  assert.deepEqual(parseBookTitle('Mistborn: The Final Empire (Book 1)'),
    { seriesTitle: 'Mistborn', seriesKey: 'mistborn', bookNumber: 1 });
});

test('parseBookTitle strips a trailing creator only when creator is known', () => {
  assert.equal(parseBookTitle('Dungeon Crawler Carl - Matt Dinniman', 'Matt Dinniman').seriesKey, 'dungeon crawler carl');
  assert.equal(parseBookTitle('Dungeon Crawler Carl Matt Dinniman', null).seriesKey, 'dungeon crawler carl matt dinniman');
  assert.equal(parseBookTitle('Pride and prejudice', ['Austen, Jane, 1775-1817', 'Thomson, Hugh']).seriesKey, 'pride and prejudice');
});

test('normalizeKey drops leading "the", punctuation and case, and is idempotent', () => {
  assert.equal(normalizeKey('The Hobbit!'), 'hobbit');
  assert.equal(normalizeKey(normalizeKey('  The  Wheel of Time. ')), 'wheel of time');
});

test('creatorString joins arrays and passes null through', () => {
  assert.equal(creatorString(['A', 'B']), 'A, B');
  assert.equal(creatorString('A'), 'A');
  assert.equal(creatorString(null), null);
});

const dcc = [
  { identifier: 'parade', title: 'A Parade Of Horribles Generic 2026 02 09', creator: 'Matt Diniman', date: '2026-05-12T00:00:00Z' },
  { identifier: 'untitled', title: 'Dungeon Crawler Carl Matt Dinniman', creator: null, date: null },
  { identifier: 'cabaret', title: 'Dungeon Crawler Carl: Part 1 of "Backstage At The Pineapple Cabaret"', creator: 'Matt Dinniman', date: '2025-12-01T00:00:00Z' },
  { identifier: 'b7', title: 'Dungeon Crawler Carl. Book 7. This Inevitable Ruin', creator: null, date: null },
  { identifier: 'b2', title: 'Dungeon Crawler Carl. Book 2. Doomsday Scenario.', creator: null, date: null },
  { identifier: 'b4b', title: 'Dungeon Crawler Carl. Book 4. The Gate Of The Feral Gods.', creator: null, date: null },
  { identifier: 'b4a', title: 'Dungeon Crawler Carl. Book 4. The Gate of the Feral Gods', creator: 'Matt Dinniman', date: '2020-10-02T00:00:00Z' },
  { identifier: 'b1', title: 'Dungeon Crawler Carl. Book 1.', creator: null, date: null },
];

test('groupBySeries puts the seven numbered books and the side story together', () => {
  const groups = groupBySeries(dcc);
  const main = groups.find((g) => g.seriesKey === 'dungeon crawler carl')!;
  assert.equal(main.seriesTitle, 'Dungeon Crawler Carl');
  assert.deepEqual(main.members.map((m) => m.identifier).sort(), ['b1', 'b2', 'b4a', 'b4b', 'b7', 'cabaret']);
  assert.ok(groups.some((g) => g.seriesKey.startsWith('a parade of horribles')));
  assert.ok(groups.some((g) => g.seriesKey === 'dungeon crawler carl matt dinniman'));
});

test('orderMembers numbers books by bookNumber then unnumbered by date after the max', () => {
  const main = groupBySeries(dcc).find((g) => g.seriesKey === 'dungeon crawler carl')!;
  const ordered = orderMembers(main.members);
  assert.deepEqual(ordered.map((m) => [m.identifier, m.chapter]),
    [['b1', 1], ['b2', 2], ['b4b', 4], ['b4a', 4], ['b7', 7], ['cabaret', 8]]);
  assert.equal(ordered.find((m) => m.identifier === 'cabaret')!.chapterTitle,
    'Dungeon Crawler Carl: Part 1 of "Backstage At The Pineapple Cabaret" (2025)');
  assert.equal(ordered.find((m) => m.identifier === 'b2')!.chapterTitle, 'Dungeon Crawler Carl. Book 2. Doomsday Scenario');
});

test('orderMembers gives editions of one unnumbered book distinct chapters, null dates last', () => {
  const eds = groupBySeries([
    { identifier: 'pp2', title: 'Pride and prejudice', creator: 'Austen, Jane', date: null },
    { identifier: 'pp1', title: 'Pride and prejudice', creator: 'Austen, Jane', date: '1894-01-01T00:00:00Z' },
    { identifier: 'pp3', title: 'Pride and prejudice : a novel', creator: 'Austen, Jane', date: '1833-01-01T00:00:00Z' },
  ])[0].members;
  assert.deepEqual(orderMembers(eds).map((m) => [m.identifier, m.chapter, m.chapterTitle]),
    [['pp3', 1, 'Pride and prejudice : a novel (1833)'], ['pp1', 2, 'Pride and prejudice (1894)'], ['pp2', 3, 'Pride and prejudice']]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the new file fails with cannot find module `./series.js`; Task 1 tests still pass.

- [ ] **Step 3: Implement `addons/archiveorg-books/series.ts`**

Implement every export in the Interfaces block following the algorithm above. No network, no imports beyond none (pure module).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests pass (4 from Task 1, 9 here).

- [ ] **Step 5: Commit**

```bash
git add addons/archiveorg-books/series.ts addons/archiveorg-books/series.test.ts
git commit -m "feat(archiveorg-books): title parsing and series grouping helpers"
```

---

### Task 3: The addon: manifest, search, chapters, pages

**Files:**
- Create: `addons/archiveorg-books/addon.json`
- Create: `addons/archiveorg-books/index.ts`
- Modify: `SOURCES.md` (addon catalog table, one row after the Archive.org row)

**Interfaces:**
- Consumes: `bestFile`, `ArchiveFile` from `../archiveorg/files.js`; `groupBySeries`, `orderMembers`, `parseBookTitle`, `normalizeKey`, `creatorString`, `ArchiveDoc` from `./series.js`; `createFetch`, `MangaSource`, `SearchResult`, `ChapterResult` from `@bindery/addon-api`.
- Produces: default export `archiveorgBooksSource: MangaSource` with `id: 'archiveorg-books'`, `name: 'Internet Archive Books'`.

- [ ] **Step 1: Write `addon.json`**

```json
{
  "id": "archiveorg-books",
  "name": "Internet Archive Books",
  "version": "1.0.0",
  "api": 1,
  "kind": "source",
  "order": 8,
  "main": "index.js",
  "hosts": ["archive.org"],
  "tags": ["books"],
  "color": "#7c3aed",
  "description": "Internet Archive — books, novels and non-fiction (PDF/EPUB), grouped by series.",
  "url": "https://archive.org",
  "favicon": "https://archive.org/favicon.ico"
}
```

- [ ] **Step 2: Implement `index.ts`**

Module-level: `const API = 'https://archive.org'`, `const get = createFetch({ rateLimitMs: 300, userAgent: <same UA string as the comics addon> })`, a `fetchJson(url)` identical to the comics addon's, and `const COMIC_SCOPE = [...]` holding the comics addon's ten `collection:`/`subject:` terms. Two private helpers:

- `searchDocs(phrase: string, rows: number): Promise<ArchiveDoc[]>` — query `(title:"${phrase}"^5 OR "${phrase}"^3 OR (${phrase})) AND mediatype:texts AND NOT (${COMIC_SCOPE.join(' OR ')})`, fields `identifier,title,creator,date,description,language`, `sort[]=downloads desc`, `output=json`; returns `data.response.docs` or `[]`, logging and returning `[]` on error like the comics addon.
- `groupToResult(group: SeriesGroup): SearchResult` — `mangaId: 'series:' + seriesKey`, `title: seriesTitle`, `coverUrl: ${API}/services/img/${members[0].identifier}`, `description`: longest member description with tags stripped and sliced to 400 (same cleanup as comics), `status: 'completed'`, `year`: earliest member year in 1900-2100 or null, `tags`: language tags exactly as the comics addon derives them, unioned over members.

Source methods:

- `search(query, limit = 20)`: `rows = Math.min(limit * 3, 100)`; `groupBySeries(await searchDocs(phrase, rows)).slice(0, limit).map(groupToResult)`.
- `getChapters(mangaId)`: if `mangaId` does not start with `series:`, treat it as one identifier: fetch `/metadata/<id>`, `bestFile(meta.files)`, return one chapter `'1'` or `[]`. Otherwise `key = mangaId.slice(7)`; docs = `searchDocs(key, 100)` filtered to `parseBookTitle(d.title, d.creator).seriesKey === key`; `ordered = orderMembers(groupBySeries(docs)[0]?.members ?? [])` (the filter guarantees at most one group). For each ordered member fetch metadata and compute `bestFile`; drop members with none. When two members share a `chapter`, keep the one whose best file scores higher (ties: the first). Return `{ sourceId: 'archiveorg-books', chapterId: identifier + '|' + file.name, chapter: String(chapter), title: chapterTitle, pages: 0, scanlationGroup: creatorString(member.creator) }`.
- `getPageUrls(chapterId)`: identical to the comics addon.
- `getMangaUrl(mangaId)`: `series:` ids → `https://archive.org/search?query=${encodeURIComponent(key)}&and[]=mediatype%3A%22texts%22`; otherwise `https://archive.org/details/<id>`.

- [ ] **Step 3: Type-check and run tests**

Run: `npx tsc -p tsconfig.addons.json --noEmit && npm test`
Expected: no errors; all tests pass.

- [ ] **Step 4: Live-check search and chapters with a throwaway script**

Write `/private/tmp/claude-501/-Users-jamesmorris--claude-spares-spare-gT1iXb/0796d810-8f51-45c6-bd36-269657a87a0d/scratchpad/live.ts` that imports `/Users/jamesmorris/Documents/source/comic-reader/addons/archiveorg-books/index.ts`, runs `search('Dungeon Crawler Carl', 10)` and `getChapters('series:dungeon crawler carl')`, and prints `mangaId`/`title` per result and `chapter`/`title`/`chapterId` per chapter. Run: `npx tsx <that path>`.
Expected: one result titled `Dungeon Crawler Carl` with `mangaId: series:dungeon crawler carl`; chapters 1, 2, 3, 4, 5, 6, 7 each with a `.pdf` chapterId, exactly one chapter 4, plus chapter 8 for the Pineapple Cabaret side story. Also run `search('Pride and Prejudice', 5)` and `getChapters` on its first result: expected one `Pride and prejudice` group whose chapters carry year suffixes.

- [ ] **Step 5: Add the SOURCES.md catalog row**

After the Archive.org row: `| **Archive.org Books** | \`archiveorg-books\` | books | REST API | both | Books, novels, non-fiction outside the comic collections. Uploads grouped into series by normalised title; one chapter per book. Shares the file picker with \`archiveorg\`. |`

- [ ] **Step 6: Commit**

```bash
git add addons/archiveorg-books/addon.json addons/archiveorg-books/index.ts SOURCES.md
git commit -m "feat: add Internet Archive Books source with series grouping"
```

---

### Task 4: End-to-end verification in the app

**Files:** none changed unless verification finds a bug.

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: succeeds; `dist/addons/archiveorg-books/addon.json` and `index.js` exist; no `*.test.js` under `dist/addons`.

- [ ] **Step 2: Start the dev server and check the pill**

Use `preview_start` with the project's dev configuration (add a `.claude/launch.json` entry running `npm run dev` on port 5173 if none exists). Open Discover. Expected: an **Internet Archive Books** pill after **Internet Archive**, and `GET /api/discover/sources` lists `archiveorg-books`.

- [ ] **Step 3: Search and download a public-domain book**

Select only the Books pill, search `Pride and Prejudice`, open the grouped result, download chapter 1. Expected: the download completes, a series `Pride and prejudice` appears in the library tagged `books`, and the chapter opens in the reader with rendered text pages.

- [ ] **Step 4: Confirm the comics pill is unchanged**

Search `Tintin` with only the **Internet Archive** pill. Expected: results and chapter listing look as before (comic items, per-volume chapters).

- [ ] **Step 5: Record the verification in the design doc and commit**

Append a `## Verification` section to the spec with the date and the three outcomes above.

```bash
git add docs/superpowers/specs/2026-11-21-archiveorg-books-design.md
git commit -m "docs: record archiveorg-books verification"
```
