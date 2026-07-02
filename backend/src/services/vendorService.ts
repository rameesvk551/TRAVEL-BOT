const { Vendor, VendorBill, VendorPayment, VendorType, AccountingLedger, AccountingPaymentMethod, Package, Property, Cruise, Visa, Service, sequelize } = require('../models');
const accountingService = require('./accountingService');

const VENDOR_ITEM_TYPES = ['PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM'];

function normalizeVendorItem(payload = {}) {
  const itemType = payload.itemType ? String(payload.itemType).toUpperCase() : null;
  if (!itemType || !VENDOR_ITEM_TYPES.includes(itemType)) return { itemType: null };
  return {
    itemType,
    packageId: itemType === 'PACKAGE' ? payload.packageId || null : null,
    propertyId: itemType === 'PROPERTY' ? payload.propertyId || null : null,
    cruiseId: itemType === 'CRUISE' ? payload.cruiseId || null : null,
    visaId: itemType === 'VISA' ? payload.visaId || null : null,
    serviceId: itemType === 'SERVICE' ? payload.serviceId || null : null,
    customItemName: itemType === 'CUSTOM' ? payload.customItemName || null : null,
    customItemDescription: itemType === 'CUSTOM' ? payload.customItemDescription || null : null,
  };
}

async function validateVendorItem(agencyId, item, transaction) {
  if (!item.itemType || item.itemType === 'CUSTOM') {
    if (item.itemType === 'CUSTOM' && !item.customItemName) {
      throw Object.assign(new Error('Custom item name is required'), { statusCode: 400 });
    }
    return;
  }
  const modelByType = { PACKAGE: Package, PROPERTY: Property, CRUISE: Cruise, VISA: Visa, SERVICE: Service };
  const idByType = {
    PACKAGE: item.packageId,
    PROPERTY: item.propertyId,
    CRUISE: item.cruiseId,
    VISA: item.visaId,
    SERVICE: item.serviceId,
  };
  // A category may be chosen without pinning a specific catalog item — the payment is
  // simply not linked to a package/property/etc. Only validate the id when one is provided.
  if (!idByType[item.itemType]) {
    return;
  }
  const record = await modelByType[item.itemType].findOne({
    where: { id: idByType[item.itemType], agencyId },
    transaction,
  });
  if (!record) {
    throw Object.assign(new Error(`${item.itemType.toLowerCase()} not found`), { statusCode: 404 });
  }
}

function vendorPaymentIncludes() {
  return [
    { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'type', 'email', 'phone'] },
    { model: VendorBill, as: 'bill', attributes: ['id', 'amount', 'paidAmount', 'billDate', 'dueDate', 'status', 'referenceNumber', 'description'] },
    { model: Package, as: 'package', attributes: ['id', 'name'] },
    { model: Property, as: 'property', attributes: ['id', 'name', 'propertyType', 'location'] },
    { model: Cruise, as: 'cruise', attributes: ['id', 'name'] },
    { model: Visa, as: 'visa', attributes: ['id', 'country', 'visaType'] },
    { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
    { model: AccountingPaymentMethod, as: 'paymentMethod', attributes: ['id', 'name', 'methodType', 'ledgerId'] },
  ];
}

function vendorBillIncludes() {
  return [
    { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'type', 'email', 'phone'] },
    { model: Package, as: 'package', attributes: ['id', 'name'] },
    { model: Property, as: 'property', attributes: ['id', 'name', 'propertyType', 'location'] },
    { model: Cruise, as: 'cruise', attributes: ['id', 'name'] },
    { model: Visa, as: 'visa', attributes: ['id', 'country', 'visaType'] },
    { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
  ];
}

function billStatus(amount, paidAmount) {
  const total = Math.max(0, parseInt(amount || 0, 10));
  const paid = Math.max(0, parseInt(paidAmount || 0, 10));
  if (total > 0 && paid >= total) return 'PAID';
  if (paid > 0) return 'PARTIALLY_PAID';
  return 'ISSUED';
}

function itemPayloadFromBill(bill) {
  if (!bill?.itemType) return { itemType: null };
  return {
    itemType: bill.itemType,
    packageId: bill.itemType === 'PACKAGE' ? bill.packageId || null : null,
    propertyId: bill.itemType === 'PROPERTY' ? bill.propertyId || null : null,
    cruiseId: bill.itemType === 'CRUISE' ? bill.cruiseId || null : null,
    visaId: bill.itemType === 'VISA' ? bill.visaId || null : null,
    serviceId: bill.itemType === 'SERVICE' ? bill.serviceId || null : null,
    customItemName: bill.itemType === 'CUSTOM' ? bill.customItemName || null : null,
    customItemDescription: bill.itemType === 'CUSTOM' ? bill.customItemDescription || null : null,
  };
}

