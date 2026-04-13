#!/bin/bash
# Stop all comic-reader dev services — kills parent and all child processes
DIR="$(cd "$(dirname "$0")/.." && pwd)"

VITE_PORT=5173
[ -f "$DIR/.vite-port" ] && VITE_PORT=$(cat "$DIR/.vite-port")

stopped=0

# Kill by PID file — send to process group to catch children
for pidfile in "$DIR/.dev.pid" "$DIR/.orchestrator.pid"; do
  if [ -f "$pidfile" ]; then
    PID=$(cat "$pidfile")
    # Kill the process group (negative PID)
    kill -- -$PID 2>/dev/null || kill $PID 2>/dev/null
    echo "Stopped PID $PID"
    stopped=$((stopped+1))
    rm -f "$pidfile"
  fi
done

# Wait a moment for graceful shutdown
sleep 1

# Kill any stragglers on our ports (SIGTERM first, then SIGKILL)
for port in 3000 3001 $VITE_PORT; do
  PIDS=$(lsof -ti:$port 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill 2>/dev/null
    sleep 0.5
    # Force kill if still alive
    PIDS=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$PIDS" ]; then
      echo "$PIDS" | xargs kill -9 2>/dev/null
      echo "Force killed processes on port $port"
    else
      echo "Killed processes on port $port"
    fi
    stopped=$((stopped+1))
  fi
done

# Also kill any orphaned tsx/vite processes from our project
pgrep -f "tsx.*comic-reader" 2>/dev/null | xargs kill 2>/dev/null
pgrep -f "vite.*comic-reader" 2>/dev/null | xargs kill 2>/dev/null

rm -f "$DIR/.vite-port"

if [ $stopped -eq 0 ]; then
  echo "No services were running."
else
  echo "All services stopped."
fi
