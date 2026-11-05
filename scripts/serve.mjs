import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './build-addon.mjs';
const root = path.join(ROOT, 'dist');
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + (pathname === '/' ? '/manifest.json' : pathname));
    if (!target.startsWith(root + path.sep)) return res.writeHead(403).end();
    const body = await readFile(target);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(body);
  } catch { res.writeHead(404).end('{}'); }
}).listen(Number(process.env.PORT || 8081), '127.0.0.1', () => console.log('Add-on: http://127.0.0.1:8081/manifest.json'));
