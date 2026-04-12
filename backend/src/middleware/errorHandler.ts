// FILE: /backend/src/middleware/errorHandler.js
// DEPS: none

/**
 * Global error handler middleware.
 * Catches all unhandled errors and returns a consistent error response.
 * Must be registered LAST in the Express middleware chain.
 */
function errorHandler(err, req, res, _next) {
  console.error(`[ErrorHandler] ${req.method} ${req.path}:`, err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Database validation failed',
      code: 'DB_VALIDATION_ERROR',
      details: err.errors?.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  // Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      error: 'A record with this value already exists',
      code: 'DUPLICATE_ENTRY',
      details: err.errors?.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  // JSON parse errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    });
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Image file too large. Max size is 5MB.',
        code: 'FILE_TOO_LARGE',
      });
    }

    return res.status(400).json({
      success: false,
      error: err.message || 'Invalid file upload',
      code: 'UPLOAD_ERROR',
    });
  }

  // Default 500 error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Internal server error' : err.message,
    code: err.code || 'INTERNAL_ERROR',
  });
}

module.exports = errorHandler;
