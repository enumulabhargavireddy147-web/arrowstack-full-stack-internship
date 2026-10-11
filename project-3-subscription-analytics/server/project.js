'use strict';
/**
 * Project 3 — Subscription Analytics SaaS MVP (backend, capstone).
 * Scenario: a SaaS application managing plans, customer accounts, usage records,
 * billing events (simulated, Stripe-like) and business analytics.
 *
 * Roles: admin (platform owner), analyst (read-only analytics), customer (own account).
 */
const { nowIso, newId } = require('../../shared/lib/db');
const { hashPassword, verifyPassword, signToken, authenticate, requireRole } = require('../../shared/lib/auth');
const { record } = require('../../shared/lib/audit');
const { validate } = require('../../shared/lib/validate');
const { wrap, HttpError } = require('../../shared/lib/http');

const round2 = (n) => Math.round(n * 100) / 100;
const periodOf = (iso) => iso.slice(0, 7); // YYYY-MM

const migrations = [
  { id: '001_users', up(db) { db.exec(`CREATE TABLE IF NOT EXISTS users (
      id STRING PRIMARY KEY, name STRING, email STRING, password_hash STRING,
      role STRING, account_id STRING, created_at STRING)`); } },
  { id: '002_plans', up(db) { db.exec(`CREATE TABLE IF NOT EXISTS plans (
      id STRING PRIMARY KEY, name STRING, price_monthly NUMBER, included_units NUMBER,
      overage_rate NUMBER, active BOOLEAN)`); } },
  { id: '003_accounts', up(db) { db.exec(`CREATE TABLE IF NOT EXISTS accounts (
      id STRING PRIMARY KEY, name STRING, plan_id STRING, status STRING, started_at STRING, cancelled_at STRING)`); } },
  { id: '004_usage', up(db) { db.exec(`CREATE TABLE IF NOT EXISTS usage_records (
      id STRING PRIMARY KEY, account_id STRING, metric STRING, quantity NUMBER, recorded_at STRING)`); } },
  { id: '005_billing', up(db) { db.exec(`CREATE TABLE IF NOT EXISTS billing_events (
      id STRING PRIMARY KEY, account_id STRING, event_type STRING, amount NUMBER,
      description STRING, period STRING, created_at STRING)`); } },
];

function seed(store) {
  const c = store.one('SELECT COUNT(*) AS c FROM users');
  if (c && c.c > 0) return;
  const bcrypt = require('bcryptjs');
  const mkUser = (name, email, role, pw, accountId) => store.query(
    'INSERT INTO users VALUES (?,?,?,?,?,?,?)',
    [newId(), name, email, bcrypt.hashSync(pw, 10), role, accountId || null, nowIso()]);

  const plans = [
    ['Starter', 1999, 10000, 0.05],
    ['Growth', 7999, 100000, 0.03],
    ['Scale', 24999, 1000000, 0.015],
  ];
  const planIds = {};
  for (const [name, price, incl, over] of plans) {
    const id = newId(); planIds[name] = id;
    store.query('INSERT INTO plans VALUES (?,?,?,?,?,?)', [id, name, price, incl, over, true]);
  }

  const accts = [
    ['Acme Retail', 'Growth', 'active'],
    ['BlueOrbit Logistics', 'Scale', 'active'],
    ['Citrus Media', 'Starter', 'active'],
    ['Delta Fintech', 'Growth', 'cancelled'],
  ];
  const acctIds = [];
  for (const [name, plan, status] of accts) {
    const id = newId(); acctIds.push(id);
    store.query('INSERT INTO accounts VALUES (?,?,?,?,?,?)',
      [id, name, planIds[plan], status, nowIso(), status === 'cancelled' ? nowIso() : null]);
  }

  // ~60 days of usage so analytics has signal.
  const metrics = ['api_calls', 'storage_gb', 'seats'];
  const now = Date.now();
  for (let d = 0; d < 60; d++) {
    for (let a = 0; a < acctIds.length; a++) {
      const qty = Math.round((50 + Math.random() * 400) * (a + 1));
      store.query('INSERT INTO usage_records VALUES (?,?,?,?,?)',
        [newId(), acctIds[a], metrics[d % metrics.length], qty, new Date(now - d * 86400000).toISOString()]);
    }
  }

  mkUser('Platform Admin', 'admin@arrowstack.in', 'admin', 'Admin@123');
  mkUser('Data Analyst', 'analyst@arrowstack.in', 'analyst', 'Analyst@123');
  mkUser('Acme Owner', 'customer@arrowstack.in', 'customer', 'Customer@123', acctIds[0]);
  store.commit();
}

