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
  assert.equal(a.value('freeAfterPlans(currentPeriod())'),125.56);
  assert.equal(a.value('currentPeriod().categoryBudgets.everyday.plan'),700);
  a.run('state=cloneState(saved.at(-1));');
  assert.equal(a.value('freeAfterPlans(currentPeriod())'),125.56);
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
  a.run(`currentPeriod().salary=1000;currentPeriod().mandatory.sections=['reserve'];currentPeriod().mandatory.reservePlan=100;safetyModal();`);
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
  a.run(`globalThis.nodes=new Map();document={querySelectorAll:()=>[],querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',style:{},classList:{toggle(){},remove(){}},querySelector(){return {dataset:{}};}});return nodes.get(selector);}};
    const p=currentPeriod();p.salary=1000;p.categoryBudgets.everyday={plan:100,spent:40};
    const w=p.foodWeeks[currentWeekIndex(p.key,new Date(),state.settings.salaryDay)];w.plan=100;w.spent=30;
    state.settings.dashboardCards=[dashboardCategoryKey('everyday')];renderHome();renderMonth();`);
  assert.equal(a.value("nodes.get('#weekPlan').textContent"),a.run('formatByn(70)'));
  assert.match(a.value("nodes.get('#categoryList').innerHTML"),/60/);
  assert.equal(a.value("nodes.get('#freeValue').textContent"),a.run('formatByn(900)'));
  assert.equal(a.value("nodes.get('#freeMeta').textContent"),a.run('`Осталось по факту: ${formatByn(930)} · Запланированные траты: ${formatByn(130)}`'));
  assert.match(a.run("renderCategoryCard(categoryById('pet'),currentPeriod())"),/>Потратить в этом месяце</);
});

test('approved palette is identical for fresh and existing settings without erasing preferences',()=>{
 const a=app();a.run("currentPeriod().salary=1234.56;state.settings.appearance={preset:'lilac',backgroundImage:'data:image/png;base64,old'};");
 assert.equal(a.value('selectedTheme().bg'),'#f2f2f2');
 assert.equal(a.value('selectedTheme().ink'),'#202020');
 assert.equal(a.value('appearanceSettings().preset'),'lilac');
 a.run("state.settings.appearance.preset='checkerRed';");
 assert.equal(a.value('selectedTheme().bg'),'#f2f2f2');
 assert.equal(a.value('currentPeriod().salary'),1234.56);
 assert.equal(a.value('appearanceSettings().backgroundImage'),'data:image/png;base64,old');
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
 assert.equal(a.value('state.pet.avatarImage'),'old');
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
 assert.deepEqual(a.value('monthCategoryIds(currentPeriod())'),['food','everyday','pet']);
 a.run('monthCategoryPicker();');
 await a.run('modal.submit({sport:true});');
 assert.deepEqual(a.value('monthCategoryIds(currentPeriod())'),['food','everyday','pet','sport']);
 assert.deepEqual(a.value("monthCategoryIds(ensurePeriod(state,'2026-11'))"),['food']);
 a.run('state=cloneState(saved.at(-1));');
 assert.deepEqual(a.value('monthCategoryIds(currentPeriod())'),['food','everyday','pet','sport']);
 assert.equal(a.value('currentPeriod().categoryBudgets.everyday.spent'),20);
});

test('pinned categories stay first and manual order survives payments and reload',()=>{
 const a=app();
 a.run(`currentPeriod().selectedCategoryIds=['everyday','sport','pet'];currentPeriod().pinnedCategoryIds=['sport'];currentPeriod().categoryBudgets.everyday={plan:100,spent:100};`);
 assert.deepEqual(a.value('orderedMonthCategories(currentPeriod()).map(c=>c.id)'),['sport','everyday','pet']);
 assert.equal(a.run("moveMonthCategory(currentPeriod(),'pet','everyday')"),true);
 assert.deepEqual(a.value('orderedMonthCategories(currentPeriod()).map(c=>c.id)'),['sport','pet','everyday']);
 assert.equal(a.run("moveMonthCategory(currentPeriod(),'pet','sport')"),false);
 a.run('state=cloneState(state);');
 assert.deepEqual(a.value('orderedMonthCategories(currentPeriod()).map(c=>c.id)'),['sport','pet','everyday']);
});

