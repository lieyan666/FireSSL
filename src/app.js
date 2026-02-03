const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware, login, logout, checkAuth, validateToken } = require('./middleware/auth');
const routes = require('./routes');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-inline'"],
      'script-src-attr': ["'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", "data:"],
    },
  },
}));
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Auth routes (public)
app.post('/api/v1/auth/login', login);
app.post('/api/v1/auth/logout', logout);
app.get('/api/v1/auth/check', checkAuth);

// Protected API routes
app.use('/api/v1', authMiddleware, routes);

// Serve index.html for root and login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Error handling
app.use(errorHandler);

module.exports = app;
