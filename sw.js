// Service Worker — Catálogo Digital de Pedidos
const CACHE_NAME = 'catalogo-v2';
const STATIC_ASSETS = [
    './',
    'index.html',
    'styles.css',
    'app.js',
    'LogoMas.png',
    'manifest.json'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: network-first for API calls, cache-first for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Network-first for Google Sheets data
    if (url.hostname === 'docs.google.com') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache a copy of the response
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for static assets and images
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                const isGoogleDrive = url.hostname.includes('drive.google.com') || 
                                    url.hostname.includes('lh3.googleusercontent.com');
                
                // Cache successful responses or opaque responses from Google Drive
                const isCacheable = (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) ||
                                  (isGoogleDrive && response.type === 'opaque');

                if (isCacheable) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
