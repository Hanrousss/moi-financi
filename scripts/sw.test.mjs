import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
function worker(){
  const handlers={},deleted=[];
  let networkCalls=0,responded,waiting;
  const current=source.match(/const CACHE='([^']+)'/)[1];
  const cache={match:async()=>new Response('cached bundle'),put:async()=>{},addAll:async()=>{}};
  const context=vm.createContext({URL,Response,
    self:{location:{origin:'https://example.com'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,handler)=>handlers[name]=handler},
    caches:{open:async()=>cache,keys:async()=>[current,'moi-dengi-private-v1.0.48','other-app-cache'],delete:async key=>deleted.push(key),match:async()=>new Response('offline index')},
    fetch:async()=>{networkCalls++;throw new Error('offline');}
  });
  vm.runInContext(source,context);
  return {handlers,deleted,get networkCalls(){return networkCalls;},
    activate:async()=>{handlers.activate({waitUntil:value=>waiting=value});await waiting;},
    request:async(mode='cors',method='GET',url='https://example.com/app.bundle.js')=>{
      responded=undefined;
      handlers.fetch({request:{mode,method,url},respondWith:value=>responded=value});
      return responded&&await (await responded).text();
    }
  };
}
test('the installed bundle is served from its release cache even without a network',async()=>{
  const w=worker();
  assert.equal(await w.request(),'cached bundle');
  assert.equal(w.networkCalls,0);
});
test('navigation falls back to the saved HTML when offline',async()=>{
  const w=worker();
  assert.equal(await w.request('navigate'),'offline index');
});
test('service worker activation preserves other applications caches on the same origin',async()=>{
  const w=worker();await w.activate();
  assert.deepEqual(w.deleted,['moi-dengi-private-v1.0.48']);
});
test('cross-origin and non-GET requests are not intercepted',async()=>{
  const w=worker();
  assert.equal(await w.request('cors','POST'),undefined);
  assert.equal(await w.request('cors','GET','https://other.example.com/image'),undefined);
});
