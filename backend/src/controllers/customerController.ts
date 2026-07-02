const { Op } = require('sequelize');
const { Customer, Booking, Package, Payment, Property, Service, Cruise, Visa } = require('../models');
const mediaService = require('../services/mediaService');
const accountingService = require('../services/accountingService');
const leadService = require('../services/leadService');
const { logActivity } = require('../services/activityService');

async function list(req, res, next) {
  try {
    const customers = await Customer.findAll({
      where: {
        agencyId: req.agency.id,
        isCustomer: true
      },
      include: [
        {
          model: Booking,
          as: 'bookings',
          required: false,
          include: [
            { model: Package, as: 'package', attributes: ['id', 'name'] },
            { model: Property, as: 'property', attributes: ['id', 'name', 'propertyType', 'location'] },
            { model: Service, as: 'service', attributes: ['id', 'name'] },
            { model: Cruise, as: 'cruise', attributes: ['id', 'name'] },
            { model: Visa, as: 'visa', attributes: ['id', 'country'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, phone, notes } = req.body;
    let customer = await Customer.findOne({
      where: { agencyId: req.agency.id, phone }
    });

    if (customer) {
      // Update existing customer to be marked as isCustomer
      await customer.update({ name: name || customer.name, notes: notes || customer.notes, isCustomer: true });
    } else {
      customer = await Customer.create({
        agencyId: req.agency.id,
        name,
        phone,
        notes,
        isCustomer: true,
        source: 'manual'
      });
    }

    try {
      await accountingService.ensureCustomerLedger(req.agency.id, customer);
      await customer.reload();
    } catch (error) {
      console.warn('[CustomerController.create] Could not create customer ledger:', error.message);
    }

    await logActivity(req, {
      action: 'customer.created',
      module: 'customers',
      targetType: 'Customer',
      targetId: customer?.id,
      summary: `Added customer "${customer?.name || phone || ''}"`.trim(),
    });

    res.status(201).json({ success: true, data: customer, message: 'Customer created' });
  } catch (err) {
    next(err);
  }
}

async function uploadDocument(req, res, next) {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne({
      where: { id, agencyId: req.agency.id }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const uploadResult = await mediaService.uploadCustomerDocument(
      req.file.buffer,
      req.agency.id,
      customer.id,
      req.file.originalname
    );

    const documents = customer.documents || [];
    documents.push(uploadResult.secureUrl);

    await customer.update({ documents });

    res.json({ success: true, data: customer, message: 'Document uploaded successfully' });
  } catch (err) {
    next(err);
  }
}

function toInt(value) {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function paidAmountForBooking(booking) {
  const payments = Array.isArray(booking.payments) ? booking.payments : [];
  const paidFromPayments = payments
    .filter((payment) => payment.status === 'PAID')
    .reduce((total, payment) => total + toInt(payment.amount), 0);
  return Math.max(paidFromPayments, toInt(booking.advancePaid));
}

function serviceNameForBooking(booking) {
  if (booking.itemType === 'SERVICE') return booking.service?.name || 'Service';
  if (booking.itemType === 'VISA') return booking.visa ? `${booking.visa.country} Visa` : 'Visa';
  return booking.customItemName || 'Custom Service';
}

async function serviceReport(req, res, next) {
  try {
    const customer = await Customer.findOne({
      where: { id: req.params.id, agencyId: req.agency.id },
      attributes: ['id', 'name', 'phone'],
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const bookings = await Booking.findAll({
      where: {
        agencyId: req.agency.id,
        customerId: customer.id,
        itemType: { [Op.in]: ['SERVICE', 'VISA', 'CUSTOM'] },
      },
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
        { model: Visa, as: 'visa', attributes: ['id', 'country', 'visaType'] },
        { model: Payment, as: 'payments', attributes: ['id', 'amount', 'status', 'paidAt'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const rows = bookings.map((booking) => {
      const totalAmount = toInt(booking.totalAmount);
      const paid = Math.min(totalAmount, paidAmountForBooking(booking));
      return {
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        itemType: booking.itemType,
        serviceId: booking.serviceId || null,
        serviceName: serviceNameForBooking(booking),
        category: booking.service?.category || booking.visa?.visaType || booking.customItemDescription || booking.itemType,
        status: booking.status,
        totalAmount,
        paid,
        balance: Math.max(0, totalAmount - paid),
        serviceDate: booking.travelDate || booking.createdAt,
        createdAt: booking.createdAt,
        notes: booking.notes || null,
      };
    });

    const byCategoryMap = new Map();
    for (const row of rows) {
      const key = row.category || row.itemType;
      const current = byCategoryMap.get(key) || { category: key, count: 0, totalAmount: 0, paid: 0, balance: 0 };
      current.count += 1;
      current.totalAmount += row.totalAmount;
      current.paid += row.paid;
      current.balance += row.balance;
      byCategoryMap.set(key, current);
    }

    const summary = rows.reduce((acc, row) => ({
      totalServices: acc.totalServices + 1,
      totalBilled: acc.totalBilled + row.totalAmount,
      totalReceived: acc.totalReceived + row.paid,
      totalBalance: acc.totalBalance + row.balance,
    }), { totalServices: 0, totalBilled: 0, totalReceived: 0, totalBalance: 0 });

    res.json({
      success: true,
      data: {
        customer,
        summary,
        byCategory: Array.from(byCategoryMap.values()),
        services: rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function activity(req, res, next) {
  try {
    const data = await leadService.getCustomerActivity(req.params.id, req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  serviceReport,
  activity,
  uploadDocument,
};
