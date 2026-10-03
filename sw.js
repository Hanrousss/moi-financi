const CACHE='moi-dengi-private-v1.2.5';
const CORE=['./','./index.html','./styles.css?v=1.2.5','./app.bundle.js?v=1.2.5','./app.js','./model.js','./storage.js','./manifest.webmanifest','./icons/favicon.png?v=1.2.5','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png?v=1.2.5','./icons/pet-face.png','./icons/profile-avatar.jpg','./icons/universal/01-navigation/food.png','./icons/universal/01-navigation/home.png','./icons/universal/01-navigation/month.png','./icons/universal/01-navigation/payments.png','./icons/universal/01-navigation/pet.png','./icons/universal/01-navigation/purchases.png','./icons/universal/01-navigation/savings.png','./icons/universal/01-navigation/settings.png','./icons/universal/02-categories/01-food.png','./icons/universal/02-categories/02-everyday.png','./icons/universal/02-categories/03-sport.png','./icons/universal/02-categories/04-pet.png','./icons/universal/02-categories/05-beauty.png','./icons/universal/02-categories/06-health.png','./icons/universal/02-categories/07-clothing.png','./icons/universal/02-categories/08-gifts.png','./icons/universal/02-categories/09-leisure.png','./icons/universal/02-categories/10-home.png','./icons/universal/02-categories/11-hobby.png','./icons/universal/02-categories/12-unexpected.png','./icons/universal/03-safety/safety.png','./icons/universal/04-avatar/pet-avatar.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('moi-dengi-private-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));return response}).catch(()=>caches.match('./index.html')));
    return;
  }
  // Versioned application assets always come from the same installed build.
  // Mixing a newer HTML page with an older bundle can change calculations.
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(event.request);
    if(cached)return cached;
    const response=await fetch(event.request);
    if(response.ok)await cache.put(event.request,response.clone());
    return response;
  }));
});
