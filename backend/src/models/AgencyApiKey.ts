// FILE: /backend/src/models/AgencyApiKey.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * AgencyApiKey model — a publishable API key an agency drops into their own
 * website to read their public catalog and submit website leads.
 *
 * Security model:
 *  - The raw key is NEVER stored. Only `keyHash` (SHA-256 of the full key) is
 *    persisted; the raw value is shown to the agency exactly once at creation.
 *  - `keyId` is the public, non-secret lookup component embedded in the key
 *    (format: `pk_live_<keyId>_<secret>`). It is indexed for O(1) lookup.
 *  - `scopes` enforce least privilege: a key can only do what it was minted for.
 *  - `allowedOrigins` optionally locks a browser key to specific sites.
 *  - `isActive` / `revokedAt` give the agency an instant kill switch.
 *
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const AgencyApiKey = sequelize.define('AgencyApiKey', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(120),
      allowNull: true,
      comment: 'Human label e.g. "Production website" shown in the dashboard',
    },
    keyId: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
      comment: 'Public, non-secret lookup id embedded in the key (pk_live_<keyId>_<secret>)',
    },
    keyPrefix: {
      type: DataTypes.STRING(60),
      allowNull: false,
      comment: 'Masked display value shown in the dashboard e.g. pk_live_ab12cd34…',
    },
    keyHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: 'SHA-256 hex of the full raw key. The raw key itself is never stored.',
    },
    scopes: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: ['catalog:read', 'leads:write'],
      comment: "Least-privilege scopes e.g. ['catalog:read','leads:write']",
    },
    allowedOrigins: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Optional origin allowlist for browser use. Empty = any origin.',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastUsedIp: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    requestCount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    createdByAgentId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Agent who minted the key',
    },
  }, {
    tableName: 'agency_api_keys',
    indexes: [
      { fields: ['key_id'], unique: true },
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'is_active'] },
    ],
  });

  return AgencyApiKey;
};
