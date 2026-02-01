const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Validation errors
  if (err.name === 'ValidationError' || err.type === 'validation') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details || undefined,
    });
  }

  // Not found errors
  if (err.name === 'NotFoundError' || err.type === 'not_found') {
    return res.status(404).json({
      error: 'Not Found',
      message: err.message,
    });
  }

  // Conflict errors
  if (err.name === 'ConflictError' || err.type === 'conflict') {
    return res.status(409).json({
      error: 'Conflict',
      message: err.message,
    });
  }

  // Default to 500 Internal Server Error
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
}

class AppError extends Error {
  constructor(type, message, details = null) {
    super(message);
    this.type = type;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super('validation', message, details);
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super('not_found', message);
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super('conflict', message);
  }
}

module.exports = {
  errorHandler,
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
};
