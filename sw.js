const VERSION = 'albahri-v1.0.0';
const CORE = [
  './', './index.html', './manifest.json',
  './css/variables.css','./css/base.css','./css/layout.css','./css/cards.css',
  './css/forms.css','./css/modals.css','./css/responsive.css',
  './js/utils.js','./js/database.js','./js/firestore.js','./js/auth.js',
  './js/permissions.js','./js/audit.js','./js/settings.js','./js/ui.js',
  './js/search.js','./js/items.js','./js/qr.js','./js/barcode.js',
  './js/stocktake.js','./js/csv.js','./js/users.js','./js/app.js',
  './assets/icons/icon-192.png','./assets/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // الشبكة أولاً للـ Firebase والـ CDN
  if (url.hostname.includes('firebase') || url.hostname.includes('gstatic') || url.hostname.includes('jsdelivr')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // الكاش أولاً للملفات المحلية
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});