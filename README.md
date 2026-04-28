# Comic Reader

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PDF.js](https://img.shields.io/badge/PDF.js-4-FF6600?logo=adobe&logoColor=white)](https://mozilla.github.io/pdf.js/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/articles/progressive-web-apps)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A self-hosted manga & comic reader for your NAS. Multi-user, multi-source,
multi-device. Browse a shared library, recommend series to your household,
sync new chapters from upstream sources, read offline on iPhone — all from
your own server.

## What's inside

- **PDF reader** — fit / scroll modes, double-tap zoom-to-point, pan
  clamping, slider page-nav, keyboard shortcuts, auto-save reading progress
- **Multi-user** — each user gets their own collection, reading progress,
  favorites, and theme. Comic files are shared on disk; only the per-user
  state is partitioned.
- **8 sources** — MangaDex, MangaFox, MangaTown, Rawkuma (raw Japanese),
  ReadAllComics, ReadComicsOnline, Archive.org, plus MyAnimeList for
  metadata. See [`SOURCES.md`](SOURCES.md) for the current matrix.
- **Discover** — server-side search across enabled sources, plus two
  server-internal pills: **♥ Recommended** (cross-user favorites feed,
  NSFW-filtered) and **📚 Library** (browse the whole catalog)
- **Favorites** — star a series to surface it on the Recommended feed for
  everyone on the instance. Attribution chips show who recommended what.
- **Sync / subscribe** — track manga from a source; the server polls for
  new chapters and downloads them automatically
- **Translation** — bubble-level Japanese→English via a vision-capable LLM
  (Ollama, Qwen2.5-VL recommended) — pairs well with Rawkuma raws
- **CRZ format** — single-file `.crz` exports for one-shot sharing across
  instances. Multi-part import for the Chrome extension. v2 round-trips
  full metadata; v1 still readable.
- **manga-finder** — companion Chrome extension that downloads chapters
  from sites comic-reader can't reach server-side (Cloudflare-protected,
  encrypted-page) and uploads to your library. Bundled in the install.
- **iPhone / iPad PWA** — installable via Safari → Add to Home Screen.
  Standalone mode, splash screens, theme-color tracks the active theme,
  safe-area handling for Dynamic Island, offline cache for chapters.
- **12 themes** — 6 dark + 6 light, paired. Synced per-user.
- **MAL enrichment** — automatic cover, score, synopsis, English title
  lookup on import
- **NAS auth** — Synology DSM API in production; anything-goes in dev

## Requirements

- A NAS or server running **Docker** + **Docker Compose**
- (Synology) DSM 7.x for built-in user auth — or set `ADMIN_USER` to a
  fixed username if you don't have DSM
- (Optional) [Ollama](https://ollama.com) on a GPU box for translation

## Quick Start

```bash
# 1. Clone or copy the repo onto your NAS
cd /volume1/docker/comic-reader

# 2. Edit docker-compose.yml — set the volume + DSM URL + admin user
#    (defaults assume Synology with DSM on host port 5000 and library at /volume1/Manga)

# 3. Build and run
docker compose up -d --build
```

Open `http://your-nas-ip:8580` and log in. On Synology, use any DSM
account; the user listed in `ADMIN_USER` gets admin privileges (delete
series, run maintenance, edit metadata, change source-sync settings).

## Configuration

`docker-compose.yml` ships with sensible defaults. The fields you actually
care about:

| Variable | What it does |
|---|---|
| `ports` | External port → internal `:3000`. Default `8580:3000`. |
| `volumes` | Where your library lives. `/volume1/Manga:/library` mounts your manga folder into the container. |
| `DSM_URL` | URL of your Synology DSM for auth. `http://host.docker.internal:5000` reaches the NAS host from inside Docker. |
| `ADMIN_USER` | DSM username that gets admin privileges. |
| `DEFAULT_USER` | First user to log in inherits all pre-existing comics into their collection. |

The data directory (`/library/.comic-reader/` by default) is auto-created
on first run and contains:

```
.comic-reader/
  series.jsonl                  # master catalog
  series-covers/                # cover JPEGs
  comics/<series>.jsonl         # chapter lists per series
  thumbnails/                   # generated chapter thumbnails
  translations/                 # cached bubble translations
  users/<user>/
    collection.jsonl            # what's in this user's library
    progress.jsonl              # reading position per chapter
    favorites.jsonl             # what this user has recommended
    preferences.json            # theme, etc.
```

Comic PDFs themselves live alongside, in `<library>/comics/<slug>/` —
shared by all users, never duplicated.

## Multi-user model

Every DSM user who logs in gets a fresh collection. The library on disk is
shared — when a user adds a series that's already in the catalog (because
someone else added it), it lands instantly with no re-download. Reading
progress, favorites, and theme are per-user.

