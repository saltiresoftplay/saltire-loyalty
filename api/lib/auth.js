'use strict';
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const SECRET  = process.env.JWT_SECRET;
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';
const ROUNDS  = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

// Express middleware — reads JWT from httpOnly cookie or Authorization header
function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.saltire_token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);

    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    req.member = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = { hashPassword, verifyPassword, signToken, requireAuth };
