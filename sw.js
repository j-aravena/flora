// Service worker: precarga la aplicación y la sirve desde caché. Al subir FLORA_VERSION en version.js se
// instala una caché nueva que se activa en la siguiente apertura y borra la anterior. El paquete inicial
// no pasa por aquí.
importScripts('./version.js');
const VERSION = 'flora-v' + self.FLORA_VERSION;
const ARCHIVOS = [
  './', './index.html', './styles.css', './version.js', './app.js', './db.js', './study.js', './images.js',
  './ui/dom.js', './ui/lista.js', './ui/ficha.js', './ui/editar.js', './ui/estudio.js', './ui/ajustes.js',
  './vendor/dexie.mjs', './vendor/jszip.min.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', evento => {
  if (evento.request.method !== 'GET') return;
  if (new URL(evento.request.url).pathname.endsWith('semilla.zip')) return;
  evento.respondWith(
    caches.match(evento.request, { ignoreSearch: true }).then(respuesta => respuesta || fetch(evento.request)));
});
