#!/usr/bin/env node
/*
  claudex — Orchestration Kit + Interactive Installer
  Single-file CLI (Node >= 18). Includes embedded Memory HTTP server (SQLite driver with fallback).
*/
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const url = require('node:url');
const os = require('node:os');
const crypto = require('node:crypto');

// -------- utilities --------
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function readJSON(p, def = undefined) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; } }
function writeJSON(p, v) { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(v, null, 2)); }
function appendJSONL(p, v) { ensureDir(path.dirname(p)); fs.appendFileSync(p, JSON.stringify(v) + "\n"); }
function getEnv(k, d) { return process.env[k] ?? d; }
function parseUrl(u) { try { return new URL(u); } catch { return new URL('http://127.0.0.1:8787'); } }
function nowIso() { return new Date().toISOString(); }

const DEFAULTS = {
  MEMORY_HTTP_DRIVER: 'sqlite',
  MEMORY_HTTP_URL: 'http://127.0.0.1:8787',
  MEMORY_HTTP_TOKEN: 'dev-memory-token-12345',
  SESSION_ID: getEnv('CODEX_SESSION_ID', 'sess_2025-09-13_01')
};

// -------- embedded Memory drivers --------
function createSqliteDriver() {
  let bsql = null;
  try { bsql = require('better-sqlite3'); } catch (e) {
    return createInMemoryDriver('[fallback:better-sqlite3-not-installed]');
  }
  const dbRoot = path.join(process.cwd(), 'claudex', 'data');
  ensureDir(dbRoot);
  const dbPath = path.join(dbRoot, 'memory.sqlite');
  const db = new bsql(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS memories(
    id TEXT PRIMARY KEY,
    content TEXT,
    metadata TEXT,
    usefulness INTEGER,
    created_at TEXT
  );`);
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS fts_memories USING fts5(content, id UNINDEXED);`);
  const insertMem = db.prepare(`INSERT INTO memories(id,content,metadata,usefulness,created_at) VALUES (@id,@content,@metadata,@usefulness,@created_at)
    ON CONFLICT(id) DO UPDATE SET content=excluded.content, metadata=excluded.metadata, usefulness=excluded.usefulness`);
  const insertFts = db.prepare(`INSERT INTO fts_memories(rowid, content, id) VALUES ((SELECT COALESCE((SELECT rowid FROM fts_memories WHERE id=@id),(SELECT MAX(rowid)+1 FROM fts_memories))), @content, @id)`);
  const selectStats = db.prepare(`SELECT COUNT(*) as cnt, COALESCE(AVG(usefulness),0) as avg FROM memories`);

  function storeMemory({ id, content, metadata, usefulness }) {
    const created_at = nowIso();
    const mid = id || crypto.randomUUID();
    insertMem.run({ id: mid, content: content || '', metadata: JSON.stringify(metadata||{}), usefulness: usefulness ?? 0, created_at });
    try { insertFts.run({ id: mid, content: content || '' }); } catch {}
    return { ok: true, id: mid };
  }
  function searchMemories({ query, limit = 10, sessionId }) {
    if (!query || !query.trim()) return [];
    let rows = [];
    try {
      const stmt = db.prepare(`SELECT m.id, m.content, m.metadata, m.usefulness FROM fts_memories f JOIN memories m ON m.id=f.id WHERE f MATCH ? LIMIT ?`);
      rows = stmt.all(query, limit * 3);
    } catch {
      const stmt = db.prepare(`SELECT id, content, metadata, usefulness FROM memories LIMIT ?`);
      rows = stmt.all(limit * 3);
    }
    const items = rows.map(r => ({ id: r.id, content: r.content, metadata: safeJSON(r.metadata), usefulness_score: r.usefulness ?? 0 }));
    const filtered = sessionId ? items.filter(x => x.metadata?.sessionId === sessionId) : items;
    return filtered.slice(0, limit);
  }
  function getStats() {
    const s = selectStats.get();
    return { total_memories: s.cnt || 0, average_usefulness: Number(s.avg || 0), cache_size: 0 };
  }
  return { kind: 'sqlite', storeMemory, searchMemories, getStats };
}

