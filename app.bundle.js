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
function mondayStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}
function dayAfterISO(value) {
  const d = parseISODate(value);
  d.setDate(d.getDate() + 1);
  return d;
}
function dateOverlapDays(aStart,aEnd,bStart,bEnd) {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, Math.ceil((end - start) / 86400000));
}
function makeFoodWeeks(key, plans=[], salaryDay=5) {
  const periodFrom = periodStart(key,salaryDay);
  const periodTo = periodEnd(key,salaryDay);
  const weeks = [];
  for(let from = mondayStart(periodFrom), index = 0; from <= periodTo; index++){
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
    const clippedFrom = from < periodFrom ? periodFrom : from;
    const clippedTo = to > periodTo ? periodTo : to;
    weeks.push({id:`${key}-w${index+1}`,index:index+1,start:toISODate(clippedFrom),end:toISODate(clippedTo),partial:clippedFrom.getTime()!==from.getTime()||clippedTo.getTime()!==to.getTime(),plan:Number(plans[index]||0),spent:0,closed:false});
    from = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
  }
  return weeks;
}
function currentWeekIndex(key,date=new Date(),salaryDay=5) {
  const weeks = makeFoodWeeks(key,[],salaryDay);
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const index = weeks.findIndex(week => current >= parseISODate(week.start) && current < dayAfterISO(week.end));
  return index >= 0 ? index : current < parseISODate(weeks[0]?.start) ? 0 : Math.max(0,weeks.length-1);
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
  category('gifts','Подарки','gift','#e4edf0','gift',7),
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
      savingsPlanUsd: 0,
      sections: ['payment','reserve'],
      categoryIds: ['food']
    },
    categoryBudgets,
    foodWeeks: makeFoodWeeks(key,[0,0,0,0]),
    balanceSnapshot: null,
    passThroughs: [],
    note: ''
  };
}

const payment=(periodKey,planned)=>({id:`payment-${periodKey}`,periodKey,title:'',planned,paid:0,note:''});
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
      debtInitial: 0,
      navLabels: true,
      navItems: ['home','month','savings','pet','purchases'],
      navIcons: {},
      sectionLabels: {},
      mandatoryLabels: {}
    },
    categories: structuredClone(DEFAULT_CATEGORIES),
    periods,
    payments: [],
    savings: [],
    purchases: [],
    pet: {balanceByn:0,avatarImage:'',transactions:[],needs:[]},
    safety: {amountUsd:0,goalUsd:2000,icon:'shield',iconImage:''},
    gifts: {balanceByn:0,transactions:[],plans:[],recipients:['Паше','Маме','Другому']}
  };
}

function alignFoodWeeks(period,salaryDay=5) {
  const expected = makeFoodWeeks(period.key,[],salaryDay);
  const current = Array.isArray(period.foodWeeks) ? period.foodWeeks : [];
  const aligned = current.length === expected.length && current.every((week,index)=>week.start===expected[index].start&&week.end===expected[index].end);
  if(aligned){
    let changed = false;
    current.forEach((week,index)=>{if(week.partial!==expected[index].partial){week.partial=expected[index].partial;changed=true;}});
    return changed;
  }
  const migrated = expected.map(week=>({...week}));
  for(const oldWeek of current){
    const oldStart = parseISODate(oldWeek.start);
    const oldEnd = dayAfterISO(oldWeek.end);
    let bestIndex = 0, bestOverlap = -1;
    migrated.forEach((week,index)=>{
      const overlap = dateOverlapDays(oldStart,oldEnd,parseISODate(week.start),dayAfterISO(week.end));
      if(overlap>bestOverlap){bestOverlap=overlap;bestIndex=index;}
    });
    migrated[bestIndex].plan = roundMoney(Number(migrated[bestIndex].plan||0) + Number(oldWeek.plan||0));
    migrated[bestIndex].spent = roundMoney(Number(migrated[bestIndex].spent||0) + Number(oldWeek.spent||0));
  }
  period.foodWeeks = migrated;
  return true;
}

function ensurePeriod(state,key) {
  if(!state.periods[key]) state.periods[key]=createPeriod(key,'normal');
  const mandatory=state.periods[key].mandatory;
  mandatory.sections=Array.isArray(mandatory.sections)?mandatory.sections:['payment','reserve'];
  mandatory.categoryIds=Array.isArray(mandatory.categoryIds)?mandatory.categoryIds:['food'];
  if(!mandatory.categoryIds.includes('food'))mandatory.categoryIds.unshift('food');
  mandatory.sections=mandatory.sections.filter((id,index,arr)=>['payment','reserve'].includes(id)&&arr.indexOf(id)===index);
  mandatory.categoryIds=mandatory.categoryIds.filter((id,index,arr)=>state.categories.some(c=>c.id===id)&&arr.indexOf(id)===index);
  alignFoodWeeks(state.periods[key],state.settings?.salaryDay||5);
  for(const c of state.categories) if(c.kind!=='food'&&!state.periods[key].categoryBudgets[c.id]) state.periods[key].categoryBudgets[c.id]={plan:0,spent:0};
  if(state.periods[key].balanceNow!=null&&!state.periods[key].balanceSnapshot) captureBalanceSnapshot(state,state.periods[key]);
  return state.periods[key];
}
function foodBudget(period){return{plan:roundMoney(period.foodWeeks.reduce((s,w)=>s+Number(w.plan||0),0)),spent:roundMoney(period.foodWeeks.reduce((s,w)=>s+Number(w.spent||0),0))}}
function categoryBudget(period,category){return category.kind==='food'?foodBudget(period):(period.categoryBudgets[category.id]||{plan:0,spent:0})}
function periodIncome(period){return roundMoney(Number(period.salary||0)+Number(period.extraIncome||0))}
function periodPayment(state,key){let item=state.payments.find(p=>p.periodKey===key);if(!item){item=payment(key,0);state.payments.push(item)}return item}
const savingSign=t=>t.type==='deposit'?1:-1;
const savingCurrency=t=>t.currency||'usd';
const savingUsdAmount=t=>savingCurrency(t)==='byn'?0:Number(t.amountUsd||0);
const savingBynAmount=t=>savingCurrency(t)==='byn'?Number(t.amountByn||0):0;
function savingsBalanceUsd(state){return roundMoney(state.savings.reduce((s,t)=>s+savingSign(t)*savingUsdAmount(t),0))}
const savingAmountByn=(state,t)=>savingBynAmount(t);
function savingsBalanceByn(state){return roundMoney(state.savings.reduce((s,t)=>s+savingSign(t)*savingAmountByn(state,t),0))}
function petBalanceByn(state){return Number.isFinite(Number(state.pet?.balanceByn))?roundMoney(state.pet.balanceByn):roundMoney(state.pet.transactions.reduce((s,t)=>s+(t.type==='topup'?1:-1)*Number(t.amountByn||0),0))}
function paymentsPaidTotal(state){return roundMoney(state.payments.reduce((s,p)=>s+Number(p.paid||0),0))}
function debtRemaining(state){return Math.max(0,roundMoney(Number(state.settings.debtInitial||0)-paymentsPaidTotal(state)))}
function plannedCategoryTotal(state,period){return roundMoney(state.categories.filter(c=>c.visible).reduce((s,c)=>s+categoryBudget(period,c).plan,0))}
function periodCarryover(state,period){
  const previous=state.periods?.[shiftPeriodKey(period.key,-1)];
  if(!previous)return 0;
  const previousFree=previous.balanceNow==null?plannedFreeBalance(state,previous):liveFreeBalance(state,previous);
  return Math.max(0,roundMoney(previousFree));
}
function periodSavingsDepositedUsd(state,key){return roundMoney(state.savings.filter(t=>t.type==='deposit'&&periodKeyForDate(parseISODate(t.date),state.settings.salaryDay)===key).reduce((s,t)=>s+Number(t.amountUsd||0),0))}
function periodSavingsDepositedByn(state,key){return roundMoney(state.savings.filter(t=>t.type==='deposit'&&periodKeyForDate(parseISODate(t.date),state.settings.salaryDay)===key).reduce((s,t)=>s+savingAmountByn(state,t),0))}
function captureBalanceSnapshot(state,period){
  const payment=periodPayment(state,period.key);
  period.balanceSnapshot={
    housingSpent:Number(period.mandatory.housingSpent||0),reserveAllocated:Number(period.mandatory.reserveAllocated||0),paymentPaid:Number(payment.paid||0),savingsDepositedUsd:periodSavingsDepositedUsd(state,period.key),savingsDepositedByn:periodSavingsDepositedByn(state,period.key),
    categories:Object.fromEntries(Object.entries(period.categoryBudgets).map(([id,b])=>[id,Number(b.spent||0)])),
    food:period.foodWeeks.map(w=>Number(w.spent||0))
  };
  return period.balanceSnapshot;
}
function plannedFreeBalance(state,period){
  const savingsPlanByn=Number(period.mandatory.savingsPlanByn??period.mandatory.savingsPlanUsd??0);
  const sections=Array.isArray(period.mandatory.sections)?period.mandatory.sections:['payment','reserve'];
  const paymentPlan=sections.includes('payment')?Number(periodPayment(state,period.key).planned||0):0;
  const reservePlan=sections.includes('reserve')?Number(period.mandatory.reservePlan||0):0;
  const base=periodIncome(period)+periodCarryover(state,period)-Number(period.mandatory.housingPlan||0)-paymentPlan-reservePlan-savingsPlanByn-plannedCategoryTotal(state,period);
  const overCategories=state.categories.filter(c=>c.visible&&c.kind!=='food').reduce((s,c)=>{const b=categoryBudget(period,c);return s+Math.min(0,Number(b.plan||0)-Number(b.spent||0))},0);
  const foodVariance=period.foodWeeks.reduce((s,w)=>{const delta=Number(w.plan||0)-Number(w.spent||0);return s+(w.closed?delta:Math.min(0,delta))},0);
  return roundMoney(base+overCategories+foodVariance);
}
function liveFreeBalance(state,period){
  if(period.balanceNow==null)return plannedFreeBalance(state,period);
  const snapshot=period.balanceSnapshot||captureBalanceSnapshot(state,period),payment=periodPayment(state,period.key),saved=periodSavingsDepositedByn(state,period.key),savingsPlanByn=Number(period.mandatory.savingsPlanByn??period.mandatory.savingsPlanUsd??0);
  const sections=Array.isArray(period.mandatory.sections)?period.mandatory.sections:['payment','reserve'];
  const remainingPayment=sections.includes('payment')?Math.max(0,Number(payment.planned||0)-Number(payment.paid||0)):0;
  const remainingReserve=sections.includes('reserve')?Math.max(0,Number(period.mandatory.reservePlan||0)-Number(period.mandatory.reserveAllocated||0)):0;
  const remainingMandatory=Math.max(0,Number(period.mandatory.housingPlan||0)-Number(period.mandatory.housingSpent||0))+remainingPayment+remainingReserve+Math.max(0,savingsPlanByn-saved);
  const remainingCategories=state.categories.filter(c=>c.visible).reduce((sum,c)=>{
    if(c.kind==='food') return sum+period.foodWeeks.reduce((s,w)=>s+(w.closed?0:Math.max(0,Number(w.plan||0)-Number(w.spent||0))),0);
    const b=categoryBudget(period,c);return sum+Math.max(0,Number(b.plan||0)-Number(b.spent||0));
  },0);
  const newMandatorySpend=(Number(period.mandatory.housingSpent||0)-Number(snapshot.housingSpent||0))+(sections.includes('reserve')?(Number(period.mandatory.reserveAllocated||0)-Number(snapshot.reserveAllocated||0)):0)+(sections.includes('payment')?(Number(payment.paid||0)-Number(snapshot.paymentPaid||0)):0)+(saved-Number(snapshot.savingsDepositedByn??snapshot.savingsDepositedUsd??0));
  const newCategorySpend=state.categories.filter(c=>c.visible).reduce((sum,c)=>{
    if(c.kind==='food')return sum+period.foodWeeks.reduce((s,w,i)=>s+Number(w.spent||0)-Number(snapshot.food?.[i]||0),0);
    const b=categoryBudget(period,c);return sum+Number(b.spent||0)-Number(snapshot.categories?.[c.id]||0);
  },0);
  return roundMoney(Number(period.balanceNow||0)-remainingMandatory-remainingCategories-newMandatorySpend-newCategorySpend);
}
function purchaseAvailable(state,cost){return savingsBalanceUsd(state)>=Number(cost||0)}
function monthlySavingsRows(state){const map=new Map();for(const t of state.savings){const key=t.date.slice(0,7),row=map.get(key)||{period:key,deposited:0,withdrawn:0,depositedByn:0,withdrawnByn:0,notes:[]};if(t.type==='deposit'){row.deposited+=savingUsdAmount(t);row.depositedByn+=savingAmountByn(state,t)}else{row.withdrawn+=savingUsdAmount(t);row.withdrawnByn+=savingAmountByn(state,t)}if(t.note)row.notes.push(t.note);map.set(key,row)}return[...map.values()].sort((a,b)=>b.period.localeCompare(a.period))}
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
const imageToDataUrl = (file,maxSize=900,{cropSquare=false,zoom=1,offsetX=0,offsetY=0}={}) => new Promise((resolve,reject)=>{
  if(!file){resolve('');return;}
  const reader=new FileReader();
  reader.onerror=()=>reject(reader.error);
  reader.onload=()=>{
    const img=new Image();
    img.onerror=()=>reject(new Error('image'));
    img.onload=()=>{
      const sourceSize=Math.min(img.width,img.height);
      const zoomValue=cropSquare?Math.max(1,Math.min(4,num(zoom)||1)):1;
      const cropSize=sourceSize/zoomValue;
      const scale=Math.min(1,maxSize/(cropSquare?cropSize:Math.max(img.width,img.height)));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round((cropSquare?cropSize:img.width)*scale));
      canvas.height=Math.max(1,Math.round((cropSquare?cropSize:img.height)*scale));
      const ctx=canvas.getContext('2d');
      if(cropSquare){
        const maxShiftX=(img.width-cropSize)/2,maxShiftY=(img.height-cropSize)/2;
        const sx=Math.max(0,Math.min(img.width-cropSize,(img.width-cropSize)/2+(num(offsetX)||0)/100*maxShiftX));
        const sy=Math.max(0,Math.min(img.height-cropSize,(img.height-cropSize)/2+(num(offsetY)||0)/100*maxShiftY));
        ctx.drawImage(img,sx,sy,cropSize,cropSize,0,0,canvas.width,canvas.height);
      }else ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const transparentSource=file.type==='image/png'||file.type==='image/webp'||file.name?.toLowerCase().endsWith('.png');
      const format=transparentSource?(file.type==='image/webp'?'image/webp':'image/png'):'image/jpeg';
      resolve(format==='image/png'?canvas.toDataURL(format):canvas.toDataURL(format,.82));
    };
    img.src=reader.result;
  };
  reader.readAsDataURL(file);
});
function cropOptions(values,name){
  return {cropSquare:true,zoom:num(values[`${name}Zoom`])||1,offsetX:num(values[`${name}X`])||0,offsetY:num(values[`${name}Y`])||0};
}
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
function petAvatar(){return `<button class="pet-avatar-button" data-edit-pet-avatar aria-label="Изменить аватар питомца"><img src="${esc(state.pet?.avatarImage||'./icons/pet-face.png')}" alt="Сэмми" loading="lazy"></button>`}
function normalizeState(){
  state.settings.navItems=Array.isArray(state.settings.navItems)?state.settings.navItems:['home','month','savings','pet','purchases'];
  for(const id of ['home','month'])if(!state.settings.navItems.includes(id))state.settings.navItems.unshift(id);
  state.settings.navItems=state.settings.navItems.filter((id,index,arr)=>navDefaults.some(item=>item.id===id)&&arr.indexOf(id)===index);
  state.settings.sectionLabels=state.settings.sectionLabels&&typeof state.settings.sectionLabels==='object'?state.settings.sectionLabels:{};
  for(const id of ['food','pet']){
    const category=state.categories?.find(c=>c.id===id), item=navDefaults.find(x=>x.id===id);
    if(category&&item&&category.name!==item.label&&!state.settings.sectionLabels[id])state.settings.sectionLabels[id]=category.name;
  }
  const foodCategory=state.categories?.find(c=>c.id==='food');
  if(foodCategory)foodCategory.visible=true;
  state.pet=state.pet||{transactions:[],needs:[]};
  if(!Number.isFinite(Number(state.pet.balanceByn)))state.pet.balanceByn=petBalanceByn(state);
  state.pet.avatarImage=state.pet.avatarImage||'';
  state.safety=state.safety&&typeof state.safety==='object'?state.safety:{};
  state.safety.amountUsd=num(state.safety.amountUsd);
  state.safety.goalUsd=num(state.safety.goalUsd)||2000;
  state.safety.icon=state.safety.icon||'shield';
  state.safety.iconImage=state.safety.iconImage||'';
  state.gifts=state.gifts&&typeof state.gifts==='object'?state.gifts:{};
  state.gifts.balanceByn=num(state.gifts.balanceByn);
  state.gifts.transactions=Array.isArray(state.gifts.transactions)?state.gifts.transactions:[];
  state.gifts.plans=Array.isArray(state.gifts.plans)?state.gifts.plans:[];
  state.gifts.recipients=Array.isArray(state.gifts.recipients)&&state.gifts.recipients.length?state.gifts.recipients:['Паше','Маме','Другому'];
  const giftsCategory=state.categories?.find(c=>c.id==='gifts');
  if(giftsCategory)giftsCategory.kind='gift';
}

