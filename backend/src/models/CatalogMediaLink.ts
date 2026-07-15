// FILE: /backend/src/models/CatalogMediaLink.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * CatalogMediaLink maps one Instagram post/reel to one catalog item (property, package,
 * service, visa or cruise) for a given agency. The mapping is authored on the catalog item's
 * form; storing it as a neutral join — rather than a column on each of five catalog models —
 * keeps a reel→item lookup a single indexed query and gives the WhatsApp handoff code a home
 * with a unique index.
 *
 * This decides WHAT a reel is about. It is orthogonal to InstagramAutomation, which decides
 * WHETHER to respond to a comment (keywords, dedupe, public reply). A reel with a link but no
 * matching rule does nothing; a rule with no linked reel behaves exactly as before.
 *
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const CatalogMediaLink = sequelize.define(
    'CatalogMediaLink',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      agencyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'agency_id',
      },
      mediaId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'media_id',
        comment: 'Instagram media/reel id (Meta numeric id).',
      },
      itemType: {
        type: DataTypes.ENUM('PACKAGE', 'PROPERTY', 'SERVICE', 'VISA', 'CRUISE'),
        allowNull: false,
        field: 'item_type',
      },
      itemId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'item_id',
      },
      code: {
        type: DataTypes.STRING(16),
        allowNull: false,
        comment: 'Short handoff code embedded in the wa.me prefilled text (e.g. 7K2Q9). '
          + 'Unique per agency so an inbound WhatsApp message can be resolved back to this reel.',
      },
      actionOverride: {
        type: DataTypes.ENUM('LEAD_FORM', 'WHATSAPP', 'DM_PDF'),
        allowNull: true,
        field: 'action_override',
        comment: "Per-reel override of the agency's default comment action. Null = inherit "
          + 'agency.instagramReelDefaultAction.',
      },
      formSlug: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'form_slug',
        comment: 'Which named lead form to send when the action resolves to LEAD_FORM. '
          + 'Null = the agency default form.',
      },
      permalink: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Cached IG permalink of the reel, for display in the CRM.',
      },
      thumbnailUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'thumbnail_url',
        comment: 'Cached IG thumbnail of the reel, for display in the CRM.',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      tableName: 'catalog_media_links',
      underscored: true,
      indexes: [
        // One reel maps to at most one item per agency; this is the resolver's hot path.
        { unique: true, fields: ['agency_id', 'media_id'] },
        // The WhatsApp handoff resolves an inbound code back to a reel; codes are unique per agency.
        { unique: true, fields: ['agency_id', 'code'] },
        // Listing "which reels are linked to this property" on the catalog form.
        { fields: ['agency_id', 'item_type', 'item_id'] },
      ],
    },
  );

  return CatalogMediaLink;
};
