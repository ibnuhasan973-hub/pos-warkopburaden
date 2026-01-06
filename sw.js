const CACHE_NAME = 'pos-warkop-v5-icons-fix';

// Daftar file UTAMA yang wajib ada (File lokal)
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
  // Icon gambar lokal jika ada, masukkan disini:
  // './warkop.png' 
];

// 1. Install Service Worker
self.addEventListener('install', (event) => {
  console.log('SW: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        urlsToCache.map((url) => {
          return cache.add(url).catch((err) => {
            console.log('SW: Gagal cache file lokal (mungkin belum ada):', url);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// 2. Activate & Bersihkan Cache Lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Hapus cache lama', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch (Logika Pintar: Cache First + Simpan CDN/External)
self.addEventListener('fetch', (event) => {
  
  // Abaikan request selain GET (misal POST ke Google Sheet)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // A. Kalau ada di cache, pakai itu.
      if (cachedResponse) {
        return cachedResponse;
      }

      // B. Kalau tidak ada, ambil dari internet
      return fetch(event.request).then((networkResponse) => {
        // Cek apakah download berhasil
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // --- BAGIAN PENTING UNTUK ICON HILANG ---
        // Kita simpan file tersebut ke cache, TERMASUK file dari CDN (Tailwind/FontAwesome)
        // Clone response karena response stream hanya bisa dibaca sekali
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // C. Kalau internet mati dan tidak ada di cache
        console.log('SW: Offline dan file tidak ditemukan:', event.request.url);
        // Opsional: Bisa return halaman offline khusus di sini
      });
    })
  );
});

