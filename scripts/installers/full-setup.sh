#!/usr/bin/env bash
# claudex full project setup installer
# - Installs dependencies (Node >= 18 required)
# - Copies templates to ./claudex in host repo
# - Wires npm scripts (non-destructive)
# - Ensures dist CLI is present (uses included dist)
# - Starts Memory HTTP (sqlite by default) and verifies health/stats
# - Generates run index if missing

set -euo pipefail

ROOT="$(pwd)"
SRC_DIR_REL="$(dirname "$0")/../.."
SRC_DIR="$(cd "$SRC_DIR_REL" && pwd)"
TARGET_DIR="${TARGET_DIR:-$ROOT}"

MEMORY_HTTP_DRIVER="${MEMORY_HTTP_DRIVER:-sqlite}"
MEMORY_HTTP_URL="${MEMORY_HTTP_URL:-http://127.0.0.1:8787}"
MEMORY_HTTP_TOKEN="${MEMORY_HTTP_TOKEN:-dev-memory-token-12345}"
CODEX_SESSION_ID="${CODEX_SESSION_ID:-sess_2025-09-13_01}"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[claudex] Missing dependency: $1"; exit 1; }; }

echo "[claudex] Full setup starting in: $TARGET_DIR"
require_cmd node
NODE_MAJ="$(node -p "process.versions.node.split('.') [0]")"
if [ "$NODE_MAJ" -lt 18 ]; then
  echo "[claudex] Node >= 18 required. Found $(node -v)."; exit 1
fi

# Ensure package.json exists in host repo
if [ ! -f "$TARGET_DIR/package.json" ]; then
  echo "[claudex] No package.json in host. Initializing..."
  (cd "$TARGET_DIR" && npm init -y >/dev/null 2>&1)
fi

# Copy templates
echo "[claudex] Copying templates → $TARGET_DIR/claudex"
mkdir -p "$TARGET_DIR/claudex"
rsync -a --delete "$SRC_DIR/templates/" "$TARGET_DIR/claudex/"

# Install .codex/config.toml at project root if missing
if [ ! -f "$TARGET_DIR/.codex/config.toml" ]; then
  mkdir -p "$TARGET_DIR/.codex"
  cp -f "$TARGET_DIR/claudex/.codex/config.toml" "$TARGET_DIR/.codex/config.toml"
  echo "[claudex] Installed .codex/config.toml"
fi

# Copy dist CLI
mkdir -p "$TARGET_DIR/dist"
cp -f "$SRC_DIR/dist/claudex.cjs" "$TARGET_DIR/dist/claudex.cjs"
cp -f "$SRC_DIR/dist/cli.js" "$TARGET_DIR/dist/cli.js"
chmod +x "$TARGET_DIR/dist/cli.js"

# .env template (non-destructive)
if [ ! -f "$TARGET_DIR/claudex/.env" ]; then
  cat > "$TARGET_DIR/claudex/.env" <<EOF
MEMORY_HTTP_DRIVER=${MEMORY_HTTP_DRIVER}
MEMORY_HTTP_URL=${MEMORY_HTTP_URL}
MEMORY_HTTP_TOKEN=${MEMORY_HTTP_TOKEN}
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
OPENAI_API_KEY=
EOF
fi

# Wire package scripts (non-destructive)
echo "[claudex] Wiring npm scripts"
node - <<'NODE'
const fs = require('fs');
const p = 'package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts['dashboard:quick'] ||= 'node dist/claudex.cjs dashboard';
pkg.scripts['dashboard:quick:mem-off'] ||= 'ENABLE_MEM_HTTP=0 node dist/claudex.cjs dashboard';
pkg.scripts['dashboard:with-memory'] ||= 'ENABLE_MEM_HTTP=1 node dist/claudex.cjs dashboard';
pkg.scripts['monitor:with-memory'] ||= 'ENABLE_MEM_HTTP=1 node dist/claudex.cjs monitor';
pkg.scripts['verify:orchestration'] ||= 'node dist/claudex.cjs verify';
fs.writeFileSync(p, JSON.stringify(pkg, null, 2));
console.log('[claudex] Scripts updated in package.json');
NODE

# Install runtime deps for full functionality (sqlite, supabase optional)
echo "[claudex] Installing runtime deps (better-sqlite3, commander, inquirer, chalk, dotenv, @supabase/supabase-js)"
npm pkg set engines.node=">=18" >/dev/null 2>&1 || true
npm i --silent better-sqlite3 commander inquirer chalk dotenv @supabase/supabase-js >/dev/null 2>&1 || true

# Start memory HTTP if unhealthy and verify
echo "[claudex] Verifying Memory HTTP at ${MEMORY_HTTP_URL} (driver=${MEMORY_HTTP_DRIVER})"
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${MEMORY_HTTP_URL}/health" || true)
if [ "$HEALTH_CODE" != "200" ]; then
  echo "[claudex] Starting embedded Memory HTTP server..."
  (cd "$TARGET_DIR" && NODE_OPTIONS="" node dist/claudex.cjs serve-memory-http >/dev/null 2>&1 &)
  for i in {1..30}; do
    HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${MEMORY_HTTP_URL}/health" || true)
    [ "$HEALTH_CODE" = "200" ] && break
    sleep 0.5
  done
fi

if [ "$HEALTH_CODE" != "200" ]; then
  echo "[claudex] Memory HTTP health check failed (${HEALTH_CODE})."
  exit 1
fi

STATS_CODE=$(curl -s -o /tmp/claudex_stats.json -w "%{http_code}" -H "Authorization: Bearer ${MEMORY_HTTP_TOKEN}" -X POST "${MEMORY_HTTP_URL}/tools/get_stats" -H 'Content-Type: application/json' -d '{}' || true)
if [ "$STATS_CODE" != "200" ]; then
  echo "[claudex] Stats unauthorized (${STATS_CODE}). Check MEMORY_HTTP_TOKEN."
else
  echo "[claudex] Stats: $(cat /tmp/claudex_stats.json)"
fi

# Ensure run index exists
mkdir -p "$TARGET_DIR/reports/orchestration"
if [ ! -f "$TARGET_DIR/reports/orchestration/index.json" ]; then
  echo "[]" > "$TARGET_DIR/reports/orchestration/index.json"
fi
cp -f "$TARGET_DIR/reports/orchestration/index.json" "$TARGET_DIR/reports/orchestroration/index.json" || true

echo "[claudex] Setup complete. Try: npm run verify:orchestration"
