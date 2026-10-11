'use strict';
/**
 * Project 2 — Employee Service Request System (backend).
 * Scenario: an internal portal where employees raise IT / HR / Facilities requests,
 * which are categorised, routed to an agent, tracked against an SLA, commented on
 * and reported on a dashboard.
 *
 * Roles: employee (raises requests), agent (handles requests), admin (oversight).
 */
const { nowIso, newId } = require('../../shared/lib/db');
const { hashPassword, verifyPassword, signToken, authenticate, requireRole } = require('../../shared/lib/auth');
const { record } = require('../../shared/lib/audit');
const { validate } = require('../../shared/lib/validate');
const { wrap, HttpError } = require('../../shared/lib/http');

const OPEN_STATUSES = ['open', 'assigned', 'in_progress'];

const migrations = [
  { id: '001_users', up(db) { db.exec(`CREATE TABLE IF NOT EXISTS users (
      id STRING PRIMARY KEY, name STRING, email STRING, password_hash STRING,
      role STRING, department STRING, active BOOLEAN, created_at STRING)`); } },
  { id: '002_categories', up(db) { db.exec(`CREATE TABLE IF NOT EXISTS categories (
      id STRING PRIMARY KEY, name STRING, default_sla_hours NUMBER)`); } },
  { id: '003_requests', up(db) { db.exec(`CREATE TABLE IF NOT EXISTS requests (
      id STRING PRIMARY KEY, requester_id STRING, category_id STRING, title STRING,
      description STRING, priority STRING, status STRING, assignee_id STRING,
      sla_due_at STRING, created_at STRING, updated_at STRING, resolved_at STRING)`); } },
  { id: '004_comments', up(db) { db.exec(`CREATE TABLE IF NOT EXISTS request_comments (
      id STRING PRIMARY KEY, request_id STRING, author_id STRING, body STRING, created_at STRING)`); } },
];

function seed(store) {
  const c = store.one('SELECT COUNT(*) AS c FROM users');
  if (c && c.c > 0) return;
  const bcrypt = require('bcryptjs');
  const users = [
    ['Portal Admin', 'admin@arrowstack.in', 'admin', 'Operations', 'Admin@123'],
    ['Priya (IT Agent)', 'agent.it@arrowstack.in', 'agent', 'IT', 'Agent@123'],
    ['Rahul (HR Agent)', 'agent.hr@arrowstack.in', 'agent', 'HR', 'Agent@123'],
    ['Neha Employee', 'employee@arrowstack.in', 'employee', 'Sales', 'Employee@123'],
  ];
  for (const [name, email, role, dept, pw] of users) {
    store.query('INSERT INTO users VALUES (?,?,?,?,?,?,?,?)',
      [newId(), name, email, bcrypt.hashSync(pw, 10), role, dept, true, nowIso()]);
  }
  const cats = [['IT', 24], ['HR', 48], ['Facilities', 72]];
  for (const [name, hrs] of cats) store.query('INSERT INTO categories VALUES (?,?,?)', [newId(), name, hrs]);
  store.commit();
}

