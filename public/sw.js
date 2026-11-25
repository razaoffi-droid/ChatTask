/**
 * ChatTask Progressive Web App (PWA) Service Worker
 * Version: 1.0.0
 * 
 * SECURITY MANDATE:
 * - NEVER cache authenticated API responses, tokens, E2EE keys, or private payloads.
 * - Cache ONLY static app shell assets (HTML, CSS, JS, Fonts, Icons) and offline fallback.
 */

const CACHE_VERSION = 'chattask-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Core static assets required for the app shell and offline experience
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/favicon.png',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png'
];

// Patterns that MUST NEVER be cached under any circumstances
const SENSITIVE_URL_PATTERNS = [
  /\/api\//i,
  /\/dms-api\//i,
  /\/socket\.io\//i,
  /\/auth\//i,
  /\/messages\//i,
  /\/keys\//i,
  /\/encryption\//i,
  /\/tasks\/proof\//i
];

/* ==========================================================================
   1. INSTALL EVENT — Precache Application Shell
   ========================================================================== */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Precache assets with individual error catch so one failure doesn't abort install
      return Promise.allSettled(
        PRECACHE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`[ChatTask SW] Failed to precache ${asset}:`, err);
          })
        )
      );
    }).then(() => {
      // Activate worker immediately
      return self.skipWaiting();
    })
  );
});

/* ==========================================================================
   2. ACTIVATE EVENT — Clean Up Obsolete Caches
   ========================================================================== */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== RUNTIME_CACHE) {
            console.log(`[ChatTask SW] Purging obsolete cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all open pages immediately
      return self.clients.claim();
    })
  );
});

/* ==========================================================================
   3. FETCH EVENT — Security-First Routing
   ========================================================================== */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Non-GET requests (POST, PUT, DELETE, PATCH): ALWAYS Network Only
  if (req.method !== 'GET') {
    return;
  }

  // 2. Sensitive APIs, Authentication, Sockets, E2EE: STRICTLY Network Only
  const isSensitive = SENSITIVE_URL_PATTERNS.some((pattern) => pattern.test(url.pathname));
  if (isSensitive) {
    return;
  }

  // 3. Navigation Requests (HTML Pages) — Network-First with Offline Fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(req, resClone);
            });
          }
          return networkRes;
        })
        .catch(async () => {
          // If offline, attempt to serve cached page or fallback to /offline.html
          const cachedPage = await caches.match(req);
          if (cachedPage) return cachedPage;

          const shellIndex = await caches.match('/index.html');
          if (shellIndex) return shellIndex;

          const offlineFallback = await caches.match('/offline.html');
          if (offlineFallback) return offlineFallback;

          return new Response('Offline - No connection available', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // 4. Static Assets (Scripts, Styles, Images, Fonts) — Stale-While-Revalidate
  const isStaticAsset =
    url.origin === self.location.origin &&
    (/\.(js|css|png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|eot)$/i.test(url.pathname) ||
     url.pathname.startsWith('/assets/') ||
     url.pathname.startsWith('/icons/'));

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cachedRes) => {
        const fetchPromise = fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(req, resClone);
            });
          }
          return networkRes;
        }).catch(() => null);

        // Return cached resource immediately if available, otherwise wait for network
        return cachedRes || fetchPromise;
      })
    );
    return;
  }

  // 5. Default fallback for other GET requests: Network with Cache Fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

/* ==========================================================================
   4. PUSH EVENT — Web Push Notifications Handler
   ========================================================================== */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    let payload = {};
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'ChatTask', body: event.data.text() };
    }

    const title = payload.title || 'ChatTask';
    const options = {
      body: payload.body || 'New update in ChatTask',
      icon: payload.icon || '/icons/icon-192.png',
      badge: payload.badge || '/icons/icon-192.png',
      vibrate: [100, 50, 100],
      tag: payload.tag || `chattask-notif-${Date.now()}`,
      renotify: true,
      requireInteraction: Boolean(payload.requireInteraction),
      data: {
        url: payload.url || '/',
        chatId: payload.chatId || null,
        taskId: payload.taskId || null,
        tab: payload.tab || 'chats',
        timestamp: Date.now()
      },
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[ChatTask SW] Error handling push event:', err);
  }
});

/* ==========================================================================
   5. NOTIFICATION CLICK EVENT — Smart Navigation
   ========================================================================== */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || '/';

  // Build target deep-link query if specific chat or task is targeted
  if (notifData.chatId) {
    targetUrl = `/?tab=chats&chatId=${encodeURIComponent(notifData.chatId)}`;
  } else if (notifData.taskId) {
    targetUrl = `/?tab=tasks&taskId=${encodeURIComponent(notifData.taskId)}`;
  } else if (notifData.tab) {
    targetUrl = `/?tab=${encodeURIComponent(notifData.tab)}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if an existing ChatTask window is already open
      for (const client of clientList) {
        if ('focus' in client) {
          // Send navigation message to existing window
          client.postMessage({
            type: 'NAVIGATE_TO',
            chatId: notifData.chatId,
            taskId: notifData.taskId,
            tab: notifData.tab
          });
          return client.focus();
        }
      }
      // If no window is currently open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

/* ==========================================================================
   6. CLIENT MESSAGE LISTENER (Skip Waiting & Foreground Notifications)
   ========================================================================== */
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Allow web client to dispatch a background system notification via SW
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    if (self.registration && self.registration.showNotification) {
      self.registration.showNotification(title || 'ChatTask', {
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        ...options
      });
    }
  }
});
