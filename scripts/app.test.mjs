import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

// Exercise the same bundle loaded by index.html, with only the browser UI and
// persistence replaced. Modal callbacks and calculation code remain real.
const bundle = fs.readFileSync(new URL('../app.bundle.js', import.meta.url), 'utf8');
function app() {
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 9, 15, 12])); }
  }
  const context = vm.createContext({ Date: TestDate, crypto: webcrypto, structuredClone, console, setTimeout, clearTimeout });
  vm.runInContext(bundle.replace(/\ninit\(\)[\s\S]*$/, ''), context);
  vm.runInContext(`
    state=seedState(new Date()); selectedPeriodKey='2026-10'; foodPeriodKey=selectedPeriodKey;
    committedState=cloneState(state);
    globalThis.messages=[]; globalThis.saved=[];
    saveState=async value=>{saved.push(cloneState(value));};
    renderAll=()=>{}; closeModal=()=>{}; toast=message=>messages.push(message);
    openModal=(title,fields,submit,options={})=>{globalThis.modal={title,fields,submit,options};};
  `, context);
  return {
    run: code => vm.runInContext(code, context),
    value: code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context)),
    context
  };
}

test('free balance editor saves the entered amount, preserves plans, and survives reload', async () => {
  const a=app();
  a.run(`const p=currentPeriod(); p.salary=1000; p.categoryBudgets.everyday.plan=700; openBalanceEditor();`);
  assert.equal(a.value(`modal.fields.find(f=>f.name==='balance').value`),300);
  await a.run(`modal.submit({balance:125.56,cash:0,note:''})`);
  assert.equal(a.value('liveFreeBalance(state,currentPeriod())'),125.56);
  assert.equal(a.value('currentPeriod().categoryBudgets.everyday.plan'),700);
  a.run('state=cloneState(saved.at(-1));');
  assert.equal(a.value('liveFreeBalance(state,currentPeriod())'),125.56);
});

test('deleting one of multiple payments rolls back that payment only', async () => {
  const a=app();
  a.run(`state.payments.push({id:'first',periodKey:'2026-10',planned:100,paid:50},{id:'second',periodKey:'2026-10',planned:200,paid:0}); paymentModal(state.payments[1]);`);
  await a.run(`modal.submit({title:'Second',period:'2026-10',planned:200,paid:75,note:''})`);
  a.run('deleteAccountOperation(state.account.transactions.at(-1).id)');
  assert.equal(a.value('state.payments[0].paid'),50);
  assert.equal(a.value('state.payments[1].paid'),0);
});

test('moving a paid payment moves all its linked operations to the new month', async () => {
  const a=app();
  a.run('paymentModal()');
  await a.run(`modal.submit({title:'Payment',period:'2026-09',planned:100,paid:75,note:''})`);
  a.run('paymentModal(state.payments.find(p=>p.title===\'Payment\'))');
  await a.run(`modal.submit({title:'Payment',period:'2026-10',planned:100,paid:75,note:''})`);
  assert.equal(a.value('state.account.transactions[0].periodKey'),'2026-10');
  a.run('deleteAccountOperation(state.account.transactions[0].id)');
  assert.equal(a.value(`state.payments.find(p=>p.title==='Payment').paid`),0);
});

test('food corrections spanning weeks are reversed in those same weeks', () => {
  const a=app();
  a.run(`const p=currentPeriod(); p.foodWeeks[0].spent=40; p.foodWeeks[1].spent=60; setCategorySpent(p,categoryById('food'),10); deleteAccountOperation(state.account.transactions.at(-1).id);`);
  assert.deepEqual(a.value('currentPeriod().foodWeeks.slice(0,2).map(w=>w.spent)'),[40,60]);
});

test('deleting an older income change preserves later income changes', async () => {
  const a=app();
  const fields={salary:1000,extra:0,cash:0,housingPlan:0,housingSpent:0,reservePlan:0,reserveAllocated:0,savingsUsd:0,savingsByn:0,utilities:0,utilitiesPaid:false,note:''};
  a.run('openPeriodEditor()');
  await a.context.modal.submit(fields);
  a.run('openPeriodEditor()');
  await a.context.modal.submit({...fields,salary:1200,extra:50});
  a.run('deleteAccountOperation(state.account.transactions[0].id)');
  assert.equal(a.value('currentPeriod().salary'),200);
  assert.equal(a.value('currentPeriod().extraIncome'),50);
});

