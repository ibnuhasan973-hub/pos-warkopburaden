// Ganti nama cache biar browser tahu ada update (misal jadi v3)
const CACHE_NAME = 'pos-warkop-v3-fix'; 

const urlsToCache = [
  './',                // Ganti '/' jadi './'
  './index.html',      // Ganti '/index.html' jadi './index.html'
  './style.css',       // Ganti '/style.css' jadi './style.css'
  './script.js',       // Ganti '/script.js' jadi './script.js'
  // Link eksternal (CDN) biarkan saja karena dia link lengkap
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// ... (Sisa kodingan ke bawah biarkan sama persis seperti sebelumnya)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Membuka cache...');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
