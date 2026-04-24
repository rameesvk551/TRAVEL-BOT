const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const flowController = require('../controllers/flowController');

const router = Router();

router.use(authenticate);

router.get('/', flowController.list);
router.post('/', flowController.create);
router.post('/sync', flowController.sync);
router.get('/:id', flowController.getById);
router.patch('/:id', flowController.update);
router.delete('/:id', flowController.remove);
router.post('/:id/publish', flowController.publish);

module.exports = router;
