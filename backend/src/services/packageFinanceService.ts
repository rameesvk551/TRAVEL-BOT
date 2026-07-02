const { Booking, Customer, Package, PackageVendorCost, Payment, Vendor, VendorPayment } = require('../models');
const itemFinanceService = require('./itemFinanceService');

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

function paymentTotal(booking) {
  const payments = Array.isArray(booking.payments) ? booking.payments : [];
  const paidFromPayments = sum(payments.filter((payment) => payment.status === 'PAID'), (payment) => payment.amount);
  return Math.max(paidFromPayments, toInt(booking.advancePaid));
}

async function assertPackage(agencyId, packageId) {
  const pkg = await Package.findOne({ where: { id: packageId, agencyId } });
  if (!pkg) {
    throw Object.assign(new Error('Package not found'), { statusCode: 404, code: 'PACKAGE_NOT_FOUND' });
  }
  return pkg;
}

async function assertVendor(agencyId, vendorId) {
  const vendor = await Vendor.findOne({ where: { id: vendorId, agencyId } });
  if (!vendor) {
    throw Object.assign(new Error('Vendor not found'), { statusCode: 404, code: 'VENDOR_NOT_FOUND' });
  }
  return vendor;
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

async function getPackageFinance(agencyId, packageId) {
  const pkg = await assertPackage(agencyId, packageId);

  const [bookings, costs, vendorPayments] = await Promise.all([
    Booking.findAll({
      where: { agencyId, packageId },
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: Payment, as: 'payments', attributes: ['id', 'amount', 'status', 'paidAt'] },
      ],
      order: [['createdAt', 'ASC']],
    }),
    PackageVendorCost.findAll({
      where: { agencyId, packageId },
      include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name', 'type', 'phone', 'email'] }],
      order: [['dueDate', 'ASC'], ['createdAt', 'ASC']],
    }),
    VendorPayment.findAll({
      where: { agencyId, packageId, itemType: 'PACKAGE' },
      include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name', 'type'] }],
      order: [['paymentDate', 'ASC'], ['createdAt', 'ASC']],
    }),
  ]);

  const activeBookings = bookings.filter((booking) => booking.status !== 'CANCELLED');
  const cancelledBookings = bookings.filter((booking) => booking.status === 'CANCELLED');
  const confirmedBookings = bookings.filter((booking) => ['CONFIRMED', 'COMPLETED'].includes(booking.status));
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

  return {
    package: {
      id: pkg.id,
      name: pkg.name,
      basePrice: toInt(pkg.basePrice),
      duration: pkg.duration,
      destinations: pkg.destinations || [],
    },
    summary: {
      packagePrice: toInt(pkg.basePrice),
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

async function createVendorCost(agencyId, packageId, payload) {
  await assertPackage(agencyId, packageId);
  await assertVendor(agencyId, payload.vendorId);
  const amount = toInt(payload.amount);
  if (amount <= 0) {
    throw Object.assign(new Error('Cost amount must be positive'), { statusCode: 400, code: 'INVALID_AMOUNT' });
  }

  return PackageVendorCost.create({
    agencyId,
    packageId,
    vendorId: payload.vendorId,
    serviceLabel: String(payload.serviceLabel || '').trim(),
    amount,
    dueDate: payload.dueDate || null,
    notes: payload.notes || null,
  });
}

async function updateVendorCost(agencyId, packageId, costId, payload) {
  await assertPackage(agencyId, packageId);
  const cost = await PackageVendorCost.findOne({ where: { id: costId, agencyId, packageId } });
  if (!cost) {
    throw Object.assign(new Error('Vendor cost not found'), { statusCode: 404, code: 'COST_NOT_FOUND' });
  }

  const updates = {};
  if (payload.vendorId !== undefined) {
    await assertVendor(agencyId, payload.vendorId);
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

  await cost.update(updates);
  return cost;
}

async function deleteVendorCost(agencyId, packageId, costId) {
  await assertPackage(agencyId, packageId);
  const deleted = await PackageVendorCost.destroy({ where: { id: costId, agencyId, packageId } });
  if (!deleted) {
    throw Object.assign(new Error('Vendor cost not found'), { statusCode: 404, code: 'COST_NOT_FOUND' });
  }
}

module.exports = {
  getPackageFinance: (agencyId, packageId) => itemFinanceService.getItemFinance(agencyId, 'PACKAGE', packageId),
  createVendorCost: (agencyId, packageId, payload, agentId = null) => itemFinanceService.createVendorCost(agencyId, 'PACKAGE', packageId, payload, agentId),
  updateVendorCost: (agencyId, packageId, costId, payload, agentId = null) => itemFinanceService.updateVendorCost(agencyId, 'PACKAGE', packageId, costId, payload, agentId),
  deleteVendorCost: (agencyId, packageId, costId) => itemFinanceService.deleteVendorCost(agencyId, 'PACKAGE', packageId, costId),
};
