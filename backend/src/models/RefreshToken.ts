// FILE: /backend/src/models/RefreshToken.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * RefreshToken model — stores hashed refresh tokens for JWT rotation.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'Hashed refresh token',
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
    tableName: 'refresh_tokens',
    indexes: [
      { fields: ['token'] },
      { fields: ['agent_id'] },
    ],
  });

  return RefreshToken;
};
