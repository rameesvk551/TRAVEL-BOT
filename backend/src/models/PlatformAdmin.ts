const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlatformAdmin = sequelize.define('PlatformAdmin', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('OWNER', 'SUPPORT'),
      allowNull: false,
      defaultValue: 'OWNER',
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'platform_admins',
    indexes: [
      { unique: true, fields: ['email'] },
      { fields: ['is_active'] },
    ],
  });

  return PlatformAdmin;
};
