// FILE: /backend/src/controllers/reviewController.ts

const reviewService = require('../services/reviewService');

exports.list = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;
    const isPublished = req.query.isPublished !== undefined ? req.query.isPublished === 'true' : undefined;
    const rating = req.query.rating ? parseInt(req.query.rating, 10) : undefined;
    
    const result = await reviewService.listReviews(req.user.agencyId, { page, pageSize, isPublished, rating });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.stats = async (req, res, next) => {
  try {
    const stats = await reviewService.getReviewStats(req.user.agencyId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

exports.togglePublished = async (req, res, next) => {
  try {
    const review = await reviewService.togglePublished(req.params.id, req.user.agencyId);
    res.json({ success: true, data: review });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
