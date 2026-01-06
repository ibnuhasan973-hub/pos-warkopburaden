const CACHE_NAME = 'pos-warkop-v2'; // Ganti v2 jadi v3 kalau ada update kodingan
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  // External Libraries (Dichache biar offline tetap jalan)
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// 1. Install Service Worker & Cache Files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Membuka cache...');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Activate & Hapus Cache Lama
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

// 3. Fetch (Strategi: Cache First, lalu Network)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Jika ada di cache, pakai cache
        }
        return fetch(event.request); // Jika tidak, ambil dari internet
      })
  );
});