/* ScanNest Service Worker for Calm Offline-First Execution */

const CACHE_NAME = 'scannest-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

// Install Event - Pre-cache essential offline UI structures
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ScanNest Service Worker] Pre-caching static skeleton app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clear previous versions safely
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ScanNest Service Worker] Purging legacy cache: ', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Serve cached assets when offline instantly
self.addEventListener('fetch', (event) => {
  // Only intercept HTTP/HTTPS GET requests (avoids breaking internal dev servers / websockets)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Verify valid response before adding to cache sandbox
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Clone and cache the resource dynamically for offline persistence
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Return a standard placeholder or let browser trigger offline state gracefully
          console.warn('[ScanNest Service Worker] Fetch failure - asset offline unavailable:', event.request.url);
        });
    })
  );
});
