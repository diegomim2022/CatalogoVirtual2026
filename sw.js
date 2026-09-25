// Service Worker — Catálogo Digital de Pedidos
const CACHE_NAME = 'catalogo-v3.4';
const STATIC_ASSETS = [
    './',
    'index.html',
    'styles.css',
    'js/main.js',
    'js/auth.js',
    'js/admin.js',
    'js/data.js',
    'js/cart.js',
    'js/orders.js',
    'js/zoom.js',
    'js/catalog.js',
    'js/detail.js',
    'nano.js',
    'LogoMas.png',
    'manifest.json'
];

// Install: cache static assets and skip waiting
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean up old caches and claim clients immediately
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

// Fetch: strategy selection
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);

    // Don't intercept Google Drive direct media downloads/videos
    if (url.hostname === 'drive.usercontent.google.com' ||
        (url.hostname === 'drive.google.com' && url.searchParams.get('export') === 'download')) {
        return;
    }

    // 1. NUNCA cachear respuestas de Google Sheets ni APIs (siempre red)
    if (url.hostname === 'docs.google.com' || url.hostname === 'script.google.com') {
        event.respondWith(fetch(event.request));
        return;
    }

    // 2. Network-first para navegación/HTML, .js y .css
    const isHtml = event.request.mode === 'navigate' ||
                   url.pathname.endsWith('/') ||
                   url.pathname.endsWith('.html');
    const isCode = url.pathname.endsWith('.js') ||
                   url.pathname.endsWith('.css') ||
                   event.request.destination === 'script' ||
                   event.request.destination === 'style';

    if (isHtml || isCode) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match(event.request);
                    if (cached) return cached;
                    if (isHtml) return caches.match('index.html');
                })
        );
        return;
    }

    // 3. Cache-first solo para imágenes, videos, íconos y fuentes
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                const isGoogleDrive = url.hostname.includes('drive.google.com') || 
                                      url.hostname.includes('lh3.googleusercontent.com');
                
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
