#!/bin/bash
# Start all comic-reader services for local development
DIR="$(cd "$(dirname "$0")/.." && pwd)"

export LIBRARY_DIR="$DIR/local-library"
export DATA_DIR="$DIR/data"
export OCR_SERVICE_URL="http://localhost:3001"

# Create local dirs
mkdir -p "$LIBRARY_DIR/import" "$LIBRARY_DIR/comics" "$LIBRARY_DIR/magazines" "$DATA_DIR"

# Find first open port starting at 5880
find_open_port() {
  local port=$1
  while lsof -ti:$port >/dev/null 2>&1; do
    port=$((port + 1))
  done
  echo $port
}

# Kill any existing comic-reader processes
"$DIR/scripts/dev-stop.sh" 2>/dev/null

VITE_PORT=$(find_open_port 5880)

echo "Starting orchestrator (port 3001)..."
cd "$DIR/ocr-service"
nohup npx tsx src/index.ts </dev/null > "$DIR/.orchestrator.log" 2>&1 &
echo $! > "$DIR/.orchestrator.pid"

echo "Starting server (port 3000) + Vite (port $VITE_PORT)..."
cd "$DIR"
nohup npx concurrently \
  "npx tsx watch src/server/index.ts" \
  "npx vite --port $VITE_PORT" \
  </dev/null > "$DIR/.dev.log" 2>&1 &
echo $! > "$DIR/.dev.pid"
echo $VITE_PORT > "$DIR/.vite-port"

sleep 3

# Verify
OK=true
if curl -sf http://localhost:3000/api/series > /dev/null 2>&1; then
  echo "  Express server: OK (port 3000)"
else
  echo "  Express server: FAILED"
  OK=false
fi

if curl -sf http://localhost:$VITE_PORT/ > /dev/null 2>&1; then
  echo "  Vite client: OK (port $VITE_PORT)"
else
  echo "  Vite client: FAILED"
  OK=false
fi

if curl -sf http://localhost:3001/import/count > /dev/null 2>&1; then
  echo "  Orchestrator: OK (port 3001)"
else
  echo "  Orchestrator: FAILED"
  OK=false
fi

if $OK; then
  echo ""
  echo "All services running. Open http://localhost:$VITE_PORT"
  echo "Logs: .dev.log, .orchestrator.log"
else
  echo ""
  echo "Some services failed to start. Check logs."
fi
