/* ═══════════ Service Worker — تخزين محلي كامل ═══════════ */
const CACHE_NAME = 'albahri-items-v2';
const CACHE_URLS = [
  './',
  './index.html',
  './index.html?action=add',
  './index.html?action=stocktake',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Cairo:wght@400;600;700;800;900&display=swap'
];

/* تثبيت — تخزين كل الملفات */
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Skip:', url, err.message))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* تنشيط — حذف الكاشات القديمة */
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* جلب — Cache First ثم Network */
self.addEventListener('fetch', event => {
  const req = event.request;
  
  // تجاهل الطلبات غير GET
  if(req.method !== 'GET') return;
  
  // تجاهل طلبات Apps Script (يجب أن تصل للسحابة مباشرة)
  if(req.url.includes('script.google.com')) return;
  
  // تجاهل الطلبات لنطاقات أخرى غير مخزّنة
  if(!req.url.startsWith(self.location.origin) &&
     !req.url.includes('cdn.jsdelivr.net') &&
     !req.url.includes('unpkg.com') &&
     !req.url.includes('fonts.googleapis.com') &&
     !req.url.includes('fonts.gstatic.com')){
    return;
  }
  
  event.respondWith(
    caches.match(req).then(cached => {
      // ✅ موجود في الكاش → استخدمه فوراً
      if(cached) return cached;
      
      // غير موجود → حمّل من الشبكة وخزّنه
      return fetch(req).then(res => {
        if(!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        return res;
      }).catch(() => {
        // فشل الشبكة + لا يوجد كاش → صفحة بديلة
        if(req.mode === 'navigate'){
          return caches.match('./index.html');
        }
        return new Response('Offline', {status: 503});
      });
    })
  );
});

/* استقبال رسائل من الصفحة */
self.addEventListener('message', event => {
  if(event.data === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
