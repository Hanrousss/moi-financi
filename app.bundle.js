// Generated fallback bundle for file:// and simple static hosting.

// Source files: model.js, storage.js, app.js

const VERSION = 4;
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const roundMoney = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const toISODate = date => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const parseISODate = value => {
  const [y,m,d] = String(value).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const formatByn = value => `${Number(value || 0).toLocaleString('ru-RU',{maximumFractionDigits:Number.isInteger(Number(value))?0:2})} BYN`;
const formatUsd = value => `$${Number(value || 0).toLocaleString('ru-RU',{maximumFractionDigits:Number.isInteger(Number(value))?0:2})}`;

function periodKeyForDate(date = new Date(), salaryDay = 5) {
  const anchor = new Date(date.getFullYear(), date.getMonth(), 1);
  if (date.getDate() < salaryDay) anchor.setMonth(anchor.getMonth() - 1);
  return `${anchor.getFullYear()}-${String(anchor.getMonth()+1).padStart(2,'0')}`;
}
function shiftPeriodKey(key, delta) {
  const [y,m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function periodStart(key, salaryDay=5) {
  const [y,m] = key.split('-').map(Number);
  return new Date(y, m-1, salaryDay);
}
function periodEnd(key, salaryDay=5) {
  const start = periodStart(key, salaryDay);
  return new Date(start.getFullYear(), start.getMonth()+1, salaryDay-1);
}
function periodTitle(key) {
  const [y,m] = key.split('-').map(Number);
  return `${MONTHS_RU[m-1]} ${y}`;
}
function formatPeriodRange(key, salaryDay=5) {
  const opts = {day:'numeric',month:'long'};
  return `${periodStart(key,salaryDay).toLocaleDateString('ru-RU',opts)} — ${periodEnd(key,salaryDay).toLocaleDateString('ru-RU',opts)}`;
}
function makeFoodWeeks(key, plans=[200,200,200,200], salaryDay=5) {
  const start = periodStart(key,salaryDay);
  const end = periodEnd(key,salaryDay);
  const ranges = [
    [start,new Date(start.getFullYear(),start.getMonth(),start.getDate()+6)],
    [new Date(start.getFullYear(),start.getMonth(),start.getDate()+7),new Date(start.getFullYear(),start.getMonth(),start.getDate()+13)],
    [new Date(start.getFullYear(),start.getMonth(),start.getDate()+14),new Date(start.getFullYear(),start.getMonth(),start.getDate()+20)],
    [new Date(start.getFullYear(),start.getMonth(),start.getDate()+21),end]
  ];
  return ranges.map(([from,to],index)=>({id:`${key}-w${index+1}`,index:index+1,start:toISODate(from),end:toISODate(to),plan:Number(plans[index]||0),spent:0,closed:false}));
}
function currentWeekIndex(key,date=new Date(),salaryDay=5) {
  const start = periodStart(key,salaryDay);
  const end = periodEnd(key,salaryDay);
  if (date <= start) return 0;
  if (date >= end) return 3;
  const diff = Math.floor((new Date(date.getFullYear(),date.getMonth(),date.getDate()) - start)/86400000);
  if (diff<=6) return 0;
  if (diff<=13) return 1;
  if (diff<=20) return 2;
  return 3;
}
function daysToNextSalary(date=new Date(),salaryDay=5) {
  const today = new Date(date.getFullYear(),date.getMonth(),date.getDate());
  let next = new Date(date.getFullYear(),date.getMonth(),salaryDay);
  if (today.getDate()>salaryDay) next = new Date(date.getFullYear(),date.getMonth()+1,salaryDay);
  return Math.max(0,Math.ceil((next-today)/86400000));
}

const category = (id,name,icon,color,kind='monthly',order=0)=>({id,name,icon,color,kind,order,visible:true});
const DEFAULT_CATEGORIES = [
  category('food','Еда','utensils','#dfece1','food',0),
  category('everyday','Остальные повседневные расходы','wallet','#e5edf8','monthly',1),
  category('sport','Спорт','dumbbell','#f4e8dc','monthly',2),
  category('pet','Питомец','paw','#ebe5f5','pet',3),
  category('beauty','Косметика / уход','sparkles','#f2e6e6','monthly',4),
  category('health','Здоровье / аптека','heart','#e9efe2','monthly',5),
  category('clothing','Одежда / обувь','shirt','#f2edda','monthly',6),
  category('gifts','Подарки','gift','#e4edf0','monthly',7),
  category('leisure','Отдых / развлечения','ticket','#eee7f4','monthly',8),
  category('home','Уют дома','home','#f5e9dc','monthly',9),
  category('hobby','Хобби','palette','#e5eef0','monthly',10),
  category('unexpected','Непредвиденное','shield','#f1e7e4','monthly',11)
];

function blankBudgets() {
  return Object.fromEntries(DEFAULT_CATEGORIES.filter(c=>c.kind!=='food').map(c=>[c.id,{plan:0,spent:0}]));
}
function createPeriod(key) {
  const categoryBudgets = blankBudgets();
  return {
    key,
    salary: 0,
    extraIncome: 0,
    balanceNow: null,
    cashNow: 0,
    mandatory: {
      housingPlan: 0,
      housingSpent: 0,
      reservePlan: 0,
      reserveAllocated: 0,
      savingsPlanUsd: 0
    },
    categoryBudgets,
    foodWeeks: makeFoodWeeks(key,[0,0,0,0]),
    balanceSnapshot: null,
    passThroughs: [],
    note: ''
  };
}

const payment=(periodKey,planned)=>({id:`payment-${periodKey}`,periodKey,planned,paid:0,note:''});
function seedState(now=new Date()) {
  const current=periodKeyForDate(now,5), periods={};
  for(let i=-2;i<=24;i++){
    const key=shiftPeriodKey(current,i);
    periods[key]=createPeriod(key);
  }
  return {
    version: VERSION,
    settings: {
      profileName: 'Пользователь',
      salaryDay: 5,
      usdRate: 1,
      debtInitial: 0
    },
    categories: structuredClone(DEFAULT_CATEGORIES),
    periods,
    payments: [],
    savings: [],
    purchases: [],
    pet: {transactions:[],needs:[]}
  };
}

function ensurePeriod(state,key) {
  if(!state.periods[key]) state.periods[key]=createPeriod(key,'normal');
  for(const c of state.categories) if(c.kind!=='food'&&!state.periods[key].categoryBudgets[c.id]) state.periods[key].categoryBudgets[c.id]={plan:0,spent:0};
  if(state.periods[key].balanceNow!=null&&!state.periods[key].balanceSnapshot) captureBalanceSnapshot(state,state.periods[key]);
  return state.periods[key];
}
function foodBudget(period){return{plan:roundMoney(period.foodWeeks.reduce((s,w)=>s+Number(w.plan||0),0)),spent:roundMoney(period.foodWeeks.reduce((s,w)=>s+Number(w.spent||0),0))}}
function categoryBudget(period,category){return category.kind==='food'?foodBudget(period):(period.categoryBudgets[category.id]||{plan:0,spent:0})}
function periodIncome(period){return roundMoney(Number(period.salary||0)+Number(period.extraIncome||0))}
function periodPayment(state,key){let item=state.payments.find(p=>p.periodKey===key);if(!item){item=payment(key,0);state.payments.push(item)}return item}
function savingsBalanceUsd(state){return roundMoney(state.savings.reduce((s,t)=>s+(t.type==='deposit'?1:-1)*Number(t.amountUsd||0),0))}
function petBalanceByn(state){return roundMoney(state.pet.transactions.reduce((s,t)=>s+(t.type==='topup'?1:-1)*Number(t.amountByn||0),0))}
function paymentsPaidTotal(state){return roundMoney(state.payments.reduce((s,p)=>s+Number(p.paid||0),0))}
function debtRemaining(state){return Math.max(0,roundMoney(Number(state.settings.debtInitial||0)-paymentsPaidTotal(state)))}
function plannedCategoryTotal(state,period){return roundMoney(state.categories.filter(c=>c.visible).reduce((s,c)=>s+categoryBudget(period,c).plan,0))}
function periodSavingsDepositedUsd(state,key){return roundMoney(state.savings.filter(t=>t.type==='deposit'&&periodKeyForDate(parseISODate(t.date),state.settings.salaryDay)===key).reduce((s,t)=>s+Number(t.amountUsd||0),0))}
function captureBalanceSnapshot(state,period){
  const payment=periodPayment(state,period.key);
  period.balanceSnapshot={
    housingSpent:Number(period.mandatory.housingSpent||0),reserveAllocated:Number(period.mandatory.reserveAllocated||0),paymentPaid:Number(payment.paid||0),savingsDepositedUsd:periodSavingsDepositedUsd(state,period.key),
    categories:Object.fromEntries(Object.entries(period.categoryBudgets).map(([id,b])=>[id,Number(b.spent||0)])),
    food:period.foodWeeks.map(w=>Number(w.spent||0))
  };
  return period.balanceSnapshot;
}
function plannedFreeBalance(state,period){
  const base=periodIncome(period)-Number(period.mandatory.housingPlan||0)-Number(periodPayment(state,period.key).planned||0)-Number(period.mandatory.reservePlan||0)-Number(period.mandatory.savingsPlanUsd||0)*Number(state.settings.usdRate||0)-plannedCategoryTotal(state,period);
  const overCategories=state.categories.filter(c=>c.visible&&c.kind!=='food').reduce((s,c)=>{const b=categoryBudget(period,c);return s+Math.min(0,Number(b.plan||0)-Number(b.spent||0))},0);
  const foodVariance=period.foodWeeks.reduce((s,w)=>{const delta=Number(w.plan||0)-Number(w.spent||0);return s+(w.closed?delta:Math.min(0,delta))},0);
  return roundMoney(base+overCategories+foodVariance);
}
function liveFreeBalance(state,period){
  if(period.balanceNow==null)return plannedFreeBalance(state,period);
  const snapshot=period.balanceSnapshot||captureBalanceSnapshot(state,period),payment=periodPayment(state,period.key),rate=Number(state.settings.usdRate||0),saved=periodSavingsDepositedUsd(state,period.key);
  const remainingMandatory=Math.max(0,Number(period.mandatory.housingPlan||0)-Number(period.mandatory.housingSpent||0))+Math.max(0,Number(payment.planned||0)-Number(payment.paid||0))+Math.max(0,Number(period.mandatory.reservePlan||0)-Number(period.mandatory.reserveAllocated||0))+Math.max(0,Number(period.mandatory.savingsPlanUsd||0)-saved)*rate;
  const remainingCategories=state.categories.filter(c=>c.visible).reduce((sum,c)=>{
    if(c.kind==='food') return sum+period.foodWeeks.reduce((s,w)=>s+(w.closed?0:Math.max(0,Number(w.plan||0)-Number(w.spent||0))),0);
    const b=categoryBudget(period,c);return sum+Math.max(0,Number(b.plan||0)-Number(b.spent||0));
  },0);
  const newMandatorySpend=(Number(period.mandatory.housingSpent||0)-Number(snapshot.housingSpent||0))+(Number(period.mandatory.reserveAllocated||0)-Number(snapshot.reserveAllocated||0))+(Number(payment.paid||0)-Number(snapshot.paymentPaid||0))+(saved-Number(snapshot.savingsDepositedUsd||0))*rate;
  const newCategorySpend=state.categories.filter(c=>c.visible).reduce((sum,c)=>{
    if(c.kind==='food')return sum+period.foodWeeks.reduce((s,w,i)=>s+Number(w.spent||0)-Number(snapshot.food?.[i]||0),0);
    const b=categoryBudget(period,c);return sum+Number(b.spent||0)-Number(snapshot.categories?.[c.id]||0);
  },0);
  return roundMoney(Number(period.balanceNow||0)+Number(period.cashNow||0)-remainingMandatory-remainingCategories-newMandatorySpend-newCategorySpend);
}
function purchaseAvailable(state,cost){return savingsBalanceUsd(state)*Number(state.settings.usdRate||0)>=Number(cost||0)}
function monthlySavingsRows(state){const map=new Map();for(const t of state.savings){const key=t.date.slice(0,7),row=map.get(key)||{period:key,deposited:0,withdrawn:0,notes:[]};if(t.type==='deposit')row.deposited+=t.amountUsd;else row.withdrawn+=t.amountUsd;if(t.note)row.notes.push(t.note);map.set(key,row)}return[...map.values()].sort((a,b)=>b.period.localeCompare(a.period))}
function validateState(v){return !!v&&typeof v==='object'&&v.version===VERSION&&v.settings&&Array.isArray(v.categories)&&v.periods&&Array.isArray(v.payments)&&Array.isArray(v.savings)&&Array.isArray(v.purchases)&&v.pet}


const DB_NAME='personal-budget-private-v1';
const STORE='state';
const KEY='app';
const FALLBACK_KEY='personal-budget-private-v1-state';
const OLD_KEYS=[];

function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function loadState(){
  try{const db=await openDB();const value=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get(KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});if(value)return value}catch{}
  try{const fallback=localStorage.getItem(FALLBACK_KEY);if(fallback)return JSON.parse(fallback)}catch{}
  return null;
}
async function saveState(state){
  try{localStorage.setItem(FALLBACK_KEY,JSON.stringify(state))}catch{}
  try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(state,KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}catch{}
}
function findLegacyState(){for(const key of OLD_KEYS){try{const raw=localStorage.getItem(key);if(raw)return JSON.parse(raw)}catch{}}return null}
async function clearState(){try{localStorage.removeItem(FALLBACK_KEY)}catch{};try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}catch{}}


const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const num = value => Number(String(value ?? '').replace(',', '.')) || 0;
const todayISO = () => toISODate(new Date());
const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}) : '';
const shortDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'}) : '';
const pluralDays = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'день' : [2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100) ? 'дня' : 'дней'}`;

const iconPaths = {
  home:'<path d="M3 11.5 12 4l9 7.5v8a2 2 0 0 1-2 2h-5v-6h-4v6H5a2 2 0 0 1-2-2z"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  piggy:'<path d="M19 10a7 7 0 0 0-13.7-2H3v4l2 1.5V17a3 3 0 0 0 3 3h1v2h3v-2h4v2h3v-3.2A6 6 0 0 0 19 10Z"/><path d="M16 8h.01M8 6c.8-1.2 2.1-2 3.7-2"/>',
  paw:'<circle cx="7.2" cy="8" r="2"/><circle cx="16.8" cy="8" r="2"/><circle cx="5" cy="13" r="1.8"/><circle cx="19" cy="13" r="1.8"/><path d="M12 11c-3 0-5.2 2.2-5.2 5 0 2.2 1.6 4 3.7 4 .7 0 1.1-.4 1.5-.4s.8.4 1.5.4c2.1 0 3.7-1.8 3.7-4 0-2.8-2.2-5-5.2-5Z"/>',
  bag:'<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1 1.6v.2h-4V21a1.8 1.8 0 0 0-1-1.6 1.8 1.8 0 0 0-2 .4l-.1.1-2.8-2.8.1-.1a1.8 1.8 0 0 0 .4-2A1.8 1.8 0 0 0 3 14H2.8v-4H3a1.8 1.8 0 0 0 1.6-1 1.8 1.8 0 0 0-.4-2l-.1-.1 2.8-2.8.1.1a1.8 1.8 0 0 0 2 .4A1.8 1.8 0 0 0 10 3V2.8h4V3a1.8 1.8 0 0 0 1 1.6 1.8 1.8 0 0 0 2-.4l.1-.1 2.8 2.8-.1.1a1.8 1.8 0 0 0-.4 2A1.8 1.8 0 0 0 21 10h.2v4H21a1.8 1.8 0 0 0-1.6 1Z"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  chevronLeft:'<path d="m15 18-6-6 6-6"/>', chevronRight:'<path d="m9 18 6-6-6-6"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
  wallet:'<path d="M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12v3"/><path d="M16 12h4"/>',
  utensils:'<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4"/>',
  dumbbell:'<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>',
  sparkles:'<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8ZM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
  shirt:'<path d="m8 4-5 3 3 5 2-1v10h8V11l2 1 3-5-5-3a4 4 0 0 1-8 0Z"/>',
  gift:'<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18M7.5 8C5 8 4 6.8 4 5.5S5 3 6.5 3C9 3 12 8 12 8M16.5 8C19 8 20 6.8 20 5.5S19 3 17.5 3C15 3 12 8 12 8"/>',
  ticket:'<path d="M2 9a3 3 0 0 0 0 6v4h20v-4a3 3 0 0 0 0-6V5H2Z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
  palette:'<path d="M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a2 2 0 0 1 0-4h4a5 5 0 0 0 5-5c0-3.3-4-6-9-6Z"/><circle cx="7.5" cy="9" r="1"/><circle cx="10.5" cy="6.5" r="1"/><circle cx="15" cy="7" r="1"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  money:'<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9H5v1M18 15h1v-1"/>',
  arrowUp:'<path d="m18 15-6-6-6 6"/>', arrowDown:'<path d="m6 9 6 6 6-6"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', upload:'<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
};
function icon(name,size=22){return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.wallet}</svg>`}
function petAvatar(){return `<svg viewBox="0 0 120 120" role="img" aria-label="Кавалер кинг чарльз спаниель"><circle cx="60" cy="60" r="56" fill="#f4e8dc"/><path d="M38 42C18 38 15 70 32 83c7 5 16-2 17-13Z" fill="#a9673f"/><path d="M82 42c20-4 23 28 6 41-7 5-16-2-17-13Z" fill="#a9673f"/><path d="M60 28c23 0 32 18 28 41-3 19-15 30-28 30S35 88 32 69C28 46 37 28 60 28Z" fill="#fffaf2"/><path d="M39 42c8-8 15-11 21-12-1 14-9 23-20 27Z" fill="#9a5734"/><path d="M81 42c-8-8-15-11-21-12 1 14 9 23 20 27Z" fill="#9a5734"/><ellipse cx="46" cy="62" rx="4.2" ry="5" fill="#222"/><ellipse cx="74" cy="62" rx="4.2" ry="5" fill="#222"/><ellipse cx="60" cy="76" rx="7" ry="5" fill="#2d2522"/><path d="M54 83c4 4 8 4 12 0" fill="none" stroke="#8c5141" stroke-width="2.5" stroke-linecap="round"/></svg>`}

