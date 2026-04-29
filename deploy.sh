#!/bin/bash
#
# Bindery — Deploy to Synology NAS
#
# Usage:
#   ./deploy.sh user@nas-ip
#   ./deploy.sh user@nas-ip /volume1/docker/bindery
#
# What this does:
#   1. Copies only the source files needed for Docker to build
#   2. SSHs into the NAS and builds/restarts the container
#
# Prerequisites:
#   - SSH access to your NAS (ssh keys recommended)
#   - Docker installed on NAS (Container Manager package)
#

set -e

NAS_HOST="${1:?Usage: ./deploy.sh user@nas-ip [remote-path]}"
REMOTE_DIR="${2:-/volume1/docker/bindery}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🦊 Bindery — Deploy"
echo "   Target: ${NAS_HOST}:${REMOTE_DIR}"
echo ""

# Create remote directory
echo "📁 Creating remote directory..."
ssh "$NAS_HOST" "mkdir -p ${REMOTE_DIR}"

# Sync source files (excludes everything Docker doesn't need)
echo "📦 Syncing source files..."
rsync -av --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude data \
  --exclude local-library \
  --exclude comics \
  --exclude .git \
  --exclude .claude \
  --exclude .env \
  --exclude .DS_Store \
  --exclude scripts \
  --exclude "*.log" \
  --exclude "*.pid" \
  --exclude .vite-port \
  "${SCRIPT_DIR}/" "${NAS_HOST}:${REMOTE_DIR}/"

echo ""
echo "✅ Files synced!"
echo ""
echo "Next steps on the NAS:"
echo ""
echo "  1. SSH in:  ssh ${NAS_HOST}"
echo "  2. cd ${REMOTE_DIR}"
echo "  3. Edit docker-compose.yml — update volume mounts to your comic folders"
echo "  4. docker compose up -d --build"
echo "  5. Open http://$(echo $NAS_HOST | cut -d@ -f2):8580"
echo ""
echo "Or run the build from here:"
echo "  ssh ${NAS_HOST} 'cd ${REMOTE_DIR} && docker compose up -d --build'"
