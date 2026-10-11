'use strict';
/**
 * Project 1 — B2B Order Management Platform (backend).
 * Scenario: a simulated distributor sells products to business buyers through a
 * multi-role ordering workflow: catalogue, cart, checkout, orders, invoices,
 * stock control and admin oversight.
 *
 * Roles: admin (oversight), seller (catalogue + fulfilment), buyer (ordering).
 */
const { nowIso, newId } = require('../../shared/lib/db');
const { hashPassword, verifyPassword, signToken, authenticate, requireRole } = require('../../shared/lib/auth');
const { record } = require('../../shared/lib/audit');
const { validate } = require('../../shared/lib/validate');
const { wrap, HttpError } = require('../../shared/lib/http');

const GST_RATE = 0.18;
const round2 = (n) => Math.round(n * 100) / 100;

const migrations = [
  {
    id: '001_users',
    up(db) {
      db.exec(`CREATE TABLE IF NOT EXISTS users (
        id STRING PRIMARY KEY, name STRING, email STRING, password_hash STRING,
        role STRING, active BOOLEAN, created_at STRING)`);
    },
  },
  {
    id: '002_products',
    up(db) {
      db.exec(`CREATE TABLE IF NOT EXISTS products (
        id STRING PRIMARY KEY, sku STRING, name STRING, unit_price NUMBER,
        stock_qty NUMBER, active BOOLEAN, created_at STRING)`);
    },
  },
  {
    id: '003_carts',
    up(db) {
      db.exec(`CREATE TABLE IF NOT EXISTS carts (
        id STRING PRIMARY KEY, buyer_id STRING, status STRING, created_at STRING)`);
      db.exec(`CREATE TABLE IF NOT EXISTS cart_items (
        id STRING PRIMARY KEY, cart_id STRING, product_id STRING,
        quantity NUMBER, unit_price NUMBER)`);
    },
  },
  {
    id: '004_orders',
    up(db) {
      db.exec(`CREATE TABLE IF NOT EXISTS orders (
        id STRING PRIMARY KEY, buyer_id STRING, status STRING, subtotal NUMBER,
        tax NUMBER, amount NUMBER, created_at STRING)`);
      db.exec(`CREATE TABLE IF NOT EXISTS order_items (
        id STRING PRIMARY KEY, order_id STRING, product_id STRING,
        product_name STRING, quantity NUMBER, unit_price NUMBER, line_amount NUMBER)`);
    },
  },
  {
    id: '005_invoices',
    up(db) {
      db.exec(`CREATE TABLE IF NOT EXISTS invoices (
        id STRING PRIMARY KEY, order_id STRING, number STRING, amount NUMBER,
        issued_at STRING, status STRING)`);
    },
  },
];

function seed(store) {
  const count = store.one('SELECT COUNT(*) AS c FROM users');
  if (count && count.c > 0) return; // already seeded

  const users = [
    { name: 'Admin User', email: 'admin@arrowstack.in', role: 'admin', password: 'Admin@123' },
    { name: 'Sunrise Traders', email: 'seller@arrowstack.in', role: 'seller', password: 'Seller@123' },
    { name: 'Bright Retail Pvt Ltd', email: 'buyer@arrowstack.in', role: 'buyer', password: 'Buyer@123' },
  ];
  // bcrypt is synchronous-capable via hashSync through the async API at seed time.
  const bcrypt = require('bcryptjs');
  for (const u of users) {
    store.query(
      'INSERT INTO users VALUES (?,?,?,?,?,?,?)',
      [newId(), u.name, u.email, bcrypt.hashSync(u.password, 10), u.role, true, nowIso()]
    );
  }

  const products = [
    ['ARW-CHR-001', 'Ergonomic Office Chair', 7499, 40],
    ['ARW-DSK-002', 'Standing Desk 120cm', 15999, 15],
    ['ARW-LMP-003', 'LED Desk Lamp', 1299, 120],
    ['ARW-PAD-004', 'Laptop Stand Aluminium', 1899, 60],
    ['ARW-CAM-005', 'HD Webcam 1080p', 2499, 0],
  ];
  for (const [sku, name, price, stock] of products) {
    store.query('INSERT INTO products VALUES (?,?,?,?,?,?,?)',
      [newId(), sku, name, price, stock, true, nowIso()]);
  }
  store.commit();
}

