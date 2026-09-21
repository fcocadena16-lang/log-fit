const APP_VERSION = '11.18';
const CACHE = 'fit-log-shell-v11.18-exercise-catalog';
const CACHE_PREFIX = 'fit-log-shell-';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=11.18',
  './app.js?v=11.18',
  './manifest.json',
  './version.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // Guarda una copia fresca del shell para que la app pueda arrancar sin red.
    await Promise.all(
      APP_SHELL.map(url => cache.add(new Request(url, {cache:'reload'})))
    );

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    // Solo elimina cachés antiguas de Fit Log; no toca otras PWA del mismo dominio.
    await Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({version: APP_VERSION});
  }
});

async function updateStableCopy(cache, key, request) {
  try {
    const response = await fetch(new Request(request, {cache:'no-store'}));
    if (response && response.ok) {
      await cache.put(key, response.clone());
      return response;
    }
  } catch (_) {}
  return null;
}

async function navigationResponse(request) {
  const cache = await caches.open(CACHE);

  // Abrir primero desde la copia local evita depender de una conexión móvil parcial.
  const cached =
    await cache.match('./index.html') ||
    await cache.match('./');

  if (cached) {
    // Si hay red, refresca index.html en segundo plano sin retrasar la apertura.
    updateStableCopy(cache, './index.html', request).catch(() => {});
    return cached;
  }

  // Primera apertura: intenta red y deja index.html guardado bajo una URL estable.
  try {
    const response = await fetch(new Request(request, {cache:'no-store'}));
    if (response && response.ok) {
      await cache.put('./index.html', response.clone());
    }
    return response;
  } catch (_) {
    return new Response('Fit Log no está disponible sin conexión todavía.', {
      status:503,
      statusText:'Offline',
      headers:{'Content-Type':'text/plain; charset=utf-8'}
    });
  }
}

async function resourceResponse(request) {
  const cache = await caches.open(CACHE);

  // ignoreSearch permite usar app.js/styles.css aunque la URL lleve ?v=...
  const cached = await cache.match(request, {ignoreSearch:true});

  if (cached) {
    // Entrega inmediatamente la copia local y actualiza en segundo plano cuando pueda.
    fetch(request)
      .then(async response => {
        if (response && response.ok) await cache.put(request, response.clone());
      })
      .catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (_) {
    return new Response('', {status:503, statusText:'Offline'});
  }
}

async function versionResponse(request) {
  const cache = await caches.open(CACHE);

  // version.json sí intenta red primero para que "Buscar actualización" siga funcionando.
  try {
    const response = await fetch(new Request(request, {cache:'no-store'}));
    if (response && response.ok) {
      await cache.put('./version.json', response.clone());
    }
    return response;
  } catch (_) {
    return (
      await cache.match('./version.json', {ignoreSearch:true}) ||
      new Response(JSON.stringify({version:APP_VERSION}), {
        headers:{'Content-Type':'application/json'}
      })
    );
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(versionResponse(request));
    return;
  }

  event.respondWith(resourceResponse(request));
});
