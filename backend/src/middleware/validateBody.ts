// FILE: /backend/src/middleware/validateBody.js
// DEPS: zod

/**
 * Zod schema validation middleware factory.
 * Validates req.body against the provided Zod schema.
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against
 * @returns {Function} Express middleware
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
    }

    // Replace body with parsed/transformed data
    req.body = result.data;
    next();
  };
}

module.exports = validateBody;
