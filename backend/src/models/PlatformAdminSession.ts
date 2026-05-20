const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlatformAdminSession = sequelize.define('PlatformAdminSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'Hashed platform refresh token',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'platform_admin_sessions',
    indexes: [
      { fields: ['token'] },
      { fields: ['admin_id'] },
    ],
  });

  return PlatformAdminSession;
};
