// ============================================================
// AUMATIQ Personal Productivity OS — Service Worker (sw.js)
// Version: aumatiq-pos-v1
//
// Cache update rule:
//   index.html বা কোনো file update করলে CACHE_NAME version বাড়াও:
//   'aumatiq-pos-v1' → 'aumatiq-pos-v2'
//   পুরনো cache auto-delete হবে, নতুন cache নেবে।
// ============================================================

var CACHE_NAME = 'aumatiq-pos-v1';

var APP_SHELL_FILES = [
  './index.html',
  './manifest.json'
];

// ── INSTALL: App shell cache করো ──
self.addEventListener('install', function(event) {
  console.log('[AUMATIQ POS SW] Installing v1...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[AUMATIQ POS SW] Caching app shell');
        return cache.addAll(APP_SHELL_FILES);
      })
      .then(function() {
        return self.skipWaiting();
      })
      .catch(function(err) {
        console.error('[AUMATIQ POS SW] Install failed:', err);
      })
  );
});

// ── ACTIVATE: পুরনো cache মুছে দাও ──
self.addEventListener('activate', function(event) {
  console.log('[AUMATIQ POS SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME) {
              console.log('[AUMATIQ POS SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

// ── FETCH: Request interceptor ──
self.addEventListener('fetch', function(event) {
  var requestUrl = event.request.url;

  // Google Apps Script API → Network First (data সবসময় fresh থাকা জরুরি)
  if (requestUrl.includes('script.google.com') ||
      requestUrl.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request)
        .catch(function() {
          return new Response(
            JSON.stringify({ success: false, error: 'Offline — network unavailable' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Google Fonts → Network First with cache fallback
  if (requestUrl.includes('fonts.googleapis.com') ||
      requestUrl.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
          return response;
        })
        .catch(function() { return caches.match(event.request); })
    );
    return;
  }

  // App Shell → Cache First, fallback to network
  event.respondWith(
    caches.match(event.request)
      .then(function(cached) {
        if (cached) return cached;
        return fetch(event.request)
          .then(function(response) {
            if (response && response.status === 200) {
              var clone = response.clone();
              caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
            }
            return response;
          })
          .catch(function() {
            return caches.match('./index.html');
          });
      })
  );
});

// ── MESSAGE: Force update ──
self.addEventListener('message', function(event) {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