let state;
let activeScreen='home';
let selectedPeriodKey=periodKeyForDate(new Date(),5);
let foodPeriodKey=selectedPeriodKey;
let purchaseTab='required';
let saving=false;
let autoCloseTimer=null;

function currentPeriod(){const p=ensurePeriod(state,periodKeyForDate(new Date(),state.settings.salaryDay));syncPeriodAutoClosedWeeks(p);return p;}
function selectedPeriod(){const p=ensurePeriod(state,selectedPeriodKey);syncPeriodAutoClosedWeeks(p);return p;}
function categoryById(id){return state.categories.find(c=>c.id===id);}
function periodSavingsDeposited(key){return roundMoney(state.savings.filter(t=>t.type==='deposit'&&periodKeyForDate(new Date(`${t.date}T12:00:00`),state.settings.salaryDay)===key).reduce((s,t)=>s+num(t.amountUsd),0));}
function weekAvailable(week){return roundMoney(num(week.plan)-num(week.spent));}
function foodWeekAutoClosed(week,now=new Date()){
  const [y,m,d]=String(week.end).split('-').map(Number);
  return Number.isFinite(y)&&now>=new Date(y,m-1,d+1);
}
function syncPeriodAutoClosedWeeks(period,now=new Date()){
  let changed=false;
  for(const week of period?.foodWeeks||[]){
    const closed=foodWeekAutoClosed(week,now);
    if(week.closed!==closed){week.closed=closed;changed=true;}
  }
  return changed;
}
function syncAllAutoClosedWeeks(){
  return Object.keys(state.periods||{}).reduce((changed,key)=>{
    const period=ensurePeriod(state,key);
    return syncPeriodAutoClosedWeeks(period)||changed;
  },false);
}
function scheduleAutoWeekClose(){
  clearTimeout(autoCloseTimer);
  const now=new Date(), nextMidnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,1);
  autoCloseTimer=setTimeout(async()=>{if(syncAllAutoClosedWeeks())await commit();else renderAll();scheduleAutoWeekClose();},Math.max(1000,nextMidnight-now));
}
function categoryAvailable(period,category){const b=categoryBudget(period,category);return roundMoney(num(b.plan)-num(b.spent));}
function visibleCategories(){return [...state.categories].filter(c=>c.visible).sort((a,b)=>a.order-b.order);}
function mandatorySections(period){
  period.mandatory.sections=Array.isArray(period.mandatory.sections)?period.mandatory.sections:['payment','reserve'];
  period.mandatory.sections=period.mandatory.sections.filter((id,index,arr)=>['payment','reserve'].includes(id)&&arr.indexOf(id)===index);
  return period.mandatory.sections;
}
function mandatoryCategoryIds(period){
  period.mandatory.categoryIds=Array.isArray(period.mandatory.categoryIds)?period.mandatory.categoryIds:['food'];
  if(!period.mandatory.categoryIds.includes('food'))period.mandatory.categoryIds.unshift('food');
  period.mandatory.categoryIds=period.mandatory.categoryIds.filter((id,index,arr)=>state.categories.some(c=>c.id===id)&&arr.indexOf(id)===index);
  return period.mandatory.categoryIds;
}
function mandatoryCategories(period){
  const ids=mandatoryCategoryIds(period);
  return ids.map(id=>categoryById(id)).filter(c=>c&&(c.visible||c.id==='food')).sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));
}
function optionalCategories(period){
  const ids=mandatoryCategoryIds(period);
  return visibleCategories().filter(c=>!ids.includes(c.id));
}
function totalOpenNeeds(){return state.pet.needs.filter(n=>!n.completed).reduce((s,n)=>s+num(n.costByn),0);}
function greeting(){const h=new Date().getHours();return h<12?'Доброе утро':h<18?'Добрый день':'Добрый вечер';}
function dashboardStatus(value){return value<0?'status-bad':'status-good';}
function txSavingCurrency(t){return t.currency||'usd';}
function savingTxUsd(t){return txSavingCurrency(t)==='byn'?0:num(t.amountUsd);}
function savingTxByn(t){return txSavingCurrency(t)==='byn'?num(t.amountByn):0;}
function formatSavingsTotal(usd,byn){return num(byn)!==0?`${formatUsd(usd)} + ${formatByn(byn)}`:formatUsd(usd);}
function formatSavingTx(t){return txSavingCurrency(t)==='byn'?formatByn(savingTxByn(t)):formatUsd(savingTxUsd(t));}
function purchaseCostUsd(item){return num(item?.costUsd ?? item?.costByn);}
function safetyIconHtml(size=25){return state.safety.iconImage?`<img class="custom-category-icon" src="${esc(state.safety.iconImage)}" alt="">`:icon(state.safety.icon||'shield',size);}
function safetyProgressText(){return num(state.safety.amountUsd)>=num(state.safety.goalUsd)?formatUsd(state.safety.amountUsd):`${formatUsd(state.safety.amountUsd)} / ${formatUsd(state.safety.goalUsd)}`;}
function giftBalanceByn(){return roundMoney(state.gifts.transactions.reduce((sum,t)=>sum+(t.type==='topup'?1:-1)*num(t.amountByn),num(state.gifts.balanceByn||0)));}
function giftPinnedRank(item){return item.recipient==='Паше'?0:item.recipient==='Маме'?1:2;}
const dashboardDefaults=['savings','payments','pet','purchases'];
const navDefaults=[
  {id:'home',icon:'home',label:'Главная'},
  {id:'month',icon:'calendar',label:'Месяц'},
  {id:'food',icon:'utensils',label:'Еда'},
  {id:'savings',icon:'piggy',label:'Накопления'},
  {id:'payments',icon:'money',label:'Платежи'},
  {id:'pet',icon:'paw',label:'Питомец'},
  {id:'purchases',icon:'bag',label:'Покупки'}
];
function sectionLabels(){
  state.settings.sectionLabels=state.settings.sectionLabels&&typeof state.settings.sectionLabels==='object'?state.settings.sectionLabels:{};
  return state.settings.sectionLabels;
}
function sectionLabel(id){
  const item=navDefaults.find(x=>x.id===id);
  return sectionLabels()[id]||item?.label||id;
}
function setSectionLabel(id,name){
  const item=navDefaults.find(x=>x.id===id), value=String(name||'').trim();
  if(!item||!value)return;
  if(value===item.label)delete sectionLabels()[id];else sectionLabels()[id]=value;
  const linkedCategory=state.categories?.find(c=>c.id===id&&['food','pet'].includes(c.kind));
  if(linkedCategory)linkedCategory.name=value;
}
function mandatoryLabels(){
  state.settings.mandatoryLabels=state.settings.mandatoryLabels&&typeof state.settings.mandatoryLabels==='object'?state.settings.mandatoryLabels:{};
  return state.settings.mandatoryLabels;
}
function mandatoryLabel(id){
  return mandatoryLabels()[id]||({housing:'Квартира',reserve:'Резерв'}[id]||id);
}
function setMandatoryLabel(id,name){
  const value=String(name||'').trim(), defaults={housing:'Квартира',reserve:'Резерв'};
  if(!value)return;
  if(value===defaults[id])delete mandatoryLabels()[id];else mandatoryLabels()[id]=value;
}
function dashboardCards(){
  state.settings.dashboardCards=Array.isArray(state.settings.dashboardCards)?state.settings.dashboardCards:[...dashboardDefaults];
  state.settings.dashboardCards=state.settings.dashboardCards.filter((id,index,arr)=>isDashboardCardAvailable(id)&&arr.indexOf(id)===index);
  return state.settings.dashboardCards;
}
function dashboardCategoryKey(id){return `cat:${id}`;}
function dashboardCategoryId(key){return String(key||'').startsWith('cat:')?String(key).slice(4):'';}
function isDashboardCardAvailable(id){
  if(dashboardDefaults.includes(id))return true;
  const categoryId=dashboardCategoryId(id);
  return !!categoryId&&!!state.categories?.some(c=>c.id===categoryId&&c.visible);
}
function navIconSettings(){
  state.settings.navIcons=state.settings.navIcons&&typeof state.settings.navIcons==='object'?state.settings.navIcons:{};
  return state.settings.navIcons;
}
function navItems(){
  state.settings.navItems=Array.isArray(state.settings.navItems)?state.settings.navItems:['home','month','savings','pet','purchases'];
  for(const id of ['home','month'])if(!state.settings.navItems.includes(id))state.settings.navItems.unshift(id);
  return state.settings.navItems.filter(id=>navDefaults.some(item=>item.id===id));
}
function showNavLabels(){
  if(typeof state.settings.navLabels!=='boolean')state.settings.navLabels=true;
  return state.settings.navLabels;
}
function appearanceSettings(){
  state.settings.appearance=state.settings.appearance&&typeof state.settings.appearance==='object'?state.settings.appearance:{};
  return state.settings.appearance;
}
function safeHex(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||''))?value:fallback;}
function applyAppearance(){
  if(!state?.settings)return;
  const a=appearanceSettings(), root=document.documentElement;
  root.style.setProperty('--green',safeHex(a.primary,'#4caf50'));
  root.style.setProperty('--bg',safeHex(a.background,'#fbfcfb'));
  root.style.setProperty('--card',safeHex(a.card,'#ffffff'));
  root.style.setProperty('--heading',safeHex(a.heading,'#111827'));
  document.body.style.backgroundImage=a.backgroundImage?`linear-gradient(rgba(255,255,255,.72),rgba(255,255,255,.72)),url("${a.backgroundImage}")`:'';
  document.body.style.backgroundSize=a.backgroundImage?'cover':'';
  document.body.style.backgroundAttachment=a.backgroundImage?'fixed':'';
  if(a.appIcon){document.querySelector('link[rel="icon"]')?.setAttribute('href',a.appIcon);document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href',a.appIcon)}
}
function navItemIconHtml(item,size=21){
  const custom=navIconSettings()[item.id]||{};
  if(custom.image)return `<img class="custom-nav-icon" src="${esc(custom.image)}" alt="">`;
  return icon(custom.icon||item.icon,size);
}
function sharedSectionIconHtml(id,size=22){
  const item=navDefaults.find(x=>x.id===id);
  return item?navItemIconHtml(item,size):icon(id,size);
}

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
  const overlay=['food','gifts','payments','settings'].includes(id);
  $('#settingsBtn').hidden=overlay;
  $('#closeOverlayBtn').hidden=!overlay;
  const titles={home:sectionLabel('home'),month:sectionLabel('month'),savings:sectionLabel('savings'),pet:sectionLabel('pet'),purchases:sectionLabel('purchases'),food:sectionLabel('food'),gifts:'Подарки',payments:sectionLabel('payments'),settings:'Настройки'};
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
  $('#freeMeta').textContent=p.balanceNow==null ? `План месяца: ${formatByn(plannedFreeBalance(state,p))}` : `На счету ${formatByn(p.balanceNow)}${p.cashNow?` · отдельно ${formatByn(p.cashNow)} не считается`:''}`;
  $('#freeCard').className=`hero-card ${dashboardStatus(free)}`;
  $('#weekAvailable').textContent=formatByn(available);
  $('#weekCard span').textContent=`${sectionLabel('food')} · эта неделя`;
  $('#weekAvailable').className=budgetValueClass(week.plan,available);
  $('#weekSpent').textContent=formatByn(week.spent);
  $('#weekCard').classList.toggle('card-negative',available<0);
  $('#weekCard').classList.toggle('card-warning',num(week.plan)>0&&available>=0&&available<=num(week.plan)*0.2);
  $('#daysToSalary').textContent=pluralDays(daysToNextSalary(new Date(),state.settings.salaryDay));

  const savings=savingsBalanceUsd(state), pet=petBalanceByn(state), debt=Math.max(0,roundMoney((num(state.settings.debtInitial)||state.payments.reduce((s,p)=>s+num(p.planned),0))-paymentsPaidTotal(state)));
  const openPurchases=state.purchases.filter(pu=>!pu.completed);
  const affordable=openPurchases.filter(pu=>purchaseAvailable(state,purchaseCostUsd(pu))).length;
  const rowMap={
    savings:{id:'savings',icon:'piggy',tone:'green',title:sectionLabel('savings'),value:formatSavingsTotal(savings,savingsBalanceByn(state)),meta:savingsBalanceByn(state)>0?'есть BYN для обмена':'только USD'},
    payments:{id:'payments',icon:'money',tone:'blue',title:sectionLabel('payments'),value:formatByn(debt),meta:'осталось закрыть'},
    pet:{id:'pet',icon:'paw',tone:'peach',title:sectionLabel('pet'),value:formatByn(pet),meta:`нужно запланировано ${formatByn(totalOpenNeeds())}`},
    purchases:{id:'purchases',icon:'bag',tone:'lavender',title:sectionLabel('purchases'),value:`${openPurchases.length}`,meta:affordable?`${affordable} уже доступны`:'пока накоплений не хватает'}
  };
  const categoryRow=id=>{const c=categoryById(dashboardCategoryId(id));if(!c||!c.visible)return null;const b=categoryBudget(p,c), left=roundMoney(num(b.plan)-num(b.spent));return {id,category:c,title:c.name,value:formatByn(left),meta:`план ${formatByn(b.plan)} · потрачено ${formatByn(b.spent)}`};};
  const rows=dashboardCards().map(id=>rowMap[id]||categoryRow(id)).filter(Boolean);
  $('#dashboardList').innerHTML=rows.map(r=>`<button class="dashboard-row" data-dashboard="${r.id}"><span class="dashboard-icon ${r.tone||''}" ${r.category?`style="background:${esc(r.category.color)}"`:''}>${r.category?categoryIconHtml(r.category):sharedSectionIconHtml(r.id)}</span><span class="dashboard-copy"><b>${esc(r.title)}</b><small>${esc(r.meta)}</small></span><strong>${esc(r.value)}</strong>${icon('chevronRight',18)}</button>`).join('');
}

