import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

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

// Relative base so the built game works from any folder / static host.
export default defineConfig({
  base: './',
  plugins: [shots],
  server: { host: true, port: 5173 },
  build: { target: 'es2020', assetsInlineLimit: 0 },
});
