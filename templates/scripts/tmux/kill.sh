#!/usr/bin/env bash
set -euo pipefail
tmux kill-session -t "${SESSION:-distributed-system}" || true
echo "[claudex] tmux session killed."

