// FILE: /backend/src/middleware/requireRole.js
// DEPS: none

/**
 * Role-based access control middleware factory.
 * Usage: requireRole('ADMIN') or requireRole('ADMIN', 'AGENT')
 * @param {...string} roles - Allowed roles
 * @returns {Function} Express middleware
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.agent) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!roles.includes(req.agent.role)) {
      return res.status(403).json({
        success: false,
        error: `This action requires one of these roles: ${roles.join(', ')}`,
        code: 'FORBIDDEN_ROLE',
      });
    }

    next();
  };
}

module.exports = requireRole;