let state;
let activeScreen='home';
let selectedPeriodKey=periodKeyForDate(new Date(),5);
let foodPeriodKey=selectedPeriodKey;
let purchaseTab='required';
let saving=false;

function currentPeriod(){return ensurePeriod(state,periodKeyForDate(new Date(),state.settings.salaryDay));}
function selectedPeriod(){return ensurePeriod(state,selectedPeriodKey);}
function categoryById(id){return state.categories.find(c=>c.id===id);}
function periodSavingsDeposited(key){return roundMoney(state.savings.filter(t=>t.type==='deposit'&&periodKeyForDate(new Date(`${t.date}T12:00:00`),state.settings.salaryDay)===key).reduce((s,t)=>s+num(t.amountUsd),0));}
function weekAvailable(week){return roundMoney(num(week.plan)-num(week.spent));}
function categoryAvailable(period,category){const b=categoryBudget(period,category);return roundMoney(num(b.plan)-num(b.spent));}
function visibleCategories(){return [...state.categories].filter(c=>c.visible).sort((a,b)=>a.order-b.order);}
function totalOpenNeeds(){return state.pet.needs.filter(n=>!n.completed).reduce((s,n)=>s+num(n.costByn),0);}
function greeting(){const h=new Date().getHours();return h<12?'Доброе утро':h<18?'Добрый день':'Добрый вечер';}
function dashboardStatus(value){return value<0?'status-bad':'status-good';}