function createSupabaseDriver() {
  let createClient = null;
  try { ({ createClient } = require('@supabase/supabase-js')); } catch (e) {
    return { kind: 'supabase-stub',
      storeMemory: () => ({ ok: false, note: 'supabase-js not installed' }),
      searchMemories: () => [],
      getStats: () => ({ total_memories: 0, average_usefulness: 0, cache_size: 0 }) };
  }
  const url = getEnv('SUPABASE_URL', '');
  const key = getEnv('SUPABASE_SERVICE_KEY', '');
  if (!url || !key) {
    return { kind: 'supabase-disabled',
      storeMemory: () => ({ ok: false, note: 'SUPABASE_URL/KEY missing' }),
      searchMemories: () => [],
      getStats: () => ({ total_memories: 0, average_usefulness: 0, cache_size: 0 }) };
  }
  const client = createClient(url, key);
  async function storeMemory({ id, content, metadata, usefulness }) {
    const rec = { id: id || crypto.randomUUID(), content: content||'', metadata: metadata||{}, usefulness: usefulness ?? 0, created_at: nowIso() };
    try {
      await client.from('memories').upsert(rec).throwOnError();
      return { ok: true, id: rec.id };
    } catch (e) { return { ok: false, error: String(e.message||e) }; }
  }
  async function searchMemories({ query, limit = 10, sessionId }) {
    // Simplified: fetch latest and filter client-side
    try {
      const { data } = await client.from('memories').select('*').order('created_at', { ascending: false }).limit(limit*3);
      const items = (data||[]).map(r => ({ id: r.id, content: r.content, metadata: r.metadata, usefulness_score: r.usefulness||0 }));
      const filtered = sessionId ? items.filter(x => x.metadata?.sessionId === sessionId) : items;
      return filtered.slice(0, limit);
    } catch { return []; }
  }
  async function getStats() {
    try {
      const { count } = await client.from('memories').select('*', { count: 'exact', head: true });
      return { total_memories: count||0, average_usefulness: 0, cache_size: 0 };
    } catch { return { total_memories: 0, average_usefulness: 0, cache_size: 0 }; }
  }
  return { kind: 'supabase', storeMemory, searchMemories, getStats };
}

function createInMemoryDriver(note='') {
  const arr = [];
  return {
    kind: 'memory'+(note?` (${note})`:''),
    storeMemory({ id, content, metadata, usefulness }) {
      const mid = id || crypto.randomUUID();
      const rec = { id: mid, content: content||'', metadata: metadata||{}, usefulness: usefulness??0, created_at: nowIso() };
      const idx = arr.findIndex(x => x.id === mid);
      if (idx >= 0) arr[idx] = rec; else arr.push(rec);
      return { ok: true, id: mid };
    },
    searchMemories({ query, limit=10, sessionId }) {
      const q = (query||'').toLowerCase();
      const items = arr.filter(x => x.content.toLowerCase().includes(q));
      const filtered = sessionId ? items.filter(x => x.metadata?.sessionId === sessionId) : items;
      return filtered.slice(0, limit).map(x => ({ id: x.id, content: x.content, metadata: x.metadata, usefulness_score: x.usefulness }));
    },
    getStats() { return { total_memories: arr.length, average_usefulness: arr.reduce((s,x)=>s+(x.usefulness||0),0)/(arr.length||1), cache_size: 0 }; }
  };
}

function selectPrimaryDriver() {
  const driver = getEnv('MEMORY_HTTP_DRIVER', DEFAULTS.MEMORY_HTTP_DRIVER);
  if (driver === 'sqlite') return createSqliteDriver();
  if (driver === 'supabase') return createSupabaseDriver();
  return createInMemoryDriver('[unknown-driver]');
}

