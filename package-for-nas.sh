#!/bin/bash
#
# Package comic-reader for NAS deployment
# Creates a zip with everything needed for docker compose build
# Includes both comic-reader and import-orchestrator source
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$HOME/Desktop/comic-reader-nas.zip"

cd "$SCRIPT_DIR"

echo "🦊 Packaging comic-reader for NAS..."

rm -f "$OUTPUT"

zip -r "$OUTPUT" . \
  -x "node_modules/*" \
  -x "ocr-service/node_modules/*" \
  -x "dist/*" \
  -x "data/*" \
  -x "library/*" \
  -x "local-library/*" \
  -x "comics/*" \
  -x "scripts/*" \
  -x ".git/*" \
  -x ".claude/*" \
  -x ".env" \
  -x ".DS_Store" \
  -x "*/.DS_Store" \
  -x "*.log" \
  -x ".dev.log" \
  -x ".orchestrator.log" \
  -x ".dev.pid" \
  -x ".orchestrator.pid" \
  -x ".vite-port" \
  -x "build-for-nas.sh" \
  -x "package-for-nas.sh"

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo ""
echo "✅ Created: $OUTPUT ($SIZE)"
echo ""
echo "Contents:"
echo "  comic-reader/        — web app (Dockerfile + source)"
echo "  ocr-service/         — import orchestrator (Dockerfile + source)"
echo "  docker-compose.yml   — both services with build: directives"
echo ""
echo "Deploy:"
echo "  1. Copy zip to NAS, unzip into /volume1/docker/comic-reader/"
echo "  2. Edit docker-compose.yml — change /volume1/Manga to your library path"
echo "  3. docker compose up -d --build"
echo "  4. Open http://nas-ip:8580"
