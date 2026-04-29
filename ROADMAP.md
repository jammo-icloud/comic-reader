# Bindery — Roadmap

Living plan for what's shipping, what's deliberately NOT shipping, and what's
queued. Written for future-Claude/future-James to pick up cold without
re-deriving any architectural decisions.

## Status snapshot

| Track | Status |
|---|---|
| **Server-side CRZ export/import (single series)** | ✅ Done |
| **Server-side backup/system/scheduled backups** | ❌ **Not building** — see Decisions log |
| **iOS PWA polish (Phase 1)** | ✅ Done |
| **Favorites + Recommended feed** | ✅ Done |
| **Download queue: dedupe + partial-chapter tracking** | ✅ Done |
| **Web capability flags (Phase 2a)** | 🔜 Next |
| **Build-time exclusion / two-target build (Phase 2b)** | Queued |
| **iOS Capacitor "Viewer" shell (Phase 3)** | Queued |
| **iOS App Store submission — media-viewer framing (Phase 4)** | Queued |
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

### Favorites + Recommended feed — multi-user social-via-shared-instance

Files: `src/server/data.ts`, `src/server/routes/favorites.ts`,
`src/server/routes/library.ts`, `src/client/lib/api.ts`,
`src/client/lib/types.ts`, `src/client/pages/SeriesPage.tsx`,
`src/client/pages/DiscoverPage.tsx`

- Per-user favorites store (`data/users/<username>/favorites.jsonl`),
  separate from collection. The user's "I'd recommend this" mark.
- 4 routes: POST/DELETE/GET own favorites, GET aggregated cross-user
  Recommended feed.
- Recommended feed always NSFW-filtered regardless of viewer admin status —
  the social-recommendation surface stays clean for shared/family contexts.
- Cascade-delete from all users' favorites on series removal.
- SeriesPage gains `★ Recommend` toggle + `+ Add to library` button —
  both visible to all logged-in users (not admin-gated). The Add primitive
  is also useful on its own — lets users add from any SeriesPage path
  without going through Discover.
- Discover gains two server-internal pills: `♥ Recommended` and `📚 Library`,
  mutually exclusive with external source selection.
- Recommended feed cards show attribution chips (per-username hash-colored
  initials, accent ring on self).
- This obsoletes the deep-link `?from=` recommend feature that was briefly
  considered in earlier roadmap iterations (see Decisions log).

### Download queue hardening — dedupe + partial-chapter tracking

Files: `src/server/downloader.ts`, `src/server/partial.ts` (new),
`src/server/routes/library.ts`, `src/server/routes/admin.ts`,
`src/client/lib/types.ts`, `src/client/lib/api.ts`,
`src/client/components/ComicListItem.tsx`,
`src/client/components/ComicCard.tsx`,
`src/client/pages/SeriesPage.tsx`

Closed two silent-failure classes that surfaced during a real
MangaTown import (Lone Necromancer, 219 chapters):

**Dedupe-on-enqueue.** Rapid double-clicks of Download (or any UI
flow that fired twice) used to create two parallel jobs for the
same series. The second job would replay every chapter after the
first finished. `queueDownload` now matches on
`(mangaDexId + sourceId + username)` against existing queued or
downloading jobs. New chapters merge in (dedup by chapter id);
exact duplicates return the existing job. `processQueue` is kicked
unconditionally so a job that was about to exit picks up the new
chapters.

**Partial-chapter tracking via sidecar files.** When a chapter
download succeeds for some pages but fails for others (CDN
intermittent 403s, rate-limiting, etc.) the assembler used to
write a multi-page-but-incomplete PDF, the existence check
treated it as "done," and the missing pages were unrecoverable.
Now: every assembly that doesn't get all pages writes a
`Chapter NNN.partial.json` sidecar with the source URLs,
successful-page count, missing-page indices, and retry count.
The chapter loop's existence check falls through when a sidecar
is present — re-attempts go through the normal download flow.
Full success deletes the sidecar.

Surfaced to the UI: `Comic` type has a `partial` field;
`ComicListItem` and `ComicCard` render a warning-tone
"⚠ 13/14" badge with a tooltip. SeriesPage admin menu gains
"Retry N partial chapters" — only shown when partials exist.
Server route: `POST /api/admin/series/:id/retry-partials`
walks the series dir for sidecars and queues a retry job
(dedupe-on-enqueue makes rapid taps merge harmlessly).

Cleanup: admin chapter-delete route now clears the sidecar
alongside the PDF + thumbnail to avoid orphaned sidecars.

