const crypto = require('crypto');
const config = require('../config');

// Store active tokens in memory (simple approach for single-instance)
const tokens = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createToken() {
  const token = generateToken();
  tokens.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + config.auth.tokenExpiry,
  });
  return token;
}

function validateToken(token) {
  if (!token) return false;
  const data = tokens.get(token);
  if (!data) return false;
  if (Date.now() > data.expiresAt) {
    tokens.delete(token);
    return false;
  }
  return true;
}

function revokeToken(token) {
  tokens.delete(token);
}

// Middleware to check authentication
function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (validateToken(token)) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized', message: 'Please login to continue' });
}

// Login handler
function login(req, res) {
  const { password } = req.body;
  if (password === config.auth.password) {
    const token = createToken();
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid password' });
  }
}

// Logout handler
function logout(req, res) {
  const token = req.headers['x-auth-token'];
  if (token) {
    revokeToken(token);
  }
  res.json({ success: true });
}

// Check auth status
function checkAuth(req, res) {
  const token = req.headers['x-auth-token'];
  res.json({ authenticated: validateToken(token) });
}

module.exports = {
  authMiddleware,
  login,
  logout,
  checkAuth,
  validateToken,
};
