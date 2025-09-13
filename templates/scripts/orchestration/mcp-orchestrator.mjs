#!/usr/bin/env node
// Attempts to locate Claude Flow; falls back to CLI orchestrate
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const task = process.argv[2] || 'Demo external orchestration';
const strategy = process.argv[3] || 'parallel';
const agents = process.argv[4] || '3';
const priority = process.argv[5] || 'medium';

function run(cmd, args) { return spawnSync(cmd, args, { stdio: 'inherit' }); }

const BIN = process.env.CLAUDE_FLOW_BIN || '';
if (BIN) {
  run(BIN, [task, strategy, agents, priority]);
  process.exit(0);
}

const localNodeBin = path.join(process.cwd(), 'node_modules', '.bin', 'claude-flow');
if (fs.existsSync(localNodeBin)) {
  run(localNodeBin, [task, strategy, agents, priority]);
  process.exit(0);
}

// Fallback: use claudex CLI orchestrate (logs + run index)
console.log('[claudex] Fallback to CLI orchestrate');
run('node', ['dist/claudex.cjs', 'orchestrate', task, strategy, agents, priority]);

