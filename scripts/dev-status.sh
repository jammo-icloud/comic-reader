#!/bin/bash
# Check status of all bindery dev services
DIR="$(cd "$(dirname "$0")/.." && pwd)"

VITE_PORT=5880
[ -f "$DIR/.vite-port" ] && VITE_PORT=$(cat "$DIR/.vite-port")

echo "Bindery Dev Status"
echo "======================="

for port_name in "3000:Express server" "${VITE_PORT}:Vite client" "3001:Orchestrator"; do
  port="${port_name%%:*}"
  name="${port_name#*:}"
  PID=$(lsof -ti:$port 2>/dev/null | head -1)
  if [ -n "$PID" ]; then
    echo "  $name (port $port): UP (PID $PID)"
  else
    echo "  $name (port $port): DOWN"
  fi
done
