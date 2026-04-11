#!/bin/bash
#
# Package comic-reader for NAS deployment
# Creates a zip with only the files needed for docker compose build
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
  -x "comics/*" \
  -x "scripts/*" \
  -x ".git/*" \
  -x ".claude/*" \
  -x ".DS_Store" \
  -x "*/.DS_Store" \
  -x "*.log" \
  -x "package-for-nas.sh"

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo ""
echo "✅ Created: $OUTPUT ($SIZE)"
echo ""
echo "Next steps:"
echo "  1. Copy $OUTPUT to your NAS"
echo "  2. Unzip into /volume1/docker/comic-reader/"
echo "  3. Edit docker-compose.yml — set your library path"
echo "  4. docker compose up -d --build"
