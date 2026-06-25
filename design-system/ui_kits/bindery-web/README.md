# Bindery Web — UI kit

A high-fidelity, click-through recreation of the Bindery web/PWA product, built
from the design system's own components. Open `index.html` and use it:

**Login → Library → Series → Reader**, plus **Discover** (top-right compass),
the **Admin** console (Profile menu → Admin), and the **Profile menu** (avatar,
top-right) with a live theme + light/dark picker.

> **UX note:** the real product buries its bulk admin actions (Run maintenance,
> Cleanup, Rescan, Re-enrich, Sync all) inside the personal profile/avatar menu.
> This recreation moves them into a dedicated header **Tools** menu on the Admin
> page — discoverable, and separated from personal "sign out" actions.

## Screens

| File | Screen | Notes |
|---|---|---|
| `Login.jsx` | Comic-panel login spread | Art panels with thick black borders + the login form rendered AS a comic panel (3D tilt, hard-shadow CTA). |
| `Library.jsx` | Library grid | Slim sticky header, sticky toolbar (type tabs + count + search/sort), Continue-reading shelf, 6-col cover grid. |
| `Series.jsx` | Series detail | Immersive blurred-cover hero, floating corner buttons, action row (Read / Recommend / Save offline), chapter grid. |
| `Reader.jsx` | PDF reader | Always-dark immersive viewer, tap-to-toggle chrome, edge nav, bottom toolbar with page slider + progress. |
| `Discover.jsx` | Multi-source search | Search field, source pills (per-source accent dot), result grid with per-source top edge + status badges. |
| `Admin.jsx` | Admin console | Four tabs (Library catalog, download Tasks, Subscriptions, Users), per-tab stat cards, merge-select footer, and a header **Tools** menu for bulk maintenance. |
| `chrome.jsx` | Header + Profile sheet | Shared sticky header, notification dropdown, profile menu with theme picker. |
| `lib.jsx` | Helpers + fake data | Lucide icon helper, asset paths, fake series/chapters. |

## How it's wired

`index.html` loads `_ds_bundle.js` (the compiled design system) and reads
components off `window.BinderyDesignSystem_cd2bc2` — `Button`, `IconButton`,
`Badge`, `StatusPill`, `Tag`, `Avatar`, `ProgressBar`, `Kicker`, `Card`,
`Input`, `SegmentedControl`, `CoverThumb`. Screens are plain Babel JSX that
compose those primitives; theme + light/dark are applied to `<html>`
(`data-theme` + `.dark` class) exactly as the real product does.

Covers are stand-in art (login backgrounds + placeholder images) — swap
`COVERS` / `ART` in `lib.jsx` for real cover URLs.
