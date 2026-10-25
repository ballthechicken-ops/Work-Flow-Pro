/* WorkFlow Pro — Service Worker (v6)
   กลยุทธ์: network-first (ออนไลน์ได้ของใหม่เสมอ) + cache สำรองเมื่อหลุดเน็ต
   ไม่แตะคำขอไป Supabase / คำขอที่ไม่ใช่ GET เลย */
const VER = 'wf-v6-1';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png'];
const CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;
  if (url.origin !== location.origin && !CDN.includes(url.hostname)) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(VER).then(c => c.put(req, cp)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? (caches.match('index.html').then(x => x || caches.match('./'))) : Response.error())))
  );
});
