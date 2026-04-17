// FILE: /backend/src/routes/reviews.ts
const { Router } = require('express');
const reviewController = require('../controllers/reviewController');
const authenticate = require('../middleware/authenticate');

const router = Router();

router.get('/', authenticate, reviewController.list);
router.get('/stats', authenticate, reviewController.stats);
router.post('/:id/toggle-published', authenticate, reviewController.togglePublished);

module.exports = router;
