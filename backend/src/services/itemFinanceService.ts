const {
  Booking,
  Cruise,
  Customer,
  ItemVendorCost,
  JournalEntry,
  JournalLine,
  Package,
  Payment,
  Property,
  Service,
  Vendor,
  VendorPayment,
  Visa,
  sequelize,
} = require('../models');
const accountingService = require('./accountingService');

const ITEM_CONFIG = {
  PACKAGE: {
    model: Package,
    idKey: 'packageId',
    priceKey: 'basePrice',
    label: 'Package',
    name: (item) => item.name,
    meta: (item) => ({ duration: item.duration, destinations: item.destinations || [] }),
  },
  PROPERTY: {
    model: Property,
    idKey: 'propertyId',
    priceKey: 'pricePerNight',
    label: 'Property',
    name: (item) => item.name,
    meta: (item) => ({ propertyType: item.propertyType, location: item.location }),
  },
  CRUISE: {
    model: Cruise,
    idKey: 'cruiseId',
    priceKey: 'basePrice',
    label: 'Cruise',
    name: (item) => item.name,
    meta: (item) => ({ duration: item.duration, destinations: item.destinations || [], capacity: item.capacity }),
  },
  VISA: {
    model: Visa,
    idKey: 'visaId',
    priceKey: 'price',
    label: 'Visa',
    name: (item) => `${item.country}${item.visaType ? ` - ${item.visaType}` : ''}`,
    meta: (item) => ({ country: item.country, visaType: item.visaType, processingTime: item.processingTime }),
  },
  SERVICE: {
    model: Service,
    idKey: 'serviceId',
    priceKey: 'basePrice',
    label: 'Service',
    name: (item) => item.name,
    meta: (item) => ({ category: item.category, pricingType: item.pricingType }),
  },
};

function normalizeItemType(value) {
  const itemType = String(value || '').toUpperCase();
  if (!ITEM_CONFIG[itemType]) {
    throw Object.assign(new Error('Unsupported item type'), { statusCode: 400, code: 'UNSUPPORTED_ITEM_TYPE' });
  }
  return itemType;
}

