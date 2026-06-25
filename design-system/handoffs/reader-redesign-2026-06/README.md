# Handoff: Comic Reader Redesign (+ Admin UX fix)

## Overview
This package redesigns the **comic reading experience** in the Bindery comic
reader, and includes a secondary fix to the **Admin** page's information
architecture. It targets the existing app in `jammo-icloud/comic-reader`
(`src/client/pages/ReaderPage.tsx` + `src/client/components/PdfViewer.tsx` for
the reader; `src/client/pages/AdminPage.tsx` for the admin fix).

The redesign solves three concrete complaints with the current reader:
1. **You couldn't easily see which comic you were reading.** The title was
   buried in a small centered line that only appeared with chrome.
2. **Page navigation was driven by a slider** — clunky; nobody reads a comic by
   dragging a scrubber.
3. **No real difference between a laptop's screen and an iPhone** — the extra
   desktop real estate went unused.

## About the Design Files
The files in this bundle are **design references created in HTML/React (via
Babel-in-browser)** — prototypes showing the intended look and behavior. They
are **not** production code to copy verbatim. Your task is to **recreate these
designs in the real `comic-reader` codebase** using its existing environment
(React + TypeScript, the real `PdfViewer` PDF.js rendering, your API/state
layer, your component library), following the patterns already there.

The prototype renders fake "comic pages" by compositing each series' **cover
image** into paneled spreads, because the prototype has no real page scans. In
the real app you already render true pages through `PdfViewer`/PDF.js — drop the
synthetic `ComicPage` renderer entirely and feed real page canvases/images into
the same surfaces.

## Fidelity
**High-fidelity (hifi).** Final layout, spacing, interaction model, and chrome
behavior are intended as shown. Colors and type come from the existing design
system (CSS custom properties — see Design Tokens). Recreate the structure and
interactions faithfully; pull exact visual values from your token system rather
than hardcoding.

---

## Screens / Views

### 1. Reader — desktop (≥ 900px)
**Purpose:** Read a chapter page-by-page with quick orientation and jumping.

**Layout:** A full-viewport (`position: fixed; inset: 0`) dark surface, always
dark regardless of app theme. Horizontal three-zone flex:
- **Left rail (304px, collapsible):** thumbnail + chapter navigator.
- **Center (flex):** a single page centered on black, max height with a
  `2 / 3` aspect ratio "paper" card (`box-shadow: 0 24px 60px rgb(0 0 0 / .6)`).
- **Right rail (384px, conditional):** Story-mode narration panel, only when
  Story mode is on.

**Top bar (auto-hides):** slides up/away after ~3.2s of inactivity; any
mouse-move (desktop) or tap (mobile) brings it back. Contains, left→right:
back button, rail-toggle button, **title block** (series name, 15px/600 +
`Chapter N · Page X / total` in 12px/0.7 opacity), the **reading-mode segmented
control** (Tap / Swipe / Scroll), an **RTL/LTR** toggle, and a **Story mode**
toggle. The bar is inset to start after the rail/story panel so it never
overlaps them (`left: railOpen ? 304 : 0; right: storySide ? 384 : 0`).

**Bottom scrubber (auto-hides, demoted):** appears only with chrome. Prev-chapter
‹‹ · prev-page ‹ · **range slider** (`page` of `total`, accent thumb) · next-page
› · next-chapter ››. This is now a *jump* affordance, not the primary nav.

**Discoverable side arrows:** on desktop, in paged modes, large circular
‹ / › buttons float at the vertical center while chrome is visible.

### 2. Reader — mobile (< 900px, iPhone)
**Purpose:** Same, immersive and single-handed.

**Differences from desktop:**
- Rail is **not** inline — it opens as a **left drawer** (min(320px, 84vw))
  over a scrim, with a slide-in animation.
- The page fills the screen; no side arrows.
- The top bar uses **two rows**: row 1 = back + drawer button + title block +
  Story toggle; **row 2 = the full-width Tap/Swipe/Scroll segmented control**
  (each segment `flex: 1`). This is the key mobile fix — at ~402px the title and
  controls don't fit on one row, so stacking them keeps the title from
  truncating.
- **Safe-area inset:** when embedded in the iOS device frame, the screen is
  inset **64px top / 24px bottom** so the top bar clears the status bar /
  Dynamic Island and the scrubber clears the home indicator. In the real PWA,
  use `env(safe-area-inset-*)` instead of fixed pixels.

### 3. Chapter Rail (desktop inline / mobile drawer)
**Purpose:** Orient and jump within and across chapters.

**Header:** small cover (44×62, radius 4), series name (14px/600), `Chapter N`
+ optional English title (12px/0.6). Drawer variant adds a close ✕.

**Two tabs** (`Pages` | `Chapters`), pill toggle:
- **Pages:** 3-col grid of page thumbnails (each a `2/3` mini page).
  Current page = 2px accent border. Already-read pages (n < current) show a
  small green ✓ at top-left and full opacity; unread are 0.5 opacity. A
  monospace page number sits bottom-right of each.