// -------- embedded HTTP server --------
function startMemoryHttpServer() {
  const primary = selectPrimaryDriver();
  const sup = createSupabaseDriver();
  const dualWrite = getEnv('MEMORY_DUAL_WRITE', '0') === '1';
  const listenUrl = parseUrl(getEnv('MEMORY_HTTP_URL', DEFAULTS.MEMORY_HTTP_URL));
  const TOKEN = getEnv('MEMORY_HTTP_TOKEN', DEFAULTS.MEMORY_HTTP_TOKEN);

  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url || '', true);
    const method = req.method || 'GET';
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };

    if (method === 'GET' && parsed.pathname === '/health') {
      return send(200, { ok: true, driver: primary.kind, dual_write: dualWrite });
    }

    // /tools/* require token
    if (!req.headers['authorization'] || !String(req.headers['authorization']).startsWith('Bearer ') || String(req.headers['authorization']).slice(7) !== TOKEN) {
      if (parsed.pathname?.startsWith('/tools/')) {
        return send(401, { ok: false, error: 'Unauthorized: set MEMORY_HTTP_TOKEN and send Authorization: Bearer <token>' });
      }
    }

    if (method === 'POST' && parsed.pathname === '/tools/store_memory') {
      let body=''; req.on('data', c => body += c); req.on('end', async () => {
        const payload = safeJSON(body) || {}; const meta = payload.metadata || {}; const sessionId = meta.sessionId;
        const r1 = await Promise.resolve(primary.storeMemory(payload));
        if (dualWrite && sessionId) { try { await Promise.resolve(sup.storeMemory(payload)); } catch {} }
        return send(200, { ok: true, id: r1.id });
      });
      return;
    }
    if (method === 'POST' && parsed.pathname === '/tools/search_memories') {
      let body=''; req.on('data', c => body += c); req.on('end', async () => {
        const payload = safeJSON(body) || {}; const { query, limit, metadata } = payload;
        const sessionId = metadata?.sessionId || payload.sessionId;
        let items = await Promise.resolve(primary.searchMemories({ query, limit: limit||10, sessionId }));
        if ((!items || items.length === 0) && sessionId) {
          const alt = await Promise.resolve(sup.searchMemories({ query, limit: limit||10, sessionId }));
          if (alt && alt.length) items = alt;
        }
        return send(200, { ok: true, items });
      });
      return;
    }
    if (method === 'POST' && parsed.pathname === '/tools/get_stats') {
      const s1 = await Promise.resolve(primary.getStats());
      return send(200, s1);
    }

    return send(404, { ok: false, error: 'Not Found' });
  });
  server.listen(Number(listenUrl.port), listenUrl.hostname, () => {
    console.log(`[claudex] Memory HTTP listening on ${listenUrl.href} (driver=${primary.kind}${dualWrite?'+dual':''})`);
  });
  return server;
}

function safeJSON(x) { try { return typeof x === 'string' ? JSON.parse(x) : x; } catch { return {}; } }

// -------- CLI commands --------
function usage() {
  console.log(`claudex v0.1.0\n\nCommands:\n  init                      Interactive installer (copy templates, add scripts)\n  dashboard                 Launch dashboard (tmux if available; starts memory if needed)\n  monitor                   Console live monitor (health/stats)\n  verify                    Verify infrastructure (/health + /tools/get_stats)\n  orchestrate <task> [strategy] [agents] [priority]  Log dispatch + update index\n  serve-memory-http         Start embedded Memory HTTP server\n\nOptions env: MEMORY_HTTP_DRIVER, MEMORY_HTTP_URL, MEMORY_HTTP_TOKEN, MEMORY_DUAL_WRITE, CODEX_SESSION_ID`);
}

