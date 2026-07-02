const vendorService = require('../services/vendorService');
const accountingService = require('../services/accountingService');

async function listVendors(req, res) {
  try {
    const { type, isActive } = req.query;
    const filters = { type };
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }
    
    const vendors = await vendorService.listVendors(req.agency.id, filters);
    
    // Fetch ledger balances for these vendors
    const vendorIdsWithLedgers = vendors.filter(v => v.ledgerId).map(v => v.ledgerId);
    
    // Actually, getLedgerReport or trial balance might be better, but we can just return the vendors.
    // For a quick balance, we can iterate or fetch a report.
    // To keep it performant, we might skip balances here or fetch in a single query if needed.
    // For now, let's just return the vendors.
    res.json(vendors);
  } catch (error) {
    console.error('[VendorsController.listVendors]', error);
    res.status(500).json({ error: 'Failed to list vendors' });
  }
}

async function createVendor(req, res) {
  try {
    const vendor = await vendorService.createVendor(req.agency.id, req.body);
    res.status(201).json(vendor);
  } catch (error) {
    console.error('[VendorsController.createVendor]', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create vendor' });
  }
}

async function getVendor(req, res) {
  try {
    const vendor = await vendorService.getVendor(req.agency.id, req.params.id);
    res.json(vendor);
  } catch (error) {
    console.error('[VendorsController.getVendor]', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to get vendor' });
  }
}

async function updateVendor(req, res) {
  try {
    const vendor = await vendorService.updateVendor(req.agency.id, req.params.id, req.body);
    res.json(vendor);
  } catch (error) {
    console.error('[VendorsController.updateVendor]', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update vendor' });
  }
}

async function listVendorPayments(req, res) {
  try {
    const payments = await vendorService.listVendorPayments(req.agency.id, req.params.id);
    res.json(payments);
  } catch (error) {
    console.error('[VendorsController.listVendorPayments]', error);
    res.status(500).json({ error: 'Failed to list vendor payments' });
  }
}

async function listVendorBills(req, res) {
  try {
    const bills = await vendorService.listVendorBills(req.agency.id, req.params.id, {
      status: req.query.status,
      outstandingOnly: req.query.outstandingOnly === 'true',
    });
    res.json(bills);
  } catch (error) {
    console.error('[VendorsController.listVendorBills]', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to list vendor bills' });
  }
}

async function createVendorPayment(req, res) {
  try {
    const payment = await vendorService.createVendorPayment(req.agency.id, req.params.id, req.body, req.agent?.id);
    res.status(201).json(payment);
  } catch (error) {
    console.error('[VendorsController.createVendorPayment]', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create vendor payment' });
  }
}

async function createVendorBill(req, res) {
  try {
    const result = await vendorService.createVendorBill(req.agency.id, req.params.id, req.body, req.agent?.id);
    res.status(201).json(result);
  } catch (error) {
    console.error('[VendorsController.createVendorBill]', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create vendor bill' });
  }
}

async function listAllVendorPayments(req, res) {
  try {
    const filters = {
      vendorId: req.query.vendorId,
      vendorType: req.query.vendorType,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      paymentMode: req.query.paymentMode,
      itemType: req.query.itemType
    };
    const payments = await vendorService.listAllVendorPayments(req.agency.id, filters);
    res.json(payments);
  } catch (error) {
    console.error('[VendorsController.listAllVendorPayments]', error);
    res.status(500).json({ error: 'Failed to list all vendor payments' });
  }
}

async function listAllVendorBills(req, res) {
  try {
    const filters = {
      vendorId: req.query.vendorId,
      vendorType: req.query.vendorType,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      outstandingOnly: req.query.outstandingOnly === 'true',
      itemType: req.query.itemType
    };
    const bills = await vendorService.listAllVendorBills(req.agency.id, filters);
    res.json(bills);
  } catch (error) {
    console.error('[VendorsController.listAllVendorBills]', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to list all vendor bills' });
  }
}

async function getVendorLedgerBalance(req, res) {
  try {
    const vendor = await vendorService.getVendor(req.agency.id, req.params.id);
    if (!vendor.ledgerId) {
      return res.json({ balance: 0 });
    }
    const balanceInfo = await accountingService.getLedgerBalance(req.agency.id, vendor.ledgerId);
    res.json(balanceInfo);
  } catch (error) {
    console.error('[VendorsController.getVendorLedgerBalance]', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to get ledger balance' });
  }
}

module.exports = {
  listVendors,
  createVendor,
  getVendor,
  updateVendor,
  createVendorBill,
  listVendorBills,
  listVendorPayments,
  createVendorPayment,
  getVendorLedgerBalance,
  listAllVendorBills,
  listAllVendorPayments,
};