- **Chapters:** vertical list. Each row: a 26×26 status chip (green ✓ box if
  read, else chapter number), `Chapter N` + `pages` count, and a trailing
  `Reading` (accent) or `New` badge. Current chapter row is accent-tinted.

### 4. Story Mode panel (right rail wide / bottom strip narrow)
**Purpose:** Per-page AI narration + bubble index. (Feature already exists in
your code — this designs it into the new layout.)

**Layout:** dark panel with an **ambient blurred cover backdrop**
(`blur(40px) brightness(0.4)`, scaled 1.2, opacity 0.5). Header: book icon +
`Story · Page N`, a read-aloud (volume) button, and a close ✕. Body: a serif
narration paragraph (15px/1.7), then a `Bubbles on this page` kicker and a list
of tappable bubble chips (numbered, each "find on page" crosshair). Footer:
`AI narration · tap a bubble to find it on the page`.
- **Wide:** 384px right rail, `border-left`.
- **Narrow:** bottom strip at `42dvh`, `border-top`; the scrubber sits above it.

### 5. Admin (secondary fix)
**Purpose:** The reader work's sibling fix. The real Admin page buries bulk
maintenance actions (Run maintenance, Cleanup, Rescan, Re-enrich, Sync all)
**inside the personal profile/avatar dropdown**, mixed with "Sign out."

**Fix:** move them into a dedicated header **"Tools" dropdown** on the Admin
page — discoverable, labeled, each with a one-line hint, async running/done
states, and "Re-enrich all" styled destructive. See `admin-page.jsx` → `ToolsMenu`.

---

## Interactions & Behavior

### Reading modes (switchable live to compare)
The mode is a single enum persisted to `localStorage['bindery.reader.mode']`.
All three operate on the same `page` / `total` / chapter state:

- **Tap** (default): the page is split into vertical thirds. Tap **left third**
  = previous, **right third** = next, **center third** = toggle chrome. Edge
  hint gradients fade in on hover (desktop). Respects RTL (see below).
- **Swipe:** horizontal drag with a 3-page window (prev/current/next absolutely
  positioned, `translateX`). Release past **18% of width** commits the flip;
  under threshold snaps back; a near-zero drag is treated as a tap (toggles
  chrome). `touch-action: pan-y`. Works with mouse and touch.
- **Scroll:** vertical webtoon. All pages stacked (`min(720px, 92%)` wide). A
  scroll listener finds the page whose center is nearest the viewport center and
  updates `page`. On entering scroll mode it programmatically scrolls to the
  page you were on. Tap toggles chrome.

### Page navigation, direction-aware
- A single `go(delta)` mutates the page. `delta = +1` always means "advance one
  page" (page number goes up); chapter boundaries flow into the next/previous
  chapter (`page > total` → next chapter page 1; `page < 1` → prev chapter last
  page).
- **RTL** (manga, auto-detected from tags like `manga/shounen/seinen/isekai`)
  only flips *which input* advances reading — i.e. in tap/swipe/keyboard, the
  **right** side maps to `go(-1)` and the **left** to `go(+1)`. **The page
  number itself always counts up.** (This was the one subtle bug to get right:
  never apply the RTL flip to the page counter or the toolbar prev/next — only
  to the directional input mapping.)
- **Keyboard:** `→` / `Space` = forward read (RTL-aware), `←` = back,
  `Esc` = exit to series.

### Chrome auto-hide
- `chromeOn` starts true. `poke()` sets it true and schedules hide after
  **3200ms**. Re-poke on page change, chapter change, mode change, mouse-move
  (desktop), key press. Top bar and bottom scrubber translate out (`-110%` /
  `110%`) when hidden, 240ms transition. Reduced-motion disables page-turn
  animations.

### Persistence
- `localStorage['bindery.reader.mode']` — reading mode (across chapters).
- `localStorage['bindery.reader.<seriesId>.<chapter>.page']` — resume page,
  per chapter. Re-read on load.

### Animations
- Page-turn (tap mode): `reader-slide-next` / `reader-slide-prev`
  (240ms `cubic-bezier(0.22,0.61,0.36,1)`, 7% slide + fade), or `reader-fade`
  220ms on jumps. All gated behind `@media (prefers-reduced-motion: no-preference)`.
- Drawer: `reader-drawer-in` 240ms same easing.
- Chrome: 240ms transform.

### Responsive
- Single breakpoint at **900px** (`matchMedia('(min-width: 900px)')`), tracked
  in state so layout swaps live (inline rail ↔ drawer, one-row ↔ two-row top
  bar, side arrows on/off, Story rail ↔ bottom strip).

## State Management
Local component state in the prototype (lift to your store/router as fits):
- `mode` ('tap' | 'swipe' | 'scroll'), `page` (number), `ch` (chapter number),
  `dir` (last flip direction, for animation), `rtl` (bool),
  `wide` (bool from matchMedia), `chromeOn`, `railOpen` (desktop),
  `drawer` (mobile), `storyOn`.
- Derived: current chapter object, prev/next chapter, `total` (page count).
- In the real app, `page`/`chapter`/`mode`/`rtl` should be URL- or
  store-backed so deep links and resume work; the page count comes from the
  loaded PDF, not fake data.

