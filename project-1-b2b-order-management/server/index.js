'use strict';
/**
 * Project 1 server entry point.
 * Run:  PORT=4001 node server/index.js
 */
const { buildApp } = require('../../shared/lib/app');
const project = require('./project');

const PORT = process.env.PORT || 4001;
const { app } = buildApp(project);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[${project.name}] listening on http://localhost:${PORT}`);
  });
}

module.exports = { app, project };