Defended along the way:
- Stub PDFs (<5 KB, written when zero pages succeeded in older
  code paths) are detected at the existence check and re-attempted
  instead of permanently stranding the chapter.
- assembleChapterFromSource throws when zero pages succeed (no
  PDF written) — used to silently produce 583-byte empty PDFs.
- Per-chapter Referer for MangaTown's hotlink-protected CDN
  (some CDNs gate on the actual reader-page URL, not just the
  source homepage).
- Diagnostic dump of sample `<img>` tags when MangaTown's image-
  URL regex doesn't match — makes the next CDN-rotation fix
  targeted instead of guesswork.

### iOS PWA polish — Phase 1

Files: `index.html`, `vite.config.ts`, `src/client/lib/themes.ts`,
`scripts/generate-splash.ts`, `public/icons/`, `public/splash/`,
`src/client/pages/{ReaderPage,SeriesPage,LibraryPage,DiscoverPage,AdminPage}.tsx`

- `viewport-fit=cover` (the foundation — without it `env(safe-area-inset-*)`
  returns 0 on every notched iPhone).
- iOS standalone meta tags: `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style="black-translucent"`,
  `apple-mobile-web-app-title="Bindery"`.
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
  remember a separate "Bindery backup" instead of using the one tool
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

**Considered:** instead of the generic spinner, animate the Bindery
logo on Library / Discover / SeriesPage pull-to-refresh.

**Rejected because:** cute but novelty depreciates fast. Adds animation code
that runs on every refresh forever, in exchange for a polish win that fades
to invisible after week one.

### Runtime capability flags as the App Store gating mechanism

**Considered:** ship a single bundle to both web and Capacitor/iOS, and let
runtime capability flags hide Discover / source-picker / etc. on iOS. This
was the original framing of Phase 2.

**Rejected because:** runtime flags don't defend against bundle inspection.
Apple App Reviewers (especially for borderline categories like "manga reader")
run `strings` on the JS bundle, look at lazy-loaded chunks, and inspect Vite
build artifacts. Even a flag-disabled `<DiscoverPage>` component ships with
its source-name strings ("MangaDex", "WeebCentral", etc.) intact in the IPA.
A reviewer's `grep` finds them; the flag-off-at-runtime defense is invisible
to the inspector.

**Chose instead:** build-time exclusion via two separate Vite targets
(Phase 2b). The App Store build literally has no `<DiscoverPage>` chunk,
no source-name strings, no source-picker UI in the bundle. `strings` on
the IPA returns clean. Runtime capability flags (Phase 2a) remain useful
for shared/family web UIs, but they are *not* the App Store defense — they
were re-scoped to their actual purpose.

**Concrete consequence:** Phase 2 is split into 2a (web admin UX win) and
2b (App Store bundle defense). Both ship; they solve different problems.
Don't conflate them again.

### Deep-link recommend feature (`?from=jared` URLs)

**Considered:** when user A wants to recommend a series to user B on the same
instance, generate a deep link (`/series/<id>?add=true&from=A`), share it via
external channel (iMessage / Slack / etc.), recipient lands on series page
with a banner offering to add to their library. Iterated through several
versions: simple `?from=` (spoofable), token-based (heavier), recommendations
store + validation (medium-weight).

**Rejected because:** all variants required users to go OUT of the app to a
messaging tool to share the URL, then back in. Even with server-side
recommendation validation, the UX is "compose iMessage → paste link → wait
for tap → render banner." The conceptual model assumed sharing is a
person-to-person event with a target and a channel.

