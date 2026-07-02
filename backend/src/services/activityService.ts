const { ActivityLog } = require('../models');

/**
 * Record a tenant-scoped activity/audit event.
 *
 * Best-effort: never throws. A logging failure must not break the real
 * request, so errors are swallowed with a warning (same contract as
 * platformAuditService.logPlatformAction).
 *
 * @param {object} req    Express request (for actor + IP/user-agent).
 * @param {object} entry
 * @param {string} entry.action      Machine key, e.g. 'lead.created'.
 * @param {string} entry.module      Filter group, e.g. 'leads'.
 * @param {string} [entry.targetType]
 * @param {string} [entry.targetId]
 * @param {string} [entry.summary]   Human-readable one-liner.
 * @param {object} [entry.metadata]
 */
async function logActivity(req, entry = {}) {
  try {
    const agencyId = req?.agency?.id || req?.user?.agencyId || entry.agencyId;
    if (!agencyId || !entry.action || !entry.module) {
      return;
    }

    const actor = req?.agent || null;
    const actorName = actor
      ? (actor.name || actor.fullName || actor.email || null)
      : (entry.actorName || null);

    await ActivityLog.create({
      agencyId,
      actorId: actor?.id || entry.actorId || null,
      actorName,
      action: entry.action,
      module: entry.module,
      targetType: entry.targetType || null,
      targetId: entry.targetId || null,
      summary: entry.summary ? String(entry.summary).slice(0, 300) : null,
      metadata: entry.metadata || {},
      ipAddress: req?.ip || null,
      userAgent: req?.headers?.['user-agent']
        ? String(req.headers['user-agent']).slice(0, 500)
        : null,
    });
  } catch (err) {
    console.warn('[ActivityLog] Failed to write activity log:', err.message);
  }
}

module.exports = {
  logActivity,
};
