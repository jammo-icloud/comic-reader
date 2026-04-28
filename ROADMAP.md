# Comic Reader — Roadmap

Living plan for what's shipping, what's deliberately NOT shipping, and what's
queued. Written for future-Claude/future-James to pick up cold without
re-deriving any architectural decisions.

## Status snapshot

| Track | Status |
|---|---|
| **Server-side CRZ export/import (single series)** | ✅ Done |
| **Server-side backup/system/scheduled backups** | ❌ **Not building** — see "Not building" |
| **iOS PWA polish (Phase 1)** | ✅ Done |
| **iOS server-side capability flags (Phase 2)** | 🔜 Next |
| **iOS Capacitor shell (Phase 3)** | Queued |
| **iOS App Store submission (Phase 4)** | Queued |
| **iOS native unlocks (Phase 5)** | Later |
| **manga-finder produces v2 CRZ (parallel)** | Format spec ready; extension work pending |

---

## ✅ Recently shipped

### Server-side CRZ export/import — single-series share mode

Files: `src/server/crz-format.ts`, `src/server/crz-handler.ts`,
`src/server/routes/export.ts`, `src/server/routes/chapter-upload.ts`

- v2 manifest spec with provenance, full SeriesRecord round-trip, NSFW flag,
  per-chapter `order`/`pages`, multi-part support (Pattern A: self-contained
  parts), translations bundle, JSON Schema for cross-language validators.
- `GET /api/admin/series/:id/export?translations=1` — streaming zip via
  `archiver` in `store` mode (no recompression — PDFs/JPEGs are already
  compressed). Single-part always (`partIndex: 0, totalParts: 1`).
- v2 importer with `?strategy=merge|replace|fork`. v1 importer kept for legacy
  CRZs. Zip-slip hardening on every path.
- SeriesPage admin menu has **Export as .crz** action — programmatic
  `<a download>` click for native browser streaming.

### iOS PWA polish — Phase 1

Files: `index.html`, `vite.config.ts`, `src/client/lib/themes.ts`,
`scripts/generate-splash.ts`, `public/icons/`, `public/splash/`,
`src/client/pages/{ReaderPage,SeriesPage,LibraryPage,DiscoverPage,AdminPage}.tsx`

- `viewport-fit=cover` (the foundation — without it `env(safe-area-inset-*)`
  returns 0 on every notched iPhone).
- iOS standalone meta tags: `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style="black-translucent"`,
  `apple-mobile-web-app-title="Comics"`.
- 180×180 `apple-touch-icon` generated from `logo.png`.
- Splash screens generated from `public/login-bg/` art via `npm run splash`
  (4 iPhone portrait sizes: Pro Max, Pro, standard, SE).
- Top-edge safe-area: 3 floating buttons (`top-3` → safe-area-inset-top),
  4 sticky page headers (LibraryPage, DiscoverPage, AdminPage, SeriesPage
  chapter sub-toolbar).
- Theme-color meta sync to active theme (12 themes — `applyTheme()` rewrites
  the `<meta name="theme-color">` tag).
