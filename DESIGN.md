# Bindery — Design Tokens & Patterns

The single source of truth for visual language. **Read this before adding new UI.** If you find yourself reaching for `bg-blue-600`, you're probably looking for `bg-accent`. If you're reaching for `100vh`, you want `100dvh`.

This file documents what's *actually wired up* in code. Where there's a gap between intent and implementation, the gap is called out under **Known stragglers**.

---

## 1. Color tokens

### 1.1 Theme-aware: gray scale

12 themes (6 dark + 6 light) are defined in `src/client/themes.css`. Each theme overrides Tailwind's gray scale via CSS variables. The `tailwind.config.js` wires `gray-{50..950}` to those vars, so **using `gray-*` Tailwind classes is automatically theme-aware**.

```js
// tailwind.config.js (excerpt)
gray: {
  50:  'rgb(var(--gray-50)  / <alpha-value>)',
  ...
  950: 'rgb(var(--gray-950) / <alpha-value>)',
}
```

| Token | When to use |
|---|---|
| `bg-gray-50` / `dark:bg-gray-950` | Page background |
| `bg-gray-100` / `dark:bg-gray-800` | Subtle surface (toggles, segmented controls, input bg) |
| `bg-gray-200` / `dark:bg-gray-700` | Stronger surface (selected segment, separator strip) |
| `bg-surface` / `dark:bg-gray-900` | **Card / modal surface** — see §1.2 below for details |
| `border-gray-200` / `dark:border-gray-800` | Default border |
| `border-gray-100` / `dark:border-gray-800` | Subtle separator inside a card |
| `text-gray-900` / `dark:text-gray-100` | Body text |
| `text-gray-700` / `dark:text-gray-300` | Headings, primary labels |
| `text-gray-600` / `dark:text-gray-400` | Secondary text |
| `text-gray-500` / `dark:text-gray-500` | Tertiary / hint text |
| `text-gray-400` / `dark:text-gray-600` | Quaternary / disabled / muted hint |

**Rule:** light/dark pairs use complementary numeric tokens (50 ↔ 950, 100 ↔ 900, etc.). Don't break this pairing — it's how each theme's brightness curve stays balanced.

### 1.2 Theme-aware: surface

`--surface` is the **card / modal background** in light mode. It exists because in warm-paper light themes (Tankobon, Newsprint, Gruvbox Sand, etc.), the page bg is a beige and `bg-white` reads as a stark, disconnected stripe of pure white over the warm page. With `--surface`, cards pick up a slightly-lifted-from-page-bg cream that harmonizes per theme.

| Theme | `--gray-50` (page) | `--surface` (card) |
|---|---|---|
| Default | 249 250 251 (near-white) | 255 255 255 (white) |
| Latte | 239 241 245 (cool lavender) | 254 254 255 (near-white, slight cool tint) |
| Dawn | 250 244 237 (warm parchment) | 255 253 250 (near-white, slight warm tint) |
| Alucard | 255 251 235 (aged ivory) | 255 255 250 (near-white, slight ivory tint) |
| Gruvbox Sand | 251 241 199 (retro sand) | 255 253 240 (near-white, slight cream tint) |
| Tankobon | 237 232 213 (manga paper) | 255 252 241 (near-white, slight cream tint) |
| Newsprint | 242 232 201 (comic paper) | 255 251 235 (near-white, slight cream tint) |

**Sizing rationale:** earlier values were "1 step lifted from gray-50" — too close to the page bg in warm themes; cards barely separated, popover sheets appeared to bleed through their (transparent on desktop) backdrop. Current values are "near-white with a tiny theme tint" — cards now read as clearly elevated everywhere while still respecting the warm/cool theme character through that subtle tint.

The token only matters in light mode — dark themes use `dark:bg-gray-900` (which is theme-aware via the gray var system, no `--surface` override needed). So the canonical card pattern is:

```tsx
<div className="bg-surface dark:bg-gray-900 …" />
```

**Sticky chrome (page header + StickyToolbar)** does NOT use `--surface` — it uses `bg-gray-50/85 dark:bg-gray-950/85 backdrop-blur-md` so the sticky strip blends with the page bg (slight transparency for the glass effect). Stick chrome is "the page extending up," not a card.

