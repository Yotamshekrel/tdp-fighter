// Minimal offline cache: cache-first for everything the game requests (refreshed in the background).
// Bump CACHE when files that keep their name change (the fighter art in fighters/), so players get the new ones.
const CACHE = 'tdp-fighter-v4';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tdp-fighter-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()),
));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Never cache live data or the admin page.
  const path = new URL(e.request.url).pathname;
  if (path.includes('/api/') || path.includes('/admin')) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(e.request);
      const net = fetch(e.request).then((res) => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});
