const CACHE = 'tts-v1';
const ASSETS = [
  './',
  './index.html',
  './settings.html',
  './styles.css',
  './app.js',
  './settings.js',
  './prayerTimes.js',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => k === CACHE ? null : caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});

// Listen for messages from the page to show a notification
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'show-notification') {
    const title = data.title || 'Time to Salat';
    const body = data.body || '';
    const opts = { body, tag: 'tts-upcoming', renotify: true };
    self.registration.showNotification(title, opts);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients && clients.length) {
        clients[0].focus();
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});