test('exchange deletion reverses both currencies without changing the ordinary account', async () => {
  const a=app();
  a.run(`state.savings.push({id:'base',type:'deposit',currency:'byn',amountByn:100,accountAmountByn:0,date:'2026-10-10'}); exchangeSavingsBynModal();`);
  await a.run(`modal.submit({usd:30,date:'2026-10-15',note:''})`);
  a.run('deleteSavingsOperation(state.savings.at(-1).id)');
  assert.equal(a.value('savingsBalanceByn(state)'),100);
  assert.equal(a.value('savingsBalanceUsd(state)'),0);
  assert.equal(a.value('accountBalanceAfterSpending(state,currentPeriod())'),0);
});

test('deleting a category preserves historical spending and deleting its operation still reverses it', async () => {
  const a=app();
  a.run(`currentPeriod().salary=1000; setCategorySpent(currentPeriod(),categoryById('everyday'),100); openCategoryEditor('everyday'); globalThis.confirm=()=>true;`);
  await a.run('modal.options.extraAction.handler()');
  assert.equal(a.value('periodSpentTotal(state,currentPeriod())'),100);
  assert.equal(a.value('accountBalanceAfterSpending(state,currentPeriod())'),900);
  a.run('deleteAccountOperation(state.account.transactions[0].id)');
  assert.equal(a.value('accountBalanceAfterSpending(state,currentPeriod())'),1000);
});

test('rapid commits persist each snapshot and the newest change', async () => {
  const a=app();
  a.run(`saveState=async value=>{await new Promise(resolve=>setTimeout(resolve,10)); saved.push(cloneState(value));}; currentPeriod().salary=100; globalThis.first=commit(); currentPeriod().salary=200; globalThis.second=commit();`);
  await a.run('Promise.all([first,second])');
  assert.deepEqual(a.value('saved.map(s=>s.periods[\'2026-10\'].salary)'),[100,200]);
  assert.equal(a.value('committedState.periods[\'2026-10\'].salary'),200);
});

test('money fields reject negative plans and spending but allow signed free balances', () => {
  const a=app();
  assert.match(a.run('fieldHtml({name:\'plan\',label:\'Plan\',type:\'money\'})'),/data-money-min="0"/);
  a.run('openBalanceEditor()');
  assert.doesNotMatch(a.run('fieldHtml(modal.fields.find(f=>f.name===\'balance\'))'),/data-money-min/);
});

test('legacy income snapshots can be removed in either order without restoring deleted income',()=>{
  const a=app();
  a.run(`currentPeriod().salary=1200; currentPeriod().extraIncome=50; const first=recordAccountDelta(1000,{periodKey:'2026-10',linkedId:'income:2026-10'}); first.previousSalary=0; first.previousExtraIncome=0; const next=recordAccountDelta(250,{periodKey:'2026-10',linkedId:'income:2026-10'}); next.previousSalary=1000; next.previousExtraIncome=0; deleteAccountOperation(first.id); deleteAccountOperation(next.id);`);
  assert.equal(a.value('currentPeriod().salary'),0);
  assert.equal(a.value('currentPeriod().extraIncome'),0);
});

test('an expense with a dependent later correction cannot silently corrupt totals on deletion',()=>{
  const a=app();
  a.run(`setCategorySpent(currentPeriod(),categoryById('everyday'),100); setCategorySpent(currentPeriod(),categoryById('everyday'),20); globalThis.original=state.account.transactions[0].id;`);
  assert.equal(a.run('deleteAccountOperation(original)'),false);
  assert.equal(a.value('currentPeriod().categoryBudgets.everyday.spent'),20);
  assert.equal(a.value('state.account.transactions.length'),2);
  a.run('deleteAccountOperation(state.account.transactions.at(-1).id); deleteAccountOperation(original)');
  assert.equal(a.value('currentPeriod().categoryBudgets.everyday.spent'),0);
  assert.equal(a.value('state.account.transactions.length'),0);
});