function registerRoutes(api, store) {
  const auth = authenticate;

  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, department: u.department });
  const hoursFrom = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
  const isOverdue = (r) => OPEN_STATUSES.includes(r.status) && r.sla_due_at && new Date(r.sla_due_at) < new Date();

  function decorate(r) {
    const cat = store.one('SELECT name FROM categories WHERE id = ?', [r.category_id]);
    const requester = store.one('SELECT name FROM users WHERE id = ?', [r.requester_id]);
    const assignee = r.assignee_id ? store.one('SELECT name FROM users WHERE id = ?', [r.assignee_id]) : null;
    return { ...r, category: cat ? cat.name : null, requester: requester ? requester.name : null,
      assignee: assignee ? assignee.name : null, overdue: isOverdue(r) };
  }

  // ---- auth ----------------------------------------------------------------
  api.post('/auth/register', wrap(async (req, res) => {
    const body = validate(req.body, {
      name: { required: true, minLen: 2, maxLen: 120 },
      email: { required: true, email: true },
      password: { required: true, minLen: 8 },
      role: { enum: ['employee', 'agent'], default: 'employee' },
      department: { maxLen: 60, default: 'General' },
    });
    if (store.one('SELECT id FROM users WHERE email = ?', [body.email])) throw new HttpError(409, 'Email already registered');
    const id = newId();
    store.query('INSERT INTO users VALUES (?,?,?,?,?,?,?,?)',
      [id, body.name, body.email, await hashPassword(body.password), body.role, body.department, true, nowIso()]);
    record(store, { actorId: id, actorRole: body.role, action: 'user.register', entity: 'user', entityId: id });
    store.commit();
    res.status(201).json({ id, email: body.email, role: body.role });
  }));

  api.post('/auth/login', wrap(async (req, res) => {
    const body = validate(req.body, { email: { required: true, email: true }, password: { required: true } });
    const user = store.one('SELECT * FROM users WHERE email = ?', [body.email]);
    if (!user || !user.active || !(await verifyPassword(body.password, user.password_hash))) throw new HttpError(401, 'Invalid credentials');
    record(store, { actorId: user.id, actorRole: user.role, action: 'user.login', entity: 'user', entityId: user.id });
    store.commit();
    res.json({ token: signToken(user), user: publicUser(user) });
  }));

  api.get('/auth/me', auth, wrap(async (req, res) => {
    const u = store.one('SELECT * FROM users WHERE id = ?', [req.user.sub]);
    if (!u) throw new HttpError(404, 'User not found');
    res.json(publicUser(u));
  }));

  api.get('/categories', auth, wrap(async (req, res) => res.json(store.query('SELECT * FROM categories ORDER BY name'))));

  // ---- requests ------------------------------------------------------------
  api.post('/requests', auth, wrap(async (req, res) => {
    const body = validate(req.body, {
      title: { required: true, minLen: 4, maxLen: 160 },
      description: { required: true, minLen: 10, maxLen: 4000 },
      category_id: { required: true },
      priority: { enum: ['low', 'medium', 'high'], default: 'medium' },
    });
    const cat = store.one('SELECT * FROM categories WHERE id = ?', [body.category_id]);
    if (!cat) throw new HttpError(400, 'Unknown category');
    const id = newId();
    store.query('INSERT INTO requests VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, req.user.sub, cat.id, body.title, body.description, body.priority, 'open', null,
        hoursFrom(cat.default_sla_hours), nowIso(), nowIso(), null]);
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'request.create', entity: 'request', entityId: id, detail: { category: cat.name } });
    store.commit();
    res.status(201).json(decorate(store.one('SELECT * FROM requests WHERE id = ?', [id])));
  }));

  api.get('/requests', auth, wrap(async (req, res) => {
    let rows;
    if (req.user.role === 'employee') {
      rows = store.query('SELECT * FROM requests WHERE requester_id = ? ORDER BY created_at DESC', [req.user.sub]);
    } else if (req.user.role === 'agent') {
      rows = store.query('SELECT * FROM requests WHERE assignee_id = ? OR assignee_id IS NULL ORDER BY created_at DESC', [req.user.sub]);
    } else {
      rows = store.query('SELECT * FROM requests ORDER BY created_at DESC');
    }
    if (req.query.status) rows = rows.filter((r) => r.status === req.query.status);
    res.json(rows.map(decorate));
  }));

  api.get('/requests/:id', auth, wrap(async (req, res) => {
    const r = store.one('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!r) throw new HttpError(404, 'Request not found');
    if (req.user.role === 'employee' && r.requester_id !== req.user.sub) throw new HttpError(403, 'Not your request');
    const comments = store.query('SELECT * FROM request_comments WHERE request_id = ? ORDER BY created_at', [r.id]);
    res.json({ ...decorate(r), comments });
  }));

  api.patch('/requests/:id', auth, requireRole('agent', 'admin'), wrap(async (req, res) => {
    const r = store.one('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!r) throw new HttpError(404, 'Request not found');
    const body = validate(req.body, {
      status: { enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed'] },
      assignee_id: {},
      priority: { enum: ['low', 'medium', 'high'] },
    });
    const merged = { ...r, ...body };
    if (body.assignee_id) {
      const agent = store.one('SELECT * FROM users WHERE id = ? AND role IN (?,?)', [body.assignee_id, 'agent', 'admin']);
      if (!agent) throw new HttpError(400, 'Assignee must be an agent or admin');
      if (merged.status === 'open') merged.status = 'assigned';
    }
    if (merged.status === 'resolved' || merged.status === 'closed') merged.resolved_at = merged.resolved_at || nowIso();
    store.query('UPDATE requests SET status=?, assignee_id=?, priority=?, updated_at=?, resolved_at=? WHERE id=?',
      [merged.status, merged.assignee_id || null, merged.priority, nowIso(), merged.resolved_at || null, r.id]);
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'request.update', entity: 'request', entityId: r.id, detail: body });
    store.commit();
    res.json(decorate(store.one('SELECT * FROM requests WHERE id = ?', [r.id])));
  }));

  api.post('/requests/:id/comments', auth, wrap(async (req, res) => {
    const r = store.one('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!r) throw new HttpError(404, 'Request not found');
    if (req.user.role === 'employee' && r.requester_id !== req.user.sub) throw new HttpError(403, 'Not your request');
    const body = validate(req.body, { body: { required: true, minLen: 1, maxLen: 2000 } });
    const id = newId();
    store.query('INSERT INTO request_comments VALUES (?,?,?,?,?)', [id, r.id, req.user.sub, body.body, nowIso()]);
    store.query('UPDATE requests SET updated_at = ? WHERE id = ?', [nowIso(), r.id]);
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'request.comment', entity: 'request', entityId: r.id });
    store.commit();
    res.status(201).json(store.one('SELECT * FROM request_comments WHERE id = ?', [id]));
  }));

  // ---- dashboard -----------------------------------------------------------
  api.get('/dashboard', auth, requireRole('agent', 'admin'), wrap(async (req, res) => {
    const rows = store.query('SELECT * FROM requests');
    const byStatus = {};
    const byCategory = {};
    let overdue = 0;
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      const cat = store.one('SELECT name FROM categories WHERE id = ?', [r.category_id]);
      const key = cat ? cat.name : 'Unknown';
      byCategory[key] = (byCategory[key] || 0) + 1;
      if (isOverdue(r)) overdue += 1;
    }
    res.json({ total: rows.length, byStatus, byCategory, overdue, open: rows.filter((r) => OPEN_STATUSES.includes(r.status)).length });
  }));

  api.get('/agents', auth, requireRole('admin'), wrap(async (req, res) => {
    res.json(store.query('SELECT id, name, email, department FROM users WHERE role = ?', ['agent']));
  }));

  api.get('/audit', auth, requireRole('admin'), wrap(async (req, res) => {
    res.json(store.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100'));
  }));
}

module.exports = {
  name: 'employee-service-requests',
  basePath: '/api',
  dbFile: process.env.DB_FILE === 'memory'
    ? null
    : (process.env.DB_FILE || require('path').join(__dirname, '..', 'data', 'requests.json')),
  migrations,
  seed,
  registerRoutes,
};