async function commit(render=true){
  if(saving)return;
  saving=true;
  try{await saveState(state);}finally{saving=false;}
  if(render)renderAll();
}
function toast(message){const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{el.hidden=true},2600);}

function setScreen(id){
  activeScreen=id;
  $$('.screen').forEach(el=>el.classList.toggle('active',el.id===id));
  $$('.bottom-nav button').forEach(el=>el.classList.toggle('active',el.dataset.nav===id));
  const overlay=['food','payments','settings'].includes(id);
  $('#settingsBtn').hidden=overlay;
  $('#closeOverlayBtn').hidden=!overlay;
  const titles={home:'Главная',month:'Месяц',savings:'Накопления',pet:'Питомец',purchases:'Покупки',food:'Еда',payments:'Платежи',settings:'Настройки'};
  $('#screenTitle').textContent=titles[id]||'';
  $('#eyebrow').textContent=id==='home'?`${greeting()}, ${state.settings.profileName}`:'';
  window.scrollTo({top:0,behavior:'smooth'});
  renderAll();
}
function openOverlay(id){setScreen(id);}
function closeOverlay(){setScreen('home');}

function statusClass(value){return value<0?'negative':value===0?'neutral':'positive';}
function budgetToneClass(plan,available){return available<0?'card-negative':num(plan)>0&&available<=num(plan)*0.2?'card-warning':'';}
function budgetValueClass(plan,available){return available<0?'negative-number':num(plan)>0&&available<=num(plan)*0.2?'warning-number':'';}
function renderHome(){
  const p=currentPeriod();
  const free=liveFreeBalance(state,p);
  const wi=currentWeekIndex(p.key,new Date(),state.settings.salaryDay);
  const week=p.foodWeeks[wi]||p.foodWeeks[0];
  const available=weekAvailable(week);
  $('#periodPill').textContent=`${periodTitle(p.key)} · ${formatPeriodRange(p.key,state.settings.salaryDay)}`;
  $('#freeValue').textContent=formatByn(free);
  $('#freeMeta').textContent=p.balanceNow==null ? `План месяца: ${formatByn(plannedFreeBalance(state,p))}` : `На счету ${formatByn(p.balanceNow)}${p.cashNow?` + отдельно ${formatByn(p.cashNow)}`:''}`;
  $('#freeCard').className=`hero-card ${dashboardStatus(free)}`;
  $('#weekAvailable').textContent=formatByn(available);
  $('#weekAvailable').className=budgetValueClass(week.plan,available);
  $('#weekSpent').textContent=formatByn(week.spent);
  $('#weekCard').classList.toggle('card-negative',available<0);
  $('#weekCard').classList.toggle('card-warning',num(week.plan)>0&&available>=0&&available<=num(week.plan)*0.2);
  $('#daysToSalary').textContent=pluralDays(daysToNextSalary(new Date(),state.settings.salaryDay));

  const savings=savingsBalanceUsd(state), pet=petBalanceByn(state), debt=debtRemaining(state);
  const openPurchases=state.purchases.filter(pu=>!pu.completed);
  const affordable=openPurchases.filter(pu=>purchaseAvailable(state,pu.costByn)).length;
  const rows=[
    {id:'savings',icon:'piggy',tone:'green',title:'Накопления',value:formatUsd(savings),meta:`≈ ${formatByn(savings*state.settings.usdRate)}`},
    {id:'payments',icon:'money',tone:'blue',title:'Платежи',value:formatByn(debt),meta:'осталось закрыть'},
    {id:'pet',icon:'paw',tone:'peach',title:'Питомец',value:formatByn(pet),meta:`нужно запланировано ${formatByn(totalOpenNeeds())}`},
    {id:'purchases',icon:'bag',tone:'lavender',title:'Покупки',value:`${openPurchases.length}`,meta:affordable?`${affordable} уже доступны`:'пока накоплений не хватает'}
  ];
  $('#dashboardList').innerHTML=rows.map(r=>`<button class="dashboard-row" data-dashboard="${r.id}"><span class="dashboard-icon ${r.tone}">${icon(r.icon)}</span><span class="dashboard-copy"><b>${esc(r.title)}</b><small>${esc(r.meta)}</small></span><strong>${esc(r.value)}</strong>${icon('chevronRight',18)}</button>`).join('');
}

function metric(label,value,fieldHtml=''){return `<div class="metric"><span>${label}</span>${fieldHtml||`<strong>${value}</strong>`}</div>`;}
function renderMandatoryCard(name,plan,spent,kind){
  const available=roundMoney(plan-spent);
  return `<article class="mandatory-card ${budgetToneClass(plan,available)}"><div class="mandatory-title"><b>${esc(name)}</b><button class="mini-icon" data-edit-mandatory="${kind}" aria-label="Изменить">${icon('edit',17)}</button></div><div class="metrics-row">${metric('План',formatByn(plan))}${metric('Потрачено',formatByn(spent))}${metric('Доступно',`<span class="${budgetValueClass(plan,available)}">${formatByn(available)}</span>`)}</div></article>`;
}
function renderCategoryCard(category,period){
  const b=categoryBudget(period,category), available=roundMoney(b.plan-b.spent);
  const food=category.kind==='food', pet=category.kind==='pet';
  const input=food ? `<button class="inline-link" data-open-food="1">${formatByn(b.spent)}</button>` : pet ? `<button class="inline-link" data-nav-to="pet">${formatByn(b.spent)}</button>` : `<input class="number-field compact" data-category-spent="${category.id}" inputmode="decimal" type="number" min="0" step="1" value="${num(b.spent)}" aria-label="Потрачено: ${esc(category.name)}">`;
  return `<article class="category-card ${budgetToneClass(b.plan,available)}" data-category="${category.id}">
    <div class="category-head"><span class="category-icon" style="background:${esc(category.color)}">${icon(category.icon)}</span><div><b>${esc(category.name)}</b><small>${category.kind==='food'?'по неделям':category.kind==='pet'?'пополнение внутреннего баланса':'месячный лимит'}</small></div><button class="mini-icon" data-edit-category="${category.id}" aria-label="Изменить категорию">${icon('edit',17)}</button></div>
    <div class="metrics-row">${metric('План',formatByn(b.plan))}${metric('Потрачено','',input)}${metric('Доступно',`<span class="${budgetValueClass(b.plan,available)}">${formatByn(available)}</span>`)}</div>
  </article>`;
}
function renderMonth(){
  const p=selectedPeriod(), payment=periodPayment(state,p.key);
  $('#monthTitle').textContent=periodTitle(p.key);$('#monthRange').textContent=formatPeriodRange(p.key,state.settings.salaryDay);
  $('#incomeTotal').textContent=formatByn(periodIncome(p));
  $('#incomeDetails').textContent=`Зарплата ${formatByn(p.salary)}${p.extraIncome?` · Доп. доход ${formatByn(p.extraIncome)}`:''}`;
  $('#mandatoryGrid').innerHTML=[
    renderMandatoryCard('Квартира',num(p.mandatory.housingPlan),num(p.mandatory.housingSpent),'housing'),
    renderMandatoryCard('Платежи',num(payment.planned),num(payment.paid),'payment'),
    renderMandatoryCard('Резерв',num(p.mandatory.reservePlan),num(p.mandatory.reserveAllocated),'reserve')
  ].join('')+`<article class="pass-through"><span>${icon('info',18)}</span><div><b>Коммунальные ${formatByn(p.passThroughs?.[0]?.amount||120)}</b><small>Аванс 25 числа приходит и сразу уходит. Основной доход не уменьшается.</small></div></article>`;
  $('#categoryList').innerHTML=visibleCategories().map(c=>renderCategoryCard(c,p)).join('');
  const free=p.balanceNow==null?plannedFreeBalance(state,p):liveFreeBalance(state,p);
  $('#monthFreeValue').textContent=formatByn(free);
  $('#monthLimitMeta').textContent=`Лимиты категорий: ${formatByn(plannedCategoryTotal(state,p))}`;
  $('#monthFreeCard').classList.toggle('negative',free<0);
}

function renderFood(){
  const p=ensurePeriod(state,foodPeriodKey), total=foodBudget(p);
  $('#foodMonthTitle').textContent=periodTitle(p.key);$('#foodMonthRange').textContent=formatPeriodRange(p.key,state.settings.salaryDay);
  const available=roundMoney(total.plan-total.spent);
  $('#foodTotal').innerHTML=`<div>${metric('План',formatByn(total.plan))}${metric('Потрачено',formatByn(total.spent))}${metric('Доступно',`<span class="${budgetValueClass(total.plan,available)}">${formatByn(available)}</span>`)}</div>`;
  $('#foodTotal').classList.toggle('card-negative',available<0);
  $('#foodTotal').classList.toggle('card-warning',num(total.plan)>0&&available>=0&&available<=num(total.plan)*0.2);
  $('#foodWeeks').innerHTML=p.foodWeeks.map((w,index)=>{
    const av=weekAvailable(w);
    return `<article class="food-week ${budgetToneClass(w.plan,av)}"><header><div><b>Неделя ${index+1}</b><small>${shortDate(w.start)} — ${shortDate(w.end)}</small></div><label class="check-label"><input type="checkbox" data-week-closed="${index}" ${w.closed?'checked':''}><span>${w.closed?'Закрыта':'Не закрыта'}</span></label></header><div class="metrics-row">${metric('План','',`<input class="number-field compact" type="number" min="0" step="1" inputmode="decimal" data-week-plan="${index}" value="${num(w.plan)}">`)}${metric('Потрачено','',`<input class="number-field compact" type="number" min="0" step="1" inputmode="decimal" data-week-spent="${index}" value="${num(w.spent)}">`)}${metric('Доступно',`<span class="${budgetValueClass(w.plan,av)}">${formatByn(av)}</span>`)}</div></article>`;
  }).join('');
}

