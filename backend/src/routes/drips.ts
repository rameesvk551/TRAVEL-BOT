// FILE: /backend/src/routes/drips.ts
const { Router } = require('express');
const dripController = require('../controllers/dripController');
const authenticate = require('../middleware/authenticate');

const router = Router();

router.get('/', authenticate, dripController.list);
router.post('/', authenticate, dripController.create);
router.get('/:id', authenticate, dripController.getById);
router.patch('/:id', authenticate, dripController.update);
router.post('/:id/toggle', authenticate, dripController.toggle);
router.post('/:id/enroll', authenticate, dripController.enroll);
router.patch('/enrollment/:enrollmentId', authenticate, dripController.updateEnrollment);

module.exports = router;
