// Tahtaya At Pro – Production PWA Service Worker (v4)
// Network-First for HTML, bypasses Vite dev modules completely, Cache-First strictly for production hashed bundles & icons
const CACHE_NAME = 'tahtaya-at-pro-v4';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable.svg',
];

const isDevHost = () => {
  const host = self.location.hostname || '';
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('ais-dev-');
};

self.addEventListener('install', (event) => {
  if (!isDevHost()) {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
    );
  }
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => isDevHost() || k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (isDevHost()) {
    return;
  }

  const { request } = event;
  const url = new URL(request.url);

  // Let WebRTC, streaming media, non-GET, external CDN, and Vite dev modules pass straight through
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.searchParams.has('t') ||
    request.url.includes('peerjs')
  ) {
    return;
  }

  // Network-First for HTML navigation requests
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-First strictly for Vite production /assets/ bundles and static icons
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  }
});