test('undo waits for pending writes and saves through the same queue',async()=>{
  const a=app();
  a.run(`saveState=async value=>{await new Promise(resolve=>setTimeout(resolve,10));saved.push(cloneState(value));}; currentPeriod().salary=100;globalThis.pending=commit();globalThis.undo=undoLastAction();`);
  await a.run('Promise.all([pending,undo])');
  assert.equal(a.value('currentPeriod().salary'),0);
  assert.equal(a.value('saved.at(-1).periods[\'2026-10\'].salary'),0);
  assert.equal(a.value('undoState'),null);
});

test('failed persistence leaves the committed snapshot intact and does not poison later saves',async()=>{
  const a=app();
  a.run(`saveState=async()=>{throw new Error('storage');}; currentPeriod().salary=100;`);
  await assert.rejects(a.run('commit()'),/storage/);
  assert.equal(a.value('committedState.periods[\'2026-10\'].salary'),0);
  a.run(`saveState=async value=>saved.push(cloneState(value));currentPeriod().salary=200;`);
  await a.run('commit()');
  assert.equal(a.value('saved.at(-1).periods[\'2026-10\'].salary'),200);
});

test('current and older backups migrate without modifying the supplied input',()=>{
  const a=app();
  a.run(`globalThis.old=cloneState(state);old.version=4;delete old.settings.salaryDay;delete old.periods['2026-09'].categoryBudgets;delete old.periods['2026-09'].mandatory;globalThis.restored=migrateBackupState(old);`);
  assert.equal(a.value('restored.settings.salaryDay'),5);
  assert.equal(a.run('validateState(restored)'),true);
  assert.equal(a.value('old.version'),4);
  assert.equal(a.run('old.periods[\'2026-09\'].mandatory===undefined'),true);
  assert.equal(a.run('validateState(migrateBackupState(state))'),true);
});

test('malformed, nonfinite and newer backups are rejected before replacing current state',()=>{
  for(const code of ['migrateBackupState({})',`state.periods['2026-10'].salary='Infinity';migrateBackupState(state)`,'state.version=999;migrateBackupState(state)',`state.savings.push({amountUsd:1,date:'2026-02-30'});migrateBackupState(state)`,`state.categories.push({id:'duplicate-food',kind:'food'});migrateBackupState(state)`]){
    const a=app();
    assert.throws(()=>a.run(code));
  }
});

test('deleting a completed pet need refunds its internal envelope without touching the ordinary account',async()=>{
  const a=app();
  a.run(`state.pet.balanceByn=70;state.pet.needs.push({id:'need',name:'Food',costByn:30,completed:true});state.pet.transactions.push({id:'spend',type:'spend',amountByn:30,needId:'need'});needModal(state.pet.needs[0]);`);
  await a.run('modal.options.extraAction.handler()');
  assert.equal(a.value('petBalanceByn(state)'),100);
  assert.equal(a.value('state.pet.transactions.length'),0);
  assert.equal(a.value('state.account.transactions.length'),0);
});

test('deleting a completed gift refunds the gift envelope without charging the account again',async()=>{
  const a=app();
  a.run(`state.gifts.balanceByn=100;state.gifts.plans.push({id:'gift',name:'Gift',costByn:30,completed:true});state.gifts.transactions.push({id:'spend',type:'spend',amountByn:30,giftPlanId:'gift'});giftModal(state.gifts.plans[0]);`);
  await a.run('modal.options.extraAction.handler()');
  assert.equal(a.value('giftBalanceByn()'),100);
  assert.equal(a.value('state.gifts.transactions.length'),0);
  assert.equal(a.value('state.account.transactions.length'),0);
});

