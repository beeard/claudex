#!/usr/bin/env bash
set -euo pipefail
MODE="${1:-project}"
SESSION_ID="${2:-}"
echo "[claudex] memory panel mode: $MODE ${SESSION_ID:+(session=$SESSION_ID)}"

