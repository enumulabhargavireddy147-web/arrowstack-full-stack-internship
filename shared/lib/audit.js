'use strict';
/**
 * audit.js — append-only activity records ("audit-friendly activity records").
 * Every mutating action writes one row so a mentor can trace who did what, when.
 */
const { nowIso, newId } = require('./db');

function record(db, { actorId, actorRole, action, entity, entityId, detail }) {
  db.query(
    'INSERT INTO audit_log (id, actor_id, actor_role, action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)',
    [newId(), actorId || null, actorRole || null, action, entity, entityId || null,
      detail ? JSON.stringify(detail) : null, nowIso()]
  );
}

const auditMigration = {
  id: '000_audit_log',
  up(db) {
    db.exec(`CREATE TABLE IF NOT EXISTS audit_log (
      id STRING PRIMARY KEY, actor_id STRING, actor_role STRING, action STRING,
      entity STRING, entity_id STRING, detail STRING, created_at STRING)`);
  },
};

module.exports = { record, auditMigration };
