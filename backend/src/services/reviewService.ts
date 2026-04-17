// FILE: /backend/src/services/reviewService.ts

const { Op, fn, col } = require('sequelize');
const { Review, Customer, Booking } = require('../models');

async function saveReview(data) {
  const { agencyId, customerId, bookingId, rating, testimonial, destination } = data;

  const existing = await Review.findOne({ where: { agencyId, customerId, bookingId } });
  if (existing) {
    return existing.update({ rating, testimonial, destination });
  }

  return Review.create({
    agencyId,
    customerId,
    bookingId,
    rating,
    testimonial,
    destination,
  });
}

async function listReviews(agencyId, { rating, isPublished, page = 1, pageSize = 20 } = {}) {
  const where = { agencyId };
  if (rating) where.rating = rating;
  if (typeof isPublished === 'boolean') where.isPublished = isPublished;

  const { count, rows } = await Review.findAndCountAll({
    where,
    include: [
      { model: Customer, as: 'customer', attributes: ['name', 'phone'] },
      { model: Booking, as: 'booking', attributes: ['bookingRef', 'travelDate'] },
    ],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return { total: count, data: rows, page, pageSize };
}

async function togglePublished(id, agencyId) {
  const review = await Review.findOne({ where: { id, agencyId } });
  if (!review) throw new Error('Review not found');
  return review.update({ isPublished: !review.isPublished });
}

async function getReviewStats(agencyId) {
  const totalReviews = await Review.count({ where: { agencyId } });
  const publishedCount = await Review.count({ where: { agencyId, isPublished: true } });

  const avgResult = await Review.findOne({
    where: { agencyId },
    attributes: [[fn('AVG', col('rating')), 'avgRating']],
    raw: true,
  });
  const avgRating = parseFloat(avgResult?.avgRating || 0).toFixed(1);

  const distribution = await Review.findAll({
    where: { agencyId },
    attributes: ['rating', [fn('COUNT', col('id')), 'count']],
    group: ['rating'],
    raw: true,
  });

  return { totalReviews, publishedCount, avgRating: parseFloat(avgRating), distribution };
}

module.exports = { saveReview, listReviews, togglePublished, getReviewStats };
