#!/usr/bin/env bash
set -euo pipefail

SESSION="${SESSION:-distributed-system}"

if ! command -v tmux >/dev/null 2>&1; then
  echo "[claudex] tmux not found. Use: node dist/claudex.cjs monitor"
  exit 0
fi

tmux new-session -d -s "$SESSION" -n validation
tmux new-window -t "$SESSION":2 -n dashboard
tmux new-window -t "$SESSION":3 -n logs
tmux send-keys -t "$SESSION":3 "tail -F tmp/claudex/coordinator.log || tail -F tmp/claude-ipc/coordinator.log" C-m
echo "[claudex] tmux session '$SESSION' created."

