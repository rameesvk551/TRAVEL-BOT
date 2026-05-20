// FILE: /backend/src/models/FlightProvider.ts
// DEPS: sequelize
// DESC: Flight provider configuration per agency (e.g., Amadeus, Travelport, Sabre, custom API)

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FlightProvider = sequelize.define('FlightProvider', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'The travel agency that owns this provider config',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Display name of the provider (e.g., Amadeus, MakeMyTrip, Custom)',
    },
    providerType: {
      type: DataTypes.ENUM('AMADEUS', 'TRAVELPORT', 'SABRE', 'KIU', 'CUSTOM_API', 'MOCK'),
      allowNull: false,
      defaultValue: 'CUSTOM_API',
      comment: 'Type of flight provider/GDS integration',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this provider is active and available for searches',
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this is the default provider for the agency',
    },
    baseUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Base API URL for the flight provider',
    },
    apiKey: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'API key or client ID (encrypted at rest)',
    },
    apiSecret: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'API secret or client secret (encrypted at rest)',
    },
    authToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'OAuth token or session token (encrypted at rest)',
    },
    authTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the auth token expires',
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Provider-specific configuration (e.g., officeId, PCC, endpoints)',
    },
    markupConfig: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Markup rules: { type: "fixed"|"percentage", amount: 500, minMarkup: 200 }',
    },
    searchConfig: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Search preferences: { maxResults: 20, preferredAirlines: [], cabinClass: "ECONOMY" }',
    },
    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last successful sync or health check timestamp',
    },
    syncStatus: {
      type: DataTypes.ENUM('PENDING', 'ACTIVE', 'FAILED', 'DISABLED'),
      defaultValue: 'PENDING',
      comment: 'Current connection/sync status',
    },
    syncError: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Last sync or connection error message',
    },
  }, {
    tableName: 'flight_providers',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'is_default'] },
      { fields: ['agency_id', 'provider_type'] },
    ],
  });

  return FlightProvider;
};
