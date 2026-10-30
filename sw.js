/**
 * BirdLogApp – sw.js
 * Service Worker for offline/PWA support
 */

const CACHE_NAME    = 'birdlog-v1.7-camera-controls-fixed';
const OFFLINE_URL   = '/offline.html';

// Assets to pre-cache on install
const ASSETS_TO_CACHE = [
  '/',
  '/login',
  '/signup',
  '/app',
  '/index.html',
  '/login.css',
  '/auth.js',
  '/user-session.js',
  '/login_bird_panel.jpg',
  '/login_center_sparrow.png',
  '/login_kingfisher.png',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

/* ─── Install: cache all assets ─── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      // Immediately activate – don't wait for old SW to finish
      return self.skipWaiting();
    })
  );
});

/* ─── Activate: clean up old caches ─── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => {
      // Take control of all open pages immediately
      return self.clients.claim();
    })
  );
});

/* ─── Fetch: network-first, fallback to cache ─── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests (e.g. Google Fonts CDN is fine to fail)
  if (request.method !== 'GET') return;

  // For API/backend requests – network only, no cache
  if (url.pathname.startsWith('/save-image') || url.pathname.startsWith('/api/')) {
    return; // let them pass through – no interception
  }

  event.respondWith(
    fetch(request)
      .then(networkResponse => {
        // Cache successful responses from our own origin
        if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed – try cache
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // For HTML navigation requests, serve offline page
          if (request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
          // For everything else, return a minimal error response
          return new Response('Offline – resource not available', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
  );
});
