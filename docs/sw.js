var CACHE = 'ghms-shell-v1';
var SHELL = ['./','./manifest.json','./icon.svg'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  // Never intercept GAS API calls — always go to network
  if (e.request.url.indexOf('script.google.com') !== -1 ||
      e.request.url.indexOf('googleusercontent.com') !== -1) return;
  e.respondWith(
    caches.match(e.request).then(function(cached){ return cached || fetch(e.request); })
  );
});
