// Guarda la app en el teléfono para que funcione sin internet.
// Si cambias index.html, sube el número de versión para forzar la actualización.
const CACHE = 'cotizador-zapatos-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

// cache: 'reload' evita copiar una versión vieja que el navegador tenga guardada
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) =>
    cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
  ));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// La página se pide primero a internet (para ver siempre la última versión)
// y, si no hay conexión o tarda más de 3 segundos, se usa la copia guardada.
function paginaPrimeroRed(request) {
  return caches.open(CACHE).then((cache) => {
    // no-cache: siempre pregunta al servidor si hay una versión nueva
    const red = fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
      if (res && res.ok) cache.put('./index.html', res.clone());
      return res;
    });
    const guardada = () => cache.match('./index.html').then((c) => c || red);
    const espera = new Promise((resolve) => setTimeout(resolve, 3000)).then(guardada);
    return Promise.race([red.catch(guardada), espera]);
  });
}

// El resto (íconos, fuentes) responde desde la copia guardada y la actualiza en segundo plano.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(paginaPrimeroRed(event.request));
    return;
  }
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const network = fetch(event.request)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network;
    })
  );
});
