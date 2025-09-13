// Template source (TypeScript). At runtime, claudex CLI provides an embedded server.
// This file is included for users who want to build their own server binary.
import http from 'node:http';
import url from 'node:url';

function getEnv(key: string, def?: string) { return process.env[key] ?? def ?? ''; }

const TOKEN = getEnv('MEMORY_HTTP_TOKEN', 'dev-memory-token-12345');

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url || '', true);
  const method = req.method || 'GET';
  const send = (code: number, body: any) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };

  if (method === 'GET' && parsed.pathname === '/health') {
    return send(200, { ok: true, driver: getEnv('MEMORY_HTTP_DRIVER', 'sqlite') });
  }

  if (parsed.pathname?.startsWith('/tools/')) {
    const auth = req.headers['authorization'] || '';
    if (!auth || !auth.toString().startsWith('Bearer ') || auth.toString().slice(7) !== TOKEN) {
      return send(401, { ok: false, error: 'Unauthorized: set MEMORY_HTTP_TOKEN and use Authorization: Bearer <token>' });
    }
    // No-op template server. Implementations live in dist/claudex.cjs runtime.
    return send(200, { ok: true, note: 'Template server only. Use claudex embedded server.' });
  }

  send(404, { ok: false, error: 'Not Found' });
});

const listenUrl = new URL(getEnv('MEMORY_HTTP_URL', 'http://127.0.0.1:8787'));
server.listen(Number(listenUrl.port), listenUrl.hostname, () => {
  console.log(`[claudex-template] Memory HTTP listening on ${listenUrl.href}`);
});

