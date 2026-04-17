// FILE: /backend/src/routes/referrals.ts
const { Router } = require('express');
const referralController = require('../controllers/referralController');
const authenticate = require('../middleware/authenticate');

const router = Router();

router.get('/', authenticate, referralController.list);
router.post('/', authenticate, referralController.create);
router.get('/stats', authenticate, referralController.stats);
router.post('/:id/toggle', authenticate, referralController.toggle);

module.exports = router;