test('deleted September payment stays deleted after rendering and reloading',async()=>{
  const a=app();
  a.run(`selectedPeriodKey='2026-09';ensurePeriod(state,selectedPeriodKey);
    state.payments=[{id:'september',periodKey:'2026-09',planned:600,paid:0,note:''}];
    globalThis.nodes=new Map();document={querySelectorAll:()=>[],querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',style:{},classList:{toggle(){},remove(){}},querySelector(){return {dataset:{}};}});return nodes.get(selector);}};
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

test('month reset clears only selected period and can be undone',async()=>{
 const a=app();
 a.run(`globalThis.confirm=()=>true;const p=currentPeriod();p.salary=1000;p.selectedCategoryIds=['sport'];p.categoryBudgets.sport={plan:200,spent:50};
 state.payments=[{id:'a',periodKey:'2026-10',planned:100,paid:0},{id:'b',periodKey:'2026-11',planned:300,paid:0}];
 recordAccountDelta(-50,{periodKey:p.key,date:'2026-10-15',categoryId:'sport'});
 ensurePeriod(state,'2026-11').salary=2222;
 committedState=cloneState(state);globalThis.original=cloneState(state);`);
 await a.run('resetSelectedMonth()');
 assert.equal(a.value('currentPeriod().salary'),0);
 assert.deepEqual(a.value('currentPeriod().selectedCategoryIds'),[]);
 assert.equal(a.value('state.account.transactions.length'),0);
 assert.equal(a.value('state.payments.length'),1);
 assert.equal(a.value("state.periods['2026-11'].salary"),2222);
 assert.equal(a.value('liveFreeBalance(state,currentPeriod())'),0);
 assert.equal(a.value('validateState(state)'),true);
 assert.deepEqual(a.value('undoState'),a.value('original'));
 a.run('state=cloneState(saved.at(-1));');
 assert.equal(a.value('currentPeriod().salary'),0);
});

test('cancelling month reset leaves data unchanged',async()=>{
 const a=app();a.run('globalThis.confirm=()=>false;globalThis.original=cloneState(state);');
 await a.run('resetSelectedMonth()');
 assert.deepEqual(a.value('state'),a.value('original'));
 assert.equal(a.value('saved.length'),0);
});

test('month reset reverses envelope transfers and preserves other months',async()=>{
 const a=app();
 a.run(`globalThis.confirm=()=>true;
 state.pet.balanceByn=150;state.pet.transactions=[{id:'p',type:'topup',amountByn:100,date:'2026-10-15',budgetPeriodKey:'2026-10'},{id:'q',type:'topup',amountByn:50,date:'2026-11-15'}];
 state.safety.amountUsd=30;state.safety.transactions=[{id:'s',type:'topup',amountUsd:20,date:'2026-10-15'}];
 state.savings=[{id:'d',type:'deposit',amountUsd:10,periodKey:'2026-10',date:'2026-10-15'}];
 recordAccountDelta(-100,{date:'2026-10-15',periodKey:'2026-10',linkedId:'pet:p'});`);
 await a.run('resetSelectedMonth()');
 assert.equal(a.value('state.pet.balanceByn'),50);
 assert.equal(a.value('state.pet.transactions.length'),1);
 assert.equal(a.value('state.safety.amountUsd'),10);
 assert.equal(a.value('state.savings.length'),0);
});

test('reset is atomic when later envelope spending prevents reversal',async()=>{
 const a=app();
 a.run(`globalThis.confirm=()=>true;state.pet.balanceByn=0;state.pet.transactions=[{id:'p',type:'topup',amountByn:100,date:'2026-10-15'},{id:'q',type:'spend',amountByn:100,date:'2026-11-15'}];globalThis.original=cloneState(state);`);
 await a.run('resetSelectedMonth()');
 assert.deepEqual(a.value('state'),a.value('original'));
 assert.equal(a.value('saved.length'),0);
});

test('home quick actions are configurable and persist',async()=>{
 const a=app();
 a.run('quickActionsModal()');
 await a.run("modal.submit({slot0:'payments',slot1:'month',slot2:'food',slot3:'pet'})");
 a.run('state=cloneState(saved.at(-1))');
 assert.deepEqual(a.value('quickActionIds()'),['payments','month','food','pet']);
 a.run('quickActionsModal()');
 await a.run("modal.submit({slot0:'month',slot1:'month',slot2:'food',slot3:'pet'})");
 assert.equal(a.value('saved.length'),1);
});

test('month can stay hidden in bottom navigation after normalization',()=>{
 const a=app();a.run("state.settings.navItems=['home','savings'];normalizeState();");
 assert.deepEqual(a.value('navItems()'),['home','savings']);
 a.run('state=cloneState(state);normalizeState();');
 assert.equal(a.value("navItems().includes('month')"),false);
});

test('personal section records survive full backup migration without changing finance',async()=>{
 const a=app();a.context.URL=URL;
 a.run("lifeSection='ideas';globalThis.financial=cloneState(state);lifeEditor();");
 await a.run("modal.submit({title:'Полка',text:'Описание',links:''})");
 a.run("lifeDetail=state.life.ideas[0].id;lifeEditor(null,{note:true});");
 await a.run("modal.submit({title:'Размеры',text:'120 см',links:'https://example.com'})");
 a.run('globalThis.restored=migrateBackupState(state);');
 assert.deepEqual(a.value('restored.life'),a.value('state.life'));
 assert.deepEqual(a.value('state.periods'),a.value('financial.periods'));
 assert.deepEqual(a.value('state.account'),a.value('financial.account'));
 assert.equal(a.value('backupSummaryForState(state).lifeRecords'),2);
 assert.equal(a.value("lifeUrl('javascript:alert(1)')"),'');
 assert.equal(a.value("lifeUrl('data:text/html,test')"),'');
});

test('activity allows multiple types per day and prevents duplicate marks',async()=>{
 const a=app();
 for(const kind of ['gym','steps']){
  a.run("lifeActivityEditor('2026-10-05')");
  await a.run(`modal.submit({date:'2026-10-05',kind:'${kind}',title:''})`);
 }
 a.run("lifeActivityEditor('2026-10-05')");
 await a.run("modal.submit({date:'2026-10-05',kind:'gym',title:''})");
 assert.equal(a.value('lifeData().activities.length'),2);
 a.run('lifeWeightEditor()');
 await a.run("modal.submit({date:'2026-10-05',value:65.4})");
 a.run('lifeWeightEditor()');
 await a.run("modal.submit({date:'2026-10-05',value:65.2})");
 assert.equal(a.value('state.life.weights.length'),1);
 assert.equal(a.value('state.life.weights[0].value'),65.2);
 assert.equal(a.value('validLifeData(state.life)'),true);
 assert.equal(a.value("validLifeData({weights:[{id:'bad',date:'2026-10-05',value:-1}]})"),false);
});

test('old backups remain compatible and malformed personal data is rejected',()=>{
 const a=app();
 assert.equal(a.value('validLifeData(undefined)'),true);
 assert.equal(a.value("validLifeData({ideas:'bad'})"),false);
 assert.throws(()=>a.run("migrateBackupState({...state,life:{ideas:'bad'}})"),/format/);
});

test('diary rich text survives backup migration and does not change finance',()=>{
 const a=app();
 a.run(`globalThis.before=cloneState(state);lifeData().diary.push({id:'note',title:'Мой день',date:'2026-10-03',html:'<h2>Мысли</h2><p><b>Текст</b></p><p><input type="checkbox" checked>Готово</p>',updatedAt:'2026-10-03T12:00:00Z'});globalThis.restored=migrateBackupState(state);`);
 assert.deepEqual(a.value('restored.life.diary'),a.value('state.life.diary'));
 assert.deepEqual(a.value('restored.payments'),a.value('before.payments'));
 assert.deepEqual(a.value('state.account'),a.value('before.account'));
 assert.equal(a.value('backupSummaryForState(state).lifeRecords'),1);
 assert.equal(a.value("validLifeData({diary:[{id:'bad',title:'Bad',date:'not-a-date',html:5}]})"),false);
});

test('custom section builder preserves records when blocks are disabled and restored',async()=>{
 const a=app();a.run("sectionBuilder(null,'recipes')");
 await a.run("modal.submit({title:'Моя кухня',use_recipes:true,use_checklist:true,name_checklist:'Купить'})");
 assert.equal(a.value('customSections()[0].blocks.length'),2);
 a.run("customSections()[0].blocks.find(b=>b.type==='recipes').items.push({id:'recipe',title:'Суп',ingredients:'Вода',steps:'Варить'});sectionBuilder(customSections()[0]);");
 await a.run("modal.submit({title:'Кухня',use_checklist:true})");
 assert.equal(a.value("customSections()[0].blocks.find(b=>b.type==='recipes').hidden"),true);
 a.run('sectionBuilder(customSections()[0])');
 await a.run("modal.submit({title:'Кухня',use_checklist:true,use_recipes:true})");
 assert.equal(a.value("customSections()[0].blocks.find(b=>b.type==='recipes').items[0].title"),'Суп');
 assert.equal(a.value('validLifeData(state.life)'),true);
 assert.deepEqual(a.value('migrateBackupState(state).life'),a.value('state.life'));
});

test('section order and names persist independently from finance and hidden records',()=>{
 const a=app();a.run("globalThis.before=cloneState(state);lifeData().ideas.push({id:'idea',title:'Полка'});state.settings.appSectionNames={ideas:'Мой уют'};state.settings.appSectionOrder=['diary','home','ideas'];state.settings.hiddenAppSections=['ideas','home'];");
 assert.equal(a.value('visibleSections()[0].id'),'diary');
 assert.equal(a.value("visibleSections().some(s=>s.id==='home')"),true);
 assert.equal(a.value("visibleSections().some(s=>s.id==='ideas')"),false);
 assert.equal(a.value("sectionName('ideas')"),'Мой уют');
 assert.equal(a.value('state.life.ideas.length'),1);
 assert.deepEqual(a.value('state.periods'),a.value('before.periods'));
 assert.deepEqual(a.value('state.account'),a.value('before.account'));
});

test('checkpoints preserve manual allocation through add, pay, edit, unpay and delete',()=>{
 const a=app();
 a.run("const p=currentPeriod(),c=categoryById('sport'),b=p.categoryBudgets.sport;b.plan=100;b.spent=12;const change=(r,n)=>changeCheckpoint(p,c,r,n);change(null,{id:'t',title:'Йога',amount:25,paid:false});");
 const amounts=()=>a.value('[b.plan,b.spent]');
 assert.deepEqual(amounts(),[100,12]);
 a.run('const r=b.checkpoints[0];change(r,{...r,paid:true});change(r,{...r,paid:true})');assert.deepEqual(amounts(),[100,37]);
 a.run('change(r,{...r,amount:30.5})');assert.deepEqual(amounts(),[100,42.5]);
 a.run('change(r,{...r,paid:false})');assert.deepEqual(amounts(),[100,12]);
 a.run('change(r,{...r,paid:true});change(r,null)');assert.deepEqual(amounts(),[100,12]);assert.equal(a.value('b.checkpoints.length'),0);
});


test('envelope deficit is visible without automatically funding the envelope',()=>{
 const a=app();
 a.run("const p=currentPeriod(),c=categoryById('sport');p.salary=1000;p.categoryBudgets.sport={plan:100,spent:0};changeCheckpoint(p,c,null,{id:'one',title:'Абонемент',amount:80,paid:false});changeCheckpoint(p,c,null,{id:'two',title:'Тренировка',amount:90,paid:false});");
 assert.deepEqual(a.value('envelopeSummary(p,c)'),{allocated:100,planned:170,spent:0,remaining:100});
 assert.equal(a.value('liveFreeBalance(state,p)'),900);
 a.run('const row=p.categoryBudgets.sport.checkpoints[0];changeCheckpoint(p,c,row,{...row,paid:true});');
 assert.deepEqual(a.value('envelopeSummary(p,c)'),{allocated:100,planned:170,spent:80,remaining:20});
 assert.equal(a.value('liveFreeBalance(state,p)'),900);
 a.run('changeCheckpoint(p,c,p.categoryBudgets.sport.checkpoints[1],null);');
 assert.deepEqual(a.value('envelopeSummary(p,c)'),{allocated:100,planned:80,spent:80,remaining:20});
 a.run('const before=cloneState(state);reconcileCheckpointBudgets();state=cloneState(state);reconcileCheckpointBudgets();');
 assert.equal(a.value('p.categoryBudgets.sport.plan'),100);
 assert.deepEqual(a.value('state.account'),a.value('before.account'));
});
test('food keeps weeks without checkpoints and weekly plans never fund its envelope',()=>{
 const a=app();
 a.run("const p=currentPeriod(),c=categoryById('food');p.salary=1000;p.foodAllocated=200;p.foodWeeks[0].plan=250;p.foodWeeks[0].closed=false;");
 assert.equal(a.run('checkpointList(p,c)'),'');
 assert.deepEqual(a.value('envelopeSummary(p,c)'),{allocated:200,planned:250,spent:0,remaining:200});
 assert.equal(a.value('liveFreeBalance(state,p)'),800);
 a.run('p.foodWeeks[0].spent=80;');
 assert.equal(a.value('envelopeSummary(p,c).remaining'),120);
 a.run('setEnvelopeAllocation(p,c,300);');
 assert.equal(a.value('p.foodWeeks[0].plan'),250);
 assert.equal(a.value('envelopeSummary(p,c).remaining'),220);
});
test('mandatory plans cannot silently increase manually allocated funds',()=>{
 const a=app();a.run("const p=currentPeriod();p.salary=1000;p.mandatory.housingPlan=100;reconcileCheckpointBudgets();p.mandatory.housingPlan=170;");
 assert.equal(a.value("mandatoryEnvelope(p,'housing',170,0).remaining"),100);
 assert.equal(a.value('liveFreeBalance(state,p)'),900);
});

test('standard pet envelope resets old mechanics once and preserves avatar and other categories',()=>{
 const a=app();a.run("state.pet.avatarImage='data:image/png;base64,avatar';state.pet.balanceByn=-50;state.pet.needs=[{id:'old',name:'Старый план',costByn:50,completed:false}];state.pet.transactions=[{id:'old',type:'spend',amountByn:50,date:'2026-10-10'}];currentPeriod().categoryBudgets.pet={plan:100,spent:50};currentPeriod().categoryBudgets.sport={plan:300,spent:20};const before=cloneState(currentPeriod().categoryBudgets.sport);normalizeState();");
 assert.equal(a.value('state.pet.avatarImage'),'data:image/png;base64,avatar');
 assert.equal(a.value('state.pet.balanceByn'),0);
 assert.equal(a.value('state.pet.needs.length'),0);
 assert.equal(a.value('state.pet.transactions.length'),0);
 assert.deepEqual(a.value('currentPeriod().categoryBudgets.sport'),a.value('before'));
 assert.equal(a.value("envelopeSummary(currentPeriod(),categoryById('pet')).remaining"),0);
 a.run("const p=currentPeriod(),c=categoryById('pet');setEnvelopeAllocation(p,c,100);changeCheckpoint(p,c,null,{id:'new',title:'Корм',amount:50,paid:true});normalizeState();");
 assert.equal(a.value('p.categoryBudgets.pet.plan'),100);
 assert.equal(a.value('p.categoryBudgets.pet.spent'),50);
 assert.equal(a.value("envelopeSummary(p,c).remaining"),50);
});

test('envelope allocations and pins survive backup restore without altering checkpoint records',()=>{
 const a=app();
 a.run("const p=currentPeriod();p.foodAllocated=250;p.envelopeAllocations={housing:300,payment:200,reserve:50};p.pinnedCategoryIds=['sport'];p.categoryBudgets.sport={plan:100,spent:80,checkpoints:[{id:'a',title:'Зал',amount:80,paid:true}]};const original=cloneState(state);state=migrateBackupState(cloneState(state));");
 assert.deepEqual(a.value('state.periods'),a.value('original.periods'));
 assert.deepEqual(a.value('state.account'),a.value('original.account'));
});

test('only housing and food have default pins',()=>{
 const a=app();a.run('monthCategoryIds(currentPeriod());');
 assert.deepEqual(a.value('currentPeriod().pinnedCategoryIds'),['food']);
 assert.match(a.run("renderMandatoryCard('Квартира',0,0,'housing')"),/aria-label="Закреплено"/);
 for(const kind of ['payment','reserve'])assert.doesNotMatch(a.run(`renderMandatoryCard('Категория',0,0,'${kind}')`),/aria-label="Закреплено"/);
 assert.match(a.run("renderCategorySummary(categoryById('food'),currentPeriod())"),/aria-label="Закреплено"/);
});

test('new users start without optional envelopes and can add payments from categories',async()=>{
 const a=app();
 assert.deepEqual(a.value('currentPeriod().mandatory.sections'),[]);
 a.run('monthCategoryPicker();');
 assert.equal(a.value("modal.fields.find(f=>f.name==='pinned-payment').value"),false);
 await a.run("modal.submit({'pinned-payment':true});");
 assert.deepEqual(a.value('currentPeriod().mandatory.sections'),['payment']);
});

test('expense picker category prefills expense and mandatory payment is recorded once',async()=>{
 const a=app();a.run("quickExpenseModal('sport');");
 assert.equal(a.value("modal.fields.find(f=>f.name==='category').value"),'sport');
 a.run("currentPeriod().salary=1000;mandatoryExpenseModal('housing');");
 await a.run('modal.submit({amount:25.50});');
 assert.equal(a.value('currentPeriod().mandatory.housingSpent'),25.50);
 assert.equal(a.value('accountBalanceAfterSpending(state,currentPeriod())'),974.50);
 a.run('deleteAccountOperation(state.account.transactions.at(-1).id);');
 assert.equal(a.value('currentPeriod().mandatory.housingSpent'),0);
 a.run("mandatoryExpenseModal('payment');");await a.run('modal.submit({amount:10});');
 assert.equal(a.value('periodPaymentsPaid(state,currentPeriod().key)'),10);
 a.run('deleteAccountOperation(state.account.transactions.at(-1).id);');
 assert.equal(a.value('periodPaymentsPaid(state,currentPeriod().key)'),0);
});

test('main balance and button depend only on manual envelope allocations',()=>{
 const a=app();a.run("const p=currentPeriod(),c=categoryById('sport');p.salary=1000;p.categoryBudgets.sport={plan:0,spent:0};");
 assert.equal(a.value('freeAfterPlans(p)'),1000);
 a.run("changeCheckpoint(p,c,null,{id:'a',title:'Зал',amount:600,paid:false});");
 assert.equal(a.value('freeAfterPlans(p)'),1000);
 assert.equal(a.value('moneyActionTone(p)'),'positive');
 a.run('const row=p.categoryBudgets.sport.checkpoints[0];changeCheckpoint(p,c,row,{...row,paid:true});');
 assert.equal(a.value('freeAfterPlans(p)'),1000);
 a.run('setEnvelopeAllocation(p,c,700);');
 assert.equal(a.value('freeAfterPlans(p)'),300);
 a.run('changeCheckpoint(p,c,row,{...row,amount:1200});');
 assert.equal(a.value('freeAfterPlans(p)'),300);
 assert.equal(a.value('envelopeSummary(p,c).remaining'),-500);
 a.run('changeCheckpoint(p,c,row,null);');
 assert.equal(a.value('p.categoryBudgets.sport.plan'),700);
 assert.equal(a.value('freeAfterPlans(p)'),300);
 a.run('setEnvelopeAllocation(p,c,1000);');
 assert.equal(a.value('moneyActionTone(p)'),'zero');
 a.run('setEnvelopeAllocation(p,c,1100);');
 assert.equal(a.value('moneyActionTone(p)'),'negative');
 a.run('setEnvelopeAllocation(p,c,500);');
 assert.equal(a.value('freeAfterPlans(p)'),500);
});

test('closed food weeks release unused plans while preserving actual spending',()=>{
 const a=app();a.run("const p=currentPeriod(),c=categoryById('food');p.salary=1000;p.foodAllocated=400;p.foodWeeks=[{plan:100,spent:120,closed:true},{plan:100,spent:50,closed:true},{plan:200,spent:0,closed:false}];");
 assert.equal(a.value('envelopeSummary(p,c).remaining'),230);
 assert.equal(a.value('envelopeSummary(p,c).spent'),170);
 assert.equal(a.value('p.foodWeeks[1].plan'),100);
 a.run('p.foodWeeks[2].spent=40;');
 assert.equal(a.value('envelopeSummary(p,c).remaining'),190);
 a.run('p.foodWeeks[2].spent=210;');
 assert.equal(a.value('envelopeSummary(p,c).remaining'),20);
 a.run('p.foodAllocated=350;');
 assert.equal(a.value('envelopeSummary(p,c).remaining'),-30);
});

test('deleting a checkpoint payment clears the checkbox and related edits exactly once',()=>{
 const a=app();a.run("const p=currentPeriod(),c=categoryById('sport');p.categoryBudgets.sport={plan:200,spent:15};changeCheckpoint(p,c,null,{id:'x',title:'Зал',amount:80,paid:false});const row=p.categoryBudgets.sport.checkpoints[0];changeCheckpoint(p,c,row,{...row,paid:true});changeCheckpoint(p,c,row,{...row,amount:90});const tx=state.account.transactions.at(-1).id;");
 assert.equal(a.value('p.categoryBudgets.sport.spent'),105);
 assert.equal(a.run('deleteAccountOperation(tx)'),true);
 assert.equal(a.value('row.paid'),false);
 assert.equal(a.value('p.categoryBudgets.sport.spent'),15);
 assert.equal(a.value('state.account.transactions.length'),0);
 assert.equal(a.run('deleteAccountOperation(tx)'),false);
 a.run('changeCheckpoint(p,c,row,{...row,paid:true});');
 assert.equal(a.value('p.categoryBudgets.sport.spent'),105);
});
test('legacy spending remains visible and unrelated expenses are not erased',()=>{
 const a=app();a.run("const p=currentPeriod(),c=categoryById('health');p.categoryBudgets.health={plan:400,spent:70};changeCheckpoint(p,c,null,{id:'x',title:'Аптека',amount:400,paid:true});");
 assert.equal(a.value('p.categoryBudgets.health.spent'),470);
 assert.equal(a.value('envelopeSummary(p,c).remaining'),-70);
 assert.doesNotMatch(a.run('renderCategoryCard(c,p)'),/Расходы вне списка/);
 a.run('changeCheckpoint(p,c,p.categoryBudgets.health.checkpoints[0],{...p.categoryBudgets.health.checkpoints[0],paid:false});');
 assert.equal(a.value('p.categoryBudgets.health.spent'),70);
});
test('deleting an old unlinked payment cannot leave paid checklist totals above spending',()=>{
 const a=app();a.run("const p=currentPeriod();p.categoryBudgets.health={plan:100,spent:100,checkpoints:[{id:'x',title:'Аптека',amount:100,paid:true}]};const tx=recordAccountDelta(-100,{categoryId:'health',periodKey:p.key,type:'expense'});const before=cloneState(state);");
 assert.equal(a.run('deleteAccountOperation(tx.id)'),false);
 assert.deepEqual(a.value('state'),a.value('before'));
});
test('spent savings and pet topups cannot be deleted into a negative balance',async()=>{
 const a=app();a.run("currentPeriod().salary=1000;savingsModal('deposit');");
 await a.run("modal.submit({currency:'usd',amount:100,accountByn:300,date:'2026-10-10',note:''});");
 a.run("const deposit=state.savings[0];state.savings.push({id:'spent',type:'withdraw',currency:'usd',amountUsd:80,amountByn:0,date:'2026-10-11',periodKey:'2026-10'});const before=cloneState(state);");
 assert.equal(a.run('deleteSavingsOperation(deposit.id)'),false);
 assert.deepEqual(a.value('state'),a.value('before'));
 assert.equal(a.run('deleteAccountOperation(deposit.accountTransactionId)'),false);
 assert.deepEqual(a.value('state'),a.value('before'));
 a.run("petTransactionModal('topup');");await a.run("modal.submit({amount:50,date:'2026-10-10',note:''});");
 a.run("state.pet.balanceByn=10;const petTx=state.pet.transactions[0];const petBefore=cloneState(state);");
 assert.equal(a.run('deleteAccountOperation(petTx.accountTransactionId)'),false);
 assert.deepEqual(a.value('state'),a.value('petBefore'));
});
test('malformed checkpoint amounts and duplicate ids are rejected on restore',()=>{
 for(const rows of ["[{id:'x',title:'Трата',amount:'NaN',paid:false}]","[{id:'x',title:'Трата',amount:5,paid:true},{id:'x',title:'Дубль',amount:5,paid:true}]"]){
  const a=app();a.run(`currentPeriod().categoryBudgets.sport.checkpoints=${rows};`);
  assert.throws(()=>a.run('migrateBackupState(state)'));
 }
});

test('the money button and balance editor use the same spendable total as the receipt',async()=>{
 const a=app();a.run("const p=currentPeriod();p.salary=1000;p.selectedCategoryIds=['sport'];p.categoryBudgets.sport={plan:100,spent:0,checkpoints:[{id:'x',title:'Зал',amount:200,paid:false}]};openBalanceEditor();");
 assert.equal(a.value("modal.fields.find(f=>f.name==='balance').value"),900);
 assert.equal(a.value('moneyActionTone(p)'),'positive');
 await a.run("modal.submit({balance:0,cash:0,note:''});");
 assert.equal(a.value('freeAfterPlans(p)'),0);
 assert.equal(a.value('moneyActionTone(p)'),'zero');
 assert.equal(a.value('p.categoryBudgets.sport.plan'),100);
 assert.equal(a.value('p.categoryBudgets.sport.checkpoints[0].amount'),200);
});

test('deleting an old expense from history preserves later paid checklist rows',()=>{
 const a=app();a.run("const p=currentPeriod(),c=categoryById('health');p.categoryBudgets.health={plan:1000,spent:150};const old=recordAccountDelta(-150,{categoryId:'health',periodKey:p.key,type:'expense'});changeCheckpoint(p,c,null,{id:'one',title:'Оплата',amount:300,paid:true});");
 assert.equal(a.run('deleteAccountOperation(old.id)'),true);
 assert.equal(a.value('p.categoryBudgets.health.spent'),300);
 assert.equal(a.value('p.categoryBudgets.health.checkpoints[0].paid'),true);
 assert.equal(a.value('p.categoryBudgets.health.plan'),1000);
});

test('food weekly plans and expenses cannot change the main manual allocation',()=>{
 const a=app();a.run("const p=currentPeriod(),c=categoryById('food');p.salary=1000;p.foodAllocated=0;p.foodWeeks[0].plan=300;p.foodWeeks[0].spent=100;");
 assert.equal(a.value('freeAfterPlans(p)'),1000);
 a.run('setEnvelopeAllocation(p,c,200);');
 assert.equal(a.value('freeAfterPlans(p)'),800);
 a.run('p.foodWeeks[0].spent=450;p.foodWeeks[0].plan=500;');
 assert.equal(a.value('freeAfterPlans(p)'),800);
});

test('reset clears standard pet budget and checklist and permits new plans',async()=>{
 const a=app();a.run("globalThis.confirm=()=>true;globalThis.document={querySelector:()=>null};normalizeState();const p=currentPeriod(),c=categoryById('pet');setEnvelopeAllocation(p,c,100);changeCheckpoint(p,c,null,{id:'old',title:'Корм',amount:50,paid:true});state.pet.avatarImage='data:image/png;base64,avatar';");
 await a.run('resetSelectedMonth();');
 assert.deepEqual(a.value('envelopeSummary(currentPeriod(),c)'),{allocated:0,planned:0,spent:0,remaining:0});
 assert.equal(a.value('state.pet.avatarImage'),'data:image/png;base64,avatar');
 a.run("changeCheckpoint(currentPeriod(),c,null,{id:'new',title:'Новая трата',amount:25,paid:false});");
 assert.equal(a.value('envelopeSummary(currentPeriod(),c).planned'),25);
 assert.equal(a.value('currentPeriod().categoryBudgets.pet.plan'),0);
});

test('envelope remainder is allocation minus actual spending, independent of unpaid plans',()=>{
 const a=app();a.run("const p=currentPeriod(),c=categoryById('sport');p.salary=1000;p.categoryBudgets.sport={plan:268,spent:90,checkpoints:[{id:'a',title:'Занятия',amount:90,paid:true},{id:'b',title:'Занятия',amount:90,paid:false},{id:'c',title:'Абонемент',amount:88,paid:false}]};");
 assert.equal(a.value('envelopeSummary(p,c).remaining'),178);
 assert.equal(a.value('freeAfterPlans(p)'),732);
 a.run('changeCheckpoint(p,c,p.categoryBudgets.sport.checkpoints[2],null);');
 assert.equal(a.value('envelopeSummary(p,c).remaining'),178);
 a.run('const row=p.categoryBudgets.sport.checkpoints[1];changeCheckpoint(p,c,row,{...row,paid:true});');
 assert.equal(a.value('envelopeSummary(p,c).remaining'),88);
 assert.equal(a.value('freeAfterPlans(p)'),732);
 a.run('changeCheckpoint(p,c,row,{...row,paid:false});');
 assert.equal(a.value('envelopeSummary(p,c).remaining'),178);
 assert.doesNotMatch(a.run('renderCategoryCard(c,p)'),/<span>План<\/span>/);
});

test('payment envelope shows manual funding separately from the schedule',()=>{
 const a=app();a.run("const p=currentPeriod();p.salary=2000;p.mandatory.sections=['payment'];p.envelopeAllocations={payment:700,housing:0,reserve:0};state.payments=[{id:'pay',periodKey:p.key,planned:1500,paid:50}];");
 assert.match(a.run('renderPaymentEnvelopeCard(p)'),/value="700"/);
 assert.match(a.run('renderPaymentEnvelopeCard(p)'),/650 BYN/);
 assert.equal(a.value('freeAfterPlans(p)'),1300);
 a.run('p.envelopeAllocations.payment=800;');
 assert.match(a.run('renderPaymentEnvelopeCard(p)'),/value="800"/);
 assert.equal(a.value('freeAfterPlans(p)'),1200);
 assert.equal(a.value('state.payments[0].planned'),1500);
});