function renderSavings(){
  const balance=savingsBalanceUsd(state);
  $('#savingsBalance').textContent=formatUsd(balance);$('#savingsEquivalent').textContent=`≈ ${formatByn(balance*state.settings.usdRate)} по курсу ${state.settings.usdRate}`;
  const rows=monthlySavingsRows(state);
  $('#monthlySavings').innerHTML=rows.length?rows.map(row=>{const net=roundMoney(row.deposited-row.withdrawn);return `<article class="monthly-row"><div><b>${periodTitle(row.period)}</b><small>${row.notes.slice(0,2).map(esc).join(' · ')||'Без комментария'}</small></div><div><span>Отложила ${formatUsd(row.deposited)}</span><span>Взяла ${formatUsd(row.withdrawn)}</span><strong class="${net<0?'negative-number':''}">${net>=0?'+':''}${formatUsd(net)}</strong></div></article>`}).join(''):'<div class="empty-state">В этом разделе пока нет данных</div>';
  $('#savingsHistory').innerHTML=state.savings.length?[...state.savings].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<article class="history-row"><span class="history-icon ${t.type==='deposit'?'green':'red'}">${icon(t.type==='deposit'?'arrowDown':'arrowUp',18)}</span><div><b class="${t.type==='withdraw'?'negative-number':''}">${t.type==='deposit'?'+':'−'} ${formatUsd(t.amountUsd)}</b><small>${esc(t.note||'Без комментария')} · ${dateLabel(t.date)}</small></div><button class="mini-icon" data-delete-saving="${t.id}" aria-label="Удалить">${icon('trash',17)}</button></article>`).join(''):'<div class="empty-state">История пока пустая</div>';
}

function renderPet(){
  const balance=petBalanceByn(state), open=state.pet.needs.filter(n=>!n.completed), needsTotal=totalOpenNeeds();
  $('#petAvatar').innerHTML=petAvatar();$('#petBalance').textContent=formatByn(balance);
  $('#petNeedSummary').textContent=open.length?`На открытые планы нужно ${formatByn(needsTotal)}`:'Открытых планов нет';
  $('#petNeeds').innerHTML=open.length?open.map(n=>{const missing=Math.max(0,num(n.costByn)-balance), enough=missing===0;return `<article class="need-card ${enough?'affordable':''}"><div class="need-main"><label class="round-check"><input type="checkbox" data-complete-need="${n.id}"><span>${icon('check',15)}</span></label><div><b>${esc(n.name)}</b><small>${n.dueDate?`До ${dateLabel(n.dueDate)}`:'Без срока'}${n.note?` · ${esc(n.note)}`:''}</small></div></div><div class="need-value"><b>${formatByn(n.costByn)}</b><small class="${enough?'success-text':'negative-number'}">${enough?'Баланс позволяет':`Не хватает ${formatByn(missing)}`}</small><button class="mini-icon" data-edit-need="${n.id}">${icon('edit',16)}</button></div></article>`}).join(''):'<div class="empty-state">Добавь покупку, прививку или визит к ветеринару</div>';
  $('#petHistory').innerHTML=state.pet.transactions.length?[...state.pet.transactions].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<article class="history-row"><span class="history-icon ${t.type==='topup'?'green':'red'}">${icon(t.type==='topup'?'arrowDown':'arrowUp',18)}</span><div><b class="${t.type==='spend'?'negative-number':''}">${t.type==='topup'?'+':'−'} ${formatByn(t.amountByn)}</b><small>${esc(t.note||'Без комментария')} · ${dateLabel(t.date)}</small></div><button class="mini-icon" data-delete-pet-tx="${t.id}">${icon('trash',17)}</button></article>`).join(''):'<div class="empty-state">История баланса пока пустая</div>';
}

const purchaseTitles={required:'Обязательные',desired:'Желательные',wish:'Просто хочется'};
function renderPurchases(){
  const savings=savingsBalanceUsd(state), byn=roundMoney(savings*state.settings.usdRate);
  $('#purchaseSavingsByn').textContent=formatByn(byn);$('#purchaseSavingsUsd').textContent=formatUsd(savings);
  $$('#purchaseTabs button').forEach(b=>b.classList.toggle('active',b.dataset.purchaseTab===purchaseTab));$('#purchaseTitle').textContent=purchaseTitles[purchaseTab];
  const items=state.purchases.filter(p=>p.priority===purchaseTab&&!p.completed);
  $('#purchaseList').innerHTML=items.length?items.map(p=>{const enough=purchaseAvailable(state,p.costByn), missing=Math.max(0,num(p.costByn)-byn);return `<article class="purchase-card ${enough?'affordable':''}"><div><b>${esc(p.name)}</b><small>${esc(p.note||purchaseTitles[p.priority])}</small></div><div class="purchase-cost"><b>${formatByn(p.costByn)}</b><small class="${enough?'success-text':'negative-number'}">${enough?'Накоплений хватает':`Не хватает ${formatByn(missing)}`}</small><div><button class="mini-icon" data-complete-purchase="${p.id}">${icon('check',16)}</button><button class="mini-icon" data-edit-purchase="${p.id}">${icon('edit',16)}</button></div></div></article>`}).join(''):'<div class="empty-state">В этом разделе пока нет покупок</div>';
}

function renderPayments(){
  const remaining=debtRemaining(state), paid=paymentsPaidTotal(state), initial=num(state.settings.debtInitial), progress=initial?Math.min(100,paid/initial*100):0;
  $('#debtRemaining').textContent=formatByn(remaining);$('#debtProgress').style.width=`${progress}%`;$('#debtMeta').textContent=`Оплачено ${formatByn(paid)} из ${formatByn(initial)}`;
  const sorted=[...state.payments].sort((a,b)=>a.periodKey.localeCompare(b.periodKey));
  $('#paymentsList').innerHTML=sorted.map(p=>{const left=Math.max(0,num(p.planned)-num(p.paid));return `<article class="payment-row ${p.planned>0&&p.paid<=0?'planned':''}"><div><b>${periodTitle(p.periodKey)}</b><small>${p.note?esc(p.note):left===0&&p.planned>0?'Оплачено':'Плановый платеж'}</small></div><div><span>План ${formatByn(p.planned)}</span><span>Оплачено ${formatByn(p.paid)}</span><strong>${left?`Осталось ${formatByn(left)}`:'Закрыто'}</strong><button class="mini-icon" data-edit-payment="${p.id}">${icon('edit',16)}</button></div></article>`}).join('');
}

function renderSettings(){
  $('#editGeneralBtn').innerHTML=`<span><b>Профиль и расчеты</b><small>${esc(state.settings.profileName)} · зарплата ${state.settings.salaryDay} числа · $ ${state.settings.usdRate}</small></span>${icon('chevronRight',18)}`;
  $('#settingsCategories').innerHTML=[...state.categories].sort((a,b)=>a.order-b.order).map(c=>`<button class="settings-row" data-settings-category="${c.id}"><span class="category-icon" style="background:${esc(c.color)}">${icon(c.icon)}</span><span><b>${esc(c.name)}</b><small>${c.visible?'Показывается':'Скрыта'} · ${c.kind==='food'?'по неделям':c.kind==='pet'?'расширенная':'обычная'}</small></span>${icon('chevronRight',18)}</button>`).join('');
  $('#exportBtn').innerHTML=`<span>${icon('download',20)}<b>Скачать резервную копию</b></span>${icon('chevronRight',18)}`;
  $('#importContent').innerHTML=`<span>${icon('upload',20)}<b>Восстановить из копии</b></span>${icon('chevronRight',18)}`;
  $('#resetBtn').innerHTML=`<span>${icon('trash',20)}<b>Сбросить данные</b></span>${icon('chevronRight',18)}`;
}

