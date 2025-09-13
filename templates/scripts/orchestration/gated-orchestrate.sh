#!/usr/bin/env bash
set -euo pipefail

TASK="${1:-Demo Task}"
STRATEGY="${2:-adaptive}"
AGENTS="${3:-3}"
PRIORITY="${4:-medium}"

echo "[claudex] Orchestrate: task='$TASK' strategy=$STRATEGY agents=$AGENTS priority=$PRIORITY"
node dist/claudex.cjs orchestrate "$TASK" "$STRATEGY" "$AGENTS" "$PRIORITY"