test('purchase completion and reversal debit and refund exactly the selected source',async()=>{
  for(const source of ['account','savings','safety']){
    const a=app();
    a.run(`currentPeriod().salary=1000;state.safety.amountUsd=100;state.savings.push({id:'base',type:'deposit',currency:'usd',amountUsd:100,accountAmountByn:0,date:'2026-10-10'});state.purchases.push({id:'purchase',name:'Item',costUsd:10,completed:false});completePurchaseModal(state.purchases[0]);`);
    await a.context.modal.submit({source,accountByn:30,category:'everyday',date:'2026-10-15'});
    assert.equal(a.value('state.purchases[0].completed'),true,source);
    assert.equal(a.value('accountBalanceAfterSpending(state,currentPeriod())'),source==='account'?970:1000,source);
    assert.equal(a.value('savingsBalanceUsd(state)'),source==='savings'?90:100,source);
    assert.equal(a.value('state.safety.amountUsd'),source==='safety'?90:100,source);
    a.run('rollbackCompletedPurchase(state.purchases[0])');
    assert.equal(a.value('state.purchases[0].completed'),false,source);
    assert.equal(a.value('accountBalanceAfterSpending(state,currentPeriod())'),1000,source);
    assert.equal(a.value('savingsBalanceUsd(state)'),100,source);
    assert.equal(a.value('state.safety.amountUsd'),100,source);
    assert.equal(a.value('currentPeriod().categoryBudgets.everyday.spent'),0,source);
  }
});

test('quick gift expenses spend only the already funded gift envelope',async()=>{
  const a=app();
  a.run(`state.gifts.balanceByn=100;quickExpenseModal();`);
  await a.run(`modal.submit({amount:30,category:'gifts'})`);
  assert.equal(a.value('giftBalanceByn()'),70);
  assert.equal(a.value('state.account.transactions.length'),0);
  assert.equal(a.value('periodSpentTotal(state,currentPeriod())'),0);
});

test('funding the USD safety envelope fulfills its BYN reserve plan exactly once',async()=>{
  const a=app();
  a.run(`currentPeriod().salary=1000;currentPeriod().mandatory.reservePlan=100;safetyModal();`);
  await a.run(`modal.submit({amount:30,accountByn:90,goal:2000,icon:'shield'})`);
  assert.equal(a.value('state.safety.amountUsd'),30);
  assert.equal(a.value('currentPeriod().mandatory.reserveAllocated'),90);
  assert.equal(a.value('accountBalanceAfterSpending(state,currentPeriod())'),910);
  assert.equal(a.value('remainingPlannedOutflows(state,currentPeriod())'),10);
  assert.equal(a.value('liveFreeBalance(state,currentPeriod())'),900);
  a.run('deleteAccountOperation(state.account.transactions.at(-1).id)');
  assert.equal(a.value('state.safety.amountUsd'),0);
  assert.equal(a.value('currentPeriod().mandatory.reserveAllocated'),0);
  assert.equal(a.value('liveFreeBalance(state,currentPeriod())'),900);
});

test('deleting safety funding after dependent spending preserves all balances until spending is reversed',async()=>{
  const a=app();
  a.run(`currentPeriod().salary=1000;safetyModal();`);
  await a.run(`modal.submit({amount:30,accountByn:90,goal:2000,icon:'shield'})`);
  a.run('state.safety.amountUsd=5');
  assert.equal(a.run('deleteAccountOperation(state.account.transactions[0].id)'),false);
  assert.equal(a.value('state.safety.amountUsd'),5);
  assert.equal(a.value('currentPeriod().mandatory.reserveAllocated'),90);
  assert.equal(a.value('state.account.transactions.length'),1);
});

test('a repeated form submit while the first one is saving executes the mutation once',async()=>{
  const a=app();
  a.run(`
    globalThis.nodes=new Map();
    document={querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,{disabled:false,addEventListener:(type,callback)=>{nodes.get(selector)[type]=callback;}});return nodes.get(selector);},querySelectorAll:()=>[]};
    bindStaticEvents();globalThis.calls=0;
    modalSubmitHandler=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,10));};
    globalThis.event={preventDefault(){},currentTarget:{querySelectorAll:()=>[]}};
    globalThis.firstSubmit=nodes.get('#modalForm').submit(event);globalThis.secondSubmit=nodes.get('#modalForm').submit(event);
  `);
  await a.run('Promise.all([firstSubmit,secondSubmit])');
  assert.equal(a.value('calls'),1);
  assert.equal(a.value('modalSubmitting'),false);
});

