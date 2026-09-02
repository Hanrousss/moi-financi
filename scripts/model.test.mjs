import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seedState, ensurePeriod, parseMoney, roundMoney, periodIncome,
  accountBalanceAfterSpending, addAccountTransaction, deleteAccountTransaction,
  accountTransactionPeriodKey, migrateMonthlyBalances, plannedFreeBalance, liveFreeBalance,
  remainingPlannedOutflows, periodSpentTotal, distributeFoodPlan, foodBudget,
  savingsBalanceByn, savingsBalanceUsd, petBalanceByn, monthlySavingsRows
} from '../model.js';

const fresh = () => seedState(new Date(2026, 8, 15));
const balance = (state, key) => accountBalanceAfterSpending(state, ensurePeriod(state, key));

test('money accepts whole amounts and one or two decimals with either separator', () => {
  for (const [input, expected] of [['37',37],['37,5',37.5],['37,56',37.56],['37.56',37.56],['1250,99',1250.99],['0,01',0.01],['-37,56',-37.56],[' 37,56 ',37.56],['',0]]) {
    assert.equal(parseMoney(input), expected, input);
  }
  for (const input of ['37,567','37.567','1,2.3','1e3','Infinity','abc','37 BYN','--1','9007199254740991']) {
    assert.ok(Number.isNaN(parseMoney(input)), input);
  }
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney(10.075), 10.08);
  assert.equal(roundMoney(-10.075), -10.08);
  assert.equal(roundMoney(-0.0001), 0);
});

test('every month uses its own income and spending, regardless of the shared account', () => {
  const state = fresh(), september = ensurePeriod(state,'2026-09'), october = ensurePeriod(state,'2026-10');
  state.account.balanceByn = 9876.54;
  september.salary = 2200;
  september.categoryBudgets.everyday.spent = 1000;
  october.salary = 3000;
  october.categoryBudgets.everyday.spent = 1200;
  assert.equal(balance(state,'2026-09'), 1200);
  assert.equal(balance(state,'2026-10'), 1800);
  assert.equal(balance(state,'2026-11'), 0);
  assert.equal(balance(state,'2025-12'), 0);
  october.extraIncome = 1250.99;
  october.categoryBudgets.everyday.spent = 1237.56;
  assert.equal(periodIncome(october), 4250.99);
  assert.equal(balance(state,'2026-10'), 3013.43);
  assert.equal(balance(state,'2026-09'), 1200);
  assert.equal(balance(JSON.parse(JSON.stringify(state)),'2026-10'), 3013.43);
});

test('future plans immediately affect the balance and spending is counted only once', () => {
  const state = fresh(), period = ensurePeriod(state,'2026-10');
  period.salary = 3000;
  period.categoryBudgets.everyday.plan = 1200;
  addAccountTransaction(state,{deltaByn:3000,type:'income',periodKey:period.key,linkedId:`income:${period.key}`});
  assert.equal(plannedFreeBalance(state,period),1800);
  period.categoryBudgets.everyday.spent = 37.56;
  const expense = addAccountTransaction(state,{deltaByn:-37.56,type:'expense',periodKey:period.key,categoryId:'everyday'});
  assert.equal(balance(state,period.key),2962.44);
  assert.equal(remainingPlannedOutflows(state,period),1162.44);
  assert.equal(liveFreeBalance(state,period),1800);
  period.categoryBudgets.everyday.spent = 1200.01;
  assert.equal(liveFreeBalance(state,period),1799.99);
  // Deletion restores the budget as well as the corresponding ledger entry.
  period.categoryBudgets.everyday.spent = 0;
  deleteAccountTransaction(state,expense.id);
  assert.equal(liveFreeBalance(state,period),1800);
});

test('all scheduled payments and mandatory plans belong to the selected month', () => {
  const state = fresh(), period = ensurePeriod(state,'2027-01');
  period.salary = 3000.99;
  period.mandatory.housingPlan = 1200.50;
  period.mandatory.housingSpent = 200.25;
  period.mandatory.reservePlan = 10.01;
  period.mandatory.reserveAllocated = 0.01;
  state.payments.push({id:'one',periodKey:period.key,planned:100.10,paid:37.56},{id:'two',periodKey:period.key,planned:200.20,paid:200.21},{id:'elsewhere',periodKey:'2026-12',planned:9999,paid:8888});
  assert.equal(periodSpentTotal(state,period),438.03);
  assert.equal(remainingPlannedOutflows(state,period),1072.79);
  assert.equal(liveFreeBalance(state,period),1490.17);
  assert.equal(balance(state,'2026-09'),0);
});

