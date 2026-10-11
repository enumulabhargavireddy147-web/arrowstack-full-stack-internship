'use strict';
/**
 * app.js — build a fully-wired Express app from a project's definition.
 * Each project supplies: name, migrations, seed and registerRoutes.
 */
const express = require('express');
const { createDatabase } = require('./db');
const { auditMigration } = require('./audit');
const { notFound, errorHandler } = require('./http');

function buildApp(project) {
  const dbFile = project.dbFile || null;
  const store = createDatabase(project.name, { file: dbFile });

  // Migrations always run first (create tables), then any saved snapshot is loaded.
  const migrations = [auditMigration, ...project.migrations];
  const applied = store.runMigrations(migrations);
  const loaded = store.load();

  if (project.seed) project.seed(store);

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => { req.store = store; next(); });

  app.get('/health', (req, res) => res.json({
    service: project.name,
    status: 'ok',
    migrationsApplied: applied,
    loadedFromDisk: loaded,
    time: new Date().toISOString(),
  }));

  const api = express.Router();
  project.registerRoutes(api, store);
  app.use(project.basePath || '/api', api);

  app.use(notFound);
  app.use(errorHandler);

  app.locals.store = store;
  return { app, store };
}

module.exports = { buildApp };
