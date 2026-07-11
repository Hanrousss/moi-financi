export const VERSION = 4;
export const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const roundMoney = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
export const toISODate = date => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
export const parseISODate = value => {
  const [y,m,d] = String(value).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const formatByn = value => `${Number(value || 0).toLocaleString('ru-RU',{maximumFractionDigits:Number.isInteger(Number(value))?0:2})} BYN`;
export const formatUsd = value => `$${Number(value || 0).toLocaleString('ru-RU',{maximumFractionDigits:Number.isInteger(Number(value))?0:2})}`;

export function periodKeyForDate(date = new Date(), salaryDay = 5) {
  const anchor = new Date(date.getFullYear(), date.getMonth(), 1);
  if (date.getDate() < salaryDay) anchor.setMonth(anchor.getMonth() - 1);
  return `${anchor.getFullYear()}-${String(anchor.getMonth()+1).padStart(2,'0')}`;
}
export function shiftPeriodKey(key, delta) {
  const [y,m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
export function periodStart(key, salaryDay=5) {
  const [y,m] = key.split('-').map(Number);
  return new Date(y, m-1, salaryDay);
}
export function periodEnd(key, salaryDay=5) {
  const start = periodStart(key, salaryDay);
  return new Date(start.getFullYear(), start.getMonth()+1, salaryDay-1);
}
export function periodTitle(key) {
  const [y,m] = key.split('-').map(Number);
  return `${MONTHS_RU[m-1]} ${y}`;
}
export function formatPeriodRange(key, salaryDay=5) {
  const opts = {day:'numeric',month:'long'};
  return `${periodStart(key,salaryDay).toLocaleDateString('ru-RU',opts)} — ${periodEnd(key,salaryDay).toLocaleDateString('ru-RU',opts)}`;
}
export function makeFoodWeeks(key, plans=[200,200,200,200], salaryDay=5) {
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
export function currentWeekIndex(key,date=new Date(),salaryDay=5) {
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
export function daysToNextSalary(date=new Date(),salaryDay=5) {
  const today = new Date(date.getFullYear(),date.getMonth(),date.getDate());
  let next = new Date(date.getFullYear(),date.getMonth(),salaryDay);
  if (today.getDate()>salaryDay) next = new Date(date.getFullYear(),date.getMonth()+1,salaryDay);
  return Math.max(0,Math.ceil((next-today)/86400000));
}

const category = (id,name,icon,color,kind='monthly',order=0)=>({id,name,icon,color,kind,order,visible:true});
export const DEFAULT_CATEGORIES = [
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
export function createPeriod(key) {
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
export function seedState(now=new Date()) {
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
      navIcons: {}
    },
    categories: structuredClone(DEFAULT_CATEGORIES),
    periods,
    payments: [],
    savings: [],
    purchases: [],
    pet: {balanceByn:0,avatarImage:'',transactions:[],needs:[]}
  };
}

export function ensurePeriod(state,key) {
  if(!state.periods[key]) state.periods[key]=createPeriod(key,'normal');
  for(const c of state.categories) if(c.kind!=='food'&&!state.periods[key].categoryBudgets[c.id]) state.periods[key].categoryBudgets[c.id]={plan:0,spent:0};
  if(state.periods[key].balanceNow!=null&&!state.periods[key].balanceSnapshot) captureBalanceSnapshot(state,state.periods[key]);
  return state.periods[key];
}
export function foodBudget(period){return{plan:roundMoney(period.foodWeeks.reduce((s,w)=>s+Number(w.plan||0),0)),spent:roundMoney(period.foodWeeks.reduce((s,w)=>s+Number(w.spent||0),0))}}
export function categoryBudget(period,category){return category.kind==='food'?foodBudget(period):(period.categoryBudgets[category.id]||{plan:0,spent:0})}
export function periodIncome(period){return roundMoney(Number(period.salary||0)+Number(period.extraIncome||0))}
export function periodPayment(state,key){let item=state.payments.find(p=>p.periodKey===key);if(!item){item=payment(key,0);state.payments.push(item)}return item}
const savingSign=t=>t.type==='deposit'?1:-1;
const savingCurrency=t=>t.currency||'usd';
const savingUsdAmount=t=>savingCurrency(t)==='byn'?0:Number(t.amountUsd||0);
const savingBynAmount=t=>savingCurrency(t)==='byn'?Number(t.amountByn||0):0;
export function savingsBalanceUsd(state){return roundMoney(state.savings.reduce((s,t)=>s+savingSign(t)*savingUsdAmount(t),0))}
const savingAmountByn=(state,t)=>savingBynAmount(t);
export function savingsBalanceByn(state){return roundMoney(state.savings.reduce((s,t)=>s+savingSign(t)*savingAmountByn(state,t),0))}
export function petBalanceByn(state){return Number.isFinite(Number(state.pet?.balanceByn))?roundMoney(state.pet.balanceByn):roundMoney(state.pet.transactions.reduce((s,t)=>s+(t.type==='topup'?1:-1)*Number(t.amountByn||0),0))}
export function paymentsPaidTotal(state){return roundMoney(state.payments.reduce((s,p)=>s+Number(p.paid||0),0))}
export function debtRemaining(state){return Math.max(0,roundMoney(Number(state.settings.debtInitial||0)-paymentsPaidTotal(state)))}
export function plannedCategoryTotal(state,period){return roundMoney(state.categories.filter(c=>c.visible).reduce((s,c)=>s+categoryBudget(period,c).plan,0))}
export function periodSavingsDepositedUsd(state,key){return roundMoney(state.savings.filter(t=>t.type==='deposit'&&periodKeyForDate(parseISODate(t.date),state.settings.salaryDay)===key).reduce((s,t)=>s+Number(t.amountUsd||0),0))}
export function periodSavingsDepositedByn(state,key){return roundMoney(state.savings.filter(t=>t.type==='deposit'&&periodKeyForDate(parseISODate(t.date),state.settings.salaryDay)===key).reduce((s,t)=>s+savingAmountByn(state,t),0))}
export function captureBalanceSnapshot(state,period){
  const payment=periodPayment(state,period.key);
  period.balanceSnapshot={
    housingSpent:Number(period.mandatory.housingSpent||0),reserveAllocated:Number(period.mandatory.reserveAllocated||0),paymentPaid:Number(payment.paid||0),savingsDepositedUsd:periodSavingsDepositedUsd(state,period.key),savingsDepositedByn:periodSavingsDepositedByn(state,period.key),
    categories:Object.fromEntries(Object.entries(period.categoryBudgets).map(([id,b])=>[id,Number(b.spent||0)])),
    food:period.foodWeeks.map(w=>Number(w.spent||0))
  };
  return period.balanceSnapshot;
}
export function plannedFreeBalance(state,period){
  const savingsPlanByn=Number(period.mandatory.savingsPlanByn??period.mandatory.savingsPlanUsd??0);
  const base=periodIncome(period)-Number(period.mandatory.housingPlan||0)-Number(periodPayment(state,period.key).planned||0)-Number(period.mandatory.reservePlan||0)-savingsPlanByn-plannedCategoryTotal(state,period);
  const overCategories=state.categories.filter(c=>c.visible&&c.kind!=='food').reduce((s,c)=>{const b=categoryBudget(period,c);return s+Math.min(0,Number(b.plan||0)-Number(b.spent||0))},0);
  const foodVariance=period.foodWeeks.reduce((s,w)=>{const delta=Number(w.plan||0)-Number(w.spent||0);return s+(w.closed?delta:Math.min(0,delta))},0);
  return roundMoney(base+overCategories+foodVariance);
}
export function liveFreeBalance(state,period){
  if(period.balanceNow==null)return plannedFreeBalance(state,period);
  const snapshot=period.balanceSnapshot||captureBalanceSnapshot(state,period),payment=periodPayment(state,period.key),saved=periodSavingsDepositedByn(state,period.key),savingsPlanByn=Number(period.mandatory.savingsPlanByn??period.mandatory.savingsPlanUsd??0);
  const remainingMandatory=Math.max(0,Number(period.mandatory.housingPlan||0)-Number(period.mandatory.housingSpent||0))+Math.max(0,Number(payment.planned||0)-Number(payment.paid||0))+Math.max(0,Number(period.mandatory.reservePlan||0)-Number(period.mandatory.reserveAllocated||0))+Math.max(0,savingsPlanByn-saved);
  const remainingCategories=state.categories.filter(c=>c.visible).reduce((sum,c)=>{
    if(c.kind==='food') return sum+period.foodWeeks.reduce((s,w)=>s+(w.closed?0:Math.max(0,Number(w.plan||0)-Number(w.spent||0))),0);
    const b=categoryBudget(period,c);return sum+Math.max(0,Number(b.plan||0)-Number(b.spent||0));
  },0);
  const newMandatorySpend=(Number(period.mandatory.housingSpent||0)-Number(snapshot.housingSpent||0))+(Number(period.mandatory.reserveAllocated||0)-Number(snapshot.reserveAllocated||0))+(Number(payment.paid||0)-Number(snapshot.paymentPaid||0))+(saved-Number(snapshot.savingsDepositedByn??snapshot.savingsDepositedUsd??0));
  const newCategorySpend=state.categories.filter(c=>c.visible).reduce((sum,c)=>{
    if(c.kind==='food')return sum+period.foodWeeks.reduce((s,w,i)=>s+Number(w.spent||0)-Number(snapshot.food?.[i]||0),0);
    const b=categoryBudget(period,c);return sum+Number(b.spent||0)-Number(snapshot.categories?.[c.id]||0);
  },0);
  return roundMoney(Number(period.balanceNow||0)-remainingMandatory-remainingCategories-newMandatorySpend-newCategorySpend);
}
export function purchaseAvailable(state,cost){return savingsBalanceByn(state)>=Number(cost||0)}
export function monthlySavingsRows(state){const map=new Map();for(const t of state.savings){const key=t.date.slice(0,7),row=map.get(key)||{period:key,deposited:0,withdrawn:0,depositedByn:0,withdrawnByn:0,notes:[]};if(t.type==='deposit'){row.deposited+=savingUsdAmount(t);row.depositedByn+=savingAmountByn(state,t)}else{row.withdrawn+=savingUsdAmount(t);row.withdrawnByn+=savingAmountByn(state,t)}if(t.note)row.notes.push(t.note);map.set(key,row)}return[...map.values()].sort((a,b)=>b.period.localeCompare(a.period))}
export function validateState(v){return !!v&&typeof v==='object'&&v.version===VERSION&&v.settings&&Array.isArray(v.categories)&&v.periods&&Array.isArray(v.payments)&&Array.isArray(v.savings)&&Array.isArray(v.purchases)&&v.pet}
