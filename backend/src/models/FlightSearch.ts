// FILE: /backend/src/models/FlightSearch.ts
// DEPS: sequelize
// DESC: Stores flight search queries and results for caching and tracking

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FlightSearch = sequelize.define('FlightSearch', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Flight provider used for this search',
    },
    searchRef: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
      comment: 'Human-readable search reference (e.g., FS-20260517-001)',
    },
    origin: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'IATA code of departure airport',
    },
    destination: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'IATA code of arrival airport',
    },
    departureDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    returnDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Null for one-way flights',
    },
    tripType: {
      type: DataTypes.ENUM('ONE_WAY', 'ROUND_TRIP', 'MULTI_CITY'),
      defaultValue: 'ONE_WAY',
    },
    adults: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    children: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    infants: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    cabinClass: {
      type: DataTypes.ENUM('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'),
      defaultValue: 'ECONOMY',
    },
    preferredAirlines: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'List of preferred airline IATA codes',
    },
    searchParams: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Additional search parameters passed to provider',
    },
    results: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Cached flight search results',
    },
    resultCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('SEARCHING', 'COMPLETED', 'FAILED', 'EXPIRED'),
      defaultValue: 'SEARCHING',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the cached results expire',
    },
    selectedFlightId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'ID of the flight selected by customer for booking',
    },
  }, {
    tableName: 'flight_searches',
    indexes: [
      { fields: ['agency_id', 'customer_id'] },
      { fields: ['search_ref'], unique: true },
      { fields: ['agency_id', 'status'] },
      { fields: ['expires_at'] },
    ],
  });

  return FlightSearch;
};
