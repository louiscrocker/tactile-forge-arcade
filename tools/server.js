// =====================================================
// Tactile Forge — Last Silo · Zero-dependency static server
// Serves the project over http so ES modules load (file:// blocks them).
//   node server.js            → http://localhost:5177
//   node server.js --port 8080
//   node server.js --root dist   (serve a packaged copy)
// =====================================================

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// --root <dir> serves another folder, e.g. a packaged copy from `npm run package`.
const argRoot = process.argv.indexOf('--root');
const ROOT = argRoot !== -1 && process.argv[argRoot + 1]
  ? resolve(process.argv[argRoot + 1])
  : resolve(fileURLToPath(new URL('.', import.meta.url)));

const argPort = process.argv.indexOf('--port');
const PORT = Number(
  (argPort !== -1 && process.argv[argPort + 1]) || process.env.PORT || 5177
);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.map':  'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
};

/** Resolve a URL path to a file inside ROOT, or null if it escapes the root. */
function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = normalize(decoded).replace(/^([/\\])+/, '');
  const abs = resolve(ROOT, rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + sep)) return null;
  return abs;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method Not Allowed');
      return;
    }

    let file = safePath(req.url || '/');
    if (!file) { res.writeHead(403).end('Forbidden'); return; }

    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) { res.writeHead(404).end('Not Found'); return; }

    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      // The game is fully client-side; never let a stale module linger in dev.
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (err) {
    res.writeHead(500).end(`Server error: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`Tactile Forge — Last Silo running at http://localhost:${PORT} (serving ${ROOT})`);
});
