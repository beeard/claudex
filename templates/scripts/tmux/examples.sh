#!/usr/bin/env bash
set -euo pipefail
echo "[claudex] Dispatching demo tasks..."
node dist/claudex.cjs orchestrate "Demo external orchestration" parallel 3 high
node dist/claudex.cjs orchestrate "Quality Gates: type-check, lint, tests" sequential 1 high