### 1.3 Theme-aware: accent

Each theme defines `--accent` and `--accent-hover` for its primary action color (Midnight=purple, Tankobon=red, Latte=lavender, etc.). Wired into Tailwind as `accent` and `accent-hover`.

| Token | Maps to | When to use |
|---|---|---|
| `bg-accent` | `rgb(var(--accent))` | Primary CTA, selected state fill, NEW badge, progress fill |
| `bg-accent-hover` | `rgb(var(--accent-hover))` | Hover on primary CTA |
| `bg-accent/10` | 10% accent | Subtle row highlight, hovered row |
| `bg-accent/15` | 15% accent | Selected pill, active state background |
| `bg-accent/20` | 20% accent | Stronger active state in dark mode |
| `text-accent` | Solid | Active text, link text, active icon, highlight |
| `border-accent` | Solid | Selected outline (e.g. theme tile in Settings) |
| `border-accent/30` | 30% accent | Soft border on info banner |
| `ring-accent` / `hover:ring-accent` | Solid | Focus ring, hover ring on cards |
| `focus:ring-accent` | Solid | Form input focus |
| `from-accent to-accent-hover` | Gradient | Decorative gradient (Library onboarding card) |
| `accent-accent` | CSS `accent-color` | `<input type=range>` thumb/track color |

**Rule:** never use `bg-blue-N` / `text-blue-N` for accent. Use these tokens. If a theme switches, the whole UI should re-tint.

**Variant guidance:**
- `accent/10` ≈ what `bg-blue-50` used to render (light tint)
- `accent/15` ≈ what `bg-blue-100` used to render (selected pill)
- `accent/20` ≈ what `dark:bg-blue-900/30` used to render (dark-mode active)
- `accent/30` ≈ what `dark:bg-blue-900/40` used to render (strongest dark-mode tint)

### 1.4 Semantic tokens — themable but stable by default

`--success`, `--warning`, `--danger` defined in `themes.css` and wired into Tailwind as `success`, `warning`, `danger`. Defaults: `green-600`, `amber-600`, `red-600`. Themes can override per-theme if a designer wants a coordinated palette (e.g. a colorblind-friendly variant), but the default values are stable across all 12 themes — switching to Tankobon does NOT make errors orange.

| Token | Maps to | When to use |
|---|---|---|
| `bg-success` / `text-success` | green-600 default | Read indicators, "saved offline", confirmation, ongoing status |
| `bg-success/10` / `bg-success/15` | tinted | Light success-tinted background |
| `bg-success/90` | nearly solid | "In Collection" badge over a cover image |
| `bg-warning` / `text-warning` | amber-600 default | Pending imports, hiatus status, warning icons, duplicate-warning |
| `bg-warning/10` / `bg-warning/15` | tinted | Warning banner background |
| `bg-danger` / `text-danger` | red-600 default | Delete, errors, cancelled status, NSFW badge |
| `bg-danger/10` / `bg-danger/15` | tinted | Error banner background |
| `bg-danger/85` | nearly solid | NSFW badge (slight transparency for cover legibility) |
| `border-warning/30` / `border-danger/30` | tinted border | Warning / error banner outlines |

**Status pill mapping:**
- `ongoing` → `bg-success` (green by default)
- `completed` → `bg-accent/15 text-accent` (accent-tinted, theme-aware)
- `hiatus` → `bg-warning`
- `cancelled` → `bg-danger`

**Rule:** if the meaning is "primary action / link / brand," use `accent`. If the meaning is "this is good / pay attention / this went wrong," use semantic.

### 1.5 Overlay & glass tokens (theme-independent)

Floating UI over content (Reader page, Series cover backdrop) uses fixed black/white scrims so it stays legible regardless of the theme behind it.

| Token | Use |
|---|---|
| `bg-black/40 backdrop-blur-md` | Floating top-corner button (back arrow, ⋯, avatar over hero) |
| `bg-black/50 backdrop-blur-sm` | Modal/sheet backdrop |
| `bg-black/60` | Strong card-overlay strip (source name on cover, offline badge) |
| `bg-black/90 backdrop-blur-md` | Reader bottom toolbar surface |
| `bg-gray-50/85 dark:bg-gray-950/85 backdrop-blur-md` | Sticky page header / sticky toolbar (theme-aware page bg, transparent for glass) |
| `bg-white/20 ring-1 ring-white/20` | Avatar over dark backdrop (`onDark` variant) |
| `bg-white/10` (hover) | Reader toolbar button hover (over its dark surface) |
| `backdrop-blur-md` | Default blur for sticky surfaces |
| `backdrop-blur-sm` | Light blur for sheet backdrops |

