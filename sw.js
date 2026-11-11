// Network first so updates show up; falls back to the cache when offline.
// Only the app's own files are cached here. The listening model has its own cache (managed by
// Transformers.js), which must never be deleted here.
const CACHE = 'timesdash-v8';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('timesdash-') && k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Cross-origin isolation lets the listening model use several CPU cores (2-3x faster on phones).
// GitHub Pages can't set these headers, so the service worker adds them to the page.
function isolate(r) {
  if (!r || r.status === 0 || r.type === 'opaqueredirect') return r;
  const h = new Headers(r.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'credentialless');
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const nav = req.mode === 'navigate';
  e.respondWith(
    fetch(req)
      .then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return nav ? isolate(r) : r; })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')).then((r) => (nav ? isolate(r) : r)))
  );
});
