// A "service worker" is a special script the browser runs in the
// background, separately from the page itself, that can intercept network
// requests. This is what makes offline support and "Add to Home Screen"
// installability possible - without one, the app would need a live
// internet connection every time it's opened.
//
// This one implements a simple "cache-first" strategy: try the offline
// cache before the network, so the app loads instantly and still works
// with no connection.

// Bumping this name creates a brand-new cache and triggers the `activate`
// cleanup below to delete the old one. IMPORTANT: whenever a file in
// ASSETS changes, or a new file is added to the app, this name MUST be
// bumped (e.g. 'final-countdown-v2') - otherwise browsers that already
// installed this service worker will keep serving the old cached files
// forever and never see the update (see CLAUDE.md).
const CACHE_NAME = 'final-countdown-v2';

// Every file the app needs to keep working fully offline. Anything not
// listed here won't be available offline (and won't be updated
// automatically) - see CLAUDE.md's note about updating this list whenever
// a new static file is added to the project.
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/storage.js',
  './js/countdown.js',
  './js/render.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Fired once, when the service worker is first installed (or updated to a
// new version). We pre-download and store every file in ASSETS into a
// named Cache Storage bucket, so they're available even with no network.
self.addEventListener('install', (event) => {
  event.waitUntil(
    // waitUntil tells the browser "don't consider install finished until
    // this promise resolves" - it keeps the worker alive long enough to
    // finish caching before moving on.
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
    // skipWaiting activates this new service worker immediately instead
    // of waiting for all open tabs of the app to be closed first.
  );
});

// Fired after install, when this service worker takes control. Used here
// to clean up: delete any caches left over from a previous CACHE_NAME
// version, so old/stale files don't pile up in storage.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // clients.claim lets this service worker start controlling any
      // already-open tabs immediately, rather than only new ones.
  );
});

// Fired for every network request the page makes (loading the HTML, JS,
// images, etc.). This is the actual "cache-first" logic.
self.addEventListener('fetch', (event) => {
  // Only intercept simple GET requests (reads); anything else (like a
  // future POST to a server) should just go straight to the network.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    // respondWith lets us supply our own Promise<Response> instead of
    // letting the request go directly to the network.
    caches.match(event.request).then((cached) => {
      // If we already have this exact request cached, serve it instantly
      // without touching the network at all.
      if (cached) return cached;

      // Otherwise, fetch it from the network as normal...
      return fetch(event.request)
        .then((response) => {
          // ...and opportunistically save a copy for next time. Responses
          // can only be read once, so we clone it: one copy goes into the
          // cache, the other is returned to the page.
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        // If the network request fails entirely (fully offline, and this
        // wasn't already cached), fall back to whatever `cached` was
        // (which will be undefined here, meaning the request just fails -
        // this mainly protects against throwing an unhandled error).
        .catch(() => cached);
    })
  );
});
