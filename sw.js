const CACHE_NAME = 'dmdn-shell-v3';
const SHELL = [
  '/',
  '/index.html',
  '/login.html',
  '/cadastro.html',
  '/recuperar-senha.html',
  '/redefinir-senha.html',
  '/convite.html',
  '/css/tokens.css',
  '/css/global.css',
  '/css/marketing.css',
  '/css/auth.css',
  '/css/app.css',
  '/css/invite.css',
  '/css/goals.css',
  '/css/dashboard-goals.css',
  '/assets/logo.svg',
  '/assets/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.hostname.includes('supabase.co') || event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