test('envelope transfers, returns and corrections affect only their own month', () => {
  const state = fresh(), period = ensurePeriod(state,'2026-10');
  period.salary = 1000;
  state.savings.push({id:'deposit',type:'deposit',currency:'usd',amountUsd:10.25,accountAmountByn:30.75,date:'2026-10-06'});
  addAccountTransaction(state,{deltaByn:-30.75,type:'transfer_out',periodKey:period.key,linkedId:'savings:deposit'});
  period.categoryBudgets.pet.spent = 37.56;
  addAccountTransaction(state,{deltaByn:-37.56,type:'transfer_out',periodKey:period.key,categoryId:'pet'});
  addAccountTransaction(state,{deltaByn:-20.50,type:'transfer_out',periodKey:period.key,linkedId:'safety:one'});
  addAccountTransaction(state,{deltaByn:5.25,type:'transfer_in',periodKey:period.key,linkedId:'savings:return'});
  const correction = addAccountTransaction(state,{deltaByn:-0.01,type:'adjustment',periodKey:period.key});
  assert.equal(balance(state,period.key),916.43);
  assert.equal(balance(state,'2026-09'),0);
  deleteAccountTransaction(state,correction.id);
  assert.equal(balance(state,period.key),916.44);
});

test('explicit month takes precedence over entry date, with salary day fallback', () => {
  const state = fresh();
  assert.equal(accountTransactionPeriodKey(state,{date:'2026-09-02',periodKey:'2026-10'}),'2026-10');
  assert.equal(accountTransactionPeriodKey(state,{date:'2026-10-04'}),'2026-09');
  assert.equal(accountTransactionPeriodKey(state,{date:'2026-10-05'}),'2026-10');
  addAccountTransaction(state,{deltaByn:37.56,date:'2026-10-04'});
  addAccountTransaction(state,{deltaByn:0.01,date:'2026-10-05'});
  assert.equal(balance(state,'2026-09'),37.56);
  assert.equal(balance(state,'2026-10'),0.01);
});

test('food allocation preserves every kopeck, including very small plans', () => {
  for (const key of ['2026-02','2026-05','2026-10']) {
    for (const amount of [0.01,0.02,0.03,0.04,0.05,37.56,1250.99]) {
      const period = ensurePeriod(fresh(),key);
      distributeFoodPlan(period,amount);
      assert.equal(foodBudget(period).plan,amount);
      assert.ok(period.foodWeeks.every(week=>week.plan>=0));
    }
  }
});

test('legacy opening balances stay in their original period and migrate only once', () => {
  const state = fresh(), september = ensurePeriod(state,'2026-09'), october = ensurePeriod(state,'2026-10');
  delete state.account.monthlyBalancesVersion;
  // An old account started at 800.25 without any ledger entries.
  state.account.balanceByn = 800.25;
  september.salary = 1000;
  september.categoryBudgets.everyday.spent = 100;
  october.salary = 3000;
  october.categoryBudgets.everyday.spent = 1200;
  addAccountTransaction(state,{deltaByn:3000,type:'income',periodKey:october.key,linkedId:`income:${october.key}`});
  addAccountTransaction(state,{deltaByn:-1200,type:'expense',periodKey:october.key,categoryId:'everyday'});
  assert.equal(migrateMonthlyBalances(state),true);
  assert.equal(balance(state,september.key),800.25);
  assert.equal(balance(state,october.key),1800);
  assert.equal(balance(state,'2026-11'),0);
  assert.equal(migrateMonthlyBalances(state),false);
  assert.equal(balance(JSON.parse(JSON.stringify(state)),september.key),800.25);
});

test('fractional savings, pets and monthly totals retain cents', () => {
  const state = fresh();
  state.savings.push(
    {type:'deposit',currency:'byn',amountByn:0.1,date:'2026-10-05'},
    {type:'deposit',currency:'byn',amountByn:0.2,date:'2026-10-06'},
    {type:'withdraw',currency:'byn',amountByn:0.01,date:'2026-10-07'},
    {type:'deposit',currency:'usd',amountUsd:37.56,date:'2026-10-05'},
    {type:'withdraw',currency:'usd',amountUsd:0.01,date:'2026-10-07'}
  );
  assert.equal(savingsBalanceByn(state),0.29);
  assert.equal(savingsBalanceUsd(state),37.55);
  assert.equal(monthlySavingsRows(state)[0].depositedByn,0.3);
  delete state.pet.balanceByn;
  state.pet.transactions.push({type:'topup',amountByn:37.56},{type:'spend',amountByn:0.01});
  assert.equal(petBalanceByn(state),37.55);
});
