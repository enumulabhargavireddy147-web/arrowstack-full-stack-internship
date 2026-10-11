'use strict';
/**
 * Project 2 server entry point.
 * Run:  PORT=4002 node server/index.js
 */
const { buildApp } = require('../../shared/lib/app');
const project = require('./project');

const PORT = process.env.PORT || 4002;
const { app } = buildApp(project);

if (require.main === module) {
  app.listen(PORT, () => console.log(`[${project.name}] listening on http://localhost:${PORT}`));
}

module.exports = { app, project };