test('carryover adds once to the new budget, preserves history and envelopes, and can be reversed',async()=>{
  const a=app();
  a.run(`state.periods['2026-09'].salary=400; currentPeriod().salary=1000; currentPeriod().categoryBudgets.everyday.plan=700; state.pet.balanceByn=90; saveCarryover(currentPeriod(),125.56); saveCarryover(currentPeriod(),125.56);`);
  assert.equal(a.value('accountBalanceAfterSpending(state,currentPeriod())'),1125.56);
  assert.equal(a.value('liveFreeBalance(state,currentPeriod())'),425.56);
  assert.equal(a.value("accountBalanceAfterSpending(state,state.periods['2026-09'])"),400);
  assert.equal(a.value('petBalanceByn(state)'),90);
  assert.equal(a.value('state.account.transactions.length'),1);
  await a.run('commit(false);');
  a.run('state=cloneState(saved.at(-1)); saveCarryover(currentPeriod(),125.56);');
  assert.equal(a.value('state.account.transactions.length'),1);
  a.run('deleteAccountOperation(state.account.transactions[0].id);');
  assert.equal(a.value('liveFreeBalance(state,currentPeriod())'),300);
});

test('carryover zero completes the prompt without an operation and invalid amounts are rejected',()=>{
  const a=app();
  for(const value of ['-1','NaN','Infinity'])assert.throws(()=>a.run(`saveCarryover(currentPeriod(),${value});`));
  assert.equal(a.value('state.account.transactions.length'),0);
  a.run('saveCarryover(currentPeriod(),0);');
  assert.equal(a.value('currentPeriod().carryoverConfirmed'),true);
  assert.equal(a.value('state.account.transactions.length'),0);
});

test('carryover starts next period, waits for other dialogs and remembers confirmation after reload',async()=>{
  const a=app();
  a.run(`document={querySelector:()=>({hidden:true})};`);
  await a.run('maybeAskCarryover()');
  assert.equal(a.value('state.settings.carryoverStartPeriod'),'2026-10');
  assert.equal(a.run('typeof modal'),'undefined');
  a.run(`state.settings.carryoverStartPeriod='2026-09'; document.querySelector=()=>({hidden:false});`);
  await a.run('maybeAskCarryover()');
  assert.equal(a.run('typeof modal'),'undefined');
  a.run('document.querySelector=()=>({hidden:true});');
  await a.run('maybeAskCarryover()');
  assert.equal(a.value('modal.title'),'Сколько перенести с прошлого месяца?');
  await a.run('modal.submit({amount:50});');
  a.run('state=cloneState(saved.at(-1)); delete globalThis.modal;');
  await a.run('maybeAskCarryover()');
  assert.equal(a.run('typeof modal'),'undefined');
});

test('home displays remaining food and category budgets and month highlights spendable money with a budget breakdown',()=>{
  const a=app();
  a.run(`globalThis.nodes=new Map();document={querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',style:{},classList:{toggle(){},remove(){}},querySelector(){return {dataset:{}};}});return nodes.get(selector);}};
    const p=currentPeriod();p.salary=1000;p.categoryBudgets.everyday={plan:100,spent:40};
    const w=p.foodWeeks[currentWeekIndex(p.key,new Date(),state.settings.salaryDay)];w.plan=100;w.spent=30;
    state.settings.dashboardCards=[dashboardCategoryKey('everyday')];renderHome();renderMonth();`);
  assert.equal(a.value("nodes.get('#weekPlan').textContent"),a.run('formatByn(70)'));
  assert.match(a.value("nodes.get('#homeCategoryList').innerHTML"),/60/);
  assert.equal(a.value("nodes.get('#incomeTotal').textContent"),a.run('formatByn(800)'));
  assert.equal(a.value("nodes.get('#monthFreeValue').textContent"),a.run('formatByn(800)'));
  assert.equal(a.value("nodes.get('#incomeDetails').textContent"),a.run('`Остаток до планов — ${formatByn(930)}\\nЗапланированные траты — ${formatByn(130)}`'));
  assert.match(a.run("renderCategoryCard(categoryById('pet'),currentPeriod())"),/>Отложено</);
});

