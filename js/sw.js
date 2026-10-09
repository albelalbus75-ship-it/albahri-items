const VERSION = 'albahri-v2.0.0';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  // CSS
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/cards.css',
  './css/forms.css',
  './css/modals.css',
  './css/responsive.css',
  // JS
  './js/utils.js',
  './js/database.js',
  './js/firestore.js',
  './js/auth.js',
  './js/permissions.js',
  './js/audit.js',
  './js/settings.js',
  './js/ui.js',
  './js/search.js',
  './js/items.js',
  './js/qr.js',
  './js/barcode.js',
  './js/stocktake.js',
  './js/csv.js',
  './js/users.js',
  './js/app.js',
  // Icons
  './assets/icons/icon-72.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-128.png',
  './assets/icons/icon-144.png',
  './assets/icons/icon-152.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-384.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png'
];

// تثبيت: تحميل كل الملفات في الكاش
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('SW install warning:', err))
  );
});

// تنشيط: حذف الكاشات القديمة
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// جلب: Cache First دائماً (يعمل بدون إنترنت)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Firebase / CDN: Network First مع fallback للكاش
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('jsdelivr')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const copy = r.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // الملفات المحلية: Cache First (يعمل بدون إنترنت)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        // لا تخزّن استجابات الفشل
        if (!r || r.status !== 200 || r.type === 'opaque') return r;
        const copy = r.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => {
        // إذا فشل كل شيء، أرجع الصفحة الرئيسية
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// رسالة تحديث
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