function registerRoutes(api, store) {
  const auth = authenticate;

  // ---- helpers -------------------------------------------------------------
  function getUserByEmail(email) {
    return store.one('SELECT * FROM users WHERE email = ?', [email]);
  }
  function publicUser(u) {
    return { id: u.id, name: u.name, email: u.email, role: u.role, active: u.active };
  }
  function openCartFor(buyerId) {
    let cart = store.one("SELECT * FROM carts WHERE buyer_id = ? AND status = 'open'", [buyerId]);
    if (!cart) {
      const id = newId();
      store.query('INSERT INTO carts VALUES (?,?,?,?)', [id, buyerId, 'open', nowIso()]);
      cart = { id, buyer_id: buyerId, status: 'open', created_at: nowIso() };
    }
    return cart;
  }
  function cartWithItems(cart) {
    const items = store.query(
      `SELECT ci.id, ci.product_id, p.name AS product_name, p.sku, ci.quantity, ci.unit_price,
              (ci.quantity * ci.unit_price) AS line_amount, p.stock_qty
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = ?`, [cart.id]);
    const subtotal = round2(items.reduce((s, i) => s + i.line_amount, 0));
    return { ...cart, items, subtotal };
  }

  // ---- auth ----------------------------------------------------------------
  api.post('/auth/register', wrap(async (req, res) => {
    const body = validate(req.body, {
      name: { required: true, minLen: 2, maxLen: 120 },
      email: { required: true, email: true },
      password: { required: true, minLen: 8, maxLen: 128 },
      role: { enum: ['buyer', 'seller'], default: 'buyer' },
    });
    if (getUserByEmail(body.email)) throw new HttpError(409, 'Email already registered');
    const id = newId();
    store.query('INSERT INTO users VALUES (?,?,?,?,?,?,?)',
      [id, body.name, body.email, await hashPassword(body.password), body.role, true, nowIso()]);
    record(store, { actorId: id, actorRole: body.role, action: 'user.register', entity: 'user', entityId: id });
    store.commit();
    res.status(201).json({ id, email: body.email, role: body.role });
  }));

  api.post('/auth/login', wrap(async (req, res) => {
    const body = validate(req.body, {
      email: { required: true, email: true },
      password: { required: true },
    });
    const user = getUserByEmail(body.email);
    if (!user || !user.active || !(await verifyPassword(body.password, user.password_hash))) {
      throw new HttpError(401, 'Invalid credentials');
    }
    record(store, { actorId: user.id, actorRole: user.role, action: 'user.login', entity: 'user', entityId: user.id });
    store.commit();
    res.json({ token: signToken(user), user: publicUser(user) });
  }));

  api.get('/auth/me', auth, wrap(async (req, res) => {
    const user = store.one('SELECT * FROM users WHERE id = ?', [req.user.sub]);
    if (!user) throw new HttpError(404, 'User not found');
    res.json(publicUser(user));
  }));

  // ---- products ------------------------------------------------------------
  api.get('/products', auth, wrap(async (req, res) => {
    res.json(store.query('SELECT * FROM products WHERE active = TRUE ORDER BY name'));
  }));

  api.get('/products/:id', auth, wrap(async (req, res) => {
    const p = store.one('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!p) throw new HttpError(404, 'Product not found');
    res.json(p);
  }));

  api.post('/products', auth, requireRole('seller', 'admin'), wrap(async (req, res) => {
    const body = validate(req.body, {
      sku: { required: true, maxLen: 40 },
      name: { required: true, minLen: 2, maxLen: 160 },
      unit_price: { required: true, type: 'number', positive: true },
      stock_qty: { required: true, integer: true, min: 0 },
    });
    if (store.one('SELECT id FROM products WHERE sku = ?', [body.sku])) throw new HttpError(409, 'SKU already exists');
    const id = newId();
    store.query('INSERT INTO products VALUES (?,?,?,?,?,?,?)',
      [id, body.sku, body.name, body.unit_price, body.stock_qty, true, nowIso()]);
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'product.create', entity: 'product', entityId: id, detail: body });
    store.commit();
    res.status(201).json(store.one('SELECT * FROM products WHERE id = ?', [id]));
  }));

  api.patch('/products/:id', auth, requireRole('seller', 'admin'), wrap(async (req, res) => {
    const p = store.one('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!p) throw new HttpError(404, 'Product not found');
    const body = validate(req.body, {
      name: { maxLen: 160 }, unit_price: { type: 'number', positive: true },
      stock_qty: { integer: true, min: 0 }, active: { type: 'boolean' },
    });
    const merged = { ...p, ...body };
    store.query('UPDATE products SET name=?, unit_price=?, stock_qty=?, active=? WHERE id=?',
      [merged.name, merged.unit_price, merged.stock_qty, merged.active, p.id]);
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'product.update', entity: 'product', entityId: p.id, detail: body });
    store.commit();
    res.json(store.one('SELECT * FROM products WHERE id = ?', [p.id]));
  }));

  // ---- cart (buyer only) ---------------------------------------------------
  api.get('/cart', auth, requireRole('buyer'), wrap(async (req, res) => {
    res.json(cartWithItems(openCartFor(req.user.sub)));
  }));

  api.post('/cart/items', auth, requireRole('buyer'), wrap(async (req, res) => {
    const body = validate(req.body, {
      product_id: { required: true },
      quantity: { required: true, integer: true, positive: true },
    });
    const product = store.one('SELECT * FROM products WHERE id = ? AND active = TRUE', [body.product_id]);
    if (!product) throw new HttpError(404, 'Product not found or inactive');
    if (product.stock_qty < body.quantity) throw new HttpError(409, `Insufficient stock: ${product.stock_qty} available`);
    const cart = openCartFor(req.user.sub);
    const existing = store.one('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?', [cart.id, product.id]);
    if (existing) {
      const qty = existing.quantity + body.quantity;
      if (qty > product.stock_qty) throw new HttpError(409, `Insufficient stock: ${product.stock_qty} available`);
      store.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [qty, existing.id]);
    } else {
      store.query('INSERT INTO cart_items VALUES (?,?,?,?,?)',
        [newId(), cart.id, product.id, body.quantity, product.unit_price]);
    }
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'cart.add', entity: 'cart', entityId: cart.id, detail: body });
    store.commit();
    res.status(201).json(cartWithItems(cart));
  }));

  api.delete('/cart/items/:id', auth, requireRole('buyer'), wrap(async (req, res) => {
    const cart = openCartFor(req.user.sub);
    const item = store.one('SELECT * FROM cart_items WHERE id = ? AND cart_id = ?', [req.params.id, cart.id]);
    if (!item) throw new HttpError(404, 'Cart item not found');
    store.query('DELETE FROM cart_items WHERE id = ?', [item.id]);
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'cart.remove', entity: 'cart', entityId: cart.id, detail: { itemId: item.id } });
    store.commit();
    res.json(cartWithItems(cart));
  }));

  // ---- orders --------------------------------------------------------------
  api.post('/orders', auth, requireRole('buyer'), wrap(async (req, res) => {
    const cart = openCartFor(req.user.sub);
    const full = cartWithItems(cart);
    if (!full.items.length) throw new HttpError(400, 'Cart is empty');

    for (const it of full.items) {
      if (it.quantity > it.stock_qty) throw new HttpError(409, `Insufficient stock for ${it.product_name}`);
    }

    const orderId = newId();
    const subtotal = full.subtotal;
    const tax = round2(subtotal * GST_RATE);
    const amount = round2(subtotal + tax);
    store.query('INSERT INTO orders VALUES (?,?,?,?,?,?,?)',
      [orderId, req.user.sub, 'pending', subtotal, tax, amount, nowIso()]);

    for (const it of full.items) {
      store.query('INSERT INTO order_items VALUES (?,?,?,?,?,?,?)',
        [newId(), orderId, it.product_id, it.product_name, it.quantity, it.unit_price, it.line_amount]);
      store.query('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?', [it.quantity, it.product_id]);
    }
    store.query('UPDATE carts SET status = ? WHERE id = ?', ['checked_out', cart.id]);

    const invNumber = `INV-${new Date().getFullYear()}-${orderId.slice(0, 6).toUpperCase()}`;
    store.query('INSERT INTO invoices VALUES (?,?,?,?,?,?)',
      [newId(), orderId, invNumber, amount, nowIso(), 'issued']);

    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'order.create', entity: 'order', entityId: orderId, detail: { amount } });
    store.commit();
    res.status(201).json(getOrder(orderId, req.user));
  }));

  function getOrder(id, user) {
    const order = store.one('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return null;
    if (user.role === 'buyer' && order.buyer_id !== user.sub) return null;
    const items = store.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
    const invoice = store.one('SELECT * FROM invoices WHERE order_id = ?', [id]);
    return { ...order, items, invoice };
  }

  api.get('/orders', auth, wrap(async (req, res) => {
    const rows = req.user.role === 'buyer'
      ? store.query('SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC', [req.user.sub])
      : store.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  }));

  api.get('/orders/:id', auth, wrap(async (req, res) => {
    const order = getOrder(req.params.id, req.user);
    if (!order) throw new HttpError(404, 'Order not found');
    res.json(order);
  }));

  api.patch('/orders/:id/status', auth, requireRole('seller', 'admin'), wrap(async (req, res) => {
    const order = store.one('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) throw new HttpError(404, 'Order not found');
    const body = validate(req.body, { status: { required: true, enum: ['pending', 'confirmed', 'shipped', 'cancelled'] } });
    store.query('UPDATE orders SET status = ? WHERE id = ?', [body.status, order.id]);
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'order.status', entity: 'order', entityId: order.id, detail: { from: order.status, to: body.status } });
    store.commit();
    res.json(store.one('SELECT * FROM orders WHERE id = ?', [order.id]));
  }));

  api.get('/invoices', auth, wrap(async (req, res) => {
    if (req.user.role === 'buyer') {
      return res.json(store.query(
        'SELECT i.* FROM invoices i JOIN orders o ON o.id = i.order_id WHERE o.buyer_id = ? ORDER BY i.issued_at DESC',
        [req.user.sub]));
    }
    res.json(store.query('SELECT * FROM invoices ORDER BY issued_at DESC'));
  }));

  // ---- admin ---------------------------------------------------------------
  api.get('/admin/users', auth, requireRole('admin'), wrap(async (req, res) => {
    res.json(store.query('SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at'));
  }));

  api.patch('/admin/users/:id', auth, requireRole('admin'), wrap(async (req, res) => {
    const user = store.one('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) throw new HttpError(404, 'User not found');
    const body = validate(req.body, { active: { required: true, type: 'boolean' } });
    store.query('UPDATE users SET active = ? WHERE id = ?', [body.active, user.id]);
    record(store, { actorId: req.user.sub, actorRole: req.user.role, action: 'user.set_active', entity: 'user', entityId: user.id, detail: body });
    store.commit();
    res.json(publicUser(store.one('SELECT * FROM users WHERE id = ?', [user.id])));
  }));

  api.get('/admin/audit', auth, requireRole('admin'), wrap(async (req, res) => {
    res.json(store.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100'));
  }));

  api.get('/admin/stats', auth, requireRole('admin', 'seller'), wrap(async (req, res) => {
    const orders = store.query('SELECT status, amount FROM orders');
    const byStatus = {};
    let revenue = 0;
    for (const o of orders) { byStatus[o.status] = (byStatus[o.status] || 0) + 1; if (o.status !== 'cancelled') revenue += o.amount; }
    const lowStock = store.query('SELECT sku, name, stock_qty FROM products WHERE stock_qty <= 5 ORDER BY stock_qty');
    res.json({ orderCount: orders.length, revenue: round2(revenue), byStatus, lowStock });
  }));
}

module.exports = {
  name: 'b2b-order-management',
  basePath: '/api',
  dbFile: process.env.DB_FILE === 'memory'
    ? null
    : (process.env.DB_FILE || require('path').join(__dirname, '..', 'data', 'orders.json')),
  migrations,
  seed,
  registerRoutes,
};