test('appearance presets persist without changing budgets or losing legacy custom settings',async()=>{
  const a=app();
  a.run(`currentPeriod().salary=1234.56;state.settings.appearance={primary:'#123456',backgroundImage:'data:image/png;base64,old'};appearanceModal();`);
  assert.equal(a.value('modal.fields[0].value'),'lime');
  await a.run(`modal.submit({preset:'lilac'});`);
  a.run('state=cloneState(saved.at(-1));');
  assert.equal(a.value('appearanceSettings().preset'),'lilac');
  assert.equal(a.value('selectedTheme().label'),'Лаванда');
  assert.equal(a.value('currentPeriod().salary'),1234.56);
  assert.equal(a.value('appearanceSettings().backgroundImage'),'data:image/png;base64,old');
  a.run(`appearanceModal();`);
  assert.equal(a.value('modal.fields[0].value'),'lilac');
  await a.run(`modal.submit({preset:'not-a-theme'});`);
  assert.equal(a.value('appearanceSettings().preset'),'lime');
});

test('theme previews expose six selectable palettes and opening the dialog does not change the theme',()=>{
  const a=app();
  a.run(`state.settings.appearance={preset:'sky'};appearanceModal();`);
  assert.equal(a.value('appearanceSettings().preset'),'sky');
  const html=a.run('fieldHtml(modal.fields[0])');
  assert.equal((html.match(/type="radio"/g)||[]).length,6);
  assert.match(html,/value="sky" checked/);
});

test('legacy category colors remain selected and dark icon presets keep light foregrounds',()=>{
  const a=app();
  const html=a.run(`fieldHtml({name:'color',type:'palette',label:'Цвет',value:'#123456',options:colorOptions})`);
  assert.match(html,/value="#123456" checked/);
  assert.match(a.run(`categoryColorStyle('#202820')`),/var\(--on-dark\)/);
  assert.match(a.run(`categoryColorStyle('#c5ec63')`),/var\(--text\)/);
});

test('universal icon pack replaces saved phone icons once and preserves finances and later choices',()=>{
 const a=app();
 a.run(`currentPeriod().salary=1234.56;state.settings.navIcons={home:{image:'old'}};state.categories[0].iconImage='old';state.pet.avatarImage='old';state.safety.iconImage='old';normalizeState();`);
 assert.equal(a.value('state.settings.navIcons.home.image'),'./icons/universal/01-navigation/home.png');
 assert.equal(a.value('state.categories[0].iconImage'),'./icons/universal/02-categories/01-food.png');
 assert.equal(a.value('state.pet.avatarImage'),'./icons/universal/04-avatar/pet-avatar.png');
 assert.equal(a.value('state.safety.iconImage'),'./icons/universal/03-safety/safety.png');
 assert.equal(a.value('currentPeriod().salary'),1234.56);
 a.run(`state.settings.navIcons.home.image='later-choice';normalizeState();`);
 assert.equal(a.value('state.settings.navIcons.home.image'),'later-choice');
});

test('payment page target is isolated from monthly budgets and dashboard debt',async()=>{
 const a=app();
 a.run(`currentPeriod().salary=2000;state.payments=[{id:'p',periodKey:currentPeriod().key,planned:500,paid:100}];globalThis.before={free:liveFreeBalance(state,currentPeriod()),debt:debtRemaining(state),account:state.account.balanceByn};paymentRemainingModal();`);
 await a.run('modal.submit({remaining:3000});');
 assert.equal(a.value('paymentPageSummary().remaining'),3000);
 assert.equal(a.value('paymentPageSummary().unallocated'),2600);
 assert.equal(a.value('liveFreeBalance(state,currentPeriod())'),a.value('before.free'));
 assert.equal(a.value('debtRemaining(state)'),a.value('before.debt'));
 assert.equal(a.value('state.account.balanceByn'),a.value('before.account'));
 a.run('state=cloneState(saved.at(-1));paymentModal();');
 assert.equal(a.value("modal.fields.find(f=>f.name==='planned').value"),'');
 assert.equal(a.value("modal.fields.find(f=>f.name==='planned').placeholder"),'2600');
});

