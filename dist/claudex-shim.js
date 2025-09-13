#!/usr/bin/env node
// claudex shim → forwards to orchestrator-kit in the current repo
const cp = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function resolveTarget() {
  const cwd = process.cwd();
  const candidate = path.join(cwd, 'orchestrator-kit', 'dist', 'orchestrator-kit.cjs');
  if (fs.existsSync(candidate)) return candidate;
  // fallback: try repo-root two levels up from this shim when linked globally
  try {
    const here = __dirname; // .../node_modules/claudex/dist
    const repo = path.resolve(here, '..', '..', '..');
    const alt = path.join(repo, 'orchestrator-kit', 'dist', 'orchestrator-kit.cjs');
    if (fs.existsSync(alt)) return alt;
  } catch {}
  return null;
}

const target = resolveTarget();
if (!target) {
  console.error('[claudex] Could not find orchestrator-kit at orchestrator-kit/dist/orchestrator-kit.cjs');
  console.error('[claudex] Run from the repo root, or ensure orchestrator-kit is built.');
  process.exit(1);
}

const args = process.argv.slice(2);
const r = cp.spawnSync(process.execPath, [target, ...args], { stdio: 'inherit' });
process.exit(r.status ?? 0);

