const { validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
    }));
    throw new ValidationError('Invalid input', details);
  }
  next();
}

module.exports = {
  validate,
};
