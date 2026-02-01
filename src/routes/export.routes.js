const express = require('express');
const { query } = require('express-validator');
const router = express.Router();
const exportController = require('../controllers/export.controller');
const { validate } = require('../middleware/validator');

// Routes
router.get('/:id/pem', exportController.exportPem);
router.get('/:id/der', exportController.exportDer);
router.get(
  '/:id/p12',
  [
    query('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  validate,
  exportController.exportP12
);
router.get('/:id/chain', exportController.exportChain);

module.exports = router;