async function cmdInit() {
  const templatesSrc = path.resolve(__dirname, '../templates');
  const dst = path.resolve(process.cwd(), 'claudex');
  copyRecursive(templatesSrc, dst);
  // .env template
  const envPath = path.join(dst, '.env');
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `MEMORY_HTTP_DRIVER=sqlite\nMEMORY_HTTP_URL=http://127.0.0.1:8787\nMEMORY_HTTP_TOKEN=dev-memory-token-12345\nSUPABASE_URL=\nSUPABASE_SERVICE_KEY=\nOPENAI_API_KEY=\n`);
  }
  // package.json scripts (non-destructive)
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = readJSON(pkgPath) || {};
    pkg.scripts = pkg.scripts || {};
    pkg.scripts['dashboard:quick'] = pkg.scripts['dashboard:quick'] || 'node dist/claudex.cjs dashboard';
    pkg.scripts['dashboard:quick:mem-off'] = pkg.scripts['dashboard:quick:mem-off'] || 'ENABLE_MEM_HTTP=0 node dist/claudex.cjs dashboard';
    pkg.scripts['dashboard:with-memory'] = pkg.scripts['dashboard:with-memory'] || 'ENABLE_MEM_HTTP=1 node dist/claudex.cjs dashboard';
    pkg.scripts['monitor:with-memory'] = pkg.scripts['monitor:with-memory'] || 'ENABLE_MEM_HTTP=1 node dist/claudex.cjs monitor';
    pkg.scripts['verify:orchestration'] = pkg.scripts['verify:orchestration'] || 'node dist/claudex.cjs verify';
    writeJSON(pkgPath, pkg);
  }
  console.log('[claudex] Templates installed to ./claudex and scripts added.');
  await doctor(true);
}

function copyRecursive(src, dst) {
  ensureDir(dst);
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry); const d = path.join(dst, entry);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) copyRecursive(s, d); else fs.copyFileSync(s, d);
  }
}

async function doctor(silent=false) {
  const info = {
    node: process.version,
    platform: `${process.platform} ${os.release()}`,
    tmux: !!which('tmux'),
    curl: !!which('curl'),
    jq: !!which('jq'),
    memory_url: getEnv('MEMORY_HTTP_URL', DEFAULTS.MEMORY_HTTP_URL),
    driver: getEnv('MEMORY_HTTP_DRIVER', DEFAULTS.MEMORY_HTTP_DRIVER)
  };
  if (!silent) console.log('[claudex] Doctor:', info);
  return info;
}

function which(name){ const r = require('node:child_process').spawnSync(name, ['-V'], { stdio: 'ignore' }); return r.status === 0; }

async function ensureMemoryHealthy() {
  const memUrl = parseUrl(getEnv('MEMORY_HTTP_URL', DEFAULTS.MEMORY_HTTP_URL));
  const ok = await fetchSafe(`${memUrl}/health`).then(r => r?.ok).catch(()=>false);
  if (!ok) {
    console.log('[claudex] Starting embedded Memory HTTP server ...');
    startMemoryHttpServer();
    // wait up to 10s
    for (let i=0;i<20;i++){ const r = await fetchSafe(`${memUrl}/health`); if (r?.ok) break; await new Promise(r=>setTimeout(r,500)); }
  }
}

async function cmdDashboard() {
  if (getEnv('ENABLE_MEM_HTTP','1') !== '0') await ensureMemoryHealthy();
  // tmux dashboard or fallback to monitor
  if (which('tmux')) {
    console.log('[claudex] Launching tmux dashboard ...');
    const sh = path.join(process.cwd(), 'templates', 'scripts', 'tmux', 'start-dashboard.sh');
    if (fs.existsSync(sh)) require('node:child_process').spawnSync('bash', [sh], { stdio: 'inherit' });
    else console.log('[claudex] tmux script not found. Running monitor instead.');
  }
  return cmdMonitor();
}