The first user to log in (the one matching `DEFAULT_USER`) inherits any
pre-existing library — useful for migrating an existing collection.

## Recommend across users (same instance)

Hit the **♥ Recommend** button on any series → it joins the cross-user
**Recommended** feed in Discover. NSFW always filtered from the feed
regardless of viewer. Cards show attribution chips so you can see who
favorited what. Tap **📚 Library** in Discover to browse the whole catalog
(useful when a household member added something and you want to add it to
your collection too).

For sharing across DIFFERENT instances (you and a friend), use **Export
as .crz** in the SeriesPage admin menu — produces a single zip with the
series, cover, chapters, metadata, and (optionally) cached translations.
Drop it on the recipient's instance via the import flow.

## Install on iPhone / iPad

Comic Reader is a PWA — no App Store needed.

1. Open the server URL in **Safari** on iOS
2. Tap **Share** → **Add to Home Screen**
3. Confirm the name (defaults to "Comics") and tap **Add**

Launches in standalone mode (no Safari chrome), status bar tints to your
active theme, splash screen pulls from your login-bg art, full safe-area
handling for Dynamic Island and the home indicator. Offline-saved chapters
persist across launches.

To force a refresh after a server update: long-press the home-screen icon
→ **Remove App** → reinstall.

## manga-finder Chrome extension

Some sources (Cloudflare-protected, encrypted pages) can't be reached from
the server. The companion **manga-finder** Chrome extension runs the
download in your browser session and uploads to your comic-reader instance.

- Bundled at `/manga-finder-extension.zip` on every install
- Discover page surfaces an install prompt
- Same design language as comic-reader (dark themes, source pills)
- Produces v2 CRZ chapters that comic-reader's importer ingests

## Translation

Comic Reader can translate Japanese bubbles inline using a vision-capable
LLM via [Ollama](https://ollama.com). Recommended setup:

```bash
# On a GPU box
ollama serve
ollama pull qwen2.5vl:7b
```

Set `OLLAMA_URL` (default `http://host.docker.internal:11434`) in the
`comic-reader` service env. Per-page translations cache as JSON in
`data/translations/<series>/<chapter-hash>/p<N>.json` — translate once,
re-render forever.

## Updating

```bash
cd /volume1/docker/comic-reader
git pull   # or replace files with the new release
docker compose up -d --build
```

Your data lives in the mounted volume (`/volume1/Manga/.comic-reader/`),
not inside the container. Updates are non-destructive.

## Local development

```bash
npm install
cd ocr-service && npm install && cd ..

# Spin up Vite dev (5880), the API server (3000), and the import
# orchestrator (3001) concurrently.
./scripts/dev-start.sh

# Tail status / health
./scripts/dev-status.sh

# Stop everything cleanly
./scripts/dev-stop.sh
```

In dev, the DSM auth check is bypassed — any username/password works. Set
`ADMIN_USER=<your dev username>` in your shell to get admin in dev.

For the splash-screen generator (after swapping art in `public/login-bg/`):

```bash
npm run splash
```

## Architecture

```
Browser
  ↓
comic-reader  (:3000, :8580 external)
  ├── /api/auth/*               DSM auth, sessions
  ├── /api/series, /api/comics  catalog + per-user state
  ├── /api/discover/*           server-side multi-source search
  ├── /api/favorites/*          per-user + cross-user Recommended feed
  ├── /api/import/crz           v1 + v2 CRZ ingest
  ├── /api/admin/series/*/export streaming v2 CRZ export
  └── /static/{covers,thumbnails}  static assets
  ↓ (for MAL matching during import)
import-orchestrator  (:3001)
  └── MAL match + enrich on directory scans
  ↓ (for translation, optional)
Ollama  (:11434, separate host)
  └── Qwen2.5-VL or any vision model
```

**Stack:** React 19 · Vite 6 · TypeScript 5.8 · Express 5 · Tailwind CSS 3 ·
PDF.js 4 · sharp · pdf-lib · archiver

## Project documents

- [`ROADMAP.md`](ROADMAP.md) — phased plan + decisions log (what's
  considered-and-rejected and why)
- [`DESIGN.md`](DESIGN.md) — design system reference (tokens, components,
  themes, accessibility patterns)
- [`SOURCES.md`](SOURCES.md) — current source matrix + research notes on
  blocked/protected sites

## License

MIT.
