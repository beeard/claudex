#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_VER=$(node -p -e "require('${DIR}/../package.json').version")
TARBALL="${DIR}/claudex-${PKG_VER}.tgz"

if [ ! -f "$TARBALL" ]; then
  echo "Tarball not found: $TARBALL"
  echo "Create it with: npm run pack"
  exit 1
fi

TARGET_DIR="${1:-$PWD/claudex-${PKG_VER}}"
mkdir -p "$TARGET_DIR"
tar -xzf "$TARBALL" -C "$TARGET_DIR"
echo "[claudex] Unpacked to $TARGET_DIR"
echo "Run: node dist/claudex.cjs init"

