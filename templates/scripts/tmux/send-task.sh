#!/usr/bin/env bash
set -euo pipefail
TASK="${1:-Demo Task}"
STRATEGY="${2:-adaptive}"
AGENTS="${3:-3}"
PRIORITY="${4:-medium}"
node dist/claudex.cjs orchestrate "$TASK" "$STRATEGY" "$AGENTS" "$PRIORITY"

