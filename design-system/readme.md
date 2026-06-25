# Bindery — Design System

The brand and UI system for **Bindery**, a self-hosted manga & comic reader for
your NAS. Multi-user, multi-source, multi-device: browse a shared library,
recommend series to your household, sync new chapters from upstream sources,
and read offline on iPhone — all from your own server. Bindery is an installable
PWA (web + iOS/iPad home-screen app), React 19 + Tailwind under the hood, and is
theme-first: **12 themes (6 dark + 6 light)** that re-tint the entire UI.

This project is the design system extracted from the product: tokens, the theme
engine, reusable React components, foundation specimen cards, a full click-through
UI kit, and a starting-point template.

## Sources

Built by reading the product's own code and design documentation:

- **GitHub:** https://github.com/jammo-icloud/comic-reader (the Bindery repo;
  "comic-reader" is the historical name, "Bindery" is the v4 product name).
  - `DESIGN.md` — the original, unusually-thorough token & pattern reference. The
    single source of truth this system is faithful to.
  - `src/client/themes.css` — the 12-theme CSS-variable definitions (copied here verbatim).
  - `src/client/components/*` & `src/client/pages/*` — the component and screen
    source the UI kit recreates.
  - `README.md`, `ROADMAP.md`, `SOURCES.md` — product context, copy voice, feature set.

Explore that repository to build richer or more accurate Bindery designs — the
git history and decisions log are deliberately transparent.

