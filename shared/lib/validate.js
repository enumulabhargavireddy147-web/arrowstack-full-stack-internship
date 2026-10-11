'use strict';
/**
 * validate.js — a tiny declarative validator so every endpoint rejects bad input
 * with a 400 and a machine-readable list of problems (validation & error handling).
 */
class ValidationError extends Error {
  constructor(problems) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.status = 400;
    this.problems = problems;
  }
}

/**
 * schema: { field: { type, required, min, max, enum, minLen, maxLen, integer, positive } }
 * returns a cleaned object (only declared fields), throws ValidationError otherwise.
 */
function validate(body, schema) {
  const problems = [];
  const out = {};
  const src = body && typeof body === 'object' ? body : {};

  for (const [field, rule] of Object.entries(schema)) {
    let value = src[field];

    if (value === undefined || value === null || value === '') {
      if (rule.required) problems.push({ field, message: 'is required' });
      else if (rule.default !== undefined) out[field] = rule.default;
      continue;
    }

    if (rule.type === 'number' || rule.integer) {
      const n = Number(value);
      if (Number.isNaN(n)) { problems.push({ field, message: 'must be a number' }); continue; }
      if (rule.integer && !Number.isInteger(n)) { problems.push({ field, message: 'must be an integer' }); continue; }
      if (rule.positive && n <= 0) { problems.push({ field, message: 'must be greater than 0' }); continue; }
      if (rule.min !== undefined && n < rule.min) { problems.push({ field, message: `must be >= ${rule.min}` }); continue; }
      if (rule.max !== undefined && n > rule.max) { problems.push({ field, message: `must be <= ${rule.max}` }); continue; }
      value = n;
    } else if (rule.type === 'boolean') {
      value = value === true || value === 'true';
    } else {
      value = String(value).trim();
      if (rule.minLen && value.length < rule.minLen) { problems.push({ field, message: `must be at least ${rule.minLen} characters` }); continue; }
      if (rule.maxLen && value.length > rule.maxLen) { problems.push({ field, message: `must be at most ${rule.maxLen} characters` }); continue; }
      if (rule.enum && !rule.enum.includes(value)) { problems.push({ field, message: `must be one of: ${rule.enum.join(', ')}` }); continue; }
      if (rule.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) { problems.push({ field, message: 'must be a valid email' }); continue; }
    }
    out[field] = value;
  }

  if (problems.length) throw new ValidationError(problems);
  return out;
}

module.exports = { validate, ValidationError };
