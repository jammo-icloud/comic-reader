# Comic Reader

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PDF.js](https://img.shields.io/badge/PDF.js-4-FF6600?logo=adobe&logoColor=white)](https://mozilla.github.io/pdf.js/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A self-hosted manga/comic reader for Synology NAS. Browse your collection, discover new manga from MangaDex and MangaFox, download chapters, and read offline — all from your browser.

## Features

- **PDF reader** with fit-to-page, scroll mode, and keyboard navigation
- **Multi-user** — each household member gets their own collection, reading progress, and preferences
- **Discover** — search MangaDex and MangaFox, download chapters directly to your library
- **Import** — drag & drop files, scan NAS folders, or point at a directory
- **MAL integration** — cover art, ratings, synopses, and English titles from MyAnimeList
- **Offline reading** — save chapters for offline use (PWA)
- **Dark/light theme** — synced per-user across devices
- **NAS authentication** — logs in with your Synology DSM account

## Requirements

- Synology NAS with **Container Manager** (Docker) installed
- Docker Compose

## Quick Start

1. Copy `comic-reader-nas.zip` to your NAS
2. Unzip into `/volume1/docker/comic-reader/`
3. Edit `docker-compose.yml` (see Configuration below)
4. SSH into your NAS and run:

```bash
cd /volume1/docker/comic-reader
docker compose up -d --build
```

5. Open `http://your-nas-ip:8580`
6. Log in with your Synology DSM username and password

## Configuration

Edit `docker-compose.yml` before building:

```yaml
services:
  comic-reader:
    ports:
      - "8580:3000"          # Change 8580 to your preferred port
    volumes:
      - /volume1/Manga:/library   # Change to your manga folder path
    environment:
      - DSM_URL=http://host.docker.internal:5000  # DSM port (usually 5000 for HTTP, 5001 for HTTPS)
      - ADMIN_USER=james     # Your DSM username for admin privileges (uncomment this)
```

### Volume Mount

The `/library` mount is where your comics live. The folder structure is:

```
/volume1/Manga/              (or whatever you mount)
  comics/
    one-piece/
      chapter-001.pdf
      chapter-002.pdf
    naruto/
      ...
  magazines/
    heavy-metal/
      ...
  import/                    (drop files here for import)
  .comic-reader/             (app data — auto-created)
    series.jsonl
    comics/
    users/
    series-covers/
    tasks/
```

### DSM Authentication

The app authenticates users against your Synology DSM. It calls DSM's Web API on port 5000 (HTTP) or 5001 (HTTPS). No reverse proxy setup is needed.

- **DSM_URL** — Points to your DSM instance. `http://host.docker.internal:5000` reaches the NAS host from inside Docker.
- **ADMIN_USER** — (Optional) Set this to your DSM username to get admin privileges (e.g., purge series from disk).

If DSM runs on a non-standard port, update `DSM_URL` accordingly.

### Multi-User

Each DSM user who logs in gets:
- **Their own collection** — which series they follow (shared library, personal shelves)
- **Their own reading progress** — page position, read/unread status
- **Their own theme** — dark/light preference synced across devices

The comic files on disk are shared — no duplication. When a user searches for manga that's already in the library, they can add it to their collection instantly without re-downloading.

## Updating

```bash
cd /volume1/docker/comic-reader
# Replace files with new version
docker compose up -d --build
```

Your data is stored in the mounted volume (`/volume1/Manga/.comic-reader/`), not inside the container. Updates are safe.

## Local Development

```bash
npm install
cd ocr-service && npm install && cd ..

# Start all services
./scripts/dev-start.sh

# Check status
./scripts/dev-status.sh

# Stop
./scripts/dev-stop.sh
```

In dev mode, any username/password is accepted for login (DSM API is not available locally).

## Architecture

```
Browser → comic-reader:8580
            ├── Login page (authenticates against DSM API)
            ├── Library (user's collection)
            ├── Series page (chapters, covers, MAL metadata)
            ├── Reader (PDF.js viewer)
            ├── Discover (MangaDex + MangaFox search)
            ├── Import (folder scan, drag & drop, NAS watch folder)
            └── import-orchestrator:3001 (MAL matching for imports)
```

**Stack:** React 19 · Vite · Tailwind CSS · Express 5 · TypeScript · PDF.js · sharp · pdf-lib
