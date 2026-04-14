#!/bin/bash
# Stop all comic-reader dev services — kills parent and all child processes
DIR="$(cd "$(dirname "$0")/.." && pwd)"

VITE_PORT=5880
[ -f "$DIR/.vite-port" ] && VITE_PORT=$(cat "$DIR/.vite-port")

stopped=0

# Kill by PID file — send to process group to catch children
for pidfile in "$DIR/.dev.pid" "$DIR/.orchestrator.pid"; do
  if [ -f "$pidfile" ]; then
    PID=$(cat "$pidfile")
    kill -- -$PID 2>/dev/null || kill $PID 2>/dev/null
    echo "Stopped PID $PID"
    stopped=$((stopped+1))
    rm -f "$pidfile"
  fi
done

sleep 1

# Kill any stragglers on our ports (SIGTERM first, then SIGKILL)
for port in 3000 3001 $VITE_PORT; do
  PIDS=$(lsof -ti:$port 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill 2>/dev/null
    sleep 0.5
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

# Kill ALL orphaned comic-reader processes (tsx, vite, concurrently, node)
# Match by the project directory path — won't touch other projects
ORPHANS=$(pgrep -f "$DIR" 2>/dev/null)
if [ -n "$ORPHANS" ]; then
  echo "Killing orphaned comic-reader processes:"
  echo "$ORPHANS" | while read pid; do
    CMD=$(ps -p $pid -o command= 2>/dev/null)
    echo "  PID $pid: $CMD"
  done
  echo "$ORPHANS" | xargs kill 2>/dev/null
  sleep 0.5
  # Force kill survivors
  ORPHANS=$(pgrep -f "$DIR" 2>/dev/null)
  if [ -n "$ORPHANS" ]; then
    echo "$ORPHANS" | xargs kill -9 2>/dev/null
    echo "  Force killed remaining orphans"
  fi
  stopped=$((stopped+1))
fi

rm -f "$DIR/.vite-port"

if [ $stopped -eq 0 ]; then
  echo "No services were running."
else
  echo "All services stopped."
fi
