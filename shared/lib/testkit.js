'use strict';
/**
 * testkit.js — minimal HTTP test harness (no external test framework).
 * Boots an Express app on an ephemeral port and gives an http-based client.
 * Uses node:http directly (not global fetch) so it works in constrained sandboxes.
 */
const http = require('http');

function startApp(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function request(base, method, path, body, token) {
  const url = new URL(path, base);
  const payload = body === undefined ? null : JSON.stringify(body);
  const headers = { 'content-type': 'application/json' };
  if (payload) headers['content-length'] = Buffer.byteLength(payload);
  if (token) headers.authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function client(base) {
  let token = null;
  return {
    setToken(t) { token = t; },
    req(method, path, body) { return request(base, method, path, body, token); },
    get(p) { return this.req('GET', p); },
    post(p, b) { return this.req('POST', p, b); },
    patch(p, b) { return this.req('PATCH', p, b); },
    del(p) { return this.req('DELETE', p); },
  };
}

/** Tiny assertion collector that prints a PASS/FAIL table and returns an exit code. */
function makeReporter(title) {
  const results = [];
  return {
    check(name, cond, detail = '') {
      results.push({ name, ok: !!cond, detail });
      console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail && !cond ? '  -> ' + detail : ''}`);
    },
    finish() {
      const passed = results.filter((r) => r.ok).length;
      console.log(`\n${title}: ${passed}/${results.length} checks passed`);
      return passed === results.length ? 0 : 1;
    },
    results,
  };
}

module.exports = { startApp, client, request, makeReporter };
