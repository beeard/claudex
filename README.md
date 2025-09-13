claudex — Orchestration Kit + Interactive Installer

Overview
- Single-file CLI (Node >= 18): `dist/claudex.cjs`
- NPM bin: `orchestrator-kit` → `dist/cli.js`
- Memory HTTP server with drivers: SQLite (default) and Supabase (optional), token-auth, /health + /tools/* endpoints
- tmux dashboard helpers, monitoring, verify scripts, intelligent orchestrator dispatch (log only), structured JSONL logs + per-run reports, run index
- MCP servers (templates): memory-http bridge + prompt-optimizer (via `@modelcontextprotocol/sdk`) wired in `.codex/config.toml`

Quick Start
- Help: `node dist/claudex.cjs --help`
- Full setup into a host repo: `node dist/claudex.cjs setup` (installs `.codex/config.toml`, copies templates, installs deps, verifies Memory HTTP)
- Install templates only: `node dist/claudex.cjs init`
- Dashboard with memory: `npm run dashboard:with-memory`
- Monitor: `npm run monitor:with-memory`
- Verify infra: `npm run verify:orchestration`
- Orchestrate: `node dist/claudex.cjs orchestrate "Hello Task" parallel 3 high`

Defaults
- MEMORY_HTTP_DRIVER=sqlite
- MEMORY_HTTP_URL=http://127.0.0.1:8787
- MEMORY_HTTP_TOKEN=dev-memory-token-12345
- Session continuity: CODEX_SESSION_ID=sess_2025-09-13_01

What’s Included
- `dist/claudex.cjs` — standalone CLI (no build required at runtime)
- `dist/cli.js` — NPM bin entry
- `templates/` — tmux scripts, orchestration helpers, memory HTTP server sources
- `docs/orchestration-guide.md` — Quick-Starts
- `install.sh` — unpack a generated tarball and run `init`

Notes
- If `tmux` is missing, dashboard commands degrade gracefully and print instructions.
- SQLite is default. Supabase dual-write is supported via env.
- The CLI can auto-start the Memory HTTP server if unhealthy.
- Codex MCP: `.codex/config.toml` points to `node claudex/mcp/memory-http-mcp.server.mjs` and `node claudex/mcp/prompt-optimizer-mcp.server.mjs`
