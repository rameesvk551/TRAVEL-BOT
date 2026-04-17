// FILE: /backend/src/models/Review.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Review — post-trip customer reviews with rating and testimonial.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Review = sequelize.define('Review', {
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
    bookingId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },
    testimonial: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    destination: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Approved for marketing use',
    },
    googleReviewSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether we sent the Google Review prompt',
    },
  }, {
    tableName: 'reviews',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['customer_id'] },
      { fields: ['agency_id', 'is_published'] },
      { fields: ['rating'] },
    ],
  });

  return Review;
};
