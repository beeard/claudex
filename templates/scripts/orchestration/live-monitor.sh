#!/usr/bin/env bash
set -euo pipefail

MEM_URL="${MEMORY_HTTP_URL:-http://127.0.0.1:8787}"

echo "[claudex] Live monitor: $MEM_URL"
while true; do
  echo "--- $(date) ---"
  curl -s "$MEM_URL/health" | jq . || true
  curl -s -H "Authorization: Bearer ${MEMORY_HTTP_TOKEN:-dev-memory-token-12345}" -X POST "$MEM_URL/tools/get_stats" -H 'Content-Type: application/json' -d '{}' | jq . || true
  sleep 3
done