function registerRoutes(api, store) {
  const auth = authenticate;
  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, account_id: u.account_id });

  function usageInPeriod(accountId, period) {
    return store.query('SELECT metric, quantity, recorded_at FROM usage_records WHERE account_id = ?', [accountId])
      .filter((u) => periodOf(u.recorded_at) === period);
  }

  // ---- auth ----------------------------------------------------------------
  api.post('/auth/register', wrap(async (req, res) => {
    const body = validate(req.body, {
      name: { required: true, minLen: 2 }, email: { required: true, email: true },
      password: { required: true, minLen: 8 },
      account_name: { maxLen: 120 },
      plan_id: {},
    });
    if (store.one('SELECT id FROM users WHERE email = ?', [body.email])) throw new HttpError(409, 'Email already registered');
    const userId = newId();
    let accountId = null;
    if (body.account_name) {
      const plan = body.plan_id ? store.one('SELECT * FROM plans WHERE id = ?', [body.plan_id]) : store.one("SELECT * FROM plans WHERE active = TRUE ORDER BY price_monthly LIMIT 1");
      if (!plan) throw new HttpError(400, 'No plan available');
      accountId = newId();
      store.query('INSERT INTO accounts VALUES (?,?,?,?,?,?)', [accountId, body.account_name, plan.id, 'active', nowIso(), null]);
    }
    store.query('INSERT INTO users VALUES (?,?,?,?,?,?,?)',
      [userId, body.name, body.email, await hashPassword(body.password), 'customer', accountId, nowIso()]);
    record(store, { actorId: userId, actorRole: 'customer', action: 'user.register', entity: 'user', entityId: userId, detail: { accountId } });
    store.commit();
    res.status(201).json({ id: userId, email: body.email, account_id: accountId });
  }));

  api.post('/auth/login', wrap(async (req, res) => {
    const body = validate(req.body, { email: { required: true, email: true }, password: { required: true } });
    const user = store.one('SELECT * FROM users WHERE email = ?', [body.email]);
    if (!user || !(await verifyPassword(body.password, user.password_hash))) throw new HttpError(401, 'Invalid credentials');
    record(store, { actorId: user.id, actorRole: user.role, action: 'user.login', entity: 'user', entityId: user.id });
    store.commit();
    res.json({ token: signToken(user), user: publicUser(user) });
  }));

  api.get('/auth/me', auth, wrap(async (req, res) => {
    const u = store.one('SELECT * FROM users WHERE id = ?', [req.user.sub]);
    if (!u) throw new HttpError(404, 'User not found');
    res.json(publicUser(u));
  }));

  // ---- plans ---------------------------------------------------------------
  api.get('/plans', auth, wrap(async (req, res) => res.json(store.query('SELECT * FROM plans ORDER BY price_monthly'))));

  api.post('/plans', auth, requireRole('admin'), wrap(async (req, res) => {
    const body = validate(req.body, {
      name: { required: true, minLen: 2, maxLen: 80 },
      price_monthly: { required: true, type: 'number', positive: true },
      included_units: { required: true, integer: true, min: 0 },
      overage_rate: { required: true, type: 'number', min: 0 },
    });
    const id = newId();
    store.query('INSERT INTO plans VALUES (?,?,?,?,?,?)', [id, body.name, body.price_monthly, body.included_units, body.overage_rate, true]);
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'plan.create', entity: 'plan', entityId: id, detail: body });
    store.commit();
    res.status(201).json(store.one('SELECT * FROM plans WHERE id = ?', [id]));
  }));

  // ---- accounts ------------------------------------------------------------
  function accountView(a) {
    const plan = store.one('SELECT * FROM plans WHERE id = ?', [a.plan_id]);
    return { ...a, plan_name: plan ? plan.name : null, price_monthly: plan ? plan.price_monthly : 0 };
  }

  api.get('/accounts', auth, requireRole('admin', 'analyst'), wrap(async (req, res) => {
    res.json(store.query('SELECT * FROM accounts ORDER BY started_at DESC').map(accountView));
  }));

  api.get('/accounts/:id', auth, wrap(async (req, res) => {
    const a = store.one('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
    if (!a) throw new HttpError(404, 'Account not found');
    if (req.user.role === 'customer' && a.id !== req.user.account_id) throw new HttpError(403, 'Not your account');
    const usage = store.query('SELECT * FROM usage_records WHERE account_id = ? ORDER BY recorded_at DESC LIMIT 50', [a.id]);
    const invoices = store.query('SELECT * FROM billing_events WHERE account_id = ? ORDER BY created_at DESC', [a.id]);
    res.json({ ...accountView(a), usage, invoices });
  }));

  api.post('/accounts', auth, requireRole('admin'), wrap(async (req, res) => {
    const body = validate(req.body, { name: { required: true, minLen: 2, maxLen: 120 }, plan_id: { required: true } });
    const plan = store.one('SELECT * FROM plans WHERE id = ?', [body.plan_id]);
    if (!plan) throw new HttpError(400, 'Unknown plan');
    const id = newId();
    store.query('INSERT INTO accounts VALUES (?,?,?,?,?,?)', [id, body.name, plan.id, 'active', nowIso(), null]);
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'account.create', entity: 'account', entityId: id, detail: body });
    store.commit();
    res.status(201).json(accountView(store.one('SELECT * FROM accounts WHERE id = ?', [id])));
  }));

  api.patch('/accounts/:id', auth, requireRole('admin'), wrap(async (req, res) => {
    const a = store.one('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
    if (!a) throw new HttpError(404, 'Account not found');
    const body = validate(req.body, { status: { enum: ['active', 'cancelled'] }, plan_id: {} });
    const merged = { ...a, ...body };
    merged.cancelled_at = merged.status === 'cancelled' ? (a.cancelled_at || nowIso()) : null;
    store.query('UPDATE accounts SET status=?, plan_id=?, cancelled_at=? WHERE id=?', [merged.status, merged.plan_id, merged.cancelled_at, a.id]);
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'account.update', entity: 'account', entityId: a.id, detail: body });
    store.commit();
    res.json(accountView(store.one('SELECT * FROM accounts WHERE id = ?', [a.id])));
  }));

  // ---- usage ---------------------------------------------------------------
  api.post('/usage', auth, wrap(async (req, res) => {
    const body = validate(req.body, {
      account_id: {}, metric: { required: true, enum: ['api_calls', 'storage_gb', 'seats'] },
      quantity: { required: true, type: 'number', positive: true },
    });
    const accountId = req.user.role === 'customer' ? req.user.account_id : body.account_id;
    if (!accountId) throw new HttpError(400, 'account_id is required');
    if (req.user.role === 'customer' && body.account_id && body.account_id !== req.user.account_id) throw new HttpError(403, 'Not your account');
    const id = newId();
    store.query('INSERT INTO usage_records VALUES (?,?,?,?,?)', [id, accountId, body.metric, body.quantity, nowIso()]);
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'usage.record', entity: 'account', entityId: accountId, detail: body });
    store.commit();
    res.status(201).json(store.one('SELECT * FROM usage_records WHERE id = ?', [id]));
  }));

  // ---- billing (simulated Stripe-like run) ---------------------------------
  api.post('/billing/run', auth, requireRole('admin'), wrap(async (req, res) => {
    const period = (req.body && req.body.period) || periodOf(nowIso());
    if (!/^\d{4}-\d{2}$/.test(period)) throw new HttpError(400, 'period must be YYYY-MM');
    const accounts = store.query("SELECT * FROM accounts WHERE status = 'active'");
    const created = [];
    for (const a of accounts) {
      const existing = store.one('SELECT id FROM billing_events WHERE account_id = ? AND period = ? AND event_type = ?', [a.id, period, 'charge']);
      if (existing) continue; // idempotent
      const plan = store.one('SELECT * FROM plans WHERE id = ?', [a.plan_id]);
      const units = usageInPeriod(a.id, period).reduce((s, u) => s + u.quantity, 0);
      const overageUnits = Math.max(0, units - plan.included_units);
      const overageAmount = round2(overageUnits * plan.overage_rate);
      const amount = round2(plan.price_monthly + overageAmount);
      const id = newId();
      store.query('INSERT INTO billing_events VALUES (?,?,?,?,?,?,?)',
        [id, a.id, 'charge', amount, `${plan.name}: base + ${overageUnits} overage units`, period, nowIso()]);
      created.push({ account_id: a.id, account: a.name, amount, period });
    }
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'billing.run', entity: 'period', entityId: period, detail: { invoices: created.length } });
    store.commit();
    res.status(201).json({ period, invoicesCreated: created.length, invoices: created });
  }));

  api.get('/billing/events', auth, requireRole('admin', 'analyst'), wrap(async (req, res) => {
    res.json(store.query('SELECT * FROM billing_events ORDER BY created_at DESC LIMIT 200'));
  }));

  // ---- analytics -----------------------------------------------------------
  api.get('/analytics/overview', auth, requireRole('admin', 'analyst'), wrap(async (req, res) => {
    const accounts = store.query('SELECT * FROM accounts');
    const active = accounts.filter((a) => a.status === 'active');
    const cancelled = accounts.filter((a) => a.status === 'cancelled');
    const mrr = round2(active.reduce((s, a) => s + (store.one('SELECT price_monthly FROM plans WHERE id = ?', [a.plan_id])?.price_monthly || 0), 0));
    const events = store.query('SELECT * FROM billing_events');
    const collected = round2(events.filter((e) => e.event_type === 'charge').reduce((s, e) => s + e.amount, 0));
    const churnRate = accounts.length ? round2((cancelled.length / accounts.length) * 100) : 0;
    const arpa = active.length ? round2(mrr / active.length) : 0;
    res.json({ accounts: accounts.length, active: active.length, cancelled: cancelled.length, mrr, arr: round2(mrr * 12), arpa, collected, churnRate });
  }));

  api.get('/analytics/usage', auth, requireRole('admin', 'analyst'), wrap(async (req, res) => {
    const records = store.query('SELECT * FROM usage_records');
    const byMetric = {};
    const byPeriod = {};
    for (const u of records) {
      byMetric[u.metric] = (byMetric[u.metric] || 0) + u.quantity;
      const p = periodOf(u.recorded_at);
      byPeriod[p] = byPeriod[p] || {};
      byPeriod[p][u.metric] = (byPeriod[p][u.metric] || 0) + u.quantity;
    }
    res.json({ byMetric, byPeriod });
  }));

  api.get('/analytics/top-accounts', auth, requireRole('admin', 'analyst'), wrap(async (req, res) => {
    const accounts = store.query('SELECT * FROM accounts');
    const ranked = accounts.map((a) => {
      const units = store.query('SELECT quantity FROM usage_records WHERE account_id = ?', [a.id]).reduce((s, u) => s + u.quantity, 0);
      return { account: a.name, status: a.status, units };
    }).sort((x, y) => y.units - x.units);
    res.json(ranked.slice(0, 10));
  }));

  api.get('/audit', auth, requireRole('admin'), wrap(async (req, res) => {
    res.json(store.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100'));
  }));
}

module.exports = {
  name: 'subscription-analytics',
  basePath: '/api',
  dbFile: process.env.DB_FILE === 'memory'
    ? null
    : (process.env.DB_FILE || require('path').join(__dirname, '..', 'data', 'saas.json')),
  migrations,
  seed,
  registerRoutes,
};
