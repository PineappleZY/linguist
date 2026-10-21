/* Linguist — service worker.
 *
 * Scope of caching: the static application shell only. Two hard rules:
 *   1. Anything that is not a same-origin GET is left alone entirely.
 *   2. Any request carrying an Authorization header is left alone entirely.
 *
 * Rule 2 is a security boundary, not an optimisation: api.deepseek.com calls
 * carry the user's own API key, and a cached response would park that key and
 * the generated answer inside Cache Storage, where it would outlive the
 * session. The guard below runs before any cache API is touched.
 *
 * Bump CACHE_VERSION on every release; there is no server-side invalidation.
 */

var CACHE_VERSION = 'v6.5.0';
var CACHE_NAME = 'linguist-' + CACHE_VERSION;

var PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/tokens.css',
  './assets/app.css',
  './js/config.js',
  './js/strings.js',
  './js/prompts.js',
  './js/store.js',
  './js/speech.js',
  './js/ui.js',
  './js/extract.js',
  './js/practice.js',
  './js/api.js',
  './js/pwa.js',
  './js/view-dictionary.js',
  './js/view-document.js',
  './js/view-word.js',
  './js/view-favorites.js',
  './js/view-profile.js',
  './js/tour.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon-180.png',
  /* PDF text extraction, kept for offline use: without these two the File mode
     would work online and fail on a plane, which is exactly when a reader has
     time to read a document. */
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          if (key !== CACHE_NAME) return caches.delete(key);
          return null;
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function isCacheable(request, url) {
  if (request.method !== 'GET') return false;
  if (request.headers && request.headers.has && request.headers.has('authorization')) return false;
  if (url.origin !== self.location.origin) return false;
  return true;
}

function wantsHTML(request) {
  if (request.mode === 'navigate') return true;
  var accept = request.headers && request.headers.get ? request.headers.get('accept') : '';
  return typeof accept === 'string' && accept.indexOf('text/html') > -1;
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);

  /* The guard runs first. If it fails, the browser handles the request
     normally and no cache API is ever reached. */
  if (!isCacheable(request, url)) return;

  if (wantsHTML(request)) {
    event.respondWith(
      caches.match('./index.html').then(function (cached) {
        return cached || fetch(request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        /* Only same-origin, credential-free GETs get here. */
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});
