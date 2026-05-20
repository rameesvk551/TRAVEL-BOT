const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlatformAuditLog = sequelize.define('PlatformAuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(120),
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
    tableName: 'platform_audit_logs',
    updatedAt: false,
    indexes: [
      { fields: ['admin_id'] },
      { fields: ['action'] },
      { fields: ['target_type', 'target_id'] },
      { fields: ['created_at'] },
    ],
  });

  return PlatformAuditLog;
};
