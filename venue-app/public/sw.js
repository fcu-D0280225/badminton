// Service Worker for PWA - 館方管理系統
// 改為 network-first：每次部署新版用戶都會拿到最新資源；網路掛掉才回退到 cache。
const CACHE_NAME = 'venue-management-v2-feat016';
const PRECACHE_URLS = ['/', '/styles.css', '/app.js', '/manifest.json'];

self.addEventListener('install', (event) => {
  // 新 SW 立刻接管，避免使用者要關掉所有分頁才生效
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // 刪除所有舊版 cache
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // 只處理 GET，POST/PUT/DELETE 直接走網路
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // /api/* 永遠走網路（API 不該被快取）
  if (url.pathname.startsWith('/api/')) return;

  // network-first：先打網路，失敗才回 cache（離線體驗）
  event.respondWith(
    fetch(req)
      .then((res) => {
        // 同源成功的回應寫回 cache，下次離線可用
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
