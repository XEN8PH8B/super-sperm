const CACHE_NAME = 'supersperm-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './main.js',
  './logo.jpg',
  './sperm_head_white.jpg',
  './shoot_btn.jpg',
  './coin.jpg'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Claim all clients immediately
  );
});

// Network-first strategy: always try the network for latest changes, fallback to cache if offline.
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
