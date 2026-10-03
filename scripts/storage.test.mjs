import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../storage.js',import.meta.url),'utf8').replace(/^export /gm,'');
function storage({database=null,fallback=null,failDatabase=false,failLocal=false,abortWrite=false}={}){
  const data={database,fallback};
  const context=vm.createContext({Date,JSON,Error,console,
    localStorage:{
      getItem:()=>data.fallback&&JSON.stringify(data.fallback),
      setItem:(_,value)=>{if(failLocal)throw new Error('Quota');data.fallback=JSON.parse(value);}
    },
    indexedDB:{open:()=>{
      const request={};
      queueMicrotask(()=>{
        if(failDatabase){request.error=new Error('Database');request.onerror();return;}
        request.result={close(){},transaction:(_,mode)=>{
          const transaction={error:new Error('Abort'),objectStore:()=>({
            get:()=>{const get={};queueMicrotask(()=>{get.result=structuredClone(data.database);get.onsuccess();});return get;},
            put:value=>{const snapshot=structuredClone(value);queueMicrotask(()=>{if(abortWrite)transaction.onabort();else{data.database=snapshot;transaction.oncomplete();}});}
          })};
          return transaction;
        }};
        request.onsuccess();
      });
      return request;
    }}
  });
  vm.runInContext(source,context);
  return {data,run:code=>vm.runInContext(code,context)};
}

test('legacy raw state still loads from IndexedDB and localStorage',async()=>{
  for(const options of [{database:{version:5,salary:100}},{fallback:{version:5,salary:100},failDatabase:true}]){
    const s=storage(options);
    assert.equal((await s.run('loadState()')).salary,100);
  }
});
test('a newer fallback wins over stale IndexedDB after a failed write',async()=>{
  const s=storage({database:{kind:'moi-dengi-storage',revision:1,state:{salary:100}},fallback:{kind:'moi-dengi-storage',revision:2,state:{salary:200}}});
  assert.equal((await s.run('loadState()')).salary,200);
});
test('saving succeeds if either storage works',async()=>{
  for(const options of [{failDatabase:true},{failLocal:true}]){
    const s=storage(options);
    await s.run('saveState({salary:37.56})');
    assert.equal((await s.run('loadState()')).salary,37.56);
  }
});
test('both unavailable stores report failure instead of claiming success',async()=>{
  const s=storage({failDatabase:true,failLocal:true});
  await assert.rejects(s.run('saveState({salary:100})'),/Оба локальных хранилища/);
});
test('aborted database writes do not hang and fallback remains recoverable',async()=>{
  const s=storage({abortWrite:true});
  await s.run('saveState({salary:100})');
  assert.equal((await s.run('loadState()')).salary,100);
  const failed=storage({abortWrite:true,failLocal:true});
  await assert.rejects(failed.run('saveState({salary:100})'));
});
test('clear writes a newer empty copy that cannot resurrect stale data',async()=>{
  const s=storage({database:{version:5,salary:100},abortWrite:true});
  await s.run('clearState()');
  assert.equal(await s.run('loadState()'),null);
});

test('saved data keeps its original top-level shape for earlier app builds',async()=>{
  const s=storage();
  await s.run('saveState({version:5,settings:{salaryDay:5},salary:100})');
  assert.equal(s.data.database.version,5);
  assert.equal(s.data.fallback.settings.salaryDay,5);
  assert.ok(s.data.database.__storageRevision>0);
  const loaded=await s.run('loadState()');
  assert.equal(loaded.salary,100);
  assert.equal(loaded.__storageRevision,undefined);
});
