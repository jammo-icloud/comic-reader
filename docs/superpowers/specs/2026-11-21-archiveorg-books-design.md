# Internet Archive Books source — design

**Date:** 2026-11-21
**Status:** approved 2026-11-21

## Intent

Let Bindery find and download books (novels, non-fiction, anything in
archive.org's `texts` media type) from the Internet Archive, not only
comics. Example: the seven *Dungeon Crawler Carl* PDFs should be
searchable, land in the library as one series with seven chapters, and
read in the existing PDF reader.

## Goals

- A new Discover pill, **Internet Archive Books**, that searches all
  archive.org text items outside the comic/manga collections.
- Search results are grouped by series: one card per book series, not one
  per upload.
- Opening a result lists one chapter per book, numbered by the book number
  in its title, downloadable through the existing single-file path.
- Series created from this source carry a `books` tag so the library can
  filter them.
- The existing **Internet Archive** (comics) pill is untouched in behaviour.

## Non-goals

- Proper text EPUB to PDF conversion. Items with no PDF still go through
  the images-only EPUB converter. mupdf already renders EPUB natively, so
  this is a clean follow-on, not part of this change.
- A new reading mode for prose. Text PDFs render as pages in the current
  reader.
- Changes to the Bindery server core, the downloader, or the addon API.

## Anti-goals

- Regressing comic search quality. The comics addon's collection filter
  stays exactly as it is.
- Merging unrelated items because their titles share a word. The grouping
  key must be the full normalised series title, not a prefix match.

## Constraints

- Addons compile with `tsc` from `addons/` to `dist/addons/`; relative
  imports between addon folders compile and load fine (`main` alone must
  stay inside the addon folder). In dev, `tsx` resolves `.js` imports to
  the `.ts` beside them.
- Addon ids are lowercase letters, digits and dashes: `archiveorg-books`.
- The Discover client lists sources from `/api/discover/sources`, so a new
  addon appears without client changes.
- `mangaId` is stored on the series as `syncSource.mangaId` and passed
  back to `getChapters` on sync, so it must be stable and self-describing.
- `chapterId` keeps the `identifier|filename` shape so `getPageUrls` and
  the downloader's file short-circuit work unchanged.

## Approaches considered

1. **Widen the existing pill to all texts and group everything.** Simplest,
   but drops the collection filter that was added because books polluted
   comic results, and title-grouping would merge unrelated comic scans.
2. **Second addon sharing the file-picking code (chosen).** Separate pill,
   separate tag, comics untouched. Grouping lives in the addon, so the
   server, the Chrome extension and subscriptions all see the same
   series. Cost: the title heuristic occasionally splits an
   inconsistently-titled series into two results.
3. **Group client-side in Discover.** Keeps the addon dumb, but the
   extension and sync never see the grouping and chapter listing for a
   group has nowhere to live.

## Design

### Files

- `addons/archiveorg/files.ts` (new): the volume-number extraction,
  file scoring and canonical-file picking moved out of
  `addons/archiveorg/index.ts`, exported. The comics addon imports them;
  behaviour unchanged.
- `addons/archiveorg-books/addon.json` (new): id `archiveorg-books`, name
  "Internet Archive Books", `tags: ["books"]`, `order: 8`, same host,
  colour and favicon family as the comics addon, description "Internet
  Archive — books, novels and non-fiction (PDF/EPUB)".
- `addons/archiveorg-books/index.ts` (new): the source.
- `SOURCES.md`: one new catalog row.

### Search

Query: `mediatype:texts AND NOT (<the comics addon's collection/subject
filter>)` with the same title-boosted phrase matching the comics addon
uses, sorted by downloads, fetching more rows than the result limit (about
3x) so grouping has material. Fields: identifier, title, creator, date,
description, language.

Each item's title is normalised to a **series key**:

1. Strip a leading "The ", trailing author (` - Name`, ` by Name`), and
   anything after the first `:` or ` - ` when what remains is non-empty.
2. Remove volume markers: `Book N`, `Vol. N`, `Volume N`, `Part N`, `#N`,
   `(Book N)`, and a trailing bare number, capturing N as the **book
   number**.
3. Lowercase, strip punctuation, collapse whitespace.

Items with the same series key form one `SearchResult`. Its `mangaId` is
`series:<series key>`, its title is the cleanest member title with markers
removed (title case preserved from the member), cover is the first
member's `services/img`, description the longest member description, year
the earliest member year, tags from languages as the comics addon does.
Groups of one are still returned (a standalone book is a one-chapter
series).

### Chapters

`getChapters("series:<key>")` re-runs the search with the key as the
phrase, keeps members whose series key matches exactly, fetches
`/metadata/<identifier>` for each, and picks the canonical file with the
shared picker. One chapter per member: `chapter` is the book number from
the title, falling back to the filename's number, then to date order
starting after the highest numbered book. Duplicate uploads of the same
book number keep the higher-scoring file. `title` is the member's cleaned
title. `chapterId` is `identifier|filename`.

### Pages and URLs

`getPageUrls` and `getMangaUrl` are identical to the comics addon, except
`getMangaUrl` for a `series:` id links to an archive.org search for the
key, since a group has no single details page.

### Left to the builder

- Exact regexes for marker stripping and the test fixtures covering
  *Dungeon Crawler Carl* titles (seven books, two Book 4 duplicates, one
  untitled "Dungeon Crawler Carl Matt Dinniman" item, fan-fiction items
  that must not be absorbed).
- Where unit tests live for addons (none exist today; a small test file
  beside `files.ts` using Node's test runner is acceptable).

## Verification

2026-11-21, dev server on localhost:5880:

- `npm run build` succeeds; `dist/addons/archiveorg-books/` holds the
  manifest, `index.js` and `series.js`; no test output under `dist/addons`.
- Discover shows the **Internet Archive Books** pill after **Internet
  Archive**; `/api/discover/sources` lists `archiveorg-books`.
- Searching "Pride and Prejudice" with only the Books pill returns the
  grouped series first (14 chapters, author shown per chapter). Chapter 1
  downloaded as an 11 MB PDF, created series `pride-and-prejudice` tagged
  `english, books` with sync source `series:pride and prejudice`, and the
  reader renders its text pages.
- Live script: "Dungeon Crawler Carl" groups into one series with books
  1-7 (one chapter 4) plus the side story as chapter 8.
- The comics pill still returns comic items for "Tintin".

### After review (same day)

A fresh review of the branch led to one fix pass, all pinned by tests:

- Unnumbered uploads are numbered from 1000 in archive.org upload order
  (`publicdate`), never from the highest book number, so a new Book 8 or a
  new scan cannot shift existing chapter numbers under sync. Numbering runs
  before the per-item file check, so an item with no downloadable file
  leaves a gap rather than renumbering the rest. A failed metadata fetch
  aborts the listing instead of reading as "no file".
- The series key maps punctuation to spaces (so "Catch-22" re-searches as
  "catch 22"), apostrophes are dropped, and a marker-only title such as
  "Book 1: The Way of Kings" takes its name from the subtitle. The trailing
  bare-number rule was removed: "Fahrenheit 451" and "Apollo 11" keep their
  numbers in the name.
- "Series - Book 3 - Subtitle" reads the book number from the subtitle.
- Search matches titles only (`title:(words)`), still most-downloaded
  first, excludes `collection:inlibrary`, and strips Lucene syntax from
  user input. Live: "Emma" and "Dune" now lead with the novels.