**⚠ Containing-block trap:** any element with `backdrop-filter` (or `transform`, `filter`, `perspective`, `will-change`) becomes a containing block for `position: fixed` descendants. Modals/popups rendered inside such an ancestor will be trapped to that ancestor's box. **Always portal modals/sheets to `document.body`** via `createPortal`. See `ProfileMenu.tsx` for the canonical pattern.

---

## 2. Typography

### 2.1 Sizes

Tailwind defaults plus three custom small sizes for high-density UI:

| Class | px | Use |
|---|---|---|
| `text-3xl` | 30px | Hero page title (Series page name on desktop) |
| `text-2xl` | 24px | Page title (Admin), Series name on tablet |
| `text-xl` | 20px | Series name on mobile, sheet title |
| `text-lg` | 18px | Sub-headings, modal headers |
| `text-base` | 16px | Default body |
| `text-sm` | 14px | Body in dense UI, button text |
| `text-xs` | 12px | Helper text, kicker labels, status pills |
| `text-[11px]` | 11px | Toolbar small text, hints, labels |
| `text-[10px]` | 10px | Tag chips, dense badges |
| `text-[9px]` | 9px | Card overlay strips (source name on cover) |

**Rule:** custom sizes (`text-[Npx]`) are reserved for ≤ 11px where Tailwind's default scale stops. If you need 12–30px, use the named scale.

### 2.2 Weights

Default body is `font-normal` (Tailwind default, 400). Three other weights in regular use:

| Class | Use |
|---|---|
| `font-medium` | 500 — chapter titles, default emphasis, form labels |
| `font-semibold` | 600 — sub-headings, primary CTAs, sticky-toolbar titles |
| `font-bold` | 700 — page titles (Admin "Admin"), avatar initial, stat values |

### 2.3 Other type tokens

| Class | Use |
|---|---|
| `tracking-wider` + `uppercase` + `text-[10px]` or `text-[11px]` | Kicker text ("CONTINUE READING", section labels, tag-popover header, admin-pill) |
| `tabular-nums` | Page counts, stat values, progress percentages |
| `font-mono` | MAL IDs, file paths, hashes |
| `truncate` | Single-line clip with ellipsis (always pair with `min-w-0` on a flex child) |
| `line-clamp-2` / `line-clamp-3` | Multi-line clip (synopsis) |

---

## 3. Spacing & sizing

### 3.1 Touch targets

Minimum tap targets, enforced explicitly via `min-h-[…]`:

| Token | Use |
|---|---|
| `min-h-[28px]` | Pill / segmented-control button (one-thumb tap, not primary) |
| `min-h-[36px]` | Toolbar icon button (`ToolbarIconButton` default) |
| `min-h-[40px]` | Secondary button |
| `min-h-[44px]` | Primary CTA on mobile (Apple HIG min) |

### 3.2 Page widths

| Token | Use |
|---|---|
| `max-w-7xl` | Library, Discover (broad grids) |
| `max-w-6xl` | Admin, sticky toolbars (default `StickyToolbar` inner width) |
| `max-w-5xl` | Series page |
| `max-w-3xl` | Import page (narrower, single-column flow) |
| `max-w-2xl` | Modals (SeriesEditModal, MergeModal) |
| `max-w-lg` | Small modals (Discover "More sites") |
| `max-w-md` | Bottom sheets at sm:+ (ConfirmSheet, ProfileMenu dropdown is `w-72`) |
| `max-w-sm` | Login form |

### 3.3 Common gutter pattern

Pages use `px-4 sm:px-6` as the canonical horizontal gutter. Vertical rhythm: `py-4` to `py-6` for main content, `space-y-6` between top-level sections.

### 3.4 Common gap values

