#!/usr/bin/env bash
set -euo pipefail

export ENABLE_TAIL="${ENABLE_TAIL:-1}"
export MEM_MODE="${MEM_MODE:-project}"
export MEM_LIMIT="${MEM_LIMIT:-5}"
export MEM_INTERVAL_MS="${MEM_INTERVAL_MS:-4000}"

if ! command -v tmux >/dev/null 2>&1; then
  echo "[claudex] tmux not found. Falling back to console monitor."
  exec node dist/claudex.cjs monitor
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/init.sh"
tmux attach -t "${SESSION:-distributed-system}"
