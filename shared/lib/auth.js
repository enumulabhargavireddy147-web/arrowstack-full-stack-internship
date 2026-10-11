'use strict';
/**
 * auth.js — JWT authentication, password hashing and role-based access control.
 * Shared by all three projects so security behaviour is consistent.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'arrowstack-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, account_id: user.account_id || null },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/** Express middleware: require a valid Bearer token. */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Express middleware factory: require one of the given roles. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    }
    return next();
  };
}

module.exports = {
  hashPassword, verifyPassword, signToken, authenticate, requireRole,
  JWT_SECRET, JWT_EXPIRES_IN,
};
