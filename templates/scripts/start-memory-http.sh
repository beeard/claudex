#!/usr/bin/env bash
set -euo pipefail

MEM_URL="${MEMORY_HTTP_URL:-http://127.0.0.1:8787}"
MEM_TOKEN="${MEMORY_HTTP_TOKEN:-dev-memory-token-12345}"
DRIVER="${MEMORY_HTTP_DRIVER:-sqlite}"

health() {
  curl -sS "$MEM_URL/health" >/dev/null 2>&1
}

echo "[claudex] Checking Memory HTTP at $MEM_URL ..."
if ! health; then
  echo "[claudex] Starting embedded Memory HTTP server (driver=$DRIVER) ..."
  # Prefer compiled server if present; fallback prints helpful note
  if [ -f "templates/services/memory-http/build/http-server.cjs" ]; then
    node templates/services/memory-http/build/http-server.cjs &
  else
    # Defer to CLI embedded server if available
    if [ -f "dist/claudex.cjs" ]; then
      node dist/claudex.cjs serve-memory-http &
    else
      echo "[claudex] No server binary found. Ensure dist/claudex.cjs exists."
      exit 1
    fi
  fi
  # Wait for health
  for i in {1..30}; do
    if health; then
      echo "[claudex] Memory HTTP is healthy."
      break
    fi
    sleep 0.5
  done
fi

echo "[claudex] Memory HTTP ready at $MEM_URL"

