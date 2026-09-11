// p2a_serve_dist.mjs — Stage C construction tool: serve the production build
// with the exact nginx /app/ → dist/ URL mapping (vite `base: '/app/'` only
// rewrites URLs; it does not create the directory layout, so `vite preview`
// cannot serve this build — nginx does that in production).
// Zero dependencies; HTTP only; dev-only tool, never part of the app.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const PORT = Number(process.argv[2] ?? 5177);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.map': 'application/json',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const rel = urlPath.startsWith('/app/') ? urlPath.slice(5) : urlPath.slice(1);
    const safe = normalize(rel).replace(/^([.][.][/\\])+/, '');
    let file = join(DIST, safe || 'index.html');
    let body;
    try {
      body = await readFile(file);
    } catch {
      file = join(DIST, 'index.html'); // SPA fallback (nginx try_files equivalent)
      body = await readFile(file);
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end('serve error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`P2A static dist server on http://localhost:${PORT} (nginx /app/ mapping equivalent)`);
});