async function getVendorBill(agencyId, vendorId, billId, transaction = null) {
  if (!billId) return null;
  const bill = await VendorBill.findOne({
    where: { id: billId, agencyId, vendorId },
    transaction,
  });
  if (!bill) {
    throw Object.assign(new Error('Vendor bill not found'), { statusCode: 404 });
  }
  if (bill.status === 'VOID') {
    throw Object.assign(new Error('Cannot pay a void vendor bill'), { statusCode: 400 });
  }
  return bill;
}

async function getOrCreateVendorGroupLedger(agencyId, vendorType, transaction) {
  // MVP accounts use one vendor payable group. Vendor types remain user data,
  // but they no longer create separate accounting groups.
  const { Op } = require('sequelize');
  const legacyVendorTypeRecord = await VendorType.findOne({
    where: {
      agencyId,
      name: { [Op.iLike]: vendorType },
    },
    transaction,
  });

  if (legacyVendorTypeRecord && legacyVendorTypeRecord.ledgerGroupId) {
    const ledger = await AccountingLedger.findOne({
      where: { id: legacyVendorTypeRecord.ledgerGroupId, agencyId },
      transaction,
    });
    if (ledger) return ledger;
  }

  const groupName = 'Vendors';
  const ledgers = await accountingService.listLedgers(agencyId, { type: 'LIABILITY', isGroup: true });
  let groupLedger = ledgers.find(l => l.name === groupName);

  if (!groupLedger) {
    const parentLedger = await accountingService.getLedgerByCode(agencyId, 'G2200', transaction);
    
    groupLedger = await accountingService.createLedger(agencyId, {
      name: groupName,
      type: 'LIABILITY',
      parentId: parentLedger.id,
      isGroup: true,
      financialStatement: 'BALANCE_SHEET'
    }, transaction);
  }
  return groupLedger;
}