function toInt(value) {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum(values, selector = (value) => value) {
  return values.reduce((total, value) => total + toInt(selector(value)), 0);
}

function todayDateOnly() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function toDateOnly(dateValue) {
  if (!dateValue) return null;
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysSince(dateValue) {
  const date = toDateOnly(dateValue);
  if (!date) return 0;
  const diff = todayDateOnly().getTime() - date.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function agingBucket(days) {
  if (days <= 7) return '0-7';
  if (days <= 15) return '8-15';
  if (days <= 30) return '16-30';
  return '31+';
}

function itemWhere(itemType, itemId) {
  const config = ITEM_CONFIG[itemType];
  return { itemType, [config.idKey]: itemId };
}

function itemIdPayload(itemType, itemId) {
  const payload = {
    packageId: null,
    propertyId: null,
    cruiseId: null,
    visaId: null,
    serviceId: null,
  };
  payload[ITEM_CONFIG[itemType].idKey] = itemId;
  return payload;
}

function paymentTotal(booking) {
  const payments = Array.isArray(booking.payments) ? booking.payments : [];
  const paidFromPayments = sum(payments.filter((payment) => payment.status === 'PAID'), (payment) => payment.amount);
  return Math.max(paidFromPayments, toInt(booking.advancePaid));
}

async function assertItem(agencyId, itemType, itemId, transaction = null) {
  const config = ITEM_CONFIG[itemType];
  const item = await config.model.findOne({ where: { id: itemId, agencyId }, transaction });
  if (!item) {
    throw Object.assign(new Error(`${config.label} not found`), { statusCode: 404, code: 'ITEM_NOT_FOUND' });
  }
  return item;
}

async function assertVendor(agencyId, vendorId, transaction = null) {
  const vendor = await Vendor.findOne({ where: { id: vendorId, agencyId }, transaction });
  if (!vendor) {
    throw Object.assign(new Error('Vendor not found'), { statusCode: 404, code: 'VENDOR_NOT_FOUND' });
  }
  return vendor;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function itemAccountingPayload(itemType, itemId) {
  return {
    itemType,
    ...itemIdPayload(itemType, itemId),
  };
}

async function postVendorCostBill(agencyId, itemType, itemId, cost, vendor, item, agentId, transaction) {
  if (!vendor.ledgerId) {
    throw Object.assign(new Error('Vendor does not have an associated ledger'), { statusCode: 400, code: 'VENDOR_LEDGER_MISSING' });
  }

  const expenseLedger = await accountingService.getLedgerByCode(
    agencyId,
    accountingService.DEFAULT_LEDGER_CODES.VENDOR_EXPENSES,
    transaction
  );
  const itemName = ITEM_CONFIG[itemType].name(item);
  const itemPayload = {
    ...itemAccountingPayload(itemType, itemId),
    itemName,
  };
  const description = cost.notes || `Vendor payable - ${vendor.name} (${cost.serviceLabel})`;

  const entry = await accountingService.createJournalEntry(agencyId, {
    type: 'OTHER_PURCHASE',
    date: todayIsoDate(),
    sourceType: 'VENDOR_BILL',
    sourceId: cost.id,
    createdByAgentId: agentId,
    description,
    lines: [
      { ledgerId: expenseLedger.id, debit: toInt(cost.amount), description },
      { ledgerId: vendor.ledgerId, credit: toInt(cost.amount), description: vendor.name, partyType: 'VENDOR', partyId: vendor.id },
    ],
    metadata: {
      vendorId: vendor.id,
      itemVendorCostId: cost.id,
      referenceNumber: cost.id,
      dueDate: cost.dueDate || null,
      serviceLabel: cost.serviceLabel,
      itemName,
      item: itemPayload,
    },
  }, { transaction });

  await cost.update({ journalEntryId: entry.id }, { transaction });
  return entry;
}

async function deleteVendorCostBill(agencyId, cost, transaction) {
  const where = cost.journalEntryId
    ? { id: cost.journalEntryId, agencyId }
    : { agencyId, sourceType: 'VENDOR_BILL', sourceId: String(cost.id), type: 'OTHER_PURCHASE' };
  const entry = await JournalEntry.findOne({ where, transaction });
  if (!entry) return;

  // Posted entries are immutable: reverse instead of destroying, so the ledger keeps a
  // permanent trail of the original bill and its cancellation.
  await accountingService.reverseJournalEntry(agencyId, entry.id, { transaction, reason: 'Vendor cost bill deleted' });
}

function buildCustomerReceivables(bookings) {
  return bookings.map((booking) => {
    const paid = Math.min(toInt(booking.totalAmount), paymentTotal(booking));
    const balance = Math.max(0, toInt(booking.totalAmount) - paid);
    const ageDays = daysSince(booking.travelDate || booking.createdAt);

    return {
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      customerId: booking.customerId,
      customerName: booking.customer?.name || booking.customer?.phone || 'Customer',
      customerPhone: booking.customer?.phone || null,
      itemAmount: toInt(booking.totalAmount),
      packageAmount: toInt(booking.totalAmount),
      paid,
      balance,
      status: booking.status,
      travellers: toInt(booking.travellers) || 1,
      travelDate: booking.travelDate,
      ageDays,
      agingBucket: agingBucket(ageDays),
    };
  });
}

function buildAgingReport(receivables) {
  const initial = {
    '0-7': { label: '0-7 days', amount: 0, count: 0 },
    '8-15': { label: '8-15 days', amount: 0, count: 0 },
    '16-30': { label: '16-30 days', amount: 0, count: 0 },
    '31+': { label: '31+ days', amount: 0, count: 0 },
  };

  for (const receivable of receivables) {
    if (receivable.balance <= 0) continue;
    initial[receivable.agingBucket].amount += receivable.balance;
    initial[receivable.agingBucket].count += 1;
  }

  return Object.entries(initial).map(([key, value]) => ({ key, ...value }));
}

function buildVendorPayables(costRows, payments) {
  const paidByVendor = new Map();
  for (const payment of payments) {
    paidByVendor.set(payment.vendorId, (paidByVendor.get(payment.vendorId) || 0) + toInt(payment.amount));
  }

  const remainingByVendor = new Map(paidByVendor);
  const vendorPayables = costRows.map((cost) => {
    const remainingPaid = remainingByVendor.get(cost.vendorId) || 0;
    const paid = Math.min(toInt(cost.amount), remainingPaid);
    remainingByVendor.set(cost.vendorId, Math.max(0, remainingPaid - paid));
    return {
      id: cost.id,
      vendorId: cost.vendorId,
      vendorName: cost.vendor?.name || 'Vendor',
      vendorType: cost.vendor?.type || null,
      service: cost.serviceLabel,
      cost: toInt(cost.amount),
      paid,
      balance: Math.max(0, toInt(cost.amount) - paid),
      dueDate: cost.dueDate || null,
      notes: cost.notes || null,
    };
  });

  const vendorMap = new Map();
  for (const payable of vendorPayables) {
    const current = vendorMap.get(payable.vendorId) || {
      vendorId: payable.vendorId,
      vendorName: payable.vendorName,
      vendorType: payable.vendorType,
      totalCost: 0,
      paid: 0,
      balance: 0,
      services: [],
    };
    current.totalCost += payable.cost;
    current.paid += payable.paid;
    current.balance += payable.balance;
    current.services.push(payable.service);
    vendorMap.set(payable.vendorId, current);
  }

  return {
    vendorPayables,
    vendorWise: Array.from(vendorMap.values()),
  };
}

async function getItemFinance(agencyId, itemTypeInput, itemId) {
  const itemType = normalizeItemType(itemTypeInput);
  const config = ITEM_CONFIG[itemType];
  const item = await assertItem(agencyId, itemType, itemId);

  const where = itemWhere(itemType, itemId);
  const [bookings, costs, vendorPayments] = await Promise.all([
    Booking.findAll({
      where: { agencyId, ...where },
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: Payment, as: 'payments', attributes: ['id', 'amount', 'status', 'paidAt'] },
      ],
      order: [['createdAt', 'ASC']],
    }),
    ItemVendorCost.findAll({
      where: { agencyId, ...where },
      include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name', 'type', 'phone', 'email'] }],
      order: [['dueDate', 'ASC'], ['createdAt', 'ASC']],
    }),
    VendorPayment.findAll({
      where: { agencyId, ...where },
      include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name', 'type'] }],
      order: [['paymentDate', 'ASC'], ['createdAt', 'ASC']],
    }),
  ]);

  const activeBookings = bookings.filter((booking) => booking.status !== 'CANCELLED');
  const cancelledBookings = bookings.filter((booking) => booking.status === 'CANCELLED');
  const confirmedBookings = activeBookings.filter((booking) => ['CONFIRMED', 'COMPLETED'].includes(booking.status));
  const receivables = buildCustomerReceivables(activeBookings);
  const expectedRevenue = sum(activeBookings, (booking) => booking.totalAmount);
  const receivedRevenue = sum(receivables, (row) => row.paid);
  const outstandingReceivables = sum(receivables, (row) => row.balance);
  const totalCost = sum(costs, (cost) => cost.amount);
  const { vendorPayables, vendorWise } = buildVendorPayables(costs, vendorPayments);
  const paidCost = sum(vendorPayables, (row) => row.paid);
  const unpaidCost = Math.max(0, totalCost - paidCost);
  const grossProfit = expectedRevenue - totalCost;
  const netProfit = receivedRevenue - paidCost;
  const profitPercent = expectedRevenue > 0 ? Math.round((grossProfit / expectedRevenue) * 10000) / 100 : 0;
  const paxCount = sum(activeBookings, (booking) => toInt(booking.travellers) || 1);
  const confirmedPax = sum(confirmedBookings, (booking) => toInt(booking.travellers) || 1);
  const cancelledPax = sum(cancelledBookings, (booking) => toInt(booking.travellers) || 1);
  const capacity = toInt(item.capacity);

  return {
    itemType,
    itemLabel: config.label,
    item: {
      id: item.id,
      name: config.name(item),
      unitPrice: toInt(item[config.priceKey]),
      ...config.meta(item),
    },
    package: {
      id: item.id,
      name: config.name(item),
      basePrice: toInt(item[config.priceKey]),
      ...config.meta(item),
    },
    summary: {
      itemPrice: toInt(item[config.priceKey]),
      packagePrice: toInt(item[config.priceKey]),
      totalCustomers: activeBookings.length,
      expectedRevenue,
      totalCost,
      expectedGrossProfit: grossProfit,
    },
    revenue: {
      expectedRevenue,
      receivedRevenue,
      pendingRevenue: outstandingReceivables,
    },
    costs: {
      totalCost,
      paidCost,
      unpaidCost,
    },
    profitability: {
      grossProfit,
      netProfit,
      profitPercent,
    },
    cashPosition: {
      customerCollections: receivedRevenue,
      vendorPayments: paidCost,
      currentCashBalance: receivedRevenue - paidCost,
    },
    operations: {
      paxCount,
      confirmedPax,
      cancelledPax,
      occupancy: capacity > 0 ? Math.round((confirmedPax / capacity) * 10000) / 100 : (paxCount > 0 ? Math.round((confirmedPax / paxCount) * 10000) / 100 : 0),
      packageOccupancy: paxCount > 0 ? Math.round((confirmedPax / paxCount) * 10000) / 100 : 0,
      bookingCount: activeBookings.length,
      cancelledBookingCount: cancelledBookings.length,
    },
    receivables,
    agingReport: buildAgingReport(receivables),
    payables: vendorPayables,
    vendorWise,
    dueDateTracking: vendorPayables
      .filter((row) => row.balance > 0)
      .map((row) => ({
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        service: row.service,
        dueDate: row.dueDate,
        balance: row.balance,
      })),
  };
}

async function createVendorCost(agencyId, itemTypeInput, itemId, payload, agentId = null) {
  const itemType = normalizeItemType(itemTypeInput);
  const amount = toInt(payload.amount);
  if (amount <= 0) {
    throw Object.assign(new Error('Cost amount must be positive'), { statusCode: 400, code: 'INVALID_AMOUNT' });
  }

  const transaction = await sequelize.transaction();
  try {
    const item = await assertItem(agencyId, itemType, itemId, transaction);
    const vendor = await assertVendor(agencyId, payload.vendorId, transaction);
    const cost = await ItemVendorCost.create({
      agencyId,
      itemType,
      ...itemIdPayload(itemType, itemId),
      vendorId: payload.vendorId,
      serviceLabel: String(payload.serviceLabel || '').trim(),
      amount,
      dueDate: payload.dueDate || null,
      notes: payload.notes || null,
    }, { transaction });

    await postVendorCostBill(agencyId, itemType, itemId, cost, vendor, item, agentId, transaction);
    await transaction.commit();
    return cost;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function updateVendorCost(agencyId, itemTypeInput, itemId, costId, payload, agentId = null) {
  const itemType = normalizeItemType(itemTypeInput);
  const transaction = await sequelize.transaction();
  try {
    const item = await assertItem(agencyId, itemType, itemId, transaction);
    const cost = await ItemVendorCost.findOne({ where: { id: costId, agencyId, ...itemWhere(itemType, itemId) }, transaction });
    if (!cost) {
      throw Object.assign(new Error('Vendor cost not found'), { statusCode: 404, code: 'COST_NOT_FOUND' });
    }

    const updates = {};
    if (payload.vendorId !== undefined) {
      await assertVendor(agencyId, payload.vendorId, transaction);
      updates.vendorId = payload.vendorId;
    }
    if (payload.serviceLabel !== undefined) updates.serviceLabel = String(payload.serviceLabel || '').trim();
    if (payload.amount !== undefined) {
      const amount = toInt(payload.amount);
      if (amount <= 0) {
        throw Object.assign(new Error('Cost amount must be positive'), { statusCode: 400, code: 'INVALID_AMOUNT' });
      }
      updates.amount = amount;
    }
    if (payload.dueDate !== undefined) updates.dueDate = payload.dueDate || null;
    if (payload.notes !== undefined) updates.notes = payload.notes || null;

    await deleteVendorCostBill(agencyId, cost, transaction);
    await cost.update({ ...updates, journalEntryId: null }, { transaction });
    const vendor = await assertVendor(agencyId, cost.vendorId, transaction);
    await postVendorCostBill(agencyId, itemType, itemId, cost, vendor, item, agentId, transaction);

    await transaction.commit();
    return cost;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function deleteVendorCost(agencyId, itemTypeInput, itemId, costId) {
  const itemType = normalizeItemType(itemTypeInput);
  const transaction = await sequelize.transaction();
  try {
    await assertItem(agencyId, itemType, itemId, transaction);
    const cost = await ItemVendorCost.findOne({ where: { id: costId, agencyId, ...itemWhere(itemType, itemId) }, transaction });
    if (!cost) {
      throw Object.assign(new Error('Vendor cost not found'), { statusCode: 404, code: 'COST_NOT_FOUND' });
    }

    await deleteVendorCostBill(agencyId, cost, transaction);
    await cost.destroy({ transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = {
  ITEM_CONFIG,
  getItemFinance,
  createVendorCost,
  updateVendorCost,
  deleteVendorCost,
};
