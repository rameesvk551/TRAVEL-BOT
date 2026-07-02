const express = require('express');
const router = express.Router();
const vendorTypeController = require('../controllers/vendorTypeController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', vendorTypeController.listVendorTypes);
router.post('/', vendorTypeController.createVendorType);
router.put('/:id', vendorTypeController.updateVendorType);
router.delete('/:id', vendorTypeController.deleteVendorType);

module.exports = router;
