'use strict';
/**
 * Project 1 — end-to-end validation scenario.
 * Exercises the full workflow: auth, RBAC, catalogue, cart, stock control,
 * checkout, invoicing, fulfilment, admin oversight and audit trail.
 * Run:  DB_FILE=memory node project-1-b2b-order-management/test/run.js
 */
process.env.DB_FILE = 'memory';
const { buildApp } = require('../../shared/lib/app');
const project = require('../server/project');
const { startApp, client, makeReporter } = require('../../shared/lib/testkit');

(async () => {
  const { app } = buildApp(project);
  const server = await startApp(app);
  const base = `http://127.0.0.1:${server.address().port}`;
  const r = makeReporter('Project 1 — B2B Order Management');

  const admin = client(base);
  const seller = client(base);
  const buyer = client(base);

  // --- auth ---
  let res = await admin.post('/api/auth/login', { email: 'admin@arrowstack.in', password: 'Admin@123' });
  r.check('admin login returns token', res.status === 200 && !!res.body.token, JSON.stringify(res.body));
  admin.setToken(res.body.token);

  res = await seller.post('/api/auth/login', { email: 'seller@arrowstack.in', password: 'Seller@123' });
  r.check('seller login succeeds', res.status === 200 && res.body.user.role === 'seller');
  seller.setToken(res.body.token);

  res = await buyer.post('/api/auth/login', { email: 'buyer@arrowstack.in', password: 'Buyer@123' });
  r.check('buyer login succeeds', res.status === 200 && res.body.user.role === 'buyer');
  buyer.setToken(res.body.token);

  res = await client(base).post('/api/auth/login', { email: 'buyer@arrowstack.in', password: 'wrong' });
  r.check('wrong password rejected (401)', res.status === 401);

  // --- validation ---
  res = await client(base).post('/api/auth/register', { name: 'X', email: 'not-an-email', password: '123' });
  r.check('invalid registration rejected (400)', res.status === 400 && Array.isArray(res.body.problems), JSON.stringify(res.body));

  // --- catalogue ---
  res = await buyer.get('/api/products');
  r.check('buyer can list products', res.status === 200 && res.body.length >= 5);
  const chair = res.body.find((p) => p.sku === 'ARW-CHR-001');
  const webcam = res.body.find((p) => p.sku === 'ARW-CAM-005');

  // --- RBAC ---
  res = await buyer.post('/api/products', { sku: 'X', name: 'Nope', unit_price: 10, stock_qty: 1 });
  r.check('buyer cannot create product (403)', res.status === 403);

  res = await seller.post('/api/products', { sku: 'ARW-NEW-006', name: 'Monitor Arm', unit_price: 3299, stock_qty: 25 });
  r.check('seller can create product (201)', res.status === 201);

  // --- cart & stock control ---
  res = await buyer.post('/api/cart/items', { product_id: webcam.id, quantity: 1 });
  r.check('out-of-stock item rejected (409)', res.status === 409, JSON.stringify(res.body));

  res = await buyer.post('/api/cart/items', { product_id: chair.id, quantity: 2 });
  r.check('add in-stock item to cart', res.status === 201 && res.body.items.length === 1);
  r.check('cart subtotal computed correctly', res.body.subtotal === chair.unit_price * 2, String(res.body.subtotal));

  res = await buyer.post('/api/cart/items', { product_id: chair.id, quantity: 999 });
  r.check('over-quantity add rejected (409)', res.status === 409);

  // --- checkout ---
  res = await buyer.post('/api/orders', {});
  r.check('checkout creates order (201)', res.status === 201 && res.body.status === 'pending', JSON.stringify(res.body));
  const order = res.body;
  const expectedTax = Math.round(order.subtotal * 0.18 * 100) / 100;
  r.check('GST computed at 18%', order.tax === expectedTax, `${order.tax} vs ${expectedTax}`);
  r.check('invoice issued with number', order.invoice && /^INV-/.test(order.invoice.number));

  // --- stock decremented ---
  res = await buyer.get(`/api/products/${chair.id}`);
  r.check('stock decremented after order', res.body.stock_qty === chair.stock_qty - 2, `${res.body.stock_qty}`);

  // --- buyer isolation ---
  res = await buyer.get('/api/orders');
  r.check('buyer sees own orders', res.status === 200 && res.body.length === 1);
  const otherBuyer = client(base);
  res = await otherBuyer.post('/api/auth/register', { name: 'Other Co', email: 'other@arrowstack.in', password: 'Other@123' });
  otherBuyer.setToken((await otherBuyer.post('/api/auth/login', { email: 'other@arrowstack.in', password: 'Other@123' })).body.token);
  res = await otherBuyer.get(`/api/orders/${order.id}`);
  r.check('other buyer cannot read order (404)', res.status === 404);

  // --- fulfilment ---
  res = await seller.patch(`/api/orders/${order.id}/status`, { status: 'confirmed' });
  r.check('seller confirms order', res.status === 200 && res.body.status === 'confirmed');

  res = await seller.patch(`/api/orders/${order.id}/status`, { status: 'teleported' });
  r.check('invalid status rejected (400)', res.status === 400);

  // --- admin ---
  res = await admin.get('/api/admin/stats');
  r.check('admin stats available', res.status === 200 && res.body.orderCount === 1, JSON.stringify(res.body));

  res = await admin.get('/api/admin/audit');
  r.check('audit trail recorded actions', res.status === 200 && res.body.length > 5, `rows=${res.body.length}`);

  res = await buyer.get('/api/admin/audit');
  r.check('non-admin blocked from audit (403)', res.status === 403);

  server.close();
  process.exit(r.finish());
})().catch((e) => { console.error(e); process.exit(1); });
