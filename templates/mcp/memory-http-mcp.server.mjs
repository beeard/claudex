#!/usr/bin/env node
// Memory HTTP → MCP bridge using @modelcontextprotocol/sdk
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load env from claudex/.env if present (project root inferred)
const root = process.cwd();
const envPath = fs.existsSync(path.join(root, 'claudex', '.env')) ? path.join(root, 'claudex', '.env') : path.join(root, '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const MEM_URL = process.env.MEMORY_HTTP_URL || 'http://127.0.0.1:8787';
const MEM_TOKEN = process.env.MEMORY_HTTP_TOKEN || 'dev-memory-token-12345';
let CURRENT_SESSION_ID = process.env.CODEX_SESSION_ID || 'sess_2025-09-13_01';

async function postTool(pathname, body = {}) {
  const r = await fetch(`${MEM_URL}${pathname}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${MEM_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t }; }
}

const transport = new StdioServerTransport();
const server = new Server({ name: 'claudex-memory-http-mcp', version: '0.1.0' }, transport);

server.tool('search_memories', {
  description: 'Search memories via Memory HTTP server',
  inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' }, threshold: { type: 'number' }, metadata: { type: 'object' } }, required: ['query'] },
  async handler({ query, limit = 10, metadata = {} }) {
    metadata.sessionId ||= CURRENT_SESSION_ID;
    return await postTool('/tools/search_memories', { query, limit, metadata });
  }
});

server.tool('store_memory', {
  description: 'Store a memory item',
  inputSchema: { type: 'object', properties: { id: { type: 'string' }, content: { type: 'string' }, metadata: { type: 'object' }, usefulness: { type: 'number' } }, required: ['content'] },
  async handler({ id, content, metadata = {}, usefulness = 0 }) {
    metadata.sessionId ||= CURRENT_SESSION_ID;
    return await postTool('/tools/store_memory', { id, content, metadata, usefulness });
  }
});

server.tool('get_stats', {
  description: 'Get memory stats',
  inputSchema: { type: 'object', properties: {} },
  async handler() { return await postTool('/tools/get_stats', {}); }
});

server.tool('provide_feedback', {
  description: 'Record feedback for a memory (no-op passthrough)',
  inputSchema: { type: 'object', properties: { memory_id: { type: 'string' }, helpful: { type: 'boolean' }, not_helpful: { type: 'boolean' } }, required: ['memory_id'] },
  async handler({ memory_id }) { return { ok: true, memory_id }; }
});

// Session controls
server.tool('get_session_id', {
  description: 'Return current session id used by memory tools',
  inputSchema: { type: 'object', properties: {} },
  async handler() { return { sessionId: CURRENT_SESSION_ID }; }
});

server.tool('set_session_id', {
  description: 'Set current session id for memory tools',
  inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] },
  async handler({ sessionId }) { CURRENT_SESSION_ID = String(sessionId); return { ok: true, sessionId: CURRENT_SESSION_ID }; }
});

await server.connect();