function renderNav(){
  const items=[['home','home','Главная'],['month','calendar','Месяц'],['savings','piggy','Накопления'],['pet','paw','Питомец'],['purchases','bag','Покупки']];
  $$('.bottom-nav button').forEach((button,index)=>{const [id,ic,label]=items[index];button.innerHTML=`${icon(ic,21)}<small>${label}</small>`;button.classList.toggle('active',activeScreen===id);});
  $('#settingsBtn').innerHTML=icon('settings',21);$('#closeOverlayBtn').innerHTML=icon('close',21);
  $('#prevMonth').innerHTML=icon('chevronLeft');$('#nextMonth').innerHTML=icon('chevronRight');$('#foodPrevMonth').innerHTML=icon('chevronLeft');$('#foodNextMonth').innerHTML=icon('chevronRight');
  $('#editBalanceBtn').innerHTML=icon('edit',17);$('#addCategoryBtn').innerHTML=`${icon('plus',17)} Добавить`;$('#depositSavings').innerHTML=`${icon('plus',18)} Отложить`;$('#withdrawSavings').innerHTML=`${icon('minus',18)} Взять`;$('#topupPet').innerHTML=`${icon('plus',18)} Пополнить`;$('#spendPet').innerHTML=`${icon('minus',18)} Потратить`;$('#addPetNeed').innerHTML=`${icon('plus',17)} Добавить`;$('#addPurchaseBtn').innerHTML=`${icon('plus',17)} Добавить`;$('#addPaymentBtn').innerHTML=`${icon('plus',17)} Добавить`;$('#settingsAddCategory').innerHTML=`${icon('plus',17)} Добавить`;$('#modalClose').innerHTML=icon('close',19);
}
function renderAll(){renderNav();renderHome();renderMonth();renderSavings();renderPet();renderPurchases();renderFood();renderPayments();renderSettings();}

function fieldHtml(field){
  const id=`field-${field.name}`;const value=field.value??'';const common=`id="${id}" name="${field.name}" ${field.required?'required':''}`;
  if(field.type==='select')return `<label class="form-field"><span>${esc(field.label)}</span><select ${common}>${field.options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>${field.help?`<small>${esc(field.help)}</small>`:''}</label>`;
  if(field.type==='textarea')return `<label class="form-field"><span>${esc(field.label)}</span><textarea ${common} rows="3" placeholder="${esc(field.placeholder||'')}">${esc(value)}</textarea>${field.help?`<small>${esc(field.help)}</small>`:''}</label>`;
  if(field.type==='checkbox')return `<label class="toggle-field"><input type="checkbox" ${common} ${value?'checked':''}><span><b>${esc(field.label)}</b>${field.help?`<small>${esc(field.help)}</small>`:''}</span></label>`;
  return `<label class="form-field"><span>${esc(field.label)}</span><input ${common} type="${field.type||'text'}" value="${esc(value)}" placeholder="${esc(field.placeholder||'')}" ${field.min!=null?`min="${field.min}"`:''} ${field.step!=null?`step="${field.step}"`:''} ${field.inputmode?`inputmode="${field.inputmode}"`:''}>${field.help?`<small>${esc(field.help)}</small>`:''}</label>`;
}
let modalSubmitHandler=null, modalExtraHandler=null;
function openModal(title,fields,onSubmit,{submitLabel='Сохранить',extraAction=null}={}){
  $('#modalTitle').textContent=title;$('#modalBody').innerHTML=fields.map(fieldHtml).join('')+(extraAction?`<button type="button" id="modalExtra" class="danger-button">${esc(extraAction.label)}</button>`:'');$('#modalSubmit').textContent=submitLabel;$('#modalBackdrop').hidden=false;document.body.classList.add('modal-open');modalSubmitHandler=onSubmit;modalExtraHandler=extraAction?.handler||null;setTimeout(()=>$('#modalBody input:not([type="checkbox"]), #modalBody select')?.focus(),40);}
function closeModal(){$('#modalBackdrop').hidden=true;document.body.classList.remove('modal-open');modalSubmitHandler=null;modalExtraHandler=null;}
function formValues(form){const result={};form.querySelectorAll('[name]').forEach(el=>{result[el.name]=el.type==='checkbox'?el.checked:el.value;});return result;}

function openPeriodEditor(){const p=selectedPeriod(), utility=p.passThroughs?.[0]||{amount:120};openModal(`Параметры · ${periodTitle(p.key)}`,[
  {name:'salary',label:'Зарплата, BYN',type:'number',step:'1',value:p.salary},
  {name:'extra',label:'Дополнительный доход, BYN',type:'number',step:'1',value:p.extraIncome},
  {name:'balance',label:'Текущий баланс на счету, BYN',type:'number',step:'1',value:p.balanceNow??'',help:'Оставь пустым для планового месяца.'},
  {name:'cash',label:'Отдельно отложено / наличные, BYN',type:'number',step:'1',value:p.cashNow},
  {name:'housingPlan',label:'Квартира — план, BYN',type:'number',step:'1',value:p.mandatory.housingPlan},
  {name:'housingSpent',label:'Квартира — оплачено, BYN',type:'number',step:'1',value:p.mandatory.housingSpent},
  {name:'reservePlan',label:'Резерв — план, BYN',type:'number',step:'1',value:p.mandatory.reservePlan},
  {name:'reserveAllocated',label:'Резерв — уже отложено, BYN',type:'number',step:'1',value:p.mandatory.reserveAllocated},
  {name:'savingsUsd',label:'Накопления — план, $',type:'number',step:'1',value:p.mandatory.savingsPlanUsd},
  {name:'utilities',label:'Коммунальные из аванса, BYN',type:'number',step:'1',value:utility.amount},
  {name:'note',label:'Комментарий',type:'textarea',value:p.note}
],async v=>{p.salary=num(v.salary);p.extraIncome=num(v.extra);p.balanceNow=v.balance===''?null:num(v.balance);p.cashNow=num(v.cash);p.mandatory.housingPlan=num(v.housingPlan);p.mandatory.housingSpent=num(v.housingSpent);p.mandatory.reservePlan=num(v.reservePlan);p.mandatory.reserveAllocated=num(v.reserveAllocated);p.mandatory.savingsPlanUsd=num(v.savingsUsd);p.passThroughs=[{...(p.passThroughs?.[0]||{id:`${p.key}-utilities`,name:'Коммунальные',dueDay:25}),amount:num(v.utilities),note:'Аванс приходит и сразу уходит'}];p.note=v.note;if(p.balanceNow==null)p.balanceSnapshot=null;else captureBalanceSnapshot(state,p);await commit();closeModal();});}
function openBalanceEditor(){const p=currentPeriod();openModal('Текущий баланс',[{name:'balance',label:'На счету, BYN',type:'number',step:'1',value:p.balanceNow??''},{name:'cash',label:'Отдельно отложено / наличные, BYN',type:'number',step:'1',value:p.cashNow}],async v=>{p.balanceNow=v.balance===''?null:num(v.balance);p.cashNow=num(v.cash);if(p.balanceNow==null)p.balanceSnapshot=null;else captureBalanceSnapshot(state,p);await commit();closeModal();});}
function openMandatoryEditor(kind){const p=selectedPeriod(), pay=periodPayment(state,p.key);const config={housing:{title:'Квартира',plan:p.mandatory.housingPlan,spent:p.mandatory.housingSpent},payment:{title:'Платежи',plan:pay.planned,spent:pay.paid},reserve:{title:'Резерв',plan:p.mandatory.reservePlan,spent:p.mandatory.reserveAllocated}}[kind];openModal(config.title,[{name:'plan',label:'План, BYN',type:'number',value:config.plan},{name:'spent',label:'Потрачено / отложено, BYN',type:'number',value:config.spent}],async v=>{if(kind==='housing'){p.mandatory.housingPlan=num(v.plan);p.mandatory.housingSpent=num(v.spent)}else if(kind==='payment'){pay.planned=num(v.plan);pay.paid=num(v.spent)}else{p.mandatory.reservePlan=num(v.plan);p.mandatory.reserveAllocated=num(v.spent)}await commit();closeModal();});}

