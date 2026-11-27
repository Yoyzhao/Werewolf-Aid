/* 狼人杀助手 PWA 离线壳；构建时由 scripts/generate-precache.mjs 注入版本与静态资源清单。 */
/* global importScripts */
try {
  importScripts('/precache.js');
} catch {
  // 开发环境没有 precache.js；生产构建会生成。
}

const CACHE_NAME = `lrs-shell-${self.__PRECACHE_VERSION__ || 'v1'}`;
const CORE_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];
const PRECACHE_ASSETS = [...new Set([...CORE_ASSETS, ...(self.__PRECACHE_ASSETS__ || [])])];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('lrs-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

function isCacheableRequest(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  // 不缓存 API、AI 中转与 WebSocket。
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return false;
  return true;
}

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
  }
}

async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!isCacheableRequest(request)) return;

  event.respondWith(request.mode === 'navigate' ? handleNavigation(request) : handleAsset(request));
});
