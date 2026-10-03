const DB_NAME='personal-budget-private-v1';
const STORE='state';
const KEY='app';
const FALLBACK_KEY='personal-budget-private-v1-state';
const STORAGE_KIND='moi-dengi-storage';
let lastRevision=0;

function openDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
function storedValue(value){
  if(value?.kind===STORAGE_KIND)return {state:value.state,revision:Number(value.revision)||0};
  if(!value)return null;
  const {__storageRevision=0,__storageDeleted=false,...state}=value;
  return {state:__storageDeleted?null:state,revision:Number(__storageRevision)||0};
}
async function readDatabase(){
  const db=await openDB();
  try{
    return await new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readonly');
      const request=transaction.objectStore(STORE).get(KEY);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error);
      transaction.onabort=()=>reject(transaction.error||new Error('Хранилище недоступно'));
    });
  }finally{db.close();}
}
async function writeDatabase(value){
  const db=await openDB();
  try{
    await new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readwrite');
      transaction.objectStore(STORE).put(value,KEY);
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error||new Error('Не удалось сохранить данные'));
    });
  }finally{db.close();}
}
export async function loadState(){
  let database=null,fallback=null;
  try{database=storedValue(await readDatabase());}catch{}
  try{fallback=storedValue(JSON.parse(localStorage.getItem(FALLBACK_KEY)||'null'));}catch{}
  const newest=[database,fallback].filter(Boolean).sort((a,b)=>b.revision-a.revision)[0];
  lastRevision=newest?.revision||0;
  return newest?.state||null;
}
export async function saveState(state){
  const snapshot=JSON.parse(JSON.stringify(state));
  const revision=Math.max(Date.now(),lastRevision+1);
  // Keep the existing top-level state shape readable by earlier app builds.
  const value=snapshot?{...snapshot,__storageRevision:revision}:{__storageRevision:revision,__storageDeleted:true};
  lastRevision=revision;
  let saved=false;
  try{localStorage.setItem(FALLBACK_KEY,JSON.stringify(value));saved=true;}catch{}
  try{await writeDatabase(value);saved=true;}catch{}
  if(!saved)throw new Error('Оба локальных хранилища недоступны');
}
export async function clearState(){
  // An empty copy with a revision prevents an unavailable, older store from
  // resurrecting deleted data after a later reload.
  await saveState(null);
}