## Design Tokens
All from the existing system (`styles.css` → `tokens/*.css`). Values are RGB
triples consumed as `rgb(var(--x))`; the reader chrome is theme-independent
(literal dark + the accent).

- **Accent (default light theme):** `--accent: 59 130 246` → `rgb(59 130 246)`
  (`#3B82F6`); hover `--accent-hover: 37 99 235` (`#2563EB`). The accent varies
  per theme — always reference `rgb(var(--accent))`, never hardcode.
- **Intents:** `--color-success`, `--color-warning`, `--color-danger`
  (RGB triples `--success` / `--warning` / `--danger`).
- **Reader chrome (literal, theme-independent):** page bg `#0a0a0a`; rail bg
  `#121110`; story bg `#0e0d0c`; chrome buttons `rgb(0 0 0 / 0.45)` +
  `backdrop-filter: blur(10px)`; gradient scrims top/bottom from
  `rgb(0 0 0 / 0.85–0.9)` to transparent.
- **Type:** `--font-sans` (system UI stack), `--font-mono` (page numbers, IDs),
  `--font-serif` (Story narration). Title 15px/600; meta 12px.
- **Radii:** page card 3px; chrome buttons 10px; rail thumbs 4–5px; pills full.
- **Shadows:** page `0 24px 60px rgb(0 0 0 / .6)`; scroll page
  `0 8px 30px rgb(0 0 0 / .5)`; rail/drawer use `--shadow-2xl`.
- **Key dimensions:** rail 304px; story rail 384px; story strip `42dvh`;
  breakpoint 900px; auto-hide 3200ms; swipe commit threshold 18% width;
  iOS insets 64/24px.

## Assets
- **Icons:** [Lucide](https://lucide.dev) (already used across this kit). Names
  used in the reader: `arrow-left, panel-left, pointer, move-horizontal,
  gallery-vertical, book-open, chevron-left, chevron-right, chevrons-left,
  chevrons-right, x, check, volume-2, crosshair, sparkles, list, layout-grid`.
  **Note:** the prototype renders Lucide via `innerHTML` (not the DOM-swapping
  `createIcons`) on purpose — `createIcons` replaces React-owned nodes and makes
  React throw on unmount. In your app use `lucide-react` components and this is a
  non-issue.
- **Page imagery:** prototype-only. The `ComicPage` synthetic renderer in
  `reader-surface.jsx` composes pages from cover art — **discard it** and render
  real pages via your existing `PdfViewer`/PDF.js path.
- **Covers** used in the prototype are in `../assets/covers/` (not required for
  the real implementation).

## Files
Design-reference files (in this bundle). These are **read-only snapshots** of
the prototype source — the two main files were renamed from their kit names
(`Reader.jsx` → `reader-main.jsx`, `Admin.jsx` → `admin-page.jsx`) purely so
they don't register as duplicate components in the design system; the code is
identical to the kit originals.
- `reader-main.jsx` — the reader orchestrator: layout, chrome, modes, nav,
  keyboard, persistence, responsive logic. **Start here.** (kit name: `Reader.jsx`)
- `reader-surface.jsx` — the three reading surfaces (`PagedTap`, `PagedSwipe`,
  `VerticalScroll`) + the synthetic `ComicPage`/`PageFrame` (drop the synthetic
  part).
- `reader-rail.jsx` — `ChapterRail` (thumbnails + chapter list, inline/drawer)
  and `StoryPanel` (narration).
- `admin-page.jsx` — Admin recreation incl. the `ToolsMenu` IA fix.
  (kit name: `Admin.jsx`)
- `lib.jsx` — fake data + the Lucide `Ic` helper + shared component handles.
- `README.md` — this document.

The runnable demo lives in the design system itself, not this bundle: open
`ui_kits/bindery-web/index.html` (full click-through app) and
`ui_kits/bindery-web/iphone.html` (reader at iPhone width with safe-area insets).
The reader keyframes + dark segmented-control CSS live in that `index.html`'s
`<style>` block.

## reader-mock.html (start here to *see* it)
`reader-mock.html` is a **single self-contained file** — all CSS, JS, the design
tokens, and the cover art are inlined as data URIs, so it works offline with no
server. Open it in any browser (or import it) to interact with the redesign:

- Boots into a cover **picker**; tap any cover to enter the reader.
- In the reader: switch **Tap / Swipe / Scroll** from the top bar, open the side
  **rail** (thumbnails + chapters), toggle **RTL/LTR** and **Story mode**.
- **Resize the window** (or open on a phone) to watch the layout swap at the
  900px breakpoint (inline rail ↔ drawer, one-row ↔ two-row top bar).

It's a *visual reference*, not production code — the pages are composed from cover
art (no real scans). Recreate the behavior in the real app per this README.

Original source to modify in the real repo:
- `src/client/pages/ReaderPage.tsx`, `src/client/components/PdfViewer.tsx`
- `src/client/pages/AdminPage.tsx` (Tools menu)