**Chose instead:** Favorites + cross-user Recommended feed in Discover (see
"Recently shipped"). Sharing is replaced by passive discovery — favorited
series surface to everyone on the instance via a pill in Discover. No
external channel, no validation logic, no spoofing concerns, no banner UI.
Functions as a community signal ("what does this server collectively rate
as good") rather than directed messaging.

**Concrete consequence:** the in-app sharing problem was eliminated, not
solved. There's no "send to" button, no pending-recommendations inbox, no
per-recommendation state. If users want to point each other at a specific
series via iMessage, they can paste the SeriesPage URL — it just navigates
there with no special banner. CRZ export remains the cross-instance tool.

### Synology DSM Package Center integration

**Considered:** ship Bindery as a DSM Package, integrate with DSM auth,
appear in Synology's Package Center alongside Plex / Drive / Surveillance.

**Rejected because:** locks the project to Synology. Most self-hosted users
run TrueNAS / Unraid / raw Docker on commodity hardware / k3s / Proxmox VMs.
DSM Package Center membership signals "Synology user" not "comic reader user"
and narrows the audience for a polish gain that affects ~20% of the install
base.

**Chose instead:** stay platform-agnostic. Ship as a Docker image that runs
on any NAS or VPS. Existing users who use DSM-specific features (DSM auth)
are accommodated via existing config; full DSM Package Center distribution
is not pursued.

---

## 🔜 Phase 2 — Capability gating (split into 2a + 2b)

Phase 2 splits cleanly into two pieces with **different motivations**, which
the original framing conflated:

| Piece | Solves | Why separate |
|---|---|---|
| **2a — Web capability flags** (runtime toggles) | Shared/family web UIs that need to gate sensitive features per-server | Useful for ANY web user. App Store gating is not the goal here. |
| **2b — Build-time exclusion** (two build targets) | App Store submission risk: bundle inspection reveals hidden UI strings even when runtime-disabled | This is the actual App Review defense. Runtime flags are insufficient on their own. |

**Critical:** runtime capability flags do NOT defend against App Store review.
A reviewer running `strings` on the bundled JS finds every UI text shipped,
including flag-disabled `<DiscoverPage>` components and source names. **2a
helps web admins; 2b is what keeps the App Store happy.** See Decisions log:
"Runtime capability flags are sufficient for App Store gating."

---

### Phase 2a — Web capability flags

**Why:** lets server admins gate sensitive features (Discover, NSFW, Translate)
for non-admin users. Useful for shared NAS accounts (kids, family, friends),
or for hardening a public-facing web UI. Plex / Jellyfin / Komga pattern.

**`GET /api/server-info`** — public, unauthenticated, returns:

```ts
{
  version: string,            // package.json version
  capabilities: {
    discover:           { enabled: boolean, sources: string[] },  // friendly names only
    chromeExtension:    { available: boolean, installUrl: string | null },
    translate:          { enabled: boolean },
    export:             { enabled: boolean },
    nsfwBypassAdminOnly: boolean,
  }
}
```

Settings persist in `data/server-config.json` (system-level, separate from
per-user prefs). New server module `src/server/config.ts` with typed
load/save and an in-memory cache.

**Admin UI** — new section in `AdminPage` "Server features" with toggle rows
for each capability. Saves via `POST /api/admin/server-config`.

**Frontend integration:**
- `src/client/lib/api.ts` adds `getServerInfo()`.
- New `ServerCapabilitiesProvider` (similar shape to `ThemeProvider`) loads
  on app boot, exposes `useCapabilities()`.
- Existing pages check capabilities before rendering features:
  - `LibraryPage` hides Discover nav if `!capabilities.discover.enabled`
  - `DiscoverPage` returns 404 component if disabled (defense-in-depth)
  - SeriesPage hides "Export as .crz" if `!capabilities.export.enabled`
  - Translation toggle in Reader hides if `!capabilities.translate.enabled`

**Key design rules:**
- Source names in `capabilities.discover.sources` are **friendly names**
  (`"Source A"`, `"Source B"`) — never domain names. Even on web, reviewer
  network-traffic inspection should never see "mangadex.org".
- Default for new installs: `discover: { enabled: true }`. Existing installs
  preserved (no breaking change). Admins can disable on shared accounts.
- `chromeExtension.available` defaults to `true` since the extension exists;
  surface as a tip, never an action.
- Capabilities can be toggled live without server restart.

**Estimate:** ~1 week calendar.

**Files touched:**
- New: `src/server/config.ts`, `src/server/routes/server-info.ts` (or extend admin)
- New: `src/client/lib/capabilities.tsx`
- Modified: `src/client/App.tsx` (provider), `src/client/pages/LibraryPage.tsx`,
  `src/client/pages/DiscoverPage.tsx`, `src/client/pages/SeriesPage.tsx`,
  `src/client/pages/AdminPage.tsx`, `src/client/pages/ReaderPage.tsx`

---

### Phase 2b — Build-time exclusion (two build targets)

**Why:** the iOS App Store bundle must NOT contain any code or strings
related to discovery, source browsing, or anything pattern-matching to
"manga downloader." Runtime flags don't help — bundle inspection reveals
all shipped UI. The defense is to *not ship those bytes at all* in the
App Store target.

**Two build targets, one codebase:**

| Build | Command | Discover code | Source names | Capability admin UI | Audience |
|---|---|---|---|---|---|
| **Default** | `npm run build` | Present | Present | Present | Web / desktop / self-host |
| **App Store** | `npm run build:appstore` | Stripped | Stripped | Hidden | Capacitor iOS bundle |

**Implementation:**
- `VITE_APPSTORE=true` env var set by the `build:appstore` script.
- Top-level route gating uses `import.meta.env.VITE_APPSTORE` to lazy-import
  conditionally:

```ts
// src/client/App.tsx
const DiscoverPage = !import.meta.env.VITE_APPSTORE
  ? lazy(() => import('./pages/DiscoverPage'))
  : null;

// In the route table
{DiscoverPage && <Route path="/discover" element={<DiscoverPage />} />}
```

- Vite + Rollup tree-shake the entire `DiscoverPage` chunk + transitively
  reachable code (source registry, source-picker components, source-name
  string constants) out of the App Store bundle.
- All source-name display goes through capabilities API responses; never
  hardcoded in the bundle.
- `SOURCES.md` is repo-only — never imported into the SPA bundle.
- "Save offline" stays (it's about the user's own library — not piracy-adjacent).
- "Export as .crz" stays (about user's own library; file-format handling).
- "CRZ import" stays (file handling, like importing a movie).
- Translation stays (operates on already-imported pages).
- Admin "Server features" toggles for Discover are HIDDEN in App Store
  builds (no point showing a toggle for a feature that doesn't exist).

**Verification:**
After `npm run build:appstore`:
```bash
strings dist/client/assets/*.js | grep -iE 'mangadex|hentainexus|weebcentral|tachiyomi|scrape'
# Expected output: nothing
```
This is the actual App Review defense. If `strings` returns clean,
reviewer's bundle inspection finds nothing discovery-related.

**Estimate:** ~3 days calendar.

**Files touched:**
- `package.json` — new `build:appstore` script with `VITE_APPSTORE=true`
- `vite.config.ts` — read `VITE_APPSTORE`, drop discover-related entries from `includeAssets`
- `src/client/App.tsx` — conditional lazy imports
- `src/client/pages/AdminPage.tsx` — hide capability admin UI when `VITE_APPSTORE`
- `src/client/lib/capabilities.tsx` — App Store builds skip the `getServerInfo()` call
  for discover-related capabilities (server still serves them; client just doesn't ask)

---

## 📦 Phase 3 — Capacitor "Viewer" shell

**Goal:** a self-hosted-media *viewer* on iPhone. Same model as Plex, Jellyfin,
Komga, Audiobookshelf clients. Reads from your server. Does NOT manage the
library. Adding new content explicitly happens on desktop / web.

This framing matters as much as any code decision: it makes the app
fundamentally a media-player class app for review purposes, not a
content-discovery class app.

### What to build

```bash
npm install @capacitor/core @capacitor/ios @capacitor/cli
npm install @capacitor/filesystem @capacitor/share @capacitor/preferences
npx cap init "Bindery" "com.morrisfamily.bindery" --web-dir=dist/client
npx cap add ios
```

**Build the App Store target, not the default:**
```bash
npm run build:appstore   # Phase 2b — strips discover, source browsing, source names
npx cap copy ios
```

The Capacitor wrapper ALWAYS wraps the App Store build. The default `npm run
build` (full feature set) is for self-hosted web only.

**What's IN the iOS Viewer:**
- Library (your collection, browse, sort, filter, search)
- Reader (PDF rendering, gestures, page navigation, view modes)
- Continue Reading shelf
- Series detail page
- Settings (theme, dark/light, server URL, sign out)
- Offline cached chapters
- CRZ import via Files app (UTI registration — see below)
- CRZ export of own series
- Translation feature (operates on already-imported pages — borderline but defensible)

**What's NOT in the iOS Viewer (build-time excluded by Phase 2b):**
- Discover / source browsing
- Source picker UI
- Source name strings (no MangaDex / WeebCentral / etc. in the bundle)
- Capability admin UI (toggles for features that don't exist in this build)

**Native features worth wiring:**
- **Capacitor Filesystem plugin** — replaces browser Cache Storage for offline
  PDFs. Survives "Clear History and Website Data" (which currently wipes
  offline-saved chapters). Adapter pattern: `src/client/lib/storage.ts`
  abstracts both backends.
- **Capacitor Share plugin + `.crz` UTI registration** — receive `.crz` files
  from iOS Files app, Mail attachments, AirDrop. `Info.plist` declares
  `com.morrisfamily.bindery.crz` as the UTI; iOS then shows the Bindery icon
  next to `.crz` files in Files app and surfaces "Open in Bindery" on share
  sheets. Wires to `POST /api/import/crz` on the connected server.
  This is the framing equivalent to "open a movie file" — pure file-handling,
  not scraping.
- **Server URL config** — first launch asks for server URL, stores in
  Capacitor Preferences. Multi-server support (Plex pattern) deferred to
  Phase 5 if useful.
- **Auth** — tokens via Capacitor Preferences (cookies in WKWebView are
  unreliable across app updates). Server keeps cookie auth for the web; native
  client uses `Authorization: Bearer <token>`. New endpoint
  `POST /api/auth/token` issues tokens against username+password.

**App identity:**
- Bundle ID: `com.morrisfamily.bindery`
- Display name: **Bindery**
- Subtitle: "Self-hosted comic library"

**Key design rules:**
- App is a thin WKWebView shell wrapping the App Store build. NO scraping
  logic in the app binary, NO source-picker UI, NO discovery code.
- All sensitive surfaces are stripped at build time (Phase 2b), not runtime.
- First-run: server URL → login → library. Period.

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

## 🍎 Phase 4 — App Store submission (media-viewer framing)

**Goal:** publicly distributable on the App Store as a self-hosted-media
viewer, not a content-discovery app.

This phase's defense-in-depth stack:
1. **Framing** — App Store metadata, app name, description all describe a
   *viewer* for self-hosted servers (this phase)
2. **Bundle integrity** — `npm run build:appstore` strips discovery code at
   compile time, `strings` the IPA reveals zero discovery surface (Phase 2b)
3. **Network behavior** — at runtime, the app only fetches your library
   metadata and PDFs (Phase 3 design)

All three layers must hold for the strongest review posture. Phase 2b is
the most important — it's the one a determined reviewer can't bypass.

### What it takes

**App identity:**
- App Store name: **Bindery — Library Viewer** (or just **Bindery**)
- Subtitle: "Read your self-hosted comic library"
- Description (opening paragraph):
  > Bindery is a viewer for your self-hosted Bindery server. Connect
  > to your home library and read on iPhone. New content is added to your
  > library on your computer; this app reads what's already there.
- Description should explicitly call out: "Like Plex / Jellyfin / Komga
  clients, this app does not download or browse third-party content. All
  comics shown are served from your own server."

**Keyword discipline:**
- USE: comic, comics, library, reader, viewer, self-hosted, server, NAS, plex
- AVOID in metadata: manga, manhwa, scrape, download, source, tachiyomi
  (these are App Store keyword-targeting-ML triggers; using "manga" in the
  *app itself* is fine — it's metadata that flags you)

**Screenshots (5-10 images):**
- ✅ Library grid with your covers (clearly your own library)
- ✅ Series detail page with chapter list
- ✅ Reader page with a comic open
- ✅ Continue Reading shelf
- ✅ Theme picker showing your 12 themes
- ❌ NO Discover screenshots
- ❌ NO source browsing
- ❌ NO search-the-internet UI

**Review prep package:**
- Screen recording: install → connect to home server → browse library →
  read a chapter → export a CRZ → import a CRZ via Files app. No discovery
  surfaces. Identical to what a Plex client does, just for comics.
- Reviewer notes (free-text field on App Store Connect):
  > Bindery is a viewer for self-hosted Bindery servers — similar in
  > concept to Plex, Jellyfin, and Komga clients. All content shown is
  > served from the user's own server. The app does not download, scrape,
  > or browse third-party content. Library management (adding new content)
  > happens on the desktop / web interface, not in this app.
- Have a test server URL + credentials ready for Apple's reviewer to log
  into and exercise.

**Expected review path:**
- First submission MAY be rejected with "we couldn't determine what content
  this is for" — common for self-hosted clients on first review.
- Response: link to the reviewer-notes paragraph + test server access + a
  pointer to Plex/Jellyfin/Komga as precedent.
- Approval typically follows within 1-2 rounds.

**Estimate:** ~2 weeks calendar (mostly waiting for review).

**Files touched:**
- `ios/App/Info.plist` — final metadata, bundle ID, UTI registrations
- `package.json` — release script that runs `build:appstore`, copies to iOS,
  bumps version, tags
- New: App Store screenshots (5-10), metadata copy, reviewer notes

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
  Bindery appear in iOS Share Sheets system-wide (e.g. share a URL from
  Safari to "import into Bindery" — would need server-side URL handler).
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

3. **Server URL discovery** — Bonjour / mDNS for "find Bindery on this
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
