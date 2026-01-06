const CACHE_NAME = 'pos-warkop-v4-debug'; 

// Daftar file prioritas
const urlsToCache = [
  './', 
  './index.html',
  './style.css', 
  './script.js' 
  // Link CDN kita hapus dulu dari "Wajib Cache" agar tidak bikin error saat install
];

// 1. Install Service Worker (Versi Kebal Error)
self.addEventListener('install', (event) => {
  console.log('SW: Mencoba menginstall...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Kita coba tambahkan satu per satu agar ketahuan mana yang error di console
      // dan tidak membatalkan seluruh proses
      return Promise.all(
        urlsToCache.map((url) => {
          return cache.add(url).catch((err) => {
            console.error('SW: Gagal cache file ini:', url, err);
          });
        })
      );
    })
  );
  // Paksa SW baru untuk segera aktif
  self.skipWaiting();
});

// 2. Activate & Hapus Cache Lama
self.addEventListener('activate', (event) => {
  console.log('SW: Aktif!');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Agar SW langsung mengontrol halaman tanpa perlu refresh 2x
  self.clients.claim();
});

// 3. Fetch (Strategi: Cache First, Network Fallback)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Kalau ada di cache, berikan
      if (response) {
        return response;
      }
      
      // Kalau tidak ada di cache, ambil dari internet
      return fetch(event.request).then((networkResponse) => {
          // Opsional: Simpan file yang baru diambil dari internet ke cache secara otomatis
          // agar kunjungan berikutnya bisa offline
          return caches.open(CACHE_NAME).then((cache) => {
             // Cek validitas response sebelum simpan
             if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                 return networkResponse;
             }
             cache.put(event.request, networkResponse.clone());
             return networkResponse;
          });
      }).catch(() => {
          // Kalau internet mati dan tidak ada di cache
          console.log('SW: Offline dan file tidak ada di cache:', event.request.url);
      });
    })
  );
});
