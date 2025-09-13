#!/usr/bin/env bash
set -euo pipefail

MEM_URL="${MEMORY_HTTP_URL:-http://127.0.0.1:8787}"
TOKEN="${MEMORY_HTTP_TOKEN:-dev-memory-token-12345}"

echo "[claudex] Verifying Memory HTTP at $MEM_URL"
echo "- Health:"
curl -sS "$MEM_URL/health" | jq . || true

echo "- Stats:"
STAT_CODE=$(curl -sS -o /tmp/claudex_stats.json -w "%{http_code}" -H "Authorization: Bearer $TOKEN" -X POST "$MEM_URL/tools/get_stats" -H 'Content-Type: application/json' -d '{}') || true
if [ "$STAT_CODE" != "200" ]; then
  echo "Unauthorized or server error ($STAT_CODE). Ensure MEMORY_HTTP_TOKEN matches."
else
  cat /tmp/claudex_stats.json | jq .
fi

