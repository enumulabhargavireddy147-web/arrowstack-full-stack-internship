'use strict';
/**
 * db.js — a tiny relational persistence layer shared by all three Arrowstack projects.
 *
 * The handbook's production stack is PostgreSQL. So the app code is written against
 * ordinary SQL (CREATE TABLE, INSERT, SELECT ... JOIN) and kept behind this thin
 * adapter, so the same code runs on a file-backed SQL engine here (alasql, pure JS,
 * zero native build) and can be pointed at PostgreSQL in production by swapping this
 * one file. See docs/DECISIONS.md for the rationale.
 */
const fs = require('fs');
const path = require('path');
const alasql = require('alasql');

function createDatabase(name, options = {}) {
  const db = new alasql.Database(name);
  const file = options.file || null;

  function ensureMigrationsTable() {
    db.exec('CREATE TABLE IF NOT EXISTS _migrations (id STRING PRIMARY KEY, applied_at STRING)');
  }

  /** Apply every migration whose id is not already recorded, in order. */
  function runMigrations(migrations) {
    ensureMigrationsTable();
    const applied = new Set(db.exec('SELECT id FROM _migrations').map((r) => r.id));
    const executed = [];
    for (const m of migrations) {
      if (applied.has(m.id)) continue;
      m.up(db);
      db.exec('INSERT INTO _migrations VALUES (?, ?)', [m.id, new Date().toISOString()]);
      executed.push(m.id);
    }
    return executed;
  }

  function snapshot() {
    const out = {};
    for (const t of Object.keys(db.tables)) out[t] = db.tables[t].data;
    return out;
  }

  /** Persist the whole database to a JSON file (durable across restarts). */
  function save() {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(snapshot(), null, 2));
  }

  /** Load a previous snapshot into the already-migrated tables. */
  function load() {
    if (!file || !fs.existsSync(file)) return false;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const t of Object.keys(data)) {
      if (db.tables[t]) db.tables[t].data = data[t];
    }
    return true;
  }

  const query = (sql, params = []) => db.exec(sql, params);
  const one = (sql, params = []) => {
    const rows = query(sql, params);
    return rows && rows.length ? rows[0] : null;
  };

  return {
    raw: db,
    query,
    one,
    runMigrations,
    save,
    load,
    /** Call after a write to keep the file store in sync (no-op for in-memory). */
    commit() { save(); },
  };
}

const nowIso = () => new Date().toISOString();
const newId = () => require('crypto').randomUUID();

module.exports = { createDatabase, nowIso, newId };