> **Font note:** Bindery ships **no custom webfont**. It uses the native system
> UI sans stack (Tailwind's default `font-sans`) for everything, with `font-mono`
> for IDs/paths. This system mirrors that — no font binaries to substitute. If you
> later adopt a brand typeface, drop the files in `assets/fonts/` and add the
> `@font-face` rules to a token file imported by `styles.css`.

---

## Content fundamentals

How Bindery writes. Voice is **quiet, precise, and a little bookish** — it treats
the reader as a capable adult running their own server, never hand-holds, and
never hypes.

- **Person & address.** Second person, possessive — "**your** library", "what was
  I reading?", "read offline on **your** iPhone". The product speaks _to_ the user
  about _their_ stuff. First person ("I") shows up only as the user's own voice in
  empty/filter states ("what was I reading?").
- **Tone.** Calm, factual, dryly confident. Feature copy states what a thing does
  and stops: "track manga from a source; the server polls for new chapters and
  downloads them automatically." No exclamation marks, no "amazing", no marketing.
- **Casing.** Sentence case for everything — titles, buttons, headers ("Save
  offline", "Continue reading", "Import your first comic"). The **only** uppercase
  is the kicker/eyebrow label (`CONTINUE READING`, tracked + 11px) and the comic
  display treatment on Login (`BINDERY`, `SIGN IN`).
- **Labels are verbs.** Buttons name the action: "Recommend", "Save offline",
  "Export as .crz", "Sign In →". Status is an adjective ("ongoing", "completed",
  "hiatus", "cancelled", "Saved", "Read").
- **Numbers are honest and terse.** "12 ch.", "5/12", "p.124", "+3 New", "8.9".
  Counts use tabular figures and abbreviate ("ch." for chapters).
- **Micro-copy has dry humor.** Reader-facing notes are wry, not jokey: "comic
  shop after hours", "manga cafe at night" (theme descriptions); "// your library"
  (login). The repo's own README signs off "100% vibe coded with Claude."
- **No emoji in product chrome.** The product uses a couple of emoji as *internal
  source pills* in Discover (♥ Recommended, 📚 Library) and that's the extent of
  it. Don't sprinkle emoji into UI copy. Icons do that job (Lucide).
- **Punctuation.** Middot separators (`· 12`, `2020 · 12 ch.`), en-dashes in prose,
  ellipsis on truncation/placeholders ("Search…", "Signing in…").

Example strings, verbatim in voice:
> "A self-hosted manga & comic reader for your NAS." · "Continue reading" ·
> "Import your first comic" · "Search MangaDex, MangaFox & more" · "Recommend" ·
> "Save offline" · "+3 New" · "In Collection" · "to your library"

---

## Visual foundations

The complete look. Specimen cards in the **Design System** tab show every token
live; this is the prose reference.

### Color & theming
- **Theme-first.** Color is never hard-coded. 12 themes each redefine a **50→950
  gray ramp** and an **accent pair** (`--accent` / `--accent-hover`) as
  space-separated RGB triplets, so everything composes with alpha
  (`rgb(var(--accent) / 0.15)`). Activate with `data-theme="<id>"` on `<html>`;
  dark themes also add `class="dark"`.
- **Default theme** is plain dark with a **blue accent** (`59 130 246`). Other
  accents: Midnight purple, Tankobon red, Nord cyan, Gruvbox orange, Latte
  lavender, Newsprint scarlet, etc.
- **Light/dark is a flip, not a separate palette.** Semantic aliases
  (`--bg-page`, `--surface-card`, `--text-body`, `--border-default`…) point at one
  end of the ramp in light mode; the `.dark` class re-points them at the
  complementary step (50↔950, 100↔900…). Use the **semantic aliases first**; reach
  for raw ramp tokens only for a specific step or alpha mix.
- **Warm-paper surfaces.** Light themes (Tankobon, Newsprint, Dawn, Latte, Alucard,
  Gruvbox) use a per-theme tinted `--surface` for cards so they read as lifted
  cream over a beige page instead of stark white. Never use pure `#fff` for a card.
- **Semantic intent is stable across themes** by default: `--success` green,
  `--warning` amber, `--danger` red. Switching to Tankobon does **not** make errors
  orange. Use accent for "primary/brand/link", semantic for "good / caution / wrong".
- **Status mapping** (memorize): ongoing → success · completed → accent-soft ·
  hiatus → warning · cancelled → danger. NSFW → danger.

### Typography
- **System sans** for everything; **mono** (`--font-mono`) for IDs, file paths,
  hashes, and the login form's field labels.
- **Named scale 30→12px** (`--text-3xl`…`--text-xs`) plus raw 11/10/9px for dense
  chrome (toolbar text, chips, cover-overlay strips). Custom sub-12px sizes only.
- **Weights:** 400 body · 500 labels/chapter titles · 600 sub-headings & CTAs ·
  700 page titles/stats. **900 (black) is reserved for the comic display wordmark.**
- **Kicker** = the recurring eyebrow: 11px, 600, uppercase, `tracking-wider`,
  tertiary color. Pair with `· N` counts. `tabular-nums` for all counts/percentages.

### Shape, borders & elevation
- **Radius scales with surface size:** 4 pills/badges · 6 icon-buttons/segments ·
  8 buttons/inputs · 12 cards/modals · 16 sheets/hero · full for avatars/dots.
- **Borders are 1px.** Card edge = `1px solid var(--border-default)`. **Selection /
  hover is a 2px accent ring** (`box-shadow: 0 0 0 2px var(--ring-color)`), not a
  thicker border.
- **Shadows climb with elevation:** `sm` cards (light only — dark drops to bare
  border) · `md` buttons/lift · `lg` floating corner buttons · `2xl` modals/sheets.
  Plus a hard-offset **comic shadow** (`3px 3px 0 #000`) for the login CTA & panels.

### Backgrounds, glass & imagery
- **No decorative gradients in chrome.** The only gradients are two onboarding
  tiles (accent→accent-hover). Backgrounds are flat theme color.
- **Glass:** sticky page header + toolbars use a translucent theme bg
  (`--chrome-bg`, 85% page color) + `backdrop-blur(12px)`. Sheet backdrops use
  `blur(4px)`. ⚠ Any `backdrop-filter` ancestor traps `position:fixed` children —
  the product portals modals to `document.body`.
- **Overlay scrims are theme-independent black** so they stay legible over any
  cover: `black/40` floating buttons, `black/50` modal backdrop, `black/60` cover
  label strips, `black/90` reader toolbar.
- **Imagery is the content** — manga/comic covers (2:3) and anime-style fantasy art
  (login spread): cool, moody, painterly, often nocturnal. Covers are the loudest
  color on screen; the chrome stays quiet to let them sing. NSFW covers blur
  (`blur(16px)`) with a danger pill, never unblur on hover.

### Motion & states
- **Snappy, restrained.** `200ms` default (`--duration-fast`), `300ms` for larger
  moves & progress fills. Standard easing `cubic-bezier(0.4,0,0.2,1)`. No bounce,
  no infinite decorative loops. `prefers-reduced-motion` strips transforms.
- **Hover:** subtle bg tint (`--bg-subtle`) on ghost controls; **2px accent ring**
  on cards; `scale(1.05)` on cover art inside its clip. **Press:** the comic CTA
  translates down into its shadow (`translate(3px,3px)`); standard buttons darken.
- **Focus:** always a visible `focus-visible` accent ring — never bare `outline:none`.

### Layout
- **Page gutter** `16px`, `24px` at sm+. Max widths by surface: 1280 library/discover
  · 1152 admin · 1024 series · 768 import · 672 modals · 384 login form.
- **Cover grid** is the signature layout: `repeat(6,1fr)` desktop, stepping down to
  2 columns on mobile, `gap: 16px`.
- **Touch targets** enforced: 28 pill · 36 toolbar icon · 40 secondary · 44 mobile CTA.
- **`100dvh`, never `100vh`** (survives iOS URL-bar collapse). Respect
  `env(safe-area-inset-*)` on screen-edge fixed elements.

---

## Iconography

- **Lucide, exclusively** (`lucide-react` in the product; the Lucide UMD CDN in
  these cards/kits). One family, consistent **2px stroke**, no fills — except
  `Play` and progress glyphs which fill `currentColor`.
- **Sizes:** 18px in toolbars, 16px inline with button text, 13–14px in dense menu
  rows, 9–12px for badge glyphs over covers.
- **Common glyphs:** `book-open` (read), `library`, `compass` (discover),
  `folder-plus` (import), `download` (save offline), `heart`/`star` (recommend/score),
  `pin` (currently reading), `search`, `arrow-down-a-z` (sort), `bell`
  (notifications), `shield` (admin), `sun`/`moon` (theme), `log-out`, `check`,
  `chevron-left/right` (reader nav), `languages` (translate).
- **No emoji as icons** in product chrome (the ♥/📚 Discover pills are the lone,
  intentional exception). **No hand-rolled SVG icons** — always use a Lucide glyph.
- The brand mark is `assets/logo.png` — a sleeping blue fox curled over an open
  book under a starry sky. Used at 32×32 (rounded 6px) in headers, 180×180 as the
  iOS touch icon. See the **Brand → Logo & Wordmark** card.

---

## Index / manifest

Root files:
- **`styles.css`** — the single entry point consumers link. `@import` lines only.
- **`tokens/`** — `colors.css` (the 12-theme engine + semantic aliases),
  `typography.css`, `spacing.css`, `shape.css`, `base.css` (reset), `components.css`
  (the `.by-*` component classes).
- **`assets/`** — `logo.png`, `apple-touch-icon-180.png`, `login-bg/` (3 anime
  fantasy panels), `placeholders/` (manga / discover / import art).
- **`SKILL.md`** — Agent-Skill front-matter so this folder works as a Claude skill.

Components (`window.BinderyDesignSystem_cd2bc2.<Name>`):
- **actions/** — `Button`, `IconButton`
- **data-display/** — `Badge`, `StatusPill`, `Tag`, `Avatar`, `ProgressBar`, `Kicker`
- **surfaces/** — `Card`
- **forms/** — `Input`, `SegmentedControl`
- **library/** — `CoverThumb` (the signature 2:3 cover card)

Each component directory has a `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md`, and
one `@dsCard` HTML showcase.

UI kit:
- **`ui_kits/bindery-web/`** — full click-through app (Login → Library → Series →
  Reader + Discover). See its `README.md`.

Template (starting point for consumers):
- **`templates/comic-library/`** — a Comic Library screen built from the design
  system, editable and ready to copy.

Foundation cards populate the **Design System** tab under: Colors, Type, Spacing,
Shape, Brand, Components, Bindery Web.
