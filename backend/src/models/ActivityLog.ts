const { DataTypes } = require('sequelize');

/**
 * Tenant-scoped activity / audit log.
 *
 * Records "who did what" for key business events inside an agency
 * (leads, bookings, payments, accounting, customers, ...). This is the
 * per-agency counterpart to PlatformAuditLog (which tracks super-admin
 * platform actions). Append-only: rows are never updated.
 */
module.exports = (sequelize) => {
  const ActivityLog = sequelize.define('ActivityLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    // The agent who performed the action. Nullable for system/bot actions.
    actorId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    // Snapshot of the actor's name at the time of the action, so the log
    // survives agent renames/deletions.
    actorName: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    // Machine key, e.g. 'lead.created', 'booking.status_changed'.
    action: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    // Coarse grouping for filtering: 'leads', 'bookings', 'accounts', ...
    module: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    targetType: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    targetId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    // Human-readable one-line description shown in the report.
    summary: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    ipAddress: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  }, {
    tableName: 'activity_logs',
    updatedAt: false,
    indexes: [
      { fields: ['agency_id', 'created_at'] },
      { fields: ['agency_id', 'actor_id'] },
      { fields: ['agency_id', 'module'] },
      { fields: ['target_type', 'target_id'] },
    ],
  });

  return ActivityLog;
};
