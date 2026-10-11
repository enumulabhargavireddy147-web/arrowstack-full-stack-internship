'use strict';
/**
 * http.js — consistent JSON error handling for every Express app.
 */
const { ValidationError } = require('./validate');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wrap an async route so thrown errors reach the error handler. */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.path });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: 'Validation failed', problems: err.problems });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ error: err.message || 'Internal server error' });
}

module.exports = { HttpError, wrap, notFound, errorHandler };