const iconOptions=['wallet','utensils','dumbbell','paw','sparkles','heart','shirt','gift','ticket','home','palette','shield'].map(i=>({label:i,value:i}));
const colorOptions=['#dfece1','#e5edf8','#f4e8dc','#ebe5f5','#f2e6e6','#e9efe2','#f2edda','#e4edf0','#eee7f4','#f5e9dc'].map(c=>({label:c,value:c}));
function openCategoryEditor(id){
  const c=categoryById(id), p=selectedPeriod(), b=categoryBudget(p,c);const deletable=!['food','pet'].includes(c.kind);
  const fields=[{name:'name',label:'Название',value:c.name},{name:'plan',label:'Лимит текущего месяца, BYN',type:'number',value:b.plan,help:c.kind==='food'?'Для еды лимиты меняются по неделям. Значение здесь распределится на четыре недели.':''},{name:'icon',label:'Иконка',type:'select',value:c.icon,options:iconOptions},{name:'color',label:'Цвет',type:'select',value:c.color,options:colorOptions},{name:'visible',label:'Показывать категорию',type:'checkbox',value:c.visible}];
  openModal('Категория',fields,async v=>{c.name=v.name.trim()||c.name;c.icon=v.icon;c.color=v.color;c.visible=v.visible;const plan=num(v.plan);if(c.kind==='food'){const per=roundMoney(plan/4);p.foodWeeks.forEach((w,i)=>w.plan=i===3?roundMoney(plan-per*3):per)}else ensurePeriod(state,p.key).categoryBudgets[c.id].plan=plan;await commit();closeModal();},{extraAction:deletable?{label:'Удалить категорию',handler:async()=>{if(!confirm(`Удалить «${c.name}»?`))return;state.categories=state.categories.filter(x=>x.id!==id);Object.values(state.periods).forEach(period=>delete period.categoryBudgets[id]);await commit();closeModal();}}:null});
}
function openNewCategory(){openModal('Новая категория',[{name:'name',label:'Название',required:true},{name:'plan',label:'Лимит текущего месяца, BYN',type:'number',value:0},{name:'icon',label:'Иконка',type:'select',value:'wallet',options:iconOptions},{name:'color',label:'Цвет',type:'select',value:'#e5edf8',options:colorOptions}],async v=>{const id=`category-${uid()}`;const order=Math.max(0,...state.categories.map(c=>c.order))+1;state.categories.push({id,name:v.name.trim()||'Новая категория',icon:v.icon,color:v.color,kind:'monthly',order,visible:true});Object.values(state.periods).forEach(period=>{period.categoryBudgets[id]={plan:period.key===selectedPeriodKey?num(v.plan):0,spent:0}});await commit();closeModal();});}

function savingsModal(type){openModal(type==='deposit'?'Отложить в накопления':'Взять из накоплений',[{name:'amount',label:'Сумма, $',type:'number',min:0,step:'1',required:true},{name:'date',label:'Дата',type:'date',value:todayISO()},{name:'note',label:'Комментарий',value:''}],async v=>{state.savings.push({id:uid(),type,amountUsd:num(v.amount),date:v.date||todayISO(),note:v.note.trim()});await commit();closeModal();});}
function petTransactionModal(type){openModal(type==='topup'?'Пополнить баланс питомца':'Потратить с баланса питомца',[{name:'amount',label:'Сумма, BYN',type:'number',min:0,step:'1',required:true},{name:'date',label:'Дата',type:'date',value:todayISO()},{name:'note',label:type==='topup'?'Комментарий':'На что потратила',value:''}],async v=>{const amount=num(v.amount),date=v.date||todayISO();const tx={id:uid(),type,amountByn:amount,date,note:v.note.trim()};if(type==='topup'){const key=periodKeyForDate(new Date(`${date}T12:00:00`),state.settings.salaryDay);const p=ensurePeriod(state,key);p.categoryBudgets.pet=p.categoryBudgets.pet||{plan:0,spent:0};p.categoryBudgets.pet.spent=roundMoney(p.categoryBudgets.pet.spent+amount);tx.budgetPeriodKey=key;}state.pet.transactions.push(tx);await commit();closeModal();});}
function needModal(item=null){openModal(item?'План питомца':'Добавить для питомца',[{name:'name',label:'Что нужно',value:item?.name||'',required:true},{name:'cost',label:'Стоимость, BYN',type:'number',value:item?.costByn||0},{name:'due',label:'Срок',type:'date',value:item?.dueDate||''},{name:'note',label:'Комментарий',value:item?.note||''}],async v=>{if(item){item.name=v.name;item.costByn=num(v.cost);item.dueDate=v.due;item.note=v.note}else state.pet.needs.push({id:uid(),name:v.name,costByn:num(v.cost),dueDate:v.due,note:v.note,completed:false});await commit();closeModal();},{extraAction:item?{label:'Удалить',handler:async()=>{state.pet.needs=state.pet.needs.filter(n=>n.id!==item.id);await commit();closeModal();}}:null});}
function purchaseModal(item=null){openModal(item?'Покупка':'Новая покупка',[{name:'name',label:'Название',value:item?.name||'',required:true},{name:'priority',label:'Раздел',type:'select',value:item?.priority||purchaseTab,options:Object.entries(purchaseTitles).map(([value,label])=>({value,label}))},{name:'cost',label:'Стоимость, BYN',type:'number',value:item?.costByn||0},{name:'note',label:'Комментарий',value:item?.note||''}],async v=>{if(item){item.name=v.name;item.priority=v.priority;item.costByn=num(v.cost);item.note=v.note}else state.purchases.push({id:uid(),name:v.name,priority:v.priority,costByn:num(v.cost),note:v.note,completed:false});purchaseTab=v.priority;await commit();closeModal();},{extraAction:item?{label:'Удалить',handler:async()=>{state.purchases=state.purchases.filter(p=>p.id!==item.id);await commit();closeModal();}}:null});}
function paymentModal(item=null){openModal(item?'Платеж':'Новый платеж',[{name:'period',label:'Месяц',type:'month',value:item?.periodKey||selectedPeriodKey},{name:'planned',label:'План, BYN',type:'number',value:item?.planned||0},{name:'paid',label:'Оплачено, BYN',type:'number',value:item?.paid||0},{name:'note',label:'Комментарий',value:item?.note||''}],async v=>{if(item){item.periodKey=v.period;item.planned=num(v.planned);item.paid=num(v.paid);item.note=v.note}else state.payments.push({id:uid(),periodKey:v.period,planned:num(v.planned),paid:num(v.paid),note:v.note});await commit();closeModal();},{extraAction:item?{label:'Удалить',handler:async()=>{state.payments=state.payments.filter(p=>p.id!==item.id);await commit();closeModal();}}:null});}
function generalModal(){openModal('Общие настройки',[{name:'name',label:'Имя',value:state.settings.profileName},{name:'salaryDay',label:'День зарплаты',type:'number',min:1,value:state.settings.salaryDay},{name:'rate',label:'Курс $ в BYN',type:'number',step:'0.01',value:state.settings.usdRate},{name:'debt',label:'Первоначальная сумма платежей, BYN',type:'number',value:state.settings.debtInitial}],async v=>{state.settings.profileName=v.name.trim()||'Пользователь';state.settings.salaryDay=Math.min(28,Math.max(1,num(v.salaryDay)||5));state.settings.usdRate=num(v.rate)||1;state.settings.debtInitial=num(v.debt);selectedPeriodKey=periodKeyForDate(new Date(),state.settings.salaryDay);foodPeriodKey=selectedPeriodKey;await commit();closeModal();});}

function exportBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`moi-dengi-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(url);toast('Резервная копия сохранена');}
async function importBackup(file){try{const parsed=JSON.parse(await file.text());if(!validateState(parsed))throw new Error('format');state=parsed;await commit();toast('Данные восстановлены');setScreen('home')}catch{toast('Не удалось прочитать резервную копию')}}

function bindStaticEvents(){
  $$('.bottom-nav button').forEach(b=>b.addEventListener('click',()=>setScreen(b.dataset.nav)));
  $('#settingsBtn').addEventListener('click',()=>openOverlay('settings'));$('#closeOverlayBtn').addEventListener('click',closeOverlay);
  $('#periodPill').addEventListener('click',()=>setScreen('month'));$('#editBalanceBtn').addEventListener('click',openBalanceEditor);$('#weekCard').addEventListener('click',()=>{foodPeriodKey=currentPeriod().key;openOverlay('food')});
  $('#prevMonth').addEventListener('click',()=>{selectedPeriodKey=shiftPeriodKey(selectedPeriodKey,-1);ensurePeriod(state,selectedPeriodKey);renderAll()});$('#nextMonth').addEventListener('click',()=>{selectedPeriodKey=shiftPeriodKey(selectedPeriodKey,1);ensurePeriod(state,selectedPeriodKey);renderAll()});
  $('#foodPrevMonth').addEventListener('click',()=>{foodPeriodKey=shiftPeriodKey(foodPeriodKey,-1);ensurePeriod(state,foodPeriodKey);renderFood()});$('#foodNextMonth').addEventListener('click',()=>{foodPeriodKey=shiftPeriodKey(foodPeriodKey,1);ensurePeriod(state,foodPeriodKey);renderFood()});
  $('#editPeriodBtn').addEventListener('click',openPeriodEditor);$('#addCategoryBtn').addEventListener('click',openNewCategory);$('#settingsAddCategory').addEventListener('click',openNewCategory);
  $('#depositSavings').addEventListener('click',()=>savingsModal('deposit'));$('#withdrawSavings').addEventListener('click',()=>savingsModal('withdraw'));
  $('#topupPet').addEventListener('click',()=>petTransactionModal('topup'));$('#spendPet').addEventListener('click',()=>petTransactionModal('spend'));$('#addPetNeed').addEventListener('click',()=>needModal());
  $('#addPurchaseBtn').addEventListener('click',()=>purchaseModal());$('#addPaymentBtn').addEventListener('click',()=>paymentModal());$('#editGeneralBtn').addEventListener('click',generalModal);
  $('#exportBtn').addEventListener('click',exportBackup);$('#importInput').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importBackup(file);e.target.value=''});$('#resetBtn').addEventListener('click',async()=>{if(!confirm('Сбросить все данные приложения?'))return;await clearState();state=seedState(new Date());selectedPeriodKey=periodKeyForDate(new Date(),state.settings.salaryDay);foodPeriodKey=selectedPeriodKey;await commit();setScreen('home');toast('Данные сброшены')});
  $('#modalClose').addEventListener('click',closeModal);$('#modalCancel').addEventListener('click',closeModal);$('#modalBackdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()});
  $('#modalForm').addEventListener('submit',async e=>{e.preventDefault();if(modalSubmitHandler)await modalSubmitHandler(formValues(e.currentTarget))});
  $('#modalBody').addEventListener('click',async e=>{if(e.target.closest('#modalExtra')&&modalExtraHandler)await modalExtraHandler()});
  $('#purchaseTabs').addEventListener('click',e=>{const b=e.target.closest('[data-purchase-tab]');if(!b)return;purchaseTab=b.dataset.purchaseTab;renderPurchases()});
}
function bindDelegatedEvents(){
  document.addEventListener('click',async e=>{
    const dashboard=e.target.closest('[data-dashboard]');if(dashboard){const id=dashboard.dataset.dashboard;if(id==='payments')openOverlay('payments');else setScreen(id);return;}
    const nav=e.target.closest('[data-nav-to]');if(nav){setScreen(nav.dataset.navTo);return;}
    if(e.target.closest('[data-open-food]')){foodPeriodKey=selectedPeriodKey;openOverlay('food');return;}
    const mandatory=e.target.closest('[data-edit-mandatory]');if(mandatory){openMandatoryEditor(mandatory.dataset.editMandatory);return;}
    const editCategory=e.target.closest('[data-edit-category]');if(editCategory){openCategoryEditor(editCategory.dataset.editCategory);return;}
    const settingsCategory=e.target.closest('[data-settings-category]');if(settingsCategory){openCategoryEditor(settingsCategory.dataset.settingsCategory);return;}
    const savingDelete=e.target.closest('[data-delete-saving]');if(savingDelete){if(!confirm('Удалить запись?'))return;state.savings=state.savings.filter(t=>t.id!==savingDelete.dataset.deleteSaving);await commit();return;}
    const petDelete=e.target.closest('[data-delete-pet-tx]');if(petDelete){if(!confirm('Удалить запись?'))return;const tx=state.pet.transactions.find(t=>t.id===petDelete.dataset.deletePetTx);if(tx?.type==='topup'&&tx.budgetPeriodKey){const p=ensurePeriod(state,tx.budgetPeriodKey);p.categoryBudgets.pet.spent=Math.max(0,roundMoney(p.categoryBudgets.pet.spent-tx.amountByn))}state.pet.transactions=state.pet.transactions.filter(t=>t.id!==petDelete.dataset.deletePetTx);await commit();return;}
    const completeNeed=e.target.closest('[data-complete-need]');if(completeNeed){const n=state.pet.needs.find(x=>x.id===completeNeed.dataset.completeNeed);if(n){n.completed=true;await commit()}return;}
    const editNeed=e.target.closest('[data-edit-need]');if(editNeed){needModal(state.pet.needs.find(n=>n.id===editNeed.dataset.editNeed));return;}
    const completePurchase=e.target.closest('[data-complete-purchase]');if(completePurchase){const p=state.purchases.find(x=>x.id===completePurchase.dataset.completePurchase);if(p){p.completed=true;await commit()}return;}
    const editPurchase=e.target.closest('[data-edit-purchase]');if(editPurchase){purchaseModal(state.purchases.find(p=>p.id===editPurchase.dataset.editPurchase));return;}
    const editPayment=e.target.closest('[data-edit-payment]');if(editPayment){paymentModal(state.payments.find(p=>p.id===editPayment.dataset.editPayment));return;}
  });
  document.addEventListener('change',async e=>{
    if(e.target.matches('[data-category-spent]')){const p=selectedPeriod(),c=categoryById(e.target.dataset.categorySpent);if(c){p.categoryBudgets[c.id].spent=Math.max(0,num(e.target.value));await commit()}return;}
    if(e.target.matches('[data-week-plan]')){const p=ensurePeriod(state,foodPeriodKey);p.foodWeeks[num(e.target.dataset.weekPlan)].plan=Math.max(0,num(e.target.value));await commit();return;}
    if(e.target.matches('[data-week-spent]')){const p=ensurePeriod(state,foodPeriodKey);p.foodWeeks[num(e.target.dataset.weekSpent)].spent=Math.max(0,num(e.target.value));await commit();return;}
    if(e.target.matches('[data-week-closed]')){const p=ensurePeriod(state,foodPeriodKey);p.foodWeeks[num(e.target.dataset.weekClosed)].closed=e.target.checked;await commit();return;}
  });
  document.addEventListener('focusin',e=>{if(e.target.matches('input[type="number"]'))e.target.select()});
}

async function init(){
  const saved=await loadState();state=validateState(saved)?saved:seedState(new Date());
  selectedPeriodKey=periodKeyForDate(new Date(),state.settings.salaryDay);foodPeriodKey=selectedPeriodKey;ensurePeriod(state,selectedPeriodKey);
  bindStaticEvents();bindDelegatedEvents();renderAll();$('#loading').hidden=true;$('#app').hidden=false;setScreen('home');
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init();
