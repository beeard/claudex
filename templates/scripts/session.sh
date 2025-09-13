#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-show}"
VALUE="${2:-}"
ENV_FILE="$(pwd)/claudex/.env"

case "$ACTION" in
  show)
    echo "Current CODEX_SESSION_ID=${CODEX_SESSION_ID:-sess_2025-09-13_01}" ;;
  set)
    if [ -z "$VALUE" ]; then echo "Usage: session.sh set <sessionId>"; exit 1; fi
    mkdir -p "$(dirname "$ENV_FILE")"
    touch "$ENV_FILE"
    if grep -q '^CODEX_SESSION_ID=' "$ENV_FILE"; then
      sed -i.bak "s/^CODEX_SESSION_ID=.*/CODEX_SESSION_ID=$VALUE/" "$ENV_FILE"
    else
      echo "CODEX_SESSION_ID=$VALUE" >> "$ENV_FILE"
    fi
    rm -f "$ENV_FILE.bak"
    echo "Updated CODEX_SESSION_ID=$VALUE in $ENV_FILE" ;;
  *) echo "Usage: session.sh [show|set <sessionId>]"; exit 1 ;;
esac

