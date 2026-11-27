const C='nobtime-v106';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.webmanifest','icon-n-192.png','icon-n-512.png','icon-n-180.png','favicon.svg'])).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).pathname.startsWith('/api/'))return;e.respondWith(fetch(e.request,{cache:'no-store'}).then(x=>{if(x&&(x.ok||x.type==='opaque')){const y=x.clone();caches.open(C).then(c=>c.put(e.request,y))}return x}).catch(()=>caches.match(e.request)))});