function metric(label,value,fieldHtml=''){return `<div class="metric"><span>${label}</span>${fieldHtml||`<strong>${value}</strong>`}</div>`;}
function categoryIconHtml(category,size=22){return category.iconImage?`<img class="custom-category-icon" src="${category.iconImage}" alt="">`:icon(category.icon,size);}
function renderMandatoryCard(name,plan,spent,kind,{locked=false}={}){
  const available=roundMoney(plan-spent);
  return `<article class="mandatory-card ${budgetToneClass(plan,available)}"><div class="mandatory-title"><b>${esc(name)}</b><span class="settings-actions"><button class="mini-icon" data-edit-mandatory="${kind}" aria-label="Изменить">${icon('edit',17)}</button>${locked?'':`<button class="mini-icon" data-remove-mandatory-section="${kind}" aria-label="Убрать из обязательного">${icon('close',16)}</button>`}</span></div><div class="metrics-row">${metric('План',formatByn(plan))}${metric('Потрачено',formatByn(spent))}${metric('Доступно',`<span class="${budgetValueClass(plan,available)}">${formatByn(available)}</span>`)}</div></article>`;
}
function renderCategoryCard(category,period,{mandatory=false}={}){
  const b=categoryBudget(period,category), available=roundMoney(b.plan-b.spent);
  const food=category.kind==='food', pet=category.kind==='pet', gift=category.kind==='gift';
  const input=food ? `<button class="inline-link" data-open-food="1">${formatByn(b.spent)}</button>` : pet ? `<button class="inline-link" data-nav-to="pet">${formatByn(b.spent)}</button>` : `<input class="number-field compact" data-category-spent="${category.id}" inputmode="decimal" type="number" min="0" step="1" value="${num(b.spent)}" aria-label="Потрачено: ${esc(category.name)}">`;
  const actions=`<span class="settings-actions"><button class="mini-icon" data-edit-category="${category.id}" aria-label="Изменить категорию">${icon('edit',17)}</button>${mandatory&&category.id!=='food'?`<button class="mini-icon" data-remove-mandatory-category="${category.id}" aria-label="Убрать из обязательного">${icon('close',16)}</button>`:!mandatory?`<button class="mini-icon" data-add-mandatory-category="${category.id}" aria-label="В обязательное">${icon('plus',16)}</button>`:''}</span>`;
  const detailAttr=food||pet||gift?` data-open-category-detail="${category.id}"`:'';
  return `<article class="category-card ${budgetToneClass(b.plan,available)}" data-category="${category.id}"${detailAttr}>
    <div class="category-head"><span class="category-icon" style="background:${esc(category.color)}">${categoryIconHtml(category)}</span><div><b>${esc(category.name)}</b><small>${mandatory?'обязательное этого месяца':category.kind==='food'?'по неделям':category.kind==='pet'?'пополнение внутреннего баланса':category.kind==='gift'?'конверт подарков':'месячный лимит'}</small></div>${actions}</div>
    <div class="metrics-row">${metric('План',formatByn(b.plan))}${metric('Потрачено','',input)}${metric('Доступно',`<span class="${budgetValueClass(b.plan,available)}">${formatByn(available)}</span>`)}</div>
  </article>`;
}
function renderMonth(){
  const p=selectedPeriod(), payment=periodPayment(state,p.key);
  const sections=mandatorySections(p);
  const addableSections=[!sections.includes('payment')?`<button class="text-button" data-add-mandatory-section="payment">+ ${esc(sectionLabel('payments'))}</button>`:'',!sections.includes('reserve')?`<button class="text-button" data-add-mandatory-section="reserve">+ ${esc(mandatoryLabel('reserve'))}</button>`:''].filter(Boolean).join('');
  $('#monthTitle').textContent=periodTitle(p.key);$('#monthRange').textContent=formatPeriodRange(p.key,state.settings.salaryDay);
  const carryover=periodCarryover(state,p), totalIncome=roundMoney(periodIncome(p)+carryover);
  $('#incomeTotal').textContent=formatByn(totalIncome);
  $('#incomeDetails').textContent=`Зарплата ${formatByn(p.salary)}${p.extraIncome?` · Доп. доход ${formatByn(p.extraIncome)}`:''}${carryover?` · Остаток прошлого месяца ${formatByn(carryover)}`:''}`;
  $('#mandatoryGrid').innerHTML=[
    renderMandatoryCard(mandatoryLabel('housing'),num(p.mandatory.housingPlan),num(p.mandatory.housingSpent),'housing',{locked:true}),
    sections.includes('payment')?renderMandatoryCard(sectionLabel('payments'),num(payment.planned),num(payment.paid),'payment'):null,
    sections.includes('reserve')?renderMandatoryCard(mandatoryLabel('reserve'),num(p.mandatory.reservePlan),num(p.mandatory.reserveAllocated),'reserve'):null,
    ...mandatoryCategories(p).map(c=>renderCategoryCard(c,p,{mandatory:true}))
  ].filter(Boolean).join('')+(addableSections?`<article class="pass-through"><div><b>Добавить в обязательное</b><small>Для ${periodTitle(p.key)} можно вернуть скрытые обязательные пункты.</small></div><div class="settings-actions">${addableSections}</div></article>`:'')+`<article class="pass-through"><label class="check-label"><input type="checkbox" data-utility-paid="${p.key}" ${p.passThroughs?.[0]?.paid?'checked':''}><span>${p.passThroughs?.[0]?.paid?'Оплачено':'Не оплачено'}</span></label><div><b>Коммунальные ${formatByn(p.passThroughs?.[0]?.amount||120)}</b><small>Аванс 25 числа приходит и сразу уходит. Основной доход не уменьшается.</small></div></article>`;
  $('#categoryList').innerHTML=optionalCategories(p).map(c=>renderCategoryCard(c,p)).join('')||'<div class="empty-state">Все видимые категории уже в обязательном для этого месяца</div>';
  const free=p.balanceNow==null?plannedFreeBalance(state,p):liveFreeBalance(state,p);
  $('#monthFreeValue').textContent=formatByn(free);
  $('#monthLimitMeta').textContent=`Лимиты категорий: ${formatByn(plannedCategoryTotal(state,p))}`;
  $('#monthFreeCard').classList.toggle('negative',free<0);
}

