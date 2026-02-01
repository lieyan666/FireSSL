const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const certController = require('../controllers/cert.controller');
const { validate } = require('../middleware/validator');

// Validation rules
const certValidation = [
  body('caId').notEmpty().withMessage('CA ID is required'),
  body('commonName').trim().notEmpty().withMessage('Common name is required'),
  body('keyAlgorithm')
    .optional()
    .isIn(['RSA-2048', 'RSA-4096', 'EC-P256', 'EC-P384', 'EC-P521'])
    .withMessage('Invalid key algorithm'),
  body('validityDays')
    .optional()
    .isInt({ min: 1, max: 3650 })
    .withMessage('Validity days must be between 1 and 3650'),
  body('organization').optional().trim(),
  body('sanDns')
    .optional()
    .isArray()
    .withMessage('SAN DNS must be an array'),
  body('sanDns.*')
    .optional()
    .trim()
    .notEmpty(),
  body('sanIps')
    .optional()
    .isArray()
    .withMessage('SAN IPs must be an array'),
  body('sanIps.*')
    .optional()
    .trim()
    .isIP()
    .withMessage('Invalid IP address'),
];

// Routes
router.post('/server', certValidation, validate, certController.createServer);
router.post('/client', certValidation, validate, certController.createClient);
router.get('/', certController.list);
router.get('/:id', certController.getById);
router.post('/:id/revoke', certController.revoke);
router.delete('/:id', certController.delete);

module.exports = router;
