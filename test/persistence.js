'use strict';
/**
 * Persistence / restart validation.
 * Proves the file-backed store survives a process restart (deployment-readiness):
 * boot project 1, create data, save; boot a fresh instance on the same file and
 * confirm the data is still there.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildApp } = require('../shared/lib/app');
const { startApp, client, makeReporter } = require('../shared/lib/testkit');

(async () => {
  const r = makeReporter('Persistence / restart');
  const tmp = path.join(os.tmpdir(), `arrowstack-persist-${Date.now()}.json`);
  process.env.DB_FILE = tmp;

  // --- first boot: create a product as seller ---
  const p1 = require('../project-1-b2b-order-management/server/project');
  let { app, store } = buildApp({ ...p1, dbFile: tmp });
  let server = await startApp(app);
  let base = `http://127.0.0.1:${server.address().port}`;
  let seller = client(base);
  let res = await seller.post('/api/auth/login', { email: 'seller@arrowstack.in', password: 'Seller@123' });
  seller.setToken(res.body.token);
  res = await seller.post('/api/products', { sku: 'PERSIST-001', name: 'Persisted Widget', unit_price: 500, stock_qty: 7 });
  r.check('first boot: product created', res.status === 201);
  store.save();
  server.close();

  // --- second boot: fresh instance on the same file ---
  delete require.cache[require.resolve('../project-1-b2b-order-management/server/project')];
  const p1b = require('../project-1-b2b-order-management/server/project');
  const built = buildApp({ ...p1b, dbFile: tmp });
  server = await startApp(built.app);
  base = `http://127.0.0.1:${server.address().port}`;
  const buyer = client(base);
  res = await buyer.post('/api/auth/login', { email: 'buyer@arrowstack.in', password: 'Buyer@123' });
  buyer.setToken(res.body.token);
  res = await buyer.get('/api/products');
  const found = res.body.find((p) => p.sku === 'PERSIST-001');
  r.check('second boot: persisted product survives restart', !!found && found.stock_qty === 7, JSON.stringify(res.body.map((p) => p.sku)));

  fs.rmSync(tmp, { force: true });
  server.close();
  process.exit(r.finish());
})().catch((e) => { console.error(e); process.exit(1); });
