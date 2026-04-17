const { DEFAULT_AGENT_PERMISSIONS, normalizePermissions } = require('../constants/permissions');

function getEffectivePermissions(agent) {
  if (!agent) return [];
  if (agent.role === 'ADMIN') return ['*'];

  const assigned = normalizePermissions(agent.permissions, DEFAULT_AGENT_PERMISSIONS);
  return assigned;
}

function requirePermission(...requiredPermissions) {
  const required = normalizePermissions(requiredPermissions, []);

  return (req, res, next) => {
    if (!req.agent) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED',
      });
    }

    if (req.agent.role === 'ADMIN') {
      return next();
    }

    const currentPermissions = getEffectivePermissions(req.agent);
    const hasAccess = required.some((permission) => currentPermissions.includes(permission));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to perform this action.',
        code: 'FORBIDDEN_PERMISSION',
        requiredPermissions: required,
      });
    }

    return next();
  };
}

module.exports = requirePermission;
