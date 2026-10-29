self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // A simple pass-through fetch handler is enough to trigger the PWA prompt in Chrome
  // We're just returning the fetch result.
  e.respondWith(fetch(e.request).catch(() => new Response("Offline")));
});
