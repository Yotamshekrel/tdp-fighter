import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { handleRoom, memoryStore } from './api/_room-core.js';
import { iceServers } from './api/_ice.js';

// Dev-only helper: POST a canvas dataURL to /__shot?name=foo and it is saved
// as tools/shots/foo.png (used for automated visual checks during development).
const shots = {
  name: 'dev-shots',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__shot', (req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const name = new URL(req.url, 'http://x').searchParams.get('name') || 'shot';
        mkdirSync('tools/shots', { recursive: true });
        writeFileSync(`tools/shots/${name.replace(/[^\w-]/g, '_')}.png`, Buffer.from(body.split(',')[1], 'base64'));
        res.end('ok');
      });
    });
  },
};

// Dev-only: the online-play signaling endpoint with rooms kept in memory, so two browser tabs can
// play each other without a database (production uses api/room.js on Vercel).
const rooms = {
  name: 'dev-rooms',
  apply: 'serve',
  configureServer(server) {
    const store = memoryStore();
    server.middlewares.use('/api/room', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch { /* bad body */ }
        if (parsed?.a === 'ice') {
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ iceServers: await iceServers(process.env) }));
        }
        const { status, json } = await handleRoom(store, parsed);
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(json));
      });
    });
  },
};

// Relative base so the built game works from any folder / static host.
export default defineConfig({
  base: './',
  plugins: [shots, rooms],
  server: { host: true, port: 5173 },
  build: { target: 'es2020', assetsInlineLimit: 0 },
});