async function createVendor(agencyId, payload) {
  // Start a transaction for vendor creation
  const transaction = await sequelize.transaction();
  try {
    const type = payload.type || 'OTHER';
    const name = payload.name;

    // 1. Get or create group ledger for this vendor type
    const groupLedger = await getOrCreateVendorGroupLedger(agencyId, type, transaction);

    // 2. Create ledger for the specific vendor under the group
    const vendorLedger = await accountingService.createLedger(agencyId, {
      name: `Vendor - ${name}`,
      type: 'LIABILITY',
      parentId: groupLedger.id,
      isGroup: false,
      financialStatement: 'BALANCE_SHEET',
      gstin: payload.gstin || null,
    }, transaction);

    // 3. Create the Vendor record
    const vendor = await Vendor.create({
      agencyId,
      name,
      type,
      email: payload.email || null,
      phone: payload.phone || null,
      gstin: payload.gstin || null,
      address: payload.address || null,
      ledgerId: vendorLedger.id,
      isActive: payload.isActive !== undefined ? payload.isActive : true,
    }, { transaction });

    await transaction.commit();
    return vendor;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function listVendors(agencyId, filters = {}) {
  const where = { agencyId };
  if (filters.type) where.type = filters.type;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;

  return Vendor.findAll({
    where,
    order: [['name', 'ASC']],
  });
}

async function getVendor(agencyId, vendorId) {
  const vendor = await Vendor.findOne({ where: { id: vendorId, agencyId } });
  if (!vendor) {
    throw Object.assign(new Error('Vendor not found'), { statusCode: 404 });
  }
  return vendor;
}

async function updateVendor(agencyId, vendorId, payload) {
  const vendor = await getVendor(agencyId, vendorId);
  const updates = {};

  ['name', 'type', 'email', 'phone', 'gstin', 'address', 'isActive'].forEach((field) => {
    if (payload[field] !== undefined) {
      updates[field] = payload[field];
    }
  });

  await vendor.update(updates);
  return vendor;
}

async function createVendorPayment(agencyId, vendorId, payload, agentId = null, outerTransaction = null) {
  const transaction = outerTransaction || await sequelize.transaction();
  const shouldCommit = !outerTransaction;
  try {
    const vendor = await getVendor(agencyId, vendorId);
    if (!vendor.ledgerId) {
      throw Object.assign(new Error('Vendor does not have an associated ledger'), { statusCode: 400 });
    }

    const amount = parseInt(payload.amount, 10);
    if (!amount || amount <= 0) {
      throw Object.assign(new Error('Invalid payment amount'), { statusCode: 400 });
    }
    const bill = await getVendorBill(agencyId, vendorId, payload.vendorBillId, transaction);
    const billOutstanding = bill ? Math.max(0, parseInt(bill.amount || 0, 10) - parseInt(bill.paidAmount || 0, 10)) : null;
    if (bill && amount > billOutstanding) {
      throw Object.assign(new Error('Payment amount cannot exceed selected bill outstanding amount'), { statusCode: 400 });
    }

    const item = bill ? itemPayloadFromBill(bill) : normalizeVendorItem(payload);
    await validateVendorItem(agencyId, item, transaction);

    const paymentMethod = await accountingService.resolvePaymentMethod(agencyId, {
      paymentMethodId: payload.paymentMethodId,
      paymentMode: payload.paymentMode || 'CASH',
    }, transaction);
    if (!paymentMethod?.ledger) {
      throw Object.assign(new Error('Payment method ledger not found'), { statusCode: 400 });
    }
    const paymentMode = paymentMethod.name || payload.paymentMode || 'Cash';
    const paymentLedger = paymentMethod.ledger;

    // Create the Journal Entry
    // Vendor is a LIABILITY. A payment to a vendor reduces the liability (Debit).
    // The payment method (Asset) is also reduced (Credit).
    const entry = await accountingService.createJournalEntry(agencyId, {
      type: 'PAYMENT',
      date: payload.paymentDate || new Date().toISOString().slice(0, 10),
      sourceType: 'VENDOR_PAYMENT',
      // sourceId will be updated after we create VendorPayment
      createdByAgentId: agentId,
      description: payload.notes || `Payment to Vendor ${vendor.name}`,
      metadata: { vendorId: vendor.id, vendorBillId: bill?.id || null, item },
      lines: [
        { ledgerId: vendor.ledgerId, debit: amount, description: bill ? `Payment against bill ${bill.referenceNumber || bill.id}` : `Payment to ${vendor.name}`, partyType: 'VENDOR', partyId: vendor.id },
        { ledgerId: paymentLedger.id, credit: amount, description: `Payment using ${paymentMode}` },
      ],
    }, { transaction });

    // Create VendorPayment record
    const vendorPayment = await VendorPayment.create({
      agencyId,
      vendorId,
      vendorBillId: bill?.id || null,
      journalEntryId: entry.id,
      ...item,
      amount,
      paymentDate: payload.paymentDate || new Date().toISOString().slice(0, 10),
      paymentMode,
      paymentMethodId: paymentMethod.id,
      referenceNumber: payload.referenceNumber || null,
      notes: payload.notes || null,
    }, { transaction });

    // Update the journal entry's sourceId with the vendorPayment id
    await entry.update({ sourceId: vendorPayment.id }, { transaction });

    if (bill) {
      const paidAmount = parseInt(bill.paidAmount || 0, 10) + amount;
      await bill.update({
        paidAmount,
        status: billStatus(bill.amount, paidAmount),
      }, { transaction });
    }

    if (shouldCommit) await transaction.commit();
    return vendorPayment;
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    throw error;
  }
}

async function createVendorBill(agencyId, vendorId, payload, agentId = null) {
  const transaction = await sequelize.transaction();
  try {
    const vendor = await getVendor(agencyId, vendorId);
    if (!vendor.ledgerId) {
      throw Object.assign(new Error('Vendor does not have an associated ledger'), { statusCode: 400 });
    }

    const amount = parseInt(payload.amount, 10);
    if (!amount || amount <= 0) {
      throw Object.assign(new Error('Invalid bill amount'), { statusCode: 400 });
    }
    const item = normalizeVendorItem(payload);
    await validateVendorItem(agencyId, item, transaction);

    const postingRules = await accountingService.getPostingRuleLedgers(agencyId, transaction);
    const expenseLedger = payload.expenseLedgerId
      ? await AccountingLedger.findOne({ where: { id: payload.expenseLedgerId, agencyId }, transaction })
      : postingRules.vendorExpenseLedgerId;

    if (!expenseLedger || expenseLedger.isGroup) {
      throw Object.assign(new Error('Expense ledger not found'), { statusCode: 400 });
    }

    const bill = await VendorBill.create({
      agencyId,
      vendorId,
      ...item,
      amount,
      paidAmount: 0,
      billDate: payload.billDate || new Date().toISOString().slice(0, 10),
      dueDate: payload.dueDate || null,
      status: 'ISSUED',
      referenceNumber: payload.referenceNumber || null,
      description: payload.description || null,
      metadata: { item },
    }, { transaction });

    const billEntry = await accountingService.createJournalEntry(agencyId, {
      type: 'OTHER_PURCHASE',
      date: payload.billDate || new Date().toISOString().slice(0, 10),
      sourceType: 'VENDOR_BILL',
      sourceId: bill.id,
      createdByAgentId: agentId,
      description: payload.description || `Bill from ${vendor.name}`,
      lines: [
        { ledgerId: expenseLedger.id, debit: amount, description: payload.description || `Bill from ${vendor.name}` },
        { ledgerId: vendor.ledgerId, credit: amount, description: vendor.name, partyType: 'VENDOR', partyId: vendor.id },
      ],
      metadata: { vendorId: vendor.id, vendorBillId: bill.id, referenceNumber: payload.referenceNumber || null, item },
    }, { transaction });

    await bill.update({ journalEntryId: billEntry.id }, { transaction });

    let payment = null;
    if (payload.payNow) {
      payment = await createVendorPayment(agencyId, vendorId, {
        vendorBillId: bill.id,
        amount,
        paymentDate: payload.paymentDate || payload.billDate,
        paymentMode: payload.paymentMode || 'BANK',
        paymentMethodId: payload.paymentMethodId || null,
        referenceNumber: payload.referenceNumber || null,
        notes: payload.description || `Payment to ${vendor.name}`,
        itemType: payload.itemType,
        packageId: payload.packageId,
        propertyId: payload.propertyId,
        cruiseId: payload.cruiseId,
        visaId: payload.visaId,
        serviceId: payload.serviceId,
        customItemName: payload.customItemName,
        customItemDescription: payload.customItemDescription,
      }, agentId, transaction);
    }

    await transaction.commit();
    return { bill, billEntry, payment };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function listVendorBills(agencyId, vendorId, filters = {}) {
  const where = { agencyId, vendorId };
  if (filters.status) where.status = filters.status;
  if (filters.outstandingOnly) {
    where.status = ['ISSUED', 'PARTIALLY_PAID'];
  }
  return VendorBill.findAll({
    where,
    include: vendorBillIncludes().filter((entry) => entry.as !== 'vendor'),
    order: [['billDate', 'DESC'], ['createdAt', 'DESC']],
  });
}

async function listAllVendorBills(agencyId, filters = {}) {
  const { Op } = require('sequelize');
  const where = { agencyId };
  if (filters.vendorId) where.vendorId = filters.vendorId;
  if (filters.status) where.status = filters.status;
  if (filters.outstandingOnly) where.status = { [Op.in]: ['ISSUED', 'PARTIALLY_PAID'] };
  if (filters.itemType) where.itemType = filters.itemType;
  if (filters.startDate && filters.endDate) {
    where.billDate = { [Op.between]: [filters.startDate, filters.endDate] };
  } else if (filters.startDate) {
    where.billDate = { [Op.gte]: filters.startDate };
  } else if (filters.endDate) {
    where.billDate = { [Op.lte]: filters.endDate };
  }

  const vendorWhere = {};
  if (filters.vendorType) vendorWhere.type = filters.vendorType;
  const includes = vendorBillIncludes();
  includes[0] = {
    ...includes[0],
    where: Object.keys(vendorWhere).length > 0 ? vendorWhere : undefined,
    required: Object.keys(vendorWhere).length > 0,
  };

  return VendorBill.findAll({
    where,
    include: includes,
    order: [['billDate', 'DESC'], ['createdAt', 'DESC']],
  });
}

async function listVendorPayments(agencyId, vendorId) {
  return VendorPayment.findAll({
    where: { agencyId, vendorId },
    include: vendorPaymentIncludes().filter((entry) => entry.as !== 'vendor'),
    order: [['paymentDate', 'DESC'], ['createdAt', 'DESC']],
  });
}

async function listAllVendorPayments(agencyId, filters = {}) {
  const { Op } = require('sequelize');
  const where = { agencyId };
  
  if (filters.vendorId) where.vendorId = filters.vendorId;
  if (filters.paymentMode) where.paymentMode = filters.paymentMode;
  if (filters.itemType) where.itemType = filters.itemType;
  if (filters.startDate && filters.endDate) {
    where.paymentDate = {
      [Op.between]: [filters.startDate, filters.endDate]
    };
  } else if (filters.startDate) {
    where.paymentDate = { [Op.gte]: filters.startDate };
  } else if (filters.endDate) {
    where.paymentDate = { [Op.lte]: filters.endDate };
  }

  const vendorWhere = {};
  if (filters.vendorType) vendorWhere.type = filters.vendorType;

  const includes = vendorPaymentIncludes();
  includes[0] = {
    ...includes[0],
    where: Object.keys(vendorWhere).length > 0 ? vendorWhere : undefined,
    required: Object.keys(vendorWhere).length > 0,
  };

  return VendorPayment.findAll({
    where,
    include: includes,
    order: [['paymentDate', 'DESC'], ['createdAt', 'DESC']],
  });
}

module.exports = {
  createVendor,
  listVendors,
  getVendor,
  updateVendor,
  createVendorBill,
  listVendorBills,
  listAllVendorBills,
  createVendorPayment,
  listVendorPayments,
  listAllVendorPayments,
};