test('payment recommendations follow unpaid plans and payments without double subtraction',()=>{
 const a=app();
 a.run(`state.settings.paymentPageTotalByn=3100;state.payments=[{id:'p',periodKey:'2026-10',planned:500,paid:100}];`);
 assert.equal(a.value('paymentPageSummary().unallocated'),2600);
 a.run('state.payments[0].paid=200;');
 assert.equal(a.value('paymentPageSummary().remaining'),2900);
 assert.equal(a.value('paymentPageSummary().unallocated'),2600);
 a.run(`state.payments.push({id:'q',periodKey:'2026-11',planned:1000,paid:0});`);
 assert.equal(a.value('paymentPageSummary().unallocated'),1600);
 a.run('state.payments.pop();');
 assert.equal(a.value('paymentPageSummary().unallocated'),2600);
 a.run('state.settings.paymentPageTotalByn=0;');
 assert.equal(a.value('paymentPageSummary().remaining'),0);
 assert.equal(a.value('paymentPageSummary().unallocated'),0);
 assert.equal(a.value('paymentPageSummary().overallocated'),300);
});

test('month category selection preserves funded history and isolates months',async()=>{
 const a=app();
 a.run(`currentPeriod().categoryBudgets.everyday={plan:100,spent:20};currentPeriod().categoryBudgets.pet={plan:0,spent:30};`);
 assert.deepEqual(a.value('monthCategoryIds(currentPeriod())'),['everyday','pet']);
 a.run('monthCategoryPicker();');
 await a.run('modal.submit({sport:true});');
 assert.deepEqual(a.value('monthCategoryIds(currentPeriod())'),['everyday','pet','sport']);
 assert.deepEqual(a.value("monthCategoryIds(ensurePeriod(state,'2026-11'))"),[]);
 a.run('state=cloneState(saved.at(-1));');
 assert.deepEqual(a.value('monthCategoryIds(currentPeriod())'),['everyday','pet','sport']);
 assert.equal(a.value('currentPeriod().categoryBudgets.everyday.spent'),20);
});

test('completed categories sink to the bottom and become active again after a plan increase',()=>{
 const a=app();
 a.run(`currentPeriod().selectedCategoryIds=['everyday','sport','pet'];currentPeriod().categoryBudgets.everyday={plan:100,spent:100};currentPeriod().categoryBudgets.sport={plan:200,spent:20};`);
 assert.deepEqual(a.value('orderedMonthCategories(currentPeriod()).map(c=>c.id)'),['sport','pet','everyday']);
 assert.equal(a.run("moveMonthCategory(currentPeriod(),'pet','sport')"),true);
 assert.deepEqual(a.value('orderedMonthCategories(currentPeriod()).map(c=>c.id)'),['pet','sport','everyday']);
 assert.equal(a.run("moveMonthCategory(currentPeriod(),'everyday','pet')"),false);
 a.run('currentPeriod().categoryBudgets.everyday.plan=120;');
 assert.deepEqual(a.value('orderedMonthCategories(currentPeriod()).map(c=>c.id)'),['everyday','pet','sport']);
});

test('deleted September payment stays deleted after rendering and reloading',async()=>{
  const a=app();
  a.run(`selectedPeriodKey='2026-09';ensurePeriod(state,selectedPeriodKey);
    state.payments=[{id:'september',periodKey:'2026-09',planned:600,paid:0,note:''}];
    globalThis.nodes=new Map();document={querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',style:{},classList:{toggle(){},remove(){}},querySelector(){return {dataset:{}};}});return nodes.get(selector);}};
    renderAll=()=>{renderHome();renderMonth();renderPayments();};
    paymentModal(state.payments[0]);`);
  await a.run('modal.options.extraAction.handler()');
  assert.equal(a.value('state.payments.length'),0);
  a.run('state=cloneState(saved.at(-1));renderAll();');
  assert.equal(a.value('state.payments.length'),0);
  a.run("openMandatoryEditor('housing');");
  assert.equal(a.value('state.payments.length'),0);
  a.run("openMandatoryEditor('payment');");
  assert.equal(a.value('state.payments.length'),0);
  await a.run("modal.submit({name:'Платежи',plan:200,spent:0})");
  assert.equal(a.value('state.payments.length'),1);
  assert.equal(a.value('state.payments[0].planned'),200);
});
