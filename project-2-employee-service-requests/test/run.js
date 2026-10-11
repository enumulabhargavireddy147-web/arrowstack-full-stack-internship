'use strict';
/**
 * Project 2 — end-to-end validation scenario.
 * Covers: auth, RBAC, raising a request, SLA computation, routing/assignment,
 * status transitions, comments, employee isolation, dashboard and audit.
 * Run:  DB_FILE=memory node project-2-employee-service-requests/test/run.js
 */
process.env.DB_FILE = 'memory';
const { buildApp } = require('../../shared/lib/app');
const project = require('../server/project');
const { startApp, client, makeReporter } = require('../../shared/lib/testkit');

(async () => {
  const { app } = buildApp(project);
  const server = await startApp(app);
  const base = `http://127.0.0.1:${server.address().port}`;
  const r = makeReporter('Project 2 — Employee Service Request System');

  const admin = client(base), agent = client(base), employee = client(base);

  let res = await admin.post('/api/auth/login', { email: 'admin@arrowstack.in', password: 'Admin@123' });
  admin.setToken(res.body.token);
  r.check('admin login', res.status === 200 && res.body.user.role === 'admin');

  res = await agent.post('/api/auth/login', { email: 'agent.it@arrowstack.in', password: 'Agent@123' });
  agent.setToken(res.body.token);
  r.check('IT agent login', res.status === 200 && res.body.user.role === 'agent');

  res = await employee.post('/api/auth/login', { email: 'employee@arrowstack.in', password: 'Employee@123' });
  employee.setToken(res.body.token);
  r.check('employee login', res.status === 200 && res.body.user.role === 'employee');

  // categories
  res = await employee.get('/api/categories');
  r.check('categories listed', res.status === 200 && res.body.length === 3);
  const itCat = res.body.find((c) => c.name === 'IT');
  const hrCat = res.body.find((c) => c.name === 'HR');
  r.check('IT SLA is 24h, HR is 48h', itCat.default_sla_hours === 24 && hrCat.default_sla_hours === 48);

  // validation
  res = await employee.post('/api/requests', { title: 'No', description: 'short', category_id: itCat.id });
  r.check('invalid request rejected (400)', res.status === 400 && Array.isArray(res.body.problems));

  // raise request
  res = await employee.post('/api/requests', { title: 'Laptop will not boot', description: 'Blue screen on startup since this morning.', category_id: itCat.id, priority: 'high' });
  r.check('employee raises request (201)', res.status === 201 && res.body.status === 'open', JSON.stringify(res.body));
  const reqId = res.body.id;
  r.check('SLA due date set on creation', !!res.body.sla_due_at);
  r.check('request not yet overdue', res.body.overdue === false);

  // isolation
  const other = client(base);
  await other.post('/api/auth/register', { name: 'Sam Employee', email: 'sam@arrowstack.in', password: 'Sam@12345' });
  other.setToken((await other.post('/api/auth/login', { email: 'sam@arrowstack.in', password: 'Sam@12345' })).body.token);
  res = await other.get(`/api/requests/${reqId}`);
  r.check('other employee blocked from request (403)', res.status === 403);

  // RBAC: employee cannot patch
  res = await employee.patch(`/api/requests/${reqId}`, { status: 'resolved' });
  r.check('employee cannot change status (403)', res.status === 403);

  // assignment
  res = await agent.get('/api/agents');
  r.check('agent list admin-only (403 for agent)', res.status === 403);
  res = await admin.get('/api/agents');
  r.check('admin can list agents', res.status === 200 && res.body.length === 2);
  const itAgent = res.body.find((a) => a.email === 'agent.it@arrowstack.in');

  res = await agent.patch(`/api/requests/${reqId}`, { assignee_id: itAgent.id });
  r.check('assigning agent moves status to assigned', res.status === 200 && res.body.status === 'assigned', JSON.stringify(res.body));

  res = await agent.patch(`/api/requests/${reqId}`, { status: 'in_progress' });
  r.check('status transition to in_progress', res.status === 200 && res.body.status === 'in_progress');

  // comment
  res = await agent.post(`/api/requests/${reqId}/comments`, { body: 'Reimaging your laptop today.' });
  r.check('agent adds comment (201)', res.status === 201);
  res = await employee.get(`/api/requests/${reqId}`);
  r.check('comments visible on request', res.body.comments.length === 1);

  // resolve
  res = await agent.patch(`/api/requests/${reqId}`, { status: 'resolved' });
  r.check('resolve sets resolved_at', res.status === 200 && !!res.body.resolved_at);

  // second request for dashboard
  await employee.post('/api/requests', { title: 'Need HR letter', description: 'Please issue a salary certificate.', category_id: hrCat.id });

  res = await agent.get('/api/dashboard');
  r.check('dashboard aggregates requests', res.status === 200 && res.body.total === 2, JSON.stringify(res.body));
  r.check('dashboard counts by category', res.body.byCategory.IT === 1 && res.body.byCategory.HR === 1);
  r.check('dashboard reports open count', res.body.open === 1);

  res = await employee.get('/api/dashboard');
  r.check('employee blocked from dashboard (403)', res.status === 403);

  res = await admin.get('/api/audit');
  r.check('audit trail recorded actions', res.status === 200 && res.body.length >= 8, `rows=${res.body.length}`);

  server.close();
  process.exit(r.finish());
})().catch((e) => { console.error(e); process.exit(1); });
