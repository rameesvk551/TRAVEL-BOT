const express = require('express');
const router = express.Router();
const vendorsController = require('../controllers/vendorsController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', vendorsController.listVendors);
router.post('/', vendorsController.createVendor);

router.get('/payments/all', vendorsController.listAllVendorPayments);
router.get('/bills/all', vendorsController.listAllVendorBills);

router.get('/:id', vendorsController.getVendor);
router.put('/:id', vendorsController.updateVendor);
router.get('/:id/balance', vendorsController.getVendorLedgerBalance);

router.post('/:id/bills', vendorsController.createVendorBill);
router.get('/:id/bills', vendorsController.listVendorBills);
router.get('/:id/payments', vendorsController.listVendorPayments);
router.post('/:id/payments', vendorsController.createVendorPayment);

module.exports = router;