function renderFood(){
  const p=ensurePeriod(state,foodPeriodKey), total=foodBudget(p);
  syncPeriodAutoClosedWeeks(p);
  $('#foodMonthTitle').textContent=periodTitle(p.key);$('#foodMonthRange').textContent=formatPeriodRange(p.key,state.settings.salaryDay);
  const available=roundMoney(total.plan-total.spent);
  $('#foodTotal').innerHTML=`<div>${metric('План',formatByn(total.plan))}${metric('Потрачено',formatByn(total.spent))}${metric('Доступно',`<span class="${budgetValueClass(total.plan,available)}">${formatByn(available)}</span>`)}</div>`;
  $('#foodTotal').classList.toggle('card-negative',available<0);
  $('#foodTotal').classList.toggle('card-warning',num(total.plan)>0&&available>=0&&available<=num(total.plan)*0.2);
  $('#foodWeeks').innerHTML=p.foodWeeks.map((w,index)=>{
    const av=weekAvailable(w);
    return `<article class="food-week ${budgetToneClass(w.plan,av)}"><header><div><b>Неделя ${index+1}</b><small>${shortDate(w.start)} — ${shortDate(w.end)}${w.partial?' · неполная неделя':''}</small></div><label class="check-label"><input type="checkbox" ${w.closed?'checked':''} disabled><span>${w.closed?'Закрыта':'Закроется автоматически'}</span></label></header><div class="metrics-row">${metric('План','',`<input class="number-field compact" type="number" min="0" step="1" inputmode="decimal" data-week-plan="${index}" value="${num(w.plan)}">`)}${metric('Потрачено','',`<input class="number-field compact" type="number" min="0" step="1" inputmode="decimal" data-week-spent="${index}" value="${num(w.spent)}">`)}${metric('Доступно',`<span class="${budgetValueClass(w.plan,av)}">${formatByn(av)}</span>`)}</div></article>`;
  }).join('');
}

function renderSavings(){
  const balance=savingsBalanceUsd(state), balanceByn=savingsBalanceByn(state);
  $('#savingsBalance').textContent=formatSavingsTotal(balance,balanceByn);
  $('#savingsEquivalent').innerHTML=balanceByn>0?`<button class="savings-alert" data-exchange-savings-byn>Обменять ${formatByn(balanceByn)} в USD</button>`:'Все накопления в USD';
  $('#safetyCard').innerHTML=`<button class="safe-icon" data-edit-safety aria-label="Изменить подушку безопасности">${safetyIconHtml()}</button><div><span>Подушка безопасности</span><strong>${safetyProgressText()}</strong><small>Не участвует в расчетах и доступных накоплениях</small></div><button class="mini-icon" data-edit-safety>${icon('edit',16)}</button>`;
  const rows=monthlySavingsRows(state);
  $('#monthlySavings').innerHTML=rows.length?rows.map(row=>{const net=roundMoney(row.deposited-row.withdrawn), netByn=roundMoney(row.depositedByn-row.withdrawnByn);return `<article class="monthly-row"><div><b>${periodTitle(row.period)}</b><small>${row.notes.slice(0,2).map(esc).join(' · ')||'Без комментария'}</small></div><div><span>Отложила ${formatSavingsTotal(row.deposited,row.depositedByn)}</span><span>Взяла ${formatSavingsTotal(row.withdrawn,row.withdrawnByn)}</span><strong class="${net<0||netByn<0?'negative-number':''}">${formatSavingsTotal(net,netByn)}</strong></div></article>`}).join(''):'<div class="empty-state">В этом разделе пока нет данных</div>';
  $('#savingsHistory').innerHTML=state.savings.length?[...state.savings].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<article class="history-row"><span class="history-icon ${t.type==='deposit'?'green':'red'}">${icon(t.type==='deposit'?'arrowDown':'arrowUp',18)}</span><div><b class="${t.type==='withdraw'?'negative-number':''}">${t.type==='deposit'?'+':'−'} ${formatSavingTx(t)}</b><small>${esc(t.note||'Без комментария')} · ${dateLabel(t.date)}</small></div><button class="mini-icon" data-delete-saving="${t.id}" aria-label="Удалить">${icon('trash',17)}</button></article>`).join(''):'<div class="empty-state">История пока пустая</div>';
}

function renderPet(){
  const balance=petBalanceByn(state), open=state.pet.needs.filter(n=>!n.completed), needsTotal=totalOpenNeeds();
  $('#petAvatar').innerHTML=petAvatar();$('#petBalance').textContent=formatByn(balance);$('.pet-hero span').textContent=`Баланс: ${sectionLabel('pet')}`;
  $('#petNeedSummary').textContent=open.length?`На открытые планы нужно ${formatByn(needsTotal)}`:'Открытых планов нет';
  $('#petNeeds').innerHTML=open.length?open.map(n=>{const missing=Math.max(0,num(n.costByn)-balance), enough=missing===0;return `<article class="need-card ${enough?'affordable':''}"><div class="need-main"><label class="round-check"><input type="checkbox" data-complete-need="${n.id}"><span>${icon('check',15)}</span></label><div><b>${esc(n.name)}</b><small>${n.dueDate?`До ${dateLabel(n.dueDate)}`:'Без срока'}${n.note?` · ${esc(n.note)}`:''}</small></div></div><div class="need-value"><b>${formatByn(n.costByn)}</b><small class="${enough?'success-text':'negative-number'}">${enough?'Баланс позволяет':`Не хватает ${formatByn(missing)}`}</small><button class="mini-icon" data-edit-need="${n.id}">${icon('edit',16)}</button></div></article>`}).join(''):'<div class="empty-state">Добавь покупку, прививку или визит к ветеринару</div>';
  $('#petHistory').innerHTML=state.pet.transactions.length?[...state.pet.transactions].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<article class="history-row"><span class="history-icon ${t.type==='topup'?'green':'red'}">${icon(t.type==='topup'?'arrowDown':'arrowUp',18)}</span><div><b class="${t.type==='spend'?'negative-number':''}">${t.type==='topup'?'+':'−'} ${formatByn(t.amountByn)}</b><small>${esc(t.note||'Без комментария')} · ${dateLabel(t.date)}</small></div><button class="mini-icon" data-delete-pet-tx="${t.id}">${icon('trash',17)}</button></article>`).join(''):'<div class="empty-state">История баланса пока пустая</div>';
}