async function cmdMonitor() {
  const memUrl = getEnv('MEMORY_HTTP_URL', DEFAULTS.MEMORY_HTTP_URL);
  const token = getEnv('MEMORY_HTTP_TOKEN', DEFAULTS.MEMORY_HTTP_TOKEN);
  console.log('[claudex] Live monitor', memUrl);
  for (let i=0;i<5;i++) {
    const h = await fetchJson(`${memUrl}/health`).catch(()=>({}));
    const s = await fetchJson(`${memUrl}/tools/get_stats`, { method:'POST', headers: { 'Authorization': `Bearer ${token}`,'Content-Type':'application/json' }, body: '{}' }).catch(()=>({}));
    console.log('---', new Date().toISOString(), '---');
    console.log('health:', h); console.log('stats:', s);
    await new Promise(r=>setTimeout(r,1000));
  }
}

async function cmdVerify() {
  const memUrl = getEnv('MEMORY_HTTP_URL', DEFAULTS.MEMORY_HTTP_URL);
  const token = getEnv('MEMORY_HTTP_TOKEN', DEFAULTS.MEMORY_HTTP_TOKEN);
  await ensureMemoryHealthy();
  const h = await fetchJson(`${memUrl}/health`).catch(()=>({}));
  const s = await fetchJson(`${memUrl}/tools/get_stats`, { method:'POST', headers: { 'Authorization': `Bearer ${token}`,'Content-Type':'application/json' }, body: '{}' }).catch((e)=>({ error:String(e) }));
  console.log('[claudex] Verify');
  console.log('- Health:', h);
  console.log('- Stats:', s);
  if (s && typeof s.total_memories !== 'undefined') {
    console.log(`total_memories=${s.total_memories} avg_usefulness=${s.average_usefulness}`);
  }
}

async function cmdOrchestrate(args) {
  const task = args[0] || 'Demo Task';
  const strategy = args[1] || 'adaptive';
  const agents = Number(args[2] || 3);
  const priority = args[3] || 'medium';
  const runId = `run_${Date.now()}`;
  const root = process.cwd();
  const logsPath = path.join(root, 'logs', 'orchestration', 'events.jsonl');
  const runDir = path.join(root, 'reports', 'orchestration', runId);
  ensureDir(runDir);
  appendJSONL(logsPath, { ts: nowIso(), type: 'dispatch', id: runId, task, strategy, agents, priority });
  const idxA = path.join(root, 'reports', 'orchestration', 'index.json');
  const idxB = path.join(root, 'reports', 'orchestroration', 'index.json');
  const idx = readJSON(idxA, []); idx.push({ id: runId, task, strategy, agents, priority, ts: nowIso(), sessionId: DEFAULTS.SESSION_ID, project: getProjectName() }); writeJSON(idxA, idx); writeJSON(idxB, idx);
  fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify({ id: runId, task, strategy, agents, priority, created_at: nowIso() }, null, 2));
  console.log(`[claudex] Orchestrated '${task}' → ${runId} (strategy=${strategy}, agents=${agents}, priority=${priority})`);
}

function getProjectName(){
  const envName = getEnv('PROJECT'); if (envName) return envName;
  const pkg = readJSON(path.join(process.cwd(), 'package.json'), {}); if (pkg.name) return String(pkg.name).replace(/^@[^/]+\//,'');
  return path.basename(process.cwd());
}

async function fetchSafe(u, opts) { try { return await fetch(u, opts); } catch { return null; } }
async function fetchJson(u, opts) { const r = await fetch(u, opts); const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t } } }

// -------- main --------
(async function main(){
  const [,,cmd, ...args] = process.argv;
  if (!cmd || cmd === '--help' || cmd === '-h') return usage();
  if (cmd === 'init') return cmdInit();
  if (cmd === 'dashboard') return cmdDashboard();
  if (cmd === 'monitor') return cmdMonitor();
  if (cmd === 'verify') return cmdVerify();
  if (cmd === 'orchestrate') return cmdOrchestrate(args);
  if (cmd === 'serve-memory-http') return startMemoryHttpServer();
  console.log('[claudex] Unknown command:', cmd); usage();
})();

