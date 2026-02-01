const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const caController = require('../controllers/ca.controller');
const { validate } = require('../middleware/validator');

// Validation rules
const caValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('commonName').trim().notEmpty().withMessage('Common name is required'),
  body('keyAlgorithm')
    .optional()
    .isIn(['RSA-2048', 'RSA-4096', 'EC-P256', 'EC-P384', 'EC-P521'])
    .withMessage('Invalid key algorithm'),
  body('validityDays')
    .optional()
    .isInt({ min: 1, max: 36500 })
    .withMessage('Validity days must be between 1 and 36500'),
  body('organization').optional().trim(),
  body('country').optional().trim().isLength({ max: 2 }).withMessage('Country must be 2 characters'),
];

const intermediateValidation = [
  ...caValidation,
  body('parentId').notEmpty().withMessage('Parent CA ID is required'),
];

// Routes
router.post('/root', caValidation, validate, caController.createRoot);
router.post('/intermediate', intermediateValidation, validate, caController.createIntermediate);
router.get('/', caController.list);
router.get('/:id', caController.getById);
router.get('/:id/chain', caController.getChain);
router.delete('/:id', caController.delete);

module.exports = router;
