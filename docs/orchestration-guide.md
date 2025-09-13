Orchestration Guide (claudex)

Quick Starts
- Init in current repo: `node dist/claudex.cjs init`
- Start dashboard (with memory): `npm run dashboard:with-memory`
- Monitor health/stats: `npm run monitor:with-memory`
- Verify infrastructure: `npm run verify:orchestration`
- Dispatch a task: `node dist/claudex.cjs orchestrate "Hello Task" parallel 3 high`

Environment
- MEMORY_HTTP_DRIVER=sqlite | supabase (default sqlite)
- MEMORY_HTTP_URL=http://127.0.0.1:8787
- MEMORY_HTTP_TOKEN=dev-memory-token-12345
- MEMORY_DUAL_WRITE=0|1 (if 1 + sessionId present → writes to sqlite and supabase)
- SUPABASE_URL= (optional)
- SUPABASE_SERVICE_KEY= (optional)
- CODEX_SESSION_ID=sess_2025-09-13_01 (default continuity)

Endpoints
- GET /health → { ok: true }
- POST /tools/search_memories → { items: [...] }
- POST /tools/store_memory → { ok: true, id }
- POST /tools/get_stats → { total_memories, average_usefulness, cache_size }
Authorization: send `Authorization: Bearer $MEMORY_HTTP_TOKEN` for /tools/* endpoints.

tmux Dashboard
- Scripts under `templates/scripts/tmux`. If `tmux` is not available, use `node dist/claudex.cjs monitor`.

Logs & Reports
- JSONL logs: `logs/orchestration/events.jsonl`
- Per-run: `reports/orchestration/<runId>/`
- Run index: `reports/orchestration/index.json` (also mirrored to `reports/orchestroration/index.json`)

