// POS Service Worker
// Strategija:
// - App shell (HTML, CSS, JS, fonts) — Cache First, nato network
// - API zahteve — Network First, fallback na cache
// - Slike — Cache First z last-modified revalidacijo
// - Offline fallback stran

const CACHE_VERSION = 'pos-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const API_CACHE = `${CACHE_VERSION}-api`
const IMAGE_CACHE = `${CACHE_VERSION}-images`

// Statični resursi za app shell
const APP_SHELL = [
  '/',
  '/login',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/offline.html',
]

// === INSTALL ===
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Cache app shell (ignoriraj napake pri posameznih virih)
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    })
  )
  self.skipWaiting()
})

// === ACTIVATE ===
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// === FETCH ===
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET zahteve
  if (request.method !== 'GET') return

  // Skip chrome-extension in druga protokola
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // WebSocket — ne cachiraj
  if (request.headers.get('upgrade') === 'websocket') return

  // API zahteve — Network First, fallback na cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  // Slike — Cache First z revalidacijo
  if (request.destination === 'image') {
    event.respondWith(cacheFirstRevalidate(request, IMAGE_CACHE))
    return
  }

  // Statični resursi (JS, CSS, fonts) — Cache First
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'manifest'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // HTML dokumenti — Network First z offline fallback
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstWithOfflineFallback(request))
    return
  }

  // Default — Cache First
  event.respondWith(cacheFirst(request, STATIC_CACHE))
})

// === Strategije ===

// Cache First — vrni iz cache, če ne najdeš, gremo v network
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (e) {
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

// Network First — poskusi network, fallback na cache
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (e) {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response(
      JSON.stringify({ error: 'Offline — podatki niso na voljo' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// Cache First z revalidacijo (stale-while-revalidate)
async function cacheFirstRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone())
    return response
  }).catch(() => cached)
  return cached || fetchPromise
}

// Network First z offline fallback stranjo
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request)
    // Cache uspešne navigacije
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch (e) {
    // Poskusi iz cache
    const cache = await caches.open(STATIC_CACHE)
    const cached = await cache.match(request)
    if (cached) return cached
    // Fallback na offline stran
    const offline = await cache.match('/offline.html')
    if (offline) return offline
    return new Response('Offline', { status: 503 })
  }
}

// === MESSAGE ===
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION })
  }
})

// === SYNC (background sync za offline prodaje) ===
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-sales') {
    event.waitUntil(syncPendingSales())
  }
})

async function syncPendingSales() {
  // V prihodnosti: sinhroniziraj offline prodaje, ko se povezava povrne
  console.log('[SW] Background sync: pending sales')
}
