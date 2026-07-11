const DB_NAME='personal-budget-private-v1';
const STORE='state';
const KEY='app';
const FALLBACK_KEY='personal-budget-private-v1-state';
const OLD_KEYS=[];

function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
export async function loadState(){
  try{const db=await openDB();const value=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get(KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});if(value)return value}catch{}
  try{const fallback=localStorage.getItem(FALLBACK_KEY);if(fallback)return JSON.parse(fallback)}catch{}
  return null;
}
export async function saveState(state){
  try{localStorage.setItem(FALLBACK_KEY,JSON.stringify(state))}catch{}
  try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(state,KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}catch{}
}
export function findLegacyState(){for(const key of OLD_KEYS){try{const raw=localStorage.getItem(key);if(raw)return JSON.parse(raw)}catch{}}return null}
export async function clearState(){try{localStorage.removeItem(FALLBACK_KEY)}catch{};try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}catch{}}
