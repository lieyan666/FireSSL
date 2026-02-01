const express = require('express');
const router = express.Router();

const caRoutes = require('./ca.routes');
const certRoutes = require('./cert.routes');
const exportRoutes = require('./export.routes');

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
router.use('/ca', caRoutes);
router.use('/certs', certRoutes);
router.use('/export', exportRoutes);

module.exports = router;
