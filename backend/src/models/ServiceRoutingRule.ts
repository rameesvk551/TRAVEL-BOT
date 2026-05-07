const { DataTypes } = require('sequelize');

/**
 * ServiceRoutingRule maps a tenant service intent to the agent who owns it.
 * Example intent keys: visa, packages, properties, staycations.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const ServiceRoutingRule = sequelize.define('ServiceRoutingRule', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    intentKey: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    agentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'service_routing_rules',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'intent_key'] },
      { unique: true, fields: ['agency_id', 'intent_key', 'agent_id'] },
    ],
  });

  return ServiceRoutingRule;
};
