'use strict';
/**
 * Project 3 — end-to-end validation scenario.
 * Covers: auth, RBAC, plans, accounts, usage ingestion, the simulated billing run
 * (with overage + idempotency), analytics (MRR, churn, usage) and audit.
 * Run:  DB_FILE=memory node project-3-subscription-analytics/test/run.js
 */
process.env.DB_FILE = 'memory';
const { buildApp } = require('../../shared/lib/app');
const project = require('../server/project');
const { startApp, client, makeReporter } = require('../../shared/lib/testkit');

(async () => {
  const { app } = buildApp(project);
  const server = await startApp(app);
  const base = `http://127.0.0.1:${server.address().port}`;
  const r = makeReporter('Project 3 — Subscription Analytics SaaS MVP');

  const admin = client(base), analyst = client(base), customer = client(base);

  let res = await admin.post('/api/auth/login', { email: 'admin@arrowstack.in', password: 'Admin@123' });
  admin.setToken(res.body.token);
  r.check('admin login', res.status === 200 && res.body.user.role === 'admin');

  res = await analyst.post('/api/auth/login', { email: 'analyst@arrowstack.in', password: 'Analyst@123' });
  analyst.setToken(res.body.token);
  r.check('analyst login', res.status === 200 && res.body.user.role === 'analyst');

  res = await customer.post('/api/auth/login', { email: 'customer@arrowstack.in', password: 'Customer@123' });
  customer.setToken(res.body.token);
  r.check('customer login has account_id', res.status === 200 && !!res.body.user.account_id);

  // plans
  res = await customer.get('/api/plans');
  r.check('plans listed', res.status === 200 && res.body.length === 3);

  res = await customer.post('/api/plans', { name: 'Hacker', price_monthly: 1, included_units: 1, overage_rate: 0 });
  r.check('customer cannot create plan (403)', res.status === 403);

  res = await admin.post('/api/plans', { name: 'Enterprise', price_monthly: 49999, included_units: 5000000, overage_rate: 0.01 });
  r.check('admin creates plan (201)', res.status === 201);
  const entPlan = res.body;

  // accounts
  res = await analyst.get('/api/accounts');
  r.check('analyst lists accounts', res.status === 200 && res.body.length === 4);

  res = await admin.post('/api/accounts', { name: 'Echo Robotics', plan_id: entPlan.id });
  r.check('admin creates account (201)', res.status === 201 && res.body.plan_name === 'Enterprise');

  // customer isolation
  res = await analyst.get('/api/accounts');
  const acme = res.body.find((a) => a.name === 'Acme Retail');
  res = await customer.get(`/api/accounts/${acme.id}`);
  r.check('customer reads own account', res.status === 200 && res.body.name === 'Acme Retail');
  const otherAcct = res.body; // Acme

  const other = client(base);
  res = await other.post('/api/auth/register', { name: 'Zed', email: 'zed@example.com', password: 'Zed@12345', account_name: 'Zed Labs' });
  r.check('self-service signup creates account', res.status === 201 && !!res.body.account_id);
  other.setToken((await other.post('/api/auth/login', { email: 'zed@example.com', password: 'Zed@12345' })).body.token);
  res = await other.get(`/api/accounts/${acme.id}`);
  r.check('customer cannot read other account (403)', res.status === 403);

  // usage
  res = await customer.post('/api/usage', { metric: 'api_calls', quantity: 5000 });
  r.check('customer records own usage (201)', res.status === 201);
  res = await customer.post('/api/usage', { account_id: acme.id, metric: 'storage_gb', quantity: 250 });
  r.check('customer records second usage metric', res.status === 201);
  res = await customer.post('/api/usage', { metric: 'bananas', quantity: 5 });
  r.check('invalid metric rejected (400)', res.status === 400);

  // billing run
  res = await admin.post('/api/billing/run', {});
  r.check('billing run creates invoices', res.status === 201 && res.body.invoicesCreated >= 4, JSON.stringify(res.body));
  const period = res.body.period;
  const acmeInvoice = res.body.invoices.find((i) => i.account === 'Acme Retail');
  r.check('invoice amount positive', acmeInvoice && acmeInvoice.amount > 0);

  // idempotency
  res = await admin.post('/api/billing/run', { period });
  r.check('re-running same period is idempotent', res.status === 201 && res.body.invoicesCreated === 0, JSON.stringify(res.body));

  res = await customer.post('/api/billing/run', {});
  r.check('customer cannot run billing (403)', res.status === 403);

  // analytics
  res = await analyst.get('/api/analytics/overview');
  r.check('analytics overview has MRR', res.status === 200 && res.body.mrr > 0, JSON.stringify(res.body));
  r.check('MRR reflects active accounts only', res.body.active >= 4 && res.body.cancelled === 1);
  r.check('ARR = MRR x 12', res.body.arr === Math.round(res.body.mrr * 12 * 100) / 100);
  r.check('churn rate computed', res.body.churnRate > 0);

  res = await analyst.get('/api/analytics/usage');
  r.check('usage analytics by metric', res.status === 200 && Object.keys(res.body.byMetric).length === 3, JSON.stringify(res.body.byMetric));
  r.check('usage analytics by period', Object.keys(res.body.byPeriod).length >= 2);

  res = await analyst.get('/api/analytics/top-accounts');
  r.check('top accounts ranked', res.status === 200 && res.body.length > 0 && res.body[0].units >= res.body[res.body.length - 1].units);

  res = await customer.get('/api/analytics/overview');
  r.check('customer blocked from analytics (403)', res.status === 403);

  res = await analyst.get('/api/audit');
  r.check('analyst blocked from audit (403)', res.status === 403);
  res = await admin.get('/api/audit');
  r.check('admin sees audit trail', res.status === 200 && res.body.length >= 8, `rows=${res.body.length}`);

  server.close();
  process.exit(r.finish());
})().catch((e) => { console.error(e); process.exit(1); });
