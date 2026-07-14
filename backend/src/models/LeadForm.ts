// FILE: /backend/src/models/LeadForm.ts
// DEPS: sequelize
//
// A named, agency-owned public lead-capture form. An agency can have many forms
// (e.g. "Villa enquiry", "Package enquiry"), each with its own slug, fields and
// copy, reachable at /lead/:agencyKey/:slug. Exactly one row per agency is the
// isDefault form, served at the bare /lead/:agencyKey (keeps old bio links working).
// `fields` uses the SAME shape as the legacy agency.leadFormConfig.fields, so the
// existing renderer / validator (leadFormConfig.ts) is reused unchanged.

const { DataTypes } = require('sequelize');

/**
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const LeadForm = sequelize.define('LeadForm', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      comment: 'Agency-facing label, e.g. "Villa enquiry"',
    },
    slug: {
      type: DataTypes.STRING(80),
      allowNull: false,
      comment: 'URL segment, unique per agency → /lead/:agencyKey/:slug',
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Gates the public page (same meaning as the legacy single toggle)',
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'The form served at the bare /lead/:agencyKey',
    },
    title: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(600),
      allowNull: true,
    },
    successMessage: {
      type: DataTypes.STRING(400),
      allowNull: true,
    },
    submitLabel: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    fields: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Field config, same shape as leadFormConfig.fields: [{ id, label, type, placeholder, required, mapsTo, options }]',
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'lead_forms',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'slug'], unique: true },
      { fields: ['agency_id', 'is_default'] },
    ],
  });

  return LeadForm;
};