| Class | Use |
|---|---|
| `gap-1` / `gap-1.5` | Icon-text in dense buttons, toolbar-button row |
| `gap-2` | Standard button row |
| `gap-3` | Card content row, modal header |
| `gap-4` | Grid items (series grid) |

---

## 4. Shape

### 4.1 Border radius

| Token | Use |
|---|---|
| `rounded-2xl` | Drop-zone hero, bottom-sheet top corners |
| `rounded-xl` | Cards (series grid, admin rows, modals, sticky-toolbar popovers) |
| `rounded-lg` | Buttons, inputs, info banners |
| `rounded-md` | Toolbar icon buttons, segmented controls |
| `rounded` | Tiny pills, status badges (default 4px) |
| `rounded-full` | Avatars, badge dots, NEW chapter badge, theme accent dots, floating top buttons, theme picker tiles |
| `rounded-t-2xl` | Mobile bottom-sheet top edge |
| `rounded-t-xl` | Modal header sticking inside a `rounded-xl` card |

**Rule:** the bigger the surface, the bigger the radius. A 280px modal uses `rounded-xl`. A 36px chip uses `rounded-md`. A circle is `rounded-full`.

### 4.2 Borders & rings

| Token | Use |
|---|---|
| `border` (default 1px) | Card edge: `border border-gray-200 dark:border-gray-800` |
| `ring-1 ring-gray-200 dark:ring-gray-800` | Card edge alt (compose-friendly, doesn't take layout space) |
| `ring-2 ring-accent` | Selected card / hovered card / focus indicator |
| `border-2 border-dashed` | Drop zone |
| `border-l-4` *(deprecated)* | Was used by old `SourceCard` — replaced by colored top edge / dot |

---

## 5. Effects

### 5.1 Shadows

| Token | Use |
|---|---|
| `shadow-sm` | Cards in light mode (cards in dark mode use `dark:shadow-none`) |
| `shadow-md` | Buttons (primary CTA), hover lift |
| `shadow-lg` | Floating top-corner buttons |
| `shadow-2xl` | Modals, sheets, popovers (overlays anything below) |

### 5.2 Transitions

| Token | Use |
|---|---|
| `transition-colors` | Default for buttons, links, hover effects |
| `transition-all` | When multiple props animate together (cards with hover lift+shadow+border) |
| `transition-transform` | Scale on hover (`group-hover:scale-105` on series-card images) |
| `transition-shadow` | Sticky toolbar pinned-state shadow fade-in |
| `transition-opacity` | Fade in/out (mobile menu drawer) |
| `transition-[padding]` | When responsive padding changes (sticky toolbar gutter on pin) |
| `duration-200` | Default snappy feel |
| `duration-300` | Slightly slower for larger movements (progress bar fill) |

### 5.3 Animations

| Token | Use |
|---|---|
| `animate-spin` | Loading spinners (Lucide `Loader` icon) |
| `animate-pulse` | Skeleton cards in DiscoverPage loading state |

---

## 6. Z-index layers

| Layer | Token | Examples |
|---|---|---|
| Base | (none) | Default content |
| Sticky page header | `z-30` | LibraryPage, AdminPage, ImportPage, DiscoverPage headers |
| Sticky per-page toolbar | `z-20` | `StickyToolbar` (pins below the page header) |
| Modal-internal sticky header | `z-10` | Sticky header *inside* a modal scroll container (SeriesEditModal, MergeModal). Always relative to the modal — not the page. |
| Floating corner buttons | `z-40` | SeriesPage floating ⋯, Reader floating back arrow, AdminPage floating ⋯ |
| Modal / sheet backdrop + content | `z-50` | All portal-rendered modals (ProfileMenu, ConfirmSheet, SeriesEditModal, etc.) |

**Rule:** modals always portal to `document.body` and live at `z-50`. Don't render a modal in-tree — it'll be containing-block-trapped (see §1.4) AND will fight z-index with siblings.

---

## 7. Viewport & mobile

| Token | Use |
|---|---|
| `min-h-[100dvh]` | Full-page container — survives iOS Safari URL-bar collapse |
| `env(safe-area-inset-bottom)` | Bottom padding inside fixed/sticky elements that touch the screen edge |
| `touch-action: none` (Tailwind: `touch-none`) | Disable browser scroll/pinch on the Reader's PDF surface |
| Viewport meta `user-scalable=no, maximum-scale=1` | Set in ReaderPage to lock browser pinch (paired with `touch-none`) |

**Rule:** never `100vh` for new code. Always `100dvh` (or `min-h-[100dvh]`).

**iOS safe-area pattern:**
```jsx
<div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
```
Used in: ConfirmSheet, ProfileMenu sheet, multi-select footer, Reader bottom toolbar (with extra buffer above the gesture zone).

---

## 8. Surfaces & patterns

### 8.1 Page header (canonical Library shape)

```tsx
<header className="sticky top-0 z-30 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
  <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center gap-2 h-12">
    <Link to="/" className="shrink-0">
      <img src="/logo.png" alt="Bindery" className="h-8 w-8 rounded-md" />
    </Link>
    <div className="flex-1" />
    <NotificationDropdown />
    <ProfileMenu />
  </div>
</header>
```

**Variants:**
- **Admin** uses two rows (title + tab strip) — taller, ~96px total
- **Series / Reader** drop the page header entirely in favor of floating top-corner buttons (immersive)

### 8.2 Floating top-corner button

```tsx
<Link className="fixed top-3 left-3 z-40 p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 shadow-lg" />
```

Used on Reader (back arrow), Series (back arrow + ProfileMenu floating variant). Reader's drawer chevron uses the same backdrop palette.

### 8.3 Sticky per-page toolbar

Use `<StickyToolbar topPx={N}>` where `N` is the page-header height in pixels (48 for slim Library header, 96 for Admin's 2-row header). Pin it BELOW the header so they stack cleanly. Sentinel + `IntersectionObserver` provides the pinned boolean inside the children render-prop.

### 8.4 Card

```tsx
<div className="bg-surface dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm dark:shadow-none">
```

For interactive cards: add `hover:ring-2 hover:ring-accent transition-all`.

The `bg-surface` token is theme-aware in light mode (lifts above the page bg per theme — see §1.2). In dark mode, `dark:bg-gray-900` carries the load (gray-900 is theme-aware via the gray var system).

### 8.5 Modal / sheet

Bottom-sheet on mobile, centered modal at `sm:+`, both portaled to `document.body`. Includes drag handle on mobile, safe-area padding, ESC to close, click-backdrop to dismiss. See `ConfirmSheet.tsx` and `ProfileMenu.tsx` for canonical implementations.

**Required a11y attributes for any modal:**
```tsx
const titleId = useId();
useEscapeKey(onClose); // from src/client/lib/useEscapeKey.ts

<div
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
>
  <h2 id={titleId}>{title}</h2>
  <button onClick={onClose} aria-label="Close" title="Close" className="… focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
    <X size={18} />
  </button>
</div>
```

If a confirmation child (e.g. a ConfirmSheet inside the modal) is open, suppress the parent's Esc handler with `useEscapeKey(onClose, !showInnerConfirm)` so Esc dismisses the inner first.

### 8.6 Reader drawer chevron

A horizontal pill that rides on top of the Reader's bottom toolbar when expanded, and floats just above the iOS gesture zone when collapsed. The single affordance for showing/hiding the toolbar.

### 8.7 Search-toggle

Pattern: a `🔍` icon button in a toolbar that, when toggled, replaces or adds a row with a full-width search input. Used in: SeriesPage chapter toolbar, LibraryToolbar, DiscoverPage. Auto-opens once results are present.

### 8.8 Selection footer

Sticky bottom strip that appears when a multi-select mode is active. Shows count + primary action + cancel. Respects `env(safe-area-inset-bottom)`. See AdminPage Library tab merge selection.

### 8.9 Card → grid-row morph

Same DOM, layout switches at `md:`. Mobile renders a stacked card; desktop uses CSS grid columns. See `SeriesAdminRow.tsx`. Avoids parallel mobile/desktop component trees.

```tsx
<div className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_minmax(140px,220px)_64px_88px] md:items-center gap-x-3 gap-y-1.5">
```

### 8.10 Skeleton loading

`animate-pulse` on placeholder card grids during async fetch. See `DiscoverPage.SkeletonGrid`.

---

## 9. Component inventory

Shared, reusable components in `src/client/components/`:

| Component | Purpose |
|---|---|
| `Avatar.tsx` | Initial-circle, sizes sm/md/lg, default/onDark variants |
| `ProfileMenu.tsx` | Avatar trigger + bottom-sheet/dropdown with identity, sections, nav, theme, settings, sign-out |
| `StickyToolbar.tsx` | Sentinel + IntersectionObserver + pinned slot |
| `ToolbarIconButton.tsx` | 36×36 icon button with optional sm:+ label, default/primary/destructive |
| `ConfirmSheet.tsx` | Replaces `window.confirm()`. Bottom-sheet on mobile, modal on desktop |
| `ContinueShelf.tsx` | Mini-card horizontal scroll strip ("Continue reading") |
| `LibraryToolbar.tsx` | Library-specific sticky toolbar (type segments, search, tag popover, sort) |
| `SeriesAdminRow.tsx` | Admin Library catalog row (card → grid-row morph) |
| `MangaSearchCard.tsx` | Discover result card (favicon + cover + title + tags) |
| `ProgressBar.tsx` | Themed thin progress bar (uses `bg-accent`) |
| `lib/useEscapeKey.ts` | Hook: `useEscapeKey(onClose, enabled?)` — wires `Escape` key to a handler. Pair with `aria-modal` on every modal/sheet/popover. |
| `NotificationDropdown.tsx` | Header bell with unread badge |
| `SeriesEditModal.tsx`, `MergeModal.tsx`, `SyncSourcePicker.tsx`, `ChapterPicker.tsx`, `ImportModal.tsx`, `PendingList.tsx`, `DownloadProgress.tsx` | Domain-specific modals |
| `ThemeToggle.tsx` | *(legacy — now embedded inside ProfileMenu, no longer rendered standalone)* |

---

## 10. Themes

12 themes defined in `src/client/themes.css`. Each redefines `--gray-50..950`, `--accent`, `--accent-hover`. Activated via `data-theme="..."` on `<html>`.

**Dark themes:** Midnight (Dracula), Nord Frost, Mocha (Catppuccin), Rosewood (Rose Pine), Tankobon Dark, Newsprint Dark
**Light themes:** Latte (Catppuccin), Dawn (Rose Pine), Alucard (Dracula Light), Gruvbox Sand, Tankobon, Newsprint

The `dark` class is added to `<html>` alongside the `data-theme` attribute for any of the dark themes — all `dark:` Tailwind variants react to it.

**Picker:** SettingsPage renders the 12 tiles using `border-accent` for the selected one — that's why the picker is the only place that genuinely felt themed before the recent sweep.

---

## 11. What goes where (decision tree)

```
Need a primary action color?
├─ Always swaps with theme        → bg-accent / text-accent / ring-accent
└─ Semantic meaning               → bg-success / bg-warning / bg-danger
                                    (themable via --success/--warning/--danger,
                                     stable across all 12 themes by default)

Need a surface color?
├─ Page background                → bg-gray-50 dark:bg-gray-950
├─ Card / modal                   → bg-surface dark:bg-gray-900 + border-gray-200 dark:border-gray-800
├─ Subtle (input, segmented)      → bg-gray-100 dark:bg-gray-800
├─ Sticky page chrome             → bg-gray-50/85 dark:bg-gray-950/85 backdrop-blur-md
└─ Floating over content          → bg-black/40 backdrop-blur-md text-white (theme-independent)

Need a text color?
├─ Body                           → text-gray-900 dark:text-gray-100
├─ Secondary                      → text-gray-600 dark:text-gray-400
├─ Hint                           → text-gray-400 dark:text-gray-600
└─ Accent / link                  → text-accent

Need a tap target?
├─ Primary CTA on mobile          → min-h-[44px], rounded-xl, bg-accent text-white
├─ Toolbar icon button            → 36×36, rounded-md
└─ Pill / chip                    → min-h-[28px], rounded-full

Sticky element?
├─ Page header                    → z-30, top-0
├─ Per-page toolbar               → z-20, topPx={pageHeaderHeight}
└─ Modal-internal header          → z-10 (relative to modal body)

Modal-style overlay?
└─ ALWAYS portal to document.body, z-50, backdrop bg-black/50 backdrop-blur-sm
```

---

## 12. Known stragglers

Tracked tech debt — fix opportunistically.

1. **Page max-width inconsistency.** Library and Discover use `max-w-7xl`, Admin uses `max-w-6xl`, Series uses `max-w-5xl`, Import uses `max-w-3xl`. Each is reasonable for the content shape but worth a deliberate decision next time we touch them.

2. **Modal sticky-header `z-10` is fine but easily confused with page-level `z-10`.** Consider documenting modal z-index as a separate scale (modal-internal: 10/20/30, page-level: 30/40, overlay: 50) to avoid future muddling.

3. **SettingsPage header tokens drift.** Uses `bg-white/80 dark:bg-gray-900/80` (more transparent, dark surface = gray-900 not gray-950) instead of the canonical `bg-white/95 dark:bg-gray-950/95`. Decide if it's deliberate; if not, normalize.

---

## 13. Don'ts

- ❌ `bg-blue-N` / `text-blue-N` for accent — use `accent` tokens
- ❌ `bg-red-N` / `text-red-N` / `bg-green-N` / `bg-amber-N` for semantic intent — use `success`, `warning`, `danger` tokens
- ❌ `bg-white` for cards and modals — use `bg-surface` so warm-paper themes (Tankobon, Newsprint, Gruvbox Sand, Alucard, Latte, Dawn) don't get stark pure-white cards on a beige page
- ❌ `bg-white/95` for sticky page chrome — use `bg-gray-50/85` so the chrome blends with the theme's page bg instead of standing out as a pure-white stripe
- ❌ `100vh` / `min-h-screen` — use `100dvh` / `min-h-[100dvh]`
- ❌ `window.confirm()` / `window.alert()` — use `<ConfirmSheet>` for confirmation, or inline error banner (set `error` state, render in a styled `<div className="bg-danger/10 border border-danger/30 …">` near the action)
- ❌ Modal `<div>` inside a backdrop-filter ancestor — portal to `document.body`
- ❌ `<button>` containing another `<button>` — use `<div role="button" tabIndex={0}>` for the outer
- ❌ Icon-only buttons without `aria-label` — screen readers hear only "button". Always pair `aria-label` and `title` (the latter for hover tooltip).
- ❌ Modal containers without `role="dialog"` + `aria-modal="true"` + `aria-labelledby={titleId}` — every modal/sheet/popover needs all three. See §8.5.
- ❌ `outline: none` (or `focus:outline-none`) without a `focus-visible:ring-2 focus-visible:ring-accent` replacement — keyboard users need a visible focus indicator.
- ❌ `accent-blue-500` on `<input type="range">` — use `accent-accent` (Tailwind utility for CSS `accent-color` + our color named `accent`)
- ❌ Inline JS hover effects (`onMouseEnter` setting `style.boxShadow`) — use Tailwind `hover:` classes
- ❌ Custom font sizes via `text-[Npx]` for sizes ≥ 12px — use the named scale (`text-xs` and up)
- ❌ Mixing `border` and `ring-1` for the same edge — pick one. Cards use `border`, dense rows often use `ring-1`.

---

## 14. Build verification

After any sweep that touches Tailwind classes:

```bash
npx tsc --noEmit -p tsconfig.json     # TypeScript
npx vite build                         # Tailwind JIT + CSS bundling
grep -c 'var(--accent' dist/client/assets/index-*.css   # confirm accent tokens compiled in
```

If a class doesn't appear in the bundle, Tailwind's content scanner didn't see it (could be a dynamic class string the scanner can't reach). Add a static fallback or `safelist` in tailwind.config.

---

## 15. When in doubt

Read the most recently redesigned pages — they reflect current intent best:

- **`src/client/pages/LibraryPage.tsx`** — header + sticky toolbar pattern
- **`src/client/pages/SeriesPage.tsx`** — floating buttons + cover-as-hero pattern
- **`src/client/pages/ReaderPage.tsx`** — immersive viewer + drawer chevron
- **`src/client/components/ProfileMenu.tsx`** — modal/sheet portal pattern
- **`src/client/components/StickyToolbar.tsx`** — sentinel + IntersectionObserver primitive

If something feels different from these, either there's a good reason — or we have new tech debt. Add it to **§12 Known stragglers**.
