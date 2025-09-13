#!/usr/bin/env bash
set -euo pipefail
tmux attach -t "${SESSION:-distributed-system}" || echo "[claudex] No tmux session. Run start-dashboard.sh first."

