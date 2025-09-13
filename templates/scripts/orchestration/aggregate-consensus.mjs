#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const idxA = path.join(root, 'reports', 'orchestration', 'index.json');
const idxB = path.join(root, 'reports', 'orchestroration', 'index.json');
const idxPath = fs.existsSync(idxA) ? idxA : idxB;
const outDir = path.join(root, 'reports', 'orchestration');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `consensus-${Date.now()}.md`);

let runs = [];
try { runs = JSON.parse(fs.readFileSync(idxPath, 'utf8')); } catch {}
const summary = runs.slice(-5).map(r => `- ${r.id} ${r.task} [${r.strategy}/${r.agents}/${r.priority}]`).join('\n');
fs.writeFileSync(out, `# Consensus (last ${Math.min(5, runs.length)} runs)\n\n${summary}\n`);
console.log('[claudex] Consensus report at', out);

