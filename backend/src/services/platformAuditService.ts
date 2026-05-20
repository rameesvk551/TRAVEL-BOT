const { PlatformAuditLog } = require('../models');

async function logPlatformAction(adminId, action, options = {}) {
  try {
    await PlatformAuditLog.create({
      adminId: adminId || null,
      action,
      targetType: options.targetType || null,
      targetId: options.targetId || null,
      metadata: options.metadata || {},
      ipAddress: options.req?.ip || null,
      userAgent: options.req?.headers?.['user-agent'] || null,
    });
  } catch (err) {
    console.warn('[PlatformAudit] Failed to write audit log:', err.message);
  }
}

module.exports = {
  logPlatformAction,
};
