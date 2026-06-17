const { DataTypes } = require('sequelize');

/**
 * Partner — a white-label reseller that sits between the platform owner and
 * agencies. A partner resells the whole platform under its own brand; all
 * agencies with this partner_id inherit the partner's branding (logo, name,
 * colors, domain, email identity) instead of the default Wayon branding.
 */
module.exports = (sequelize) => {
  const Partner = sequelize.define('Partner', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // URL-safe identifier used for slug.app.<rootDomain>
    slug: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
    },
    customDomain: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    // ===== Branding (dashboard + login) =====
    brandName: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    logoUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    faviconUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    primaryColor: {
      type: DataTypes.STRING(7),
      allowNull: true,
      defaultValue: '#00A884',
    },
    accentColor: {
      type: DataTypes.STRING(7),
      allowNull: true,
    },
    loginTagline: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    loginImageUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    supportEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    supportUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },

    // ===== Email identity (transactional emails) =====
    emailFromName: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    emailReplyTo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    emailFooterText: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    // ===== Commercial / revenue-share =====
    billingModel: {
      type: DataTypes.ENUM('REV_SHARE', 'MARKUP', 'FLAT'),
      allowNull: false,
      defaultValue: 'REV_SHARE',
    },
    // Percentage the platform keeps (REV_SHARE) or partner markup (MARKUP).
    revenueSharePercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    // Flat fee per agency per billing period (FLAT / add-on).
    perAgencyFee: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'INR',
    },
    billingStatus: {
      type: DataTypes.ENUM('ACTIVE', 'PAST_DUE', 'SUSPENDED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },

    createdByAdminId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'partners',
    indexes: [
      { unique: true, fields: ['slug'] },
      { fields: ['is_active'] },
    ],
  });

  return Partner;
};