function renderGifts(){
  const balance=giftBalanceByn(), open=state.gifts.plans.filter(g=>!g.completed);
  $('#giftBalance').textContent=formatByn(balance);
  $('#giftSummary').textContent=open.length?`Запланировано ${open.length} · нужно ${formatByn(open.reduce((s,g)=>s+num(g.costByn),0))}`:'Планов подарков пока нет';
  $('#giftPlans').innerHTML=open.length?[...open].sort((a,b)=>giftPinnedRank(a)-giftPinnedRank(b)||a.name.localeCompare(b.name)).map(g=>{
    const color=g.color||'#e4edf0', enough=balance>=num(g.costByn);
    return `<article class="gift-card ${enough?'affordable':''}" style="--gift-color:${esc(color)}">${g.imageDataUrl?`<img class="purchase-thumb" src="${g.imageDataUrl}" alt="">`:`<span class="gift-envelope">✉</span>`}<div><b>${esc(g.name)}</b><small>${esc(g.recipient||'Другому')}${g.note?` · ${esc(g.note)}`:''}</small>${g.link?`<a href="${esc(g.link)}" target="_blank" rel="noreferrer">Ссылка на подарок</a>`:''}</div><div class="purchase-cost"><b>${formatByn(g.costByn)}</b><small class="${enough?'success-text':'negative-number'}">${enough?'Конверт позволяет':`Не хватает ${formatByn(num(g.costByn)-balance)}`}</small><div><button class="mini-icon" data-complete-gift="${g.id}">${icon('check',16)}</button><button class="mini-icon" data-edit-gift="${g.id}">${icon('edit',16)}</button></div></div></article>`;
  }).join(''):'<div class="empty-state">Добавь подарок, ссылку или идею</div>';
  $('#giftHistory').innerHTML=state.gifts.transactions.length?[...state.gifts.transactions].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<article class="history-row"><span class="history-icon ${t.type==='topup'?'green':'red'}">${icon(t.type==='topup'?'arrowDown':'arrowUp',18)}</span><div><b class="${t.type==='spend'?'negative-number':''}">${t.type==='topup'?'+':'−'} ${formatByn(t.amountByn)}</b><small>${esc(t.note||'Без комментария')} · ${dateLabel(t.date)}</small></div><button class="mini-icon" data-delete-gift-tx="${t.id}">${icon('trash',17)}</button></article>`).join(''):'<div class="empty-state">История конверта пока пустая</div>';
}

const purchaseTitles={required:'Обязательные',desired:'Желательные',wish:'Просто хочется'};
function renderPurchases(){
  const savings=savingsBalanceUsd(state), byn=savingsBalanceByn(state);
  $('#purchaseSavingsByn').textContent=formatByn(byn);$('#purchaseSavingsUsd').textContent=formatUsd(savings);
  $$('#purchaseTabs button').forEach(b=>b.classList.toggle('active',b.dataset.purchaseTab===purchaseTab));$('#purchaseTitle').textContent=purchaseTitles[purchaseTab];
  const items=state.purchases.filter(p=>p.priority===purchaseTab&&!p.completed);
  $('#purchaseList').innerHTML=items.length?items.map(p=>{const cost=purchaseCostUsd(p), enough=purchaseAvailable(state,cost), missing=Math.max(0,cost-savings);return `<article class="purchase-card ${enough?'affordable':''}">${p.imageDataUrl?`<img class="purchase-thumb" src="${p.imageDataUrl}" alt="">`:''}<div><b>${esc(p.name)}</b>${p.note?`<small>${esc(p.note)}</small>`:''}</div><div class="purchase-cost"><b>${formatUsd(cost)}</b><small class="${enough?'success-text':'negative-number'}">${enough?'Накоплений хватает':`Не хватает ${formatUsd(missing)}`}</small><div><button class="mini-icon" data-complete-purchase="${p.id}">${icon('check',16)}</button><button class="mini-icon" data-edit-purchase="${p.id}">${icon('edit',16)}</button></div></div></article>`}).join(''):'<div class="empty-state">В этом разделе пока нет покупок</div>';
}

function renderPayments(){
  const paid=paymentsPaidTotal(state), planned=roundMoney(state.payments.reduce((s,p)=>s+num(p.planned),0)), initial=num(state.settings.debtInitial)||planned, remaining=Math.max(0,roundMoney(initial-paid)), progress=initial?Math.min(100,paid/initial*100):0;
  $('#debtRemaining').textContent=formatByn(remaining);$('#debtProgress').style.width=`${progress}%`;$('#debtMeta').textContent=`Оплачено ${formatByn(paid)} из ${formatByn(initial)}`;
  const sorted=[...state.payments].sort((a,b)=>a.periodKey.localeCompare(b.periodKey));
  $('#paymentsList').innerHTML=sorted.map(p=>{const left=Math.max(0,num(p.planned)-num(p.paid)), title=p.title?.trim()||periodTitle(p.periodKey);return `<article class="payment-row ${p.planned>0&&p.paid<=0?'planned':''}"><div><b>${esc(title)}</b><small>${p.note?esc(p.note):p.title?.trim()?periodTitle(p.periodKey):left===0&&p.planned>0?'Оплачено':'Плановый платеж'}</small></div><div><span>План ${formatByn(p.planned)}</span><span>Оплачено ${formatByn(p.paid)}</span><strong>${left?`Осталось ${formatByn(left)}`:'Закрыто'}</strong><button class="mini-icon" data-edit-payment="${p.id}">${icon('edit',16)}</button></div></article>`}).join('');
}

function renderSettings(){
  $('#editGeneralBtn').innerHTML=`<span><b>Профиль и расчеты</b><small>${esc(state.settings.profileName)} · зарплата ${state.settings.salaryDay} числа</small></span>${icon('chevronRight',18)}`;
  $('#editAppearanceBtn').innerHTML=`<span><b>Цвета, фон и иконка</b><small>HEX-коды, кастомный фон и иконка приложения</small></span>${icon('chevronRight',18)}`;
  $('#settingsNavIcons').innerHTML=`<label class="toggle-field"><input type="checkbox" data-nav-labels ${showNavLabels()?'checked':''}><span><b>Показывать названия</b><small>Если выключить, нижнее меню останется только с крупными иконками.</small></span></label>`+navDefaults.map(item=>`<article class="settings-row dashboard-setting"><span><span class="nav-icon-preview">${navItemIconHtml(item,20)}</span><span><b>${esc(sectionLabel(item.id))}</b><small>${['home','month'].includes(item.id)?'Обязательный раздел':navItems().includes(item.id)?'Показывается':'Скрыт'}</small></span></span><span class="settings-actions"><label class="mini-toggle"><input type="checkbox" data-nav-item="${item.id}" ${navItems().includes(item.id)?'checked':''} ${['home','month'].includes(item.id)?'disabled':''}><span></span></label><button class="mini-icon" data-edit-nav-icon="${item.id}" aria-label="Изменить раздел">${icon('edit',16)}</button></span></article>`).join('');
  const cardLabels={savings:sectionLabel('savings'),payments:sectionLabel('payments'),pet:sectionLabel('pet'),purchases:sectionLabel('purchases')};
  const dashboardLabel=id=>cardLabels[id]||categoryById(dashboardCategoryId(id))?.name||id;
  const dashboardList=dashboardCards(), availableDashboard=[...dashboardDefaults,...visibleCategories().map(c=>dashboardCategoryKey(c.id))].filter(id=>!dashboardList.includes(id)&&isDashboardCardAvailable(id));
  $('#settingsDashboardCards').innerHTML=dashboardList.map((id,index)=>`<article class="settings-row dashboard-setting"><span><b>${esc(dashboardLabel(id))}</b><small>${index+1} на главной</small></span><span class="settings-actions"><button class="mini-icon" data-card-up="${id}" ${index===0?'disabled':''}>${icon('chevronLeft',16)}</button><button class="mini-icon" data-card-down="${id}" ${index===dashboardList.length-1?'disabled':''}>${icon('chevronRight',16)}</button><button class="mini-icon" data-card-remove="${id}" aria-label="Скрыть">${icon('close',16)}</button></span></article>`).join('')+availableDashboard.map(id=>`<button class="settings-row" data-card-add="${id}"><span><b>${esc(dashboardLabel(id))}</b><small>${dashboardCategoryId(id)?'Категория · скрыта':'Скрыта'}</small></span>${icon('plus',18)}</button>`).join('');
  $('#settingsCategories').innerHTML=[...state.categories].sort((a,b)=>a.order-b.order).map(c=>`<button class="settings-row" data-settings-category="${c.id}"><span><span class="category-icon" style="background:${esc(c.color)}">${categoryIconHtml(c,20)}</span><span><b>${esc(c.name)}</b><small>${c.visible?'Показывается':'Скрыта'} · ${c.kind==='food'?'по неделям':['pet','gift'].includes(c.kind)?'расширенная':'обычная'}</small></span></span>${icon('chevronRight',18)}</button>`).join('');
  $('#exportBtn').innerHTML=`<span>${icon('download',20)}<b>Скачать резервную копию</b></span>${icon('chevronRight',18)}`;
  $('#importContent').innerHTML=`<span>${icon('upload',20)}<b>Восстановить из копии</b></span>${icon('chevronRight',18)}`;
  $('#resetBtn').innerHTML=`<span>${icon('trash',20)}<b>Сбросить данные</b></span>${icon('chevronRight',18)}`;
}

function renderNav(){
  const nav=$('.bottom-nav'), labels=showNavLabels();
  const visible=navItems();
  nav.style.setProperty('--nav-count',visible.length);
  nav.classList.toggle('icons-only',!labels);
  $$('.bottom-nav button').forEach((button,index)=>{const item=navDefaults[index],shown=visible.includes(item.id);button.hidden=!shown;button.innerHTML=`${navItemIconHtml(item,labels?21:31)}${labels?`<small>${sectionLabel(item.id)}</small>`:''}`;button.classList.toggle('active',activeScreen===item.id);});
  $('#settingsBtn').innerHTML=icon('settings',21);$('#closeOverlayBtn').innerHTML=icon('close',21);
  $('#prevMonth').innerHTML=icon('chevronLeft');$('#nextMonth').innerHTML=icon('chevronRight');$('#foodPrevMonth').innerHTML=icon('chevronLeft');$('#foodNextMonth').innerHTML=icon('chevronRight');
  $('#editBalanceBtn').innerHTML=icon('edit',17);$('#addCategoryBtn').innerHTML=`${icon('plus',17)} Добавить`;$('#depositSavings').innerHTML=`${icon('plus',18)} Отложить`;$('#withdrawSavings').innerHTML=`${icon('minus',18)} Взять`;$('#topupPet').innerHTML=`${icon('plus',18)} Пополнить`;$('#spendPet').innerHTML=`${icon('minus',18)} Вычесть`;$('#topupGifts').innerHTML=`${icon('plus',18)} Пополнить`;$('#spendGifts').innerHTML=`${icon('minus',18)} Вычесть`;$('#addPetNeed').innerHTML=`${icon('plus',17)} Добавить`;$('#addGiftPlan').innerHTML=`${icon('plus',17)} Добавить`;$('#addPurchaseBtn').innerHTML=`${icon('plus',17)} Добавить`;$('#addPaymentBtn').innerHTML=`${icon('plus',17)} Добавить`;$('#settingsAddCategory').innerHTML=`${icon('plus',17)} Добавить`;$('#modalClose').innerHTML=icon('close',19);
}
function renderAll(){applyAppearance();renderNav();renderHome();renderMonth();renderSavings();renderPet();renderGifts();renderPurchases();renderFood();renderPayments();renderSettings();}

function fieldHtml(field){
  const id=`field-${field.name}`;const value=field.value??'';const common=`id="${id}" name="${field.name}" ${field.required?'required':''}`;
  if(field.type==='palette'){
    const hasMatch=field.options.some(o=>String(o.value).toLowerCase()===String(value).toLowerCase());
    return `<fieldset class="form-field palette-field"><legend>${esc(field.label)}</legend><div class="color-palette">${field.options.map((o,i)=>`<label class="color-dot" title="${esc(o.label)}"><input type="radio" name="${esc(field.name)}" value="${esc(o.value)}" ${String(o.value).toLowerCase()===String(value).toLowerCase()||(!hasMatch&&i===0)?'checked':''}><span style="background:${esc(o.value)}"></span></label>`).join('')}</div>${field.help?`<small>${esc(field.help)}</small>`:''}</fieldset>`;
  }
  if(field.type==='select')return `<label class="form-field"><span>${esc(field.label)}</span><select ${common}>${field.options.map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>${field.help?`<small>${esc(field.help)}</small>`:''}</label>`;
  if(field.type==='textarea')return `<label class="form-field"><span>${esc(field.label)}</span><textarea ${common} rows="3" placeholder="${esc(field.placeholder||'')}">${esc(value)}</textarea>${field.help?`<small>${esc(field.help)}</small>`:''}</label>`;
  if(field.type==='checkbox')return `<label class="toggle-field"><input type="checkbox" ${common} ${value?'checked':''}><span><b>${esc(field.label)}</b>${field.help?`<small>${esc(field.help)}</small>`:''}</span></label>`;
  if(field.type==='file'){
    if(field.crop)return `<label class="form-field file-picker crop-picker" data-crop-field="${esc(field.name)}"><span>${esc(field.label)}</span><div class="crop-preview" data-crop-preview="${esc(field.name)}" ${field.preview?`style="background-image:url('${esc(field.preview)}')"`:''}></div><input ${common} type="file" accept="${esc(field.accept||'image/*')}" data-crop-input="${esc(field.name)}"><div class="crop-controls" data-crop-controls="${esc(field.name)}" hidden><label><span>Масштаб</span><input name="${esc(field.name)}Zoom" type="range" min="1" max="3" step="0.05" value="1" data-crop-slider="${esc(field.name)}"></label><label><span>Горизонталь</span><input name="${esc(field.name)}X" type="range" min="-100" max="100" step="1" value="0" data-crop-slider="${esc(field.name)}"></label><label><span>Вертикаль</span><input name="${esc(field.name)}Y" type="range" min="-100" max="100" step="1" value="0" data-crop-slider="${esc(field.name)}"></label></div>${field.help?`<small>${esc(field.help)}</small>`:''}</label>`;
    return `<label class="form-field file-picker"><span>${esc(field.label)}</span>${field.preview?`<img src="${esc(field.preview)}" alt="">`:''}<input ${common} type="file" accept="${esc(field.accept||'image/*')}">${field.help?`<small>${esc(field.help)}</small>`:''}</label>`;
  }
  return `<label class="form-field"><span>${esc(field.label)}</span><input ${common} type="${field.type||'text'}" value="${esc(value)}" placeholder="${esc(field.placeholder||'')}" ${field.min!=null?`min="${field.min}"`:''} ${field.step!=null?`step="${field.step}"`:''} ${field.inputmode?`inputmode="${field.inputmode}"`:''}>${field.help?`<small>${esc(field.help)}</small>`:''}</label>`;
}
let modalSubmitHandler=null, modalExtraHandler=null;
function openModal(title,fields,onSubmit,{submitLabel='Сохранить',extraAction=null}={}){
  $('#modalTitle').textContent=title;$('#modalBody').innerHTML=fields.map(fieldHtml).join('')+(extraAction?`<button type="button" id="modalExtra" class="danger-button">${esc(extraAction.label)}</button>`:'');$('#modalSubmit').textContent=submitLabel;$('#modalBackdrop').hidden=false;document.body.classList.add('modal-open');modalSubmitHandler=onSubmit;modalExtraHandler=extraAction?.handler||null;setTimeout(()=>$('#modalBody input:not([type="checkbox"]), #modalBody select')?.focus(),40);}
function closeModal(){$('#modalBackdrop').hidden=true;document.body.classList.remove('modal-open');modalSubmitHandler=null;modalExtraHandler=null;}
function formValues(form){const result={};form.querySelectorAll('[name]').forEach(el=>{if(el.type==='radio'){if(el.checked)result[el.name]=el.value;return;}result[el.name]=el.type==='checkbox'?el.checked:el.type==='file'?el.files?.[0]||null:el.value;});return result;}
async function updateCropPreview(root,name){
  const preview=root.querySelector(`[data-crop-preview="${name}"]`);
  const input=root.querySelector(`[data-crop-input="${name}"]`);
  const controls=root.querySelector(`[data-crop-controls="${name}"]`);
  if(!preview)return;
  const file=input?.files?.[0];
  const zoom=Math.max(1,num(root.querySelector(`[name="${name}Zoom"]`)?.value)||1);
  const x=num(root.querySelector(`[name="${name}X"]`)?.value)||0;
  const y=num(root.querySelector(`[name="${name}Y"]`)?.value)||0;
  if(file){
    if(controls)controls.hidden=false;
    const dataUrl=await imageToDataUrl(file,176,{cropSquare:true,zoom,offsetX:x,offsetY:y});
    preview.style.backgroundImage=`url("${dataUrl}")`;
  }
  preview.style.backgroundSize='cover';
  preview.style.backgroundPosition='center';
}

function openPeriodEditor(){const p=selectedPeriod(), utility=p.passThroughs?.[0]||{amount:120};openModal(`Параметры · ${periodTitle(p.key)}`,[
  {name:'salary',label:'Зарплата, BYN',type:'number',step:'1',value:p.salary},
  {name:'extra',label:'Дополнительный доход, BYN',type:'number',step:'1',value:p.extraIncome},
  {name:'balance',label:'Текущий баланс на счету, BYN',type:'number',step:'1',value:p.balanceNow??'',help:'Оставь пустым для планового месяца.'},
  {name:'cash',label:'Отдельно отложено / наличные, BYN',type:'number',step:'1',value:p.cashNow},
  {name:'housingPlan',label:`${mandatoryLabel('housing')} — план, BYN`,type:'number',step:'1',value:p.mandatory.housingPlan},
  {name:'housingSpent',label:`${mandatoryLabel('housing')} — оплачено, BYN`,type:'number',step:'1',value:p.mandatory.housingSpent},
  {name:'reservePlan',label:`${mandatoryLabel('reserve')} — план, BYN`,type:'number',step:'1',value:p.mandatory.reservePlan},
  {name:'reserveAllocated',label:`${mandatoryLabel('reserve')} — уже отложено, BYN`,type:'number',step:'1',value:p.mandatory.reserveAllocated},
  {name:'savingsUsd',label:`${sectionLabel('savings')} — план, $`,type:'number',step:'1',value:p.mandatory.savingsPlanUsd},
  {name:'savingsByn',label:`${sectionLabel('savings')} — план, BYN`,type:'number',step:'1',value:p.mandatory.savingsPlanByn??p.mandatory.savingsPlanUsd??0},
  {name:'utilities',label:'Коммунальные из аванса, BYN',type:'number',step:'1',value:utility.amount},
  {name:'utilitiesPaid',label:'Коммунальные оплачены',type:'checkbox',value:!!utility.paid},
  {name:'note',label:'Комментарий',type:'textarea',value:p.note}
],async v=>{p.salary=num(v.salary);p.extraIncome=num(v.extra);p.balanceNow=v.balance===''?null:num(v.balance);p.cashNow=num(v.cash);p.mandatory.housingPlan=num(v.housingPlan);p.mandatory.housingSpent=num(v.housingSpent);p.mandatory.reservePlan=num(v.reservePlan);p.mandatory.reserveAllocated=num(v.reserveAllocated);p.mandatory.savingsPlanUsd=num(v.savingsUsd);p.mandatory.savingsPlanByn=num(v.savingsByn);p.passThroughs=[{...(p.passThroughs?.[0]||{id:`${p.key}-utilities`,name:'Коммунальные',dueDay:25}),amount:num(v.utilities),paid:v.utilitiesPaid,note:'Аванс приходит и сразу уходит'}];p.note=v.note;if(p.balanceNow==null)p.balanceSnapshot=null;else captureBalanceSnapshot(state,p);await commit();closeModal();});}
function openBalanceEditor(){const p=currentPeriod();openModal('Текущий баланс',[{name:'balance',label:'На счету, BYN',type:'number',step:'1',value:p.balanceNow??''},{name:'cash',label:'Отдельно отложено / наличные, BYN',type:'number',step:'1',value:p.cashNow}],async v=>{p.balanceNow=v.balance===''?null:num(v.balance);p.cashNow=num(v.cash);if(p.balanceNow==null)p.balanceSnapshot=null;else captureBalanceSnapshot(state,p);await commit();closeModal();});}
function openMandatoryEditor(kind){const p=selectedPeriod(), pay=periodPayment(state,p.key);const config={housing:{title:mandatoryLabel('housing'),plan:p.mandatory.housingPlan,spent:p.mandatory.housingSpent},payment:{title:sectionLabel('payments'),plan:pay.planned,spent:pay.paid},reserve:{title:mandatoryLabel('reserve'),plan:p.mandatory.reservePlan,spent:p.mandatory.reserveAllocated}}[kind];openModal(config.title,[{name:'name',label:'Название',value:config.title},{name:'plan',label:'План, BYN',type:'number',value:config.plan},{name:'spent',label:'Потрачено / отложено, BYN',type:'number',value:config.spent}],async v=>{if(kind==='payment')setSectionLabel('payments',v.name);else setMandatoryLabel(kind,v.name);if(kind==='housing'){p.mandatory.housingPlan=num(v.plan);p.mandatory.housingSpent=num(v.spent)}else if(kind==='payment'){pay.planned=num(v.plan);pay.paid=num(v.spent)}else{p.mandatory.reservePlan=num(v.plan);p.mandatory.reserveAllocated=num(v.spent)}await commit();closeModal();});}

const iconOptions=['wallet','home','calendar','piggy','paw','bag','money','utensils','dumbbell','sparkles','heart','shirt','gift','ticket','palette','shield'].map(i=>({label:i,value:i}));
const colorOptions=[
  '#FFFFFF','#000000',
  '#FFB76D','#F97940','#FFCCCC','#EABD86','#F9E5CC','#ADCCD1','#9FAF64','#FEA365','#FFD283',
  '#C8E4E8','#FBC9AE','#D8B69B','#FFDB7B','#B9D672','#77C9C5','#FF9969','#D9A373','#B2D0B5',
  '#EEAC60','#AA695B','#FEE8DD','#6C909E','#E6B16D','#EFA681','#EAAF3E','#F6E2C7','#E8755B'
].map(c=>({label:c,value:c}));
function navIconModal(id){
  const item=navDefaults.find(x=>x.id===id);if(!item)return;
  const settings=navIconSettings(), current=settings[id]||{};
  openModal(`Раздел: ${sectionLabel(item.id)}`,[{name:'name',label:'Название',value:sectionLabel(item.id)},{name:'icon',label:'Стандартная иконка',type:'select',value:current.icon||item.icon,options:iconOptions},{name:'image',label:'Своя картинка',type:'file',crop:true,preview:current.image||'',accept:'image/png,image/jpeg,image/webp,image/*',help:'PNG с прозрачным фоном сохранится вместе с альфа-каналом. После выбора файла можно вручную настроить кроп.'}],async v=>{
    setSectionLabel(id,v.name);
    const image=v.image?await imageToDataUrl(v.image,160,cropOptions(v,'image')):current.image||'';
    settings[id]={icon:v.icon||item.icon,image};
    if(settings[id].icon===item.icon&&!settings[id].image)delete settings[id];
    const linkedCategory=state.categories?.find(c=>c.id===id&&['food','pet'].includes(c.kind));
    if(linkedCategory){linkedCategory.icon=v.icon||linkedCategory.icon;linkedCategory.iconImage=image||'';}
    await commit();closeModal();
  },{extraAction:current.icon||current.image?{label:'Сбросить иконку',handler:async()=>{delete settings[id];await commit();closeModal();}}:null});
}
function petAvatarModal(){
  openModal('Аватар питомца',[{name:'avatar',label:'Картинка питомца',type:'file',crop:true,preview:state.pet.avatarImage||'./icons/pet-face.png',accept:'image/png,image/jpeg,image/webp,image/*',help:'Можно загрузить новую картинку, настроить кроп или сбросить к стандартной.'}],async v=>{if(v.avatar)state.pet.avatarImage=await imageToDataUrl(v.avatar,512,cropOptions(v,'avatar'));await commit();closeModal();},{extraAction:state.pet.avatarImage?{label:'Вернуть стандартную картинку',handler:async()=>{state.pet.avatarImage='';await commit();closeModal();}}:null});
}
function openCategoryEditor(id){
  const c=categoryById(id), p=selectedPeriod(), b=categoryBudget(p,c);const deletable=!['food','pet'].includes(c.kind);
  const fields=[{name:'name',label:'Название',value:c.name},{name:'plan',label:'Лимит текущего месяца, BYN',type:'number',value:b.plan,help:c.kind==='food'?'Для еды лимиты меняются по неделям. Значение здесь распределится на четыре недели.':''},{name:'icon',label:'Иконка',type:'select',value:c.icon,options:iconOptions},{name:'iconImage',label:'Своя иконка',type:'file',crop:true,preview:c.iconImage||'',help:'Загруженная картинка заменит выбранную иконку. После выбора файла можно вручную настроить кроп.'},{name:'color',label:'Цвет',type:'palette',value:c.color,options:colorOptions},{name:'visible',label:'Показывать категорию',type:'checkbox',value:c.visible}];
  openModal('Категория',fields,async v=>{
    c.name=v.name.trim()||c.name;
    if(['food','pet'].includes(c.kind))setSectionLabel(c.id,c.name);
    c.icon=v.icon;c.color=v.color;c.visible=v.visible;
    if(v.iconImage)c.iconImage=await imageToDataUrl(v.iconImage,256,cropOptions(v,'iconImage'));
    if(['food','pet'].includes(c.kind)){
      const item=navDefaults.find(x=>x.id===c.id);
      navIconSettings()[c.id]={icon:c.icon||item?.icon,image:c.iconImage||''};
      if(navIconSettings()[c.id].icon===item?.icon&&!navIconSettings()[c.id].image)delete navIconSettings()[c.id];
    }
    const plan=num(v.plan);
    if(c.kind==='food'){
      const count=Math.max(1,p.foodWeeks.length), per=roundMoney(plan/count);
      p.foodWeeks.forEach((w,i)=>w.plan=i===count-1?roundMoney(plan-per*(count-1)):per);
    }else ensurePeriod(state,p.key).categoryBudgets[c.id].plan=plan;
    await commit();closeModal();
  },{extraAction:deletable?{label:'Удалить категорию',handler:async()=>{
    if(!confirm(`Удалить «${c.name}»?`))return;
    state.categories=state.categories.filter(x=>x.id!==id);
    Object.values(state.periods).forEach(period=>{delete period.categoryBudgets[id];if(period.mandatory?.categoryIds)period.mandatory.categoryIds=period.mandatory.categoryIds.filter(x=>x!==id);});
    await commit();closeModal();
  }}:null});
}
function openNewCategory(){openModal('Новая категория',[{name:'name',label:'Название',required:true},{name:'plan',label:'Лимит текущего месяца, BYN',type:'number',value:0},{name:'icon',label:'Иконка',type:'select',value:'wallet',options:iconOptions},{name:'iconImage',label:'Своя иконка',type:'file',crop:true,help:'Можно загрузить свою картинку и вручную настроить кроп.'},{name:'color',label:'Цвет',type:'palette',value:'#C8E4E8',options:colorOptions}],async v=>{const id=`category-${uid()}`;const order=Math.max(0,...state.categories.map(c=>c.order))+1;state.categories.push({id,name:v.name.trim()||'Новая категория',icon:v.icon,iconImage:v.iconImage?await imageToDataUrl(v.iconImage,256,cropOptions(v,'iconImage')):'',color:v.color,kind:'monthly',order,visible:true});Object.values(state.periods).forEach(period=>{period.categoryBudgets[id]={plan:period.key===selectedPeriodKey?num(v.plan):0,spent:0}});await commit();closeModal();});}

function savingsModal(type){openModal(type==='deposit'?'Отложить в накопления':'Взять из накоплений',[{name:'currency',label:'Валюта',type:'select',value:'usd',options:[{value:'usd',label:'USD'},{value:'byn',label:'BYN'}]},{name:'amount',label:'Сумма',type:'number',min:0,step:'1',required:true},{name:'date',label:'Дата',type:'date',value:todayISO()},{name:'note',label:'Комментарий',value:''}],async v=>{const currency=v.currency==='byn'?'byn':'usd', amount=num(v.amount);if(amount<=0){toast('Введи сумму');return;}state.savings.push({id:uid(),type,currency,amountUsd:currency==='usd'?amount:0,amountByn:currency==='byn'?amount:0,date:v.date||todayISO(),note:v.note.trim()});await commit();closeModal();});}
function safetyModal(){openModal('Подушка безопасности',[{name:'amount',label:'Сумма в сейфе, USD',type:'number',min:0,step:'1',value:state.safety.amountUsd},{name:'goal',label:'Цель, USD',type:'number',min:1,step:'1',value:state.safety.goalUsd||2000},{name:'icon',label:'Иконка',type:'select',value:state.safety.icon||'shield',options:iconOptions},{name:'iconImage',label:'Своя иконка сейфа',type:'file',crop:true,preview:state.safety.iconImage||'',help:'Картинка будет обрезана в квадрат без потери прозрачности, кроп можно настроить вручную.'}],async v=>{state.safety.amountUsd=num(v.amount);state.safety.goalUsd=num(v.goal)||2000;state.safety.icon=v.icon||'shield';if(v.iconImage)state.safety.iconImage=await imageToDataUrl(v.iconImage,256,cropOptions(v,'iconImage'));await commit();closeModal();},{extraAction:state.safety.iconImage?{label:'Сбросить свою иконку',handler:async()=>{state.safety.iconImage='';await commit();closeModal();}}:null});}
function exchangeSavingsBynModal(){
  const byn=savingsBalanceByn(state);
  if(byn<=0)return;
  openModal('Обмен BYN в USD',[{name:'usd',label:'Сколько USD куплено',type:'number',min:0,step:'1',required:true},{name:'date',label:'Дата',type:'date',value:todayISO()},{name:'note',label:'Комментарий',value:'Обмен накоплений BYN в USD'}],async v=>{
    const usd=num(v.usd), date=v.date||todayISO(), note=v.note.trim()||'Обмен накоплений BYN в USD';
    if(usd<=0){toast('Введи сумму USD');return;}
    state.savings.push({id:uid(),type:'withdraw',currency:'byn',amountUsd:0,amountByn:byn,date,note});
    state.savings.push({id:uid(),type:'deposit',currency:'usd',amountUsd:usd,amountByn:0,date,note});
    await commit();closeModal();toast('BYN обменяны в USD');
  });
}
function petTransactionModal(type){openModal(type==='topup'?'Пополнить баланс питомца':'Вычесть из баланса питомца',[{name:'amount',label:'Сумма, BYN',type:'number',min:0,step:'1',required:true},{name:'date',label:'Дата',type:'date',value:todayISO()},{name:'note',label:'Комментарий',value:''}],async v=>{const amount=num(v.amount),date=v.date||todayISO();if(amount<=0){toast('Введи сумму');return;}const tx={id:uid(),type,amountByn:amount,date,note:v.note.trim()};state.pet.balanceByn=roundMoney(petBalanceByn(state)+(type==='topup'?amount:-amount));if(type==='topup'){const key=periodKeyForDate(new Date(`${date}T12:00:00`),state.settings.salaryDay);const p=ensurePeriod(state,key);p.categoryBudgets.pet=p.categoryBudgets.pet||{plan:0,spent:0};p.categoryBudgets.pet.spent=roundMoney(p.categoryBudgets.pet.spent+amount);tx.budgetPeriodKey=key;}state.pet.transactions.push(tx);await commit();closeModal();});}
function needModal(item=null){openModal(item?'План питомца':'Добавить для питомца',[{name:'name',label:'Что нужно',value:item?.name||'',required:true},{name:'cost',label:'Стоимость, BYN',type:'number',value:item?.costByn||0},{name:'due',label:'Срок',type:'date',value:item?.dueDate||''},{name:'note',label:'Комментарий',value:item?.note||''}],async v=>{if(item){item.name=v.name;item.costByn=num(v.cost);item.dueDate=v.due;item.note=v.note}else state.pet.needs.push({id:uid(),name:v.name,costByn:num(v.cost),dueDate:v.due,note:v.note,completed:false});await commit();closeModal();},{extraAction:item?{label:'Удалить',handler:async()=>{state.pet.needs=state.pet.needs.filter(n=>n.id!==item.id);await commit();closeModal();}}:null});}
function giftTransactionModal(type){openModal(type==='topup'?'Пополнить конверт подарков':'Вычесть из конверта подарков',[{name:'amount',label:'Сумма, BYN',type:'number',min:0,step:'1',required:true},{name:'date',label:'Дата',type:'date',value:todayISO()},{name:'note',label:'Комментарий',value:''}],async v=>{const amount=num(v.amount);if(amount<=0){toast('Введи сумму');return;}state.gifts.transactions.push({id:uid(),type,amountByn:amount,date:v.date||todayISO(),note:v.note.trim()});await commit();closeModal();});}
function giftModal(item=null){const recipients=[...new Set([...(state.gifts.recipients||[]),'Паше','Маме','Другому'])];openModal(item?'Подарок':'Новый подарок',[{name:'name',label:'Название',value:item?.name||'',required:true},{name:'recipient',label:'Кому',type:'select',value:item?.recipient||recipients[0],options:recipients.map(r=>({value:r,label:r}))},{name:'recipientCustom',label:'Другой получатель',value:'',help:'Заполни, если нужно добавить новый пресет.'},{name:'cost',label:'Стоимость, BYN',type:'number',value:item?.costByn||0},{name:'color',label:'Цвет карточки',type:'palette',value:item?.color||'#FBC9AE',options:colorOptions},{name:'link',label:'Ссылка',value:item?.link||''},{name:'image',label:'Изображение',type:'file',preview:item?.imageDataUrl||'',help:'Можно прикрепить фото или скрин подарка.'},{name:'note',label:'Комментарий',value:item?.note||''}],async v=>{const recipient=(v.recipientCustom||'').trim()||v.recipient;if(!state.gifts.recipients.includes(recipient))state.gifts.recipients.push(recipient);const imageDataUrl=v.image?await imageToDataUrl(v.image):item?.imageDataUrl||'';if(item){item.name=v.name;item.recipient=recipient;item.costByn=num(v.cost);item.color=v.color;item.link=v.link;item.note=v.note;item.imageDataUrl=imageDataUrl}else state.gifts.plans.push({id:uid(),name:v.name,recipient,costByn:num(v.cost),color:v.color,link:v.link,note:v.note,imageDataUrl,completed:false});await commit();closeModal();},{extraAction:item?{label:'Удалить подарок',handler:async()=>{state.gifts.plans=state.gifts.plans.filter(g=>g.id!==item.id);await commit();closeModal();}}:null});}
function purchaseModal(item=null){openModal(item?'Покупка':'Новая покупка',[{name:'name',label:'Название',value:item?.name||'',required:true},{name:'priority',label:'Раздел',type:'select',value:item?.priority||purchaseTab,options:Object.entries(purchaseTitles).map(([value,label])=>({value,label}))},{name:'cost',label:'Стоимость, USD',type:'number',value:purchaseCostUsd(item)},{name:'image',label:'Изображение',type:'file',preview:item?.imageDataUrl||'',help:'Можно добавить фото товара или скрин.'},{name:'note',label:'Комментарий',value:item?.note||''}],async v=>{const imageDataUrl=v.image?await imageToDataUrl(v.image):item?.imageDataUrl||'';if(item){item.name=v.name;item.priority=v.priority;item.costUsd=num(v.cost);delete item.costByn;item.note=v.note;item.imageDataUrl=imageDataUrl}else state.purchases.push({id:uid(),name:v.name,priority:v.priority,costUsd:num(v.cost),note:v.note,imageDataUrl,completed:false});purchaseTab=v.priority;await commit();closeModal();},{extraAction:item?{label:'Удалить',handler:async()=>{state.purchases=state.purchases.filter(p=>p.id!==item.id);await commit();closeModal();}}:null});}
function paymentModal(item=null){openModal(item?'Платеж':'Новый платеж',[{name:'title',label:'Название',value:item?.title||''},{name:'period',label:'Месяц',type:'month',value:item?.periodKey||selectedPeriodKey},{name:'planned',label:'План, BYN',type:'number',value:item?.planned||0},{name:'paid',label:'Оплачено, BYN',type:'number',value:item?.paid||0},{name:'note',label:'Комментарий',value:item?.note||''}],async v=>{if(item){item.title=v.title.trim();item.periodKey=v.period;item.planned=num(v.planned);item.paid=num(v.paid);item.note=v.note}else state.payments.push({id:uid(),title:v.title.trim(),periodKey:v.period,planned:num(v.planned),paid:num(v.paid),note:v.note});await commit();closeModal();},{extraAction:item?{label:'Удалить',handler:async()=>{state.payments=state.payments.filter(p=>p.id!==item.id);await commit();closeModal();}}:null});}
function generalModal(){openModal('Общие настройки',[{name:'name',label:'Имя',value:state.settings.profileName},{name:'salaryDay',label:'День зарплаты',type:'number',min:1,value:state.settings.salaryDay}],async v=>{state.settings.profileName=v.name.trim()||'Пользователь';state.settings.salaryDay=Math.min(28,Math.max(1,num(v.salaryDay)||5));selectedPeriodKey=periodKeyForDate(new Date(),state.settings.salaryDay);foodPeriodKey=selectedPeriodKey;await commit();closeModal();});}
function appearanceModal(){const a=appearanceSettings();openModal('Внешний вид',[{name:'primary',label:'Основной цвет',type:'palette',value:a.primary||'#9FAF64',options:colorOptions},{name:'background',label:'Цвет фона',type:'palette',value:a.background||'#FEE8DD',options:colorOptions},{name:'card',label:'Цвет карточек',type:'palette',value:a.card||'#F9E5CC',options:colorOptions},{name:'heading',label:'Цвет заголовков',type:'palette',value:a.heading||'#6C909E',options:colorOptions},{name:'backgroundImage',label:'Свой фон',type:'file',preview:a.backgroundImage||'',accept:'image/png,image/jpeg,image/webp,image/*'},{name:'appIcon',label:'Иконка приложения',type:'file',crop:true,preview:a.appIcon||'./icons/apple-touch-icon.png',accept:'image/png,image/*',help:'После выбора файла можно настроить кроп и масштаб.'}],async v=>{a.primary=safeHex(v.primary,'#9FAF64');a.background=safeHex(v.background,'#FEE8DD');a.card=safeHex(v.card,'#F9E5CC');a.heading=safeHex(v.heading,'#6C909E');if(v.backgroundImage)a.backgroundImage=await imageToDataUrl(v.backgroundImage,1400);if(v.appIcon)a.appIcon=await imageToDataUrl(v.appIcon,512,cropOptions(v,'appIcon'));applyAppearance();await commit();closeModal();},{extraAction:a.backgroundImage||a.appIcon?{label:'Сбросить фон и иконку',handler:async()=>{a.backgroundImage='';a.appIcon='';applyAppearance();await commit();closeModal();}}:null});}

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
  $('#topupGifts').addEventListener('click',()=>giftTransactionModal('topup'));$('#spendGifts').addEventListener('click',()=>giftTransactionModal('spend'));$('#addGiftPlan').addEventListener('click',()=>giftModal());
  $('#addPurchaseBtn').addEventListener('click',()=>purchaseModal());$('#addPaymentBtn').addEventListener('click',()=>paymentModal());$('#editGeneralBtn').addEventListener('click',generalModal);$('#editAppearanceBtn').addEventListener('click',appearanceModal);
  $('#exportBtn').addEventListener('click',exportBackup);$('#importInput').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importBackup(file);e.target.value=''});$('#resetBtn').addEventListener('click',async()=>{if(!confirm('Сбросить все данные приложения?'))return;await clearState();state=seedState(new Date());selectedPeriodKey=periodKeyForDate(new Date(),state.settings.salaryDay);foodPeriodKey=selectedPeriodKey;await commit();setScreen('home');toast('Данные сброшены')});
  $('#modalClose').addEventListener('click',closeModal);$('#modalCancel').addEventListener('click',closeModal);$('#modalBackdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()});
  $('#modalForm').addEventListener('submit',async e=>{e.preventDefault();if(modalSubmitHandler)await modalSubmitHandler(formValues(e.currentTarget))});
  $('#modalBody').addEventListener('click',async e=>{if(e.target.closest('#modalExtra')&&modalExtraHandler)await modalExtraHandler()});
  $('#modalBody').addEventListener('input',e=>{if(e.target.matches('[data-crop-slider]'))updateCropPreview($('#modalBody'),e.target.dataset.cropSlider)});
  $('#modalBody').addEventListener('change',e=>{if(e.target.matches('[data-crop-input]'))updateCropPreview($('#modalBody'),e.target.dataset.cropInput)});
  $('#purchaseTabs').addEventListener('click',e=>{const b=e.target.closest('[data-purchase-tab]');if(!b)return;purchaseTab=b.dataset.purchaseTab;renderPurchases()});
}
function bindDelegatedEvents(){
  document.addEventListener('click',async e=>{
    const dashboard=e.target.closest('[data-dashboard]');if(dashboard){const id=dashboard.dataset.dashboard,category=categoryById(dashboardCategoryId(id));if(category){if(category.kind==='food'){foodPeriodKey=currentPeriod().key;openOverlay('food')}else if(category.kind==='pet')setScreen('pet');else if(category.kind==='gift')openOverlay('gifts');else setScreen('month');return;}if(id==='payments')openOverlay('payments');else setScreen(id);return;}
    const nav=e.target.closest('[data-nav-to]');if(nav){setScreen(nav.dataset.navTo);return;}
    if(e.target.closest('[data-open-food]')){foodPeriodKey=selectedPeriodKey;openOverlay('food');return;}
    const detail=e.target.closest('[data-open-category-detail]');if(detail&&!e.target.closest('button,input,label,.settings-actions')){const id=detail.dataset.openCategoryDetail;if(id==='food'){foodPeriodKey=selectedPeriodKey;openOverlay('food')}else if(id==='pet')setScreen('pet');else if(id==='gifts')openOverlay('gifts');return;}
    const addMandatorySection=e.target.closest('[data-add-mandatory-section]');if(addMandatorySection){const p=selectedPeriod(),sections=mandatorySections(p),id=addMandatorySection.dataset.addMandatorySection;if(!sections.includes(id))sections.push(id);await commit();return;}
    const removeMandatorySection=e.target.closest('[data-remove-mandatory-section]');if(removeMandatorySection){const p=selectedPeriod(),id=removeMandatorySection.dataset.removeMandatorySection;if(['payment','reserve'].includes(id))p.mandatory.sections=mandatorySections(p).filter(x=>x!==id);await commit();return;}
    const addMandatoryCategory=e.target.closest('[data-add-mandatory-category]');if(addMandatoryCategory){const p=selectedPeriod(),ids=mandatoryCategoryIds(p),id=addMandatoryCategory.dataset.addMandatoryCategory;if(!ids.includes(id))ids.push(id);await commit();return;}
    const removeMandatoryCategory=e.target.closest('[data-remove-mandatory-category]');if(removeMandatoryCategory){const p=selectedPeriod(),id=removeMandatoryCategory.dataset.removeMandatoryCategory;if(id!=='food')p.mandatory.categoryIds=mandatoryCategoryIds(p).filter(x=>x!==id);await commit();return;}
    const mandatory=e.target.closest('[data-edit-mandatory]');if(mandatory){openMandatoryEditor(mandatory.dataset.editMandatory);return;}
    const editCategory=e.target.closest('[data-edit-category]');if(editCategory){openCategoryEditor(editCategory.dataset.editCategory);return;}
    const settingsCategory=e.target.closest('[data-settings-category]');if(settingsCategory){openCategoryEditor(settingsCategory.dataset.settingsCategory);return;}
    const navIcon=e.target.closest('[data-edit-nav-icon]');if(navIcon){navIconModal(navIcon.dataset.editNavIcon);return;}
    const cardUp=e.target.closest('[data-card-up]');if(cardUp){const list=dashboardCards(),i=list.indexOf(cardUp.dataset.cardUp);if(i>0){[list[i-1],list[i]]=[list[i],list[i-1]];await commit()}return;}
    const cardDown=e.target.closest('[data-card-down]');if(cardDown){const list=dashboardCards(),i=list.indexOf(cardDown.dataset.cardDown);if(i>=0&&i<list.length-1){[list[i+1],list[i]]=[list[i],list[i+1]];await commit()}return;}
    const cardRemove=e.target.closest('[data-card-remove]');if(cardRemove){state.settings.dashboardCards=dashboardCards().filter(id=>id!==cardRemove.dataset.cardRemove);await commit();return;}
    const cardAdd=e.target.closest('[data-card-add]');if(cardAdd){const list=dashboardCards();if(!list.includes(cardAdd.dataset.cardAdd))list.push(cardAdd.dataset.cardAdd);await commit();return;}
    const savingDelete=e.target.closest('[data-delete-saving]');if(savingDelete){if(!confirm('Удалить запись?'))return;state.savings=state.savings.filter(t=>t.id!==savingDelete.dataset.deleteSaving);await commit();return;}
    const petDelete=e.target.closest('[data-delete-pet-tx]');if(petDelete){if(!confirm('Удалить запись?'))return;state.pet.transactions=state.pet.transactions.filter(t=>t.id!==petDelete.dataset.deletePetTx);await commit();return;}
    if(e.target.closest('[data-edit-safety]')){safetyModal();return;}
    const completeNeed=e.target.closest('[data-complete-need]');if(completeNeed){const n=state.pet.needs.find(x=>x.id===completeNeed.dataset.completeNeed);if(n){n.completed=true;const amount=num(n.costByn);if(amount>0){state.pet.balanceByn=roundMoney(petBalanceByn(state)-amount);state.pet.transactions.push({id:uid(),type:'spend',amountByn:amount,date:todayISO(),note:`Покупка: ${n.name}`})}await commit()}return;}
    if(e.target.closest('[data-edit-pet-avatar]')){petAvatarModal();return;}
    const editNeed=e.target.closest('[data-edit-need]');if(editNeed){needModal(state.pet.needs.find(n=>n.id===editNeed.dataset.editNeed));return;}
    const completePurchase=e.target.closest('[data-complete-purchase]');if(completePurchase){const p=state.purchases.find(x=>x.id===completePurchase.dataset.completePurchase);if(p){p.completed=true;await commit()}return;}
    const editPurchase=e.target.closest('[data-edit-purchase]');if(editPurchase){purchaseModal(state.purchases.find(p=>p.id===editPurchase.dataset.editPurchase));return;}
    const completeGift=e.target.closest('[data-complete-gift]');if(completeGift){const g=state.gifts.plans.find(x=>x.id===completeGift.dataset.completeGift);if(g){g.completed=true;const amount=num(g.costByn);if(amount>0)state.gifts.transactions.push({id:uid(),type:'spend',amountByn:amount,date:todayISO(),note:`Подарок: ${g.name}`});await commit()}return;}
    const editGift=e.target.closest('[data-edit-gift]');if(editGift){giftModal(state.gifts.plans.find(g=>g.id===editGift.dataset.editGift));return;}
    const giftDelete=e.target.closest('[data-delete-gift-tx]');if(giftDelete){if(!confirm('Удалить запись?'))return;state.gifts.transactions=state.gifts.transactions.filter(t=>t.id!==giftDelete.dataset.deleteGiftTx);await commit();return;}
    const editPayment=e.target.closest('[data-edit-payment]');if(editPayment){paymentModal(state.payments.find(p=>p.id===editPayment.dataset.editPayment));return;}
    if(e.target.closest('[data-exchange-savings-byn]')){exchangeSavingsBynModal();return;}
  });
  document.addEventListener('change',async e=>{
    if(e.target.matches('[data-category-spent]')){const p=selectedPeriod(),c=categoryById(e.target.dataset.categorySpent);if(c){p.categoryBudgets[c.id].spent=Math.max(0,num(e.target.value));await commit()}return;}
    if(e.target.matches('[data-week-plan]')){const p=ensurePeriod(state,foodPeriodKey);p.foodWeeks[num(e.target.dataset.weekPlan)].plan=Math.max(0,num(e.target.value));await commit();return;}
    if(e.target.matches('[data-week-spent]')){const p=ensurePeriod(state,foodPeriodKey);p.foodWeeks[num(e.target.dataset.weekSpent)].spent=Math.max(0,num(e.target.value));await commit();return;}
    if(e.target.matches('[data-utility-paid]')){const p=ensurePeriod(state,e.target.dataset.utilityPaid);p.passThroughs=p.passThroughs?.length?p.passThroughs:[{id:`${p.key}-utilities`,name:'Коммунальные',dueDay:25,amount:120}];p.passThroughs[0].paid=e.target.checked;await commit();return;}
    if(e.target.matches('[data-nav-labels]')){state.settings.navLabels=e.target.checked;await commit();return;}
    if(e.target.matches('[data-nav-item]')){const id=e.target.dataset.navItem;if(['home','month'].includes(id))return;const list=navItems().filter(x=>!['home','month'].includes(x));state.settings.navItems=['home','month',...(e.target.checked?[...list,id]:list.filter(x=>x!==id))];await commit();return;}
  });
  document.addEventListener('focusin',e=>{if(e.target.matches('input[type="number"]'))e.target.select()});
}

async function init(){
  const saved=await loadState();state=validateState(saved)?saved:seedState(new Date());
  normalizeState();
  if(syncAllAutoClosedWeeks())await saveState(state);
  selectedPeriodKey=periodKeyForDate(new Date(),state.settings.salaryDay);foodPeriodKey=selectedPeriodKey;ensurePeriod(state,selectedPeriodKey);
  bindStaticEvents();bindDelegatedEvents();renderAll();$('#loading').hidden=true;$('#app').hidden=false;setScreen('home');
  scheduleAutoWeekClose();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init();