- `h-screen` → `h-[100dvh]` (iOS Safari URL bar bug).
- Reader pan-clamping (canvas can't be dragged past edges) + 44pt tap targets
  + footer toolbar clearance from the home-indicator gesture zone.

---

## ❌ Decisions log — considered and rejected

These were on the table at some point, evaluated, and deliberately set aside.
Captured here so the same idea doesn't re-surface in three months and trigger
a re-litigation. Each entry says **what** was considered, **why rejected**,
and (where applicable) **what we chose instead**.

### Server-side backup, system-backup, scheduled backups

**Considered:** dedicated backup-mode (.crzbackup), system-mode (.crzsystem),
scheduled exports to EXPORT_DIR.

**Rejected because:** the NAS handles filesystem-level backup natively and far
better than we could.
- Synology Snapshot Replication / BTRFS snapshots / ZFS snapshots are
  filesystem-level, atomic, deduplicating, and survive corruption.
- Rsync / Hyper Backup / borg are battle-tested for offsite copies.
- Re-implementing in app code reinvents a worse wheel and forces users to
  remember a separate "Comic Reader backup" instead of using the one tool
  that backs up everything else on the NAS.

**Chose instead:** per-series CRZ export/import (already shipped). Strictly
better than a backup mode for sharing — file-manager-friendly, format ships
across instances, not coupled to the host filesystem.

**Concrete consequence:** ignore all references to ".crzbackup", ".crzsystem",
or "EXPORT_DIR / scheduled exports" in any earlier design notes. Those are out.

### Gyroscope-driven parallax (iOS-wallpaper-style depth)

**Considered:** make cover art / library cards / hero shift with device tilt
via `DeviceOrientationEvent`, mirroring iOS's home-screen wallpaper effect.

**Rejected because:**
- iOS 13+ requires `DeviceOrientationEvent.requestPermission()` — user must
  tap a button to grant motion access. Awkward, breaks first-run flow.
- Feel is dated (peak iOS 7 era). Apple themselves moved away from it.
- Motion-sickness risk if applied broadly.
- iPhone-only — no value on desktop / iPad / Android.
- Battery drain from continuous gyroscope sampling, even if marginal.

**Chose instead:** touch/pointer-driven `<TiltCard>` wrapper as the optional
visual differentiator (see "Open product questions" — pointer-tilt). Same
"3D perspective" feel without permissions, works everywhere, used by Apple
Music / Apple TV+ / Steam UI today.

### 3D card flip on every card surface

**Considered:** apply perspective + rotate transforms across the library
grid, comic-card list items, manga search results — anywhere a card lives.

**Rejected because:** overdone = nauseating. Tilt should be reserved for
focused/touched cards (the marquee hero, the long-pressed library card),
not ambient. If we ever build `<TiltCard>`, it gets applied selectively,
not globally.

### Animated page transitions between routes

**Considered:** crossfade / slide / shared-element transitions between
LibraryPage ↔ SeriesPage ↔ ReaderPage.

**Rejected because:** classic rabbit hole. Every transition feels great in
isolation and frustrating after the 50th time. The current instant-route
behavior is correctly invisible; users don't notice navigation, which is the
goal. Re-evaluate only if there's a specific UX problem to solve, not as
polish.

### Page-flip animation in the Reader (book-page peel)

**Considered:** replace the current linear page-change with a CSS-perspective
book-page-peel animation.

**Rejected (for now) because:** motion-sickness risk is real for chapter
binge-reading. The cost of getting it wrong (user closes the app and never
returns) outweighs the polish win. Re-evaluate ONLY if `<TiltCard>` ships
first and proves users like the depth aesthetic in the Reader context.

### Pull-to-refresh with custom logo-bounce animation

**Considered:** instead of the generic spinner, animate the Comic Reader
logo on Library / Discover / SeriesPage pull-to-refresh.

**Rejected because:** cute but novelty depreciates fast. Adds animation code
that runs on every refresh forever, in exchange for a polish win that fades
to invisible after week one.

---

## 🔜 Phase 2 — Server-side capability flags

**Why before Capacitor:** the iOS App Store version needs feature gating to
pass review. Apple's bar is "does the iPhone app on its own facilitate piracy?"
A capability-flags system lets the server be the source of truth — the app
just shows what's enabled. Plex / Jellyfin / Komga all use this pattern.

Useful even without iOS: it cleans up the "core library reader" vs "discovery"
separation, lets you ship a stripped-down family/shared web UI.

### What to build

**`GET /api/server-info`** — public, unauthenticated, returns:

```ts
{
  version: string,            // package.json version
  capabilities: {
    discover:           { enabled: boolean, sources: string[] },  // names only, no domains
    chromeExtension:    { available: boolean, installUrl: string | null },
    translate:          { enabled: boolean },
    export:             { enabled: boolean },
    nsfwBypassAdminOnly: boolean,
  }
}
```

Settings persist in a new `data/server-config.json` (system-level, separate
from per-user prefs). New server module `src/server/config.ts` with typed
load/save and an in-memory cache.

**Admin UI** — new section in `AdminPage` "Server features" with toggle rows
for each capability. Saves via `POST /api/admin/server-config`.

**Frontend integration:**
- `src/client/lib/api.ts` adds `getServerInfo()`.
- New `ServerCapabilitiesProvider` (similar shape to `ThemeProvider`) loads
  on app boot, exposes `useCapabilities()`.
- Existing pages check capabilities before rendering features:
  - `LibraryPage` hides Discover nav if `!capabilities.discover.enabled`
  - `DiscoverPage` 404s if disabled (defense-in-depth)
  - SeriesPage hides "Export as .crz" if `!capabilities.export.enabled`
  - Translation toggle in Reader hides if `!capabilities.translate.enabled`

**Key design rules:**
- Source names in `capabilities.discover.sources` are **friendly names**
  (`"Source A"`, `"Source B"`) — never domain names. Apple reviewer never sees
  "mangadex.org" in app traffic or UI.
- Default for new installs: `discover: { enabled: false }`. Existing installs
  upgrade with `discover: { enabled: true }` (preserves current behavior).
- `chromeExtension.available` defaults to `true` since the extension exists;
  surface as a tip, never an action.
- Capabilities can be toggled live without server restart.

**Estimate:** ~2 weeks calendar.

**Files touched:**
- New: `src/server/config.ts`, `src/server/routes/server-info.ts` (or extend admin)
- New: `src/client/lib/capabilities.tsx`
- Modified: `src/client/App.tsx` (provider), `src/client/pages/LibraryPage.tsx`,
  `src/client/pages/DiscoverPage.tsx`, `src/client/pages/SeriesPage.tsx`,
  `src/client/pages/AdminPage.tsx`, `src/client/pages/ReaderPage.tsx`

---

## 📦 Phase 3 — Capacitor shell

**Goal:** a real iPhone app that's mostly the existing SPA in a WKWebView,
plus a few native niceties.

### What to build

```bash
npm install @capacitor/core @capacitor/ios @capacitor/cli
npm install @capacitor/filesystem @capacitor/share @capacitor/preferences
npx cap init "Comic Reader" "com.morrisfamily.comicreader" --web-dir=dist/client
npx cap add ios
```

**Native features worth wiring:**
- **Capacitor Filesystem plugin** — replaces browser Cache Storage for offline
  PDFs. Survives Safari "Clear History and Website Data" (which currently
  wipes offline-saved chapters). Adapter pattern: `src/client/lib/storage.ts`
  abstracts both backends.
- **Capacitor Share plugin** — receive `.crz` files from the iOS Files app,
  Mail attachments, AirDrop. Wires to `POST /api/import/crz`.
- **`.crz` UTI registration** — `Info.plist` declares
  `com.morrisfamily.comicreader.crz` as the UTI for `.crz` files. iOS then
  treats them as first-class: Files app shows the Comic Reader icon, "Open
  with Comic Reader" appears in share sheets, AirDropping a `.crz` from
  another iPhone routes to the app.
- **Server URL config** — first launch asks for server URL, stores in
  Capacitor Preferences. Multi-server support (Plex pattern) deferred to
  Phase 5 if useful.
- **Auth** — tokens via Capacitor Preferences (rather than cookies in
  WKWebView, which iOS sometimes nukes on app updates). Server keeps cookie
  auth for the web; native client uses `Authorization: Bearer <token>`. New
  endpoint `POST /api/auth/token` issues tokens against username+password.

**Build output:** `npx cap copy ios` after every `npm run build`. Then Xcode
opens, sign, TestFlight.

**Key design rules:**
- App is a thin WKWebView shell. NO scraping logic in the app binary.
- Server-side capability flags (Phase 2) gate what's visible.
- First-run experience: server URL → login → library. NO discovery surfaces
  by default unless the connected server has `capabilities.discover.enabled`.

**Estimate:** ~3-4 weeks calendar (mostly Apple Developer setup, code-signing,
TestFlight pipeline — actual Capacitor wiring is days, not weeks).

**Files touched:**
- New: `ios/` (Capacitor-generated; gitignore most of it, commit `Info.plist`
  and signing config)
- New: `src/client/lib/storage.ts` (abstracts Cache Storage vs Capacitor FS),
  `src/client/lib/native.ts` (Capacitor detection helpers)
- Modified: `src/client/lib/api.ts` (token-aware auth path),
  `src/server/routes/auth.ts` (token issue endpoint)

---

## 🍎 Phase 4 — App Store submission

**Goal:** publicly distributable on the App Store.

### What it takes

**Defensible framing:**
- App description: "Self-hosted comic reader for your personal library."
  Never "manga downloader," never "scraper," never "Tachiyomi-style."
- Screenshots: only show your personal library + reader. No Discover, no
  source browsing, no third-party content.
- Keywords: comic, library, self-hosted, reader. Avoid "manga" in metadata
  (still fine in the app itself; it's just metadata-targeting that triggers
  Apple's piracy-radar ML).

**Default-off discovery in the App Store build:**
- Build flag `IS_APPSTORE_BUILD=true` ships with `capabilities.discover` UI
  hidden in the first-run experience. Even if a server has discover enabled,
  the App Store version only surfaces it after the user **explicitly enables
  it in Settings**. (The server still controls availability; the app adds an
  extra opt-in layer specifically for review compliance.)

**Review prep:**
- Screen recording showing: install → connect to my home server → browse
  library → read a chapter → export a CRZ. No discovery surfaces.
- Reviewer notes: "This is a client app for self-hosted Comic Reader servers.
  All content is user-owned, served from the user's own NAS. Similar to Plex,
  Jellyfin, Komga clients."
- Have a test server URL + credentials ready for Apple's reviewer to use.

**Expect 1-2 rounds.** First rejection is common ("we couldn't tell what
content this is for"). Reply with the test server access and the
self-hosted-client framing.

**Estimate:** ~2 weeks calendar (mostly waiting for review).

**Files touched:**
- `ios/App/Info.plist` — final metadata, app group, URL schemes
- `src/client/lib/capabilities.tsx` — App Store build path that requires
  user-toggle for discover even if server has it enabled
- New: App Store screenshots, metadata copy

---

## 🚀 Phase 5 — Native unlocks (later)

Stuff that becomes possible once Capacitor is in. Not roadmap-committed yet —
pick any subset based on actual pain.

- **Background fetch** for chapter pre-download. iOS `BGAppRefreshTask` via
  `@capacitor/background-task`. Server pushes "new chapter ready" event; app
  fetches in the background.
- **Push notifications** via APNs. Server registers per-user device tokens,
  sends pushes for "new chapter" / "sync complete" / "translation ready".
  Capacitor Push Notifications plugin handles the iOS side.
- **Watch app** — "what am I reading," resume button, complication. Native
  WatchKit code, no Capacitor — separate Xcode target.
- **iPad layout** — landscape two-page reader. Already mostly works in PWA
  but iPad's gesture system (swipe-from-edge multitasking, Stage Manager) is
  better-handled by a real WKWebView in standalone mode.
- **Multi-server** — connect to multiple servers (Plex pattern). Useful if
  you have NAS at home + somewhere else, or want to consume a friend's NAS
  occasionally.
- **Share Extension target** — separate from Capacitor Share plugin: lets
  Comic Reader appear in iOS Share Sheets system-wide (e.g. share a URL from
  Safari to "import into Comic Reader" — would need server-side URL handler).
- **Spotlight indexing** — `CSSearchableItem` makes series searchable from
  the iPhone home screen swipe-down search.

---

## 🌐 Parallel track — manga-finder produces v2 CRZ

**Status:** v2 format spec is stable (`src/server/crz-format.ts`). Work
hasn't started in the extension yet.

**What changes in `manga-finder`:**
- After a series download completes, package the chapters as a v2 CRZ in
  extension memory.
- Split at ~200 MB to stay under Chrome MV3 service worker memory cap. Each
  part has the full manifest (Pattern A — see `crz-format.ts` for the
  multi-part contract); subsequent parts may set `coverFile: null` to dedupe.
- POST each part to `POST /api/import/crz` against the user's configured
  server URL. Importer is additive and stateless across parts; parts can
  arrive in any order.
- Replaces the current per-chapter upload flow — one CRZ POST per series,
  much simpler ingest, no per-chapter HTTP overhead.

**Server-side changes needed:** none — the v2 importer already accepts
multi-part CRZs.

**Files to touch (in `manga-finder` repo):**
- New: `src/shared/crz-builder.ts` — JSZip-based v2 CRZ builder
- Modified: `src/background/downloader.ts` — emit CRZ instead of per-chapter
  POSTs

---

## Open product questions

These don't block any phase but are worth deciding before they bite.

1. **Multi-server in the iOS app** — Phase 3 ships single-server. If you want
   home + parents'-house support, decide before Phase 4 submission so the
   App Store description matches.

2. **Token auth lifetime** — long-lived (refresh tokens) or short with re-login
   when the app cold-starts after a week? iOS UX expects no re-login; server
   admin probably wants the option to revoke. Pick before Phase 3.

3. **Server URL discovery** — Bonjour / mDNS for "find Comic Reader on this
   network" (Plex pattern) vs always typing the URL. Quality-of-life win for
   first-run; ~1 week to implement via `@capacitor-community/zeroconf`.

4. **Watch what you read on multiple devices** — current progress sync is
   server-driven, fine. But the "continue reading" shelf doesn't yet account
   for "device-typed for reading" (iPad two-page vs iPhone one-page). Punt
   to Phase 5.

5. **`manga-finder` Safari Web Extension port** — separate iOS app target,
   different review path. If you want feature-parity across browsers, decide
   when to start. Defer until after the iOS reader app ships.

6. **Pointer-tilt visual differentiator (`<TiltCard>`).** Considered as the
   "stand out visually on iPhone" feature in lieu of gyroscope (see Decisions
   log). Not in any phase right now — ships only if we decide visual
   differentiation matters more than the next concrete feature. If yes, the
   recommended implementation:
   - New `src/client/components/TiltCard.tsx` — wraps children, listens to
     pointermove (mouse + touch), computes pointer position relative to card
     center, applies `transform: perspective(1000px) rotateX(...) rotateY(...)`,
     plus a `radial-gradient` sheen overlay that follows the pointer.
     Resets to flat on pointerleave/up. Honors `prefers-reduced-motion: reduce`
     (required, not optional).
   - Apply selectively: SeriesPage hero cover (marquee), library `MangaCard`
     covers, ContinueShelf cards. NEVER globally — see Decisions log entry on
     "3D card flip on every card surface."
   - ~120 LoC total. Ships in PWA today, carries through Capacitor unchanged.
   - Validates one surface first (SeriesPage hero) before propagating. Revert
     is a single-file delete if it doesn't feel right.

---

*Last updated: 2026-04-27. Update this file whenever a phase moves status or
a new question lands.*
