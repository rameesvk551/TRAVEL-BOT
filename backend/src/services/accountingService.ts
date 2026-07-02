const { Op } = require('sequelize');
const {
  sequelize,
  AccountingLedger,
  JournalEntry,
  JournalLine,
  AccountInvoice,
  AccountReminder,
  CreditNote,
  Customer,
  Agency,
  Booking,
  Payment,
  Package,
  Property,
  Cruise,
  Visa,
  Service,
  Vendor,
  VendorPayment,
  AccountingPaymentMethod,
} = require('../models');

const DEFAULT_LEDGER_CODES = {
  CASH_BANK: '1002',
  BANK: '1003',
  CASH: '1004',
  TRADE_DEBTORS: '1005',
  TRADE_CREDITORS: '2001',
  CUSTOMER_ADVANCES: '2002',
  GST_INPUT: '2301',
  GST_OUTPUT: '2302',
  GST_INPUT_CGST: '1301',
  GST_INPUT_SGST: '1302',
  GST_INPUT_IGST: '1303',
  GST_OUTPUT_CGST: '2303',
  GST_OUTPUT_SGST: '2304',
  GST_OUTPUT_IGST: '2305',
  TRAVEL_SALES: 'G4100',
  VENDOR_EXPENSES: '5101',
  DIRECT_EXPENSES: 'G5100',
  INDIRECT_EXPENSES: 'G5200',
  OPENING_BALANCE_EQUITY: '2101',
};

// Leading digit per account type, used to auto-generate the next ledger code.
const TYPE_CODE_PREFIX = { ASSET: '1', LIABILITY: '2', EQUITY: '3', REVENUE: '4', EXPENSE: '5' };

const JOURNAL_PREFIX = {
  JOURNAL: 'JE',
  INVOICE: 'INV',
  RECEIPT: 'RCPT',
  PAYMENT: 'PAY',
  EXPENSE_VOUCHER: 'EV',
  OTHER_PURCHASE: 'PUR',
  OTHER_SALE: 'SALE',
  INTERNAL_FUND_TRANSFER: 'IFT',
  CREDIT_NOTE: 'CN',
};

const DEFAULT_CHART = [
  { code: 'BS', name: 'Balance Sheet', type: 'LIABILITY', financialStatement: 'BALANCE_SHEET', isGroup: true },
  { code: 'BS-LIAB', name: 'Liabilities', type: 'LIABILITY', financialStatement: 'BALANCE_SHEET', isGroup: true, parentCode: 'BS' },
  { code: 'BS-EQUITY', name: 'Equity', type: 'EQUITY', financialStatement: 'BALANCE_SHEET', isGroup: true, parentCode: 'BS' },
  { code: 'G2100', name: 'Capital', type: 'EQUITY', financialStatement: 'BALANCE_SHEET', isGroup: true, parentCode: 'BS-EQUITY' },
  { code: '2101', name: 'Opening Balance Equity', type: 'EQUITY', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: 'G2100' },

  { code: 'G2200', name: 'Current Liabilities', type: 'LIABILITY', financialStatement: 'BALANCE_SHEET', isGroup: true, parentCode: 'BS-LIAB' },
  { code: '2001', name: 'Trade Creditors', type: 'LIABILITY', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: 'G2200' },
  { code: '2002', name: 'Customer Advances', type: 'LIABILITY', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: 'G2200' },
  { code: 'G2300', name: 'Tax Payables', type: 'LIABILITY', financialStatement: 'BALANCE_SHEET', isGroup: true, parentCode: 'BS-LIAB' },
  { code: '2302', name: 'Output Tax Payable', type: 'LIABILITY', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: 'G2300' },
  { code: '2303', name: 'Output CGST Payable', type: 'LIABILITY', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: 'G2300' },
  { code: '2304', name: 'Output SGST Payable', type: 'LIABILITY', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: 'G2300' },
  { code: '2305', name: 'Output IGST Payable', type: 'LIABILITY', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: 'G2300' },

  { code: 'BS-ASSET', name: 'Assets', type: 'ASSET', financialStatement: 'BALANCE_SHEET', isGroup: true, parentCode: 'BS' },
  { code: 'G1100', name: 'Fixed Assets', type: 'ASSET', financialStatement: 'BALANCE_SHEET', isGroup: true, parentCode: 'BS-ASSET' },
  { code: 'G1200', name: 'Current Assets', type: 'ASSET', financialStatement: 'BALANCE_SHEET', isGroup: true, parentCode: 'BS-ASSET' },
  { code: '1002', name: 'Cash & Bank', type: 'ASSET', financialStatement: 'BALANCE_SHEET', isGroup: true, parentCode: 'G1200' },
  { code: '1004', name: 'Cash', type: 'ASSET', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: '1002' },
  { code: '1005', name: 'Trade Debtors', type: 'ASSET', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: 'G1200' },
  { code: 'G1300', name: 'Tax Credits', type: 'ASSET', financialStatement: 'BALANCE_SHEET', isGroup: true, parentCode: 'BS-ASSET' },
  { code: '2301', name: 'Input Tax Credit', type: 'ASSET', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: 'G1300' },
  { code: '1301', name: 'Input CGST Credit', type: 'ASSET', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: 'G1300' },
  { code: '1302', name: 'Input SGST Credit', type: 'ASSET', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: 'G1300' },
  { code: '1303', name: 'Input IGST Credit', type: 'ASSET', financialStatement: 'BALANCE_SHEET', isGroup: false, parentCode: 'G1300' },

  { code: 'PL', name: 'Profit and Loss', type: 'REVENUE', financialStatement: 'PROFIT_AND_LOSS', isGroup: true },
  { code: 'PL-INCOME', name: 'Income', type: 'REVENUE', financialStatement: 'PROFIT_AND_LOSS', isGroup: true, parentCode: 'PL' },
  { code: 'G4100', name: 'Sales', type: 'REVENUE', financialStatement: 'PROFIT_AND_LOSS', groupType: 'DIRECT', isGroup: false, parentCode: 'PL-INCOME' },

  { code: 'PL-EXPENSE', name: 'Expenses', type: 'EXPENSE', financialStatement: 'PROFIT_AND_LOSS', isGroup: true, parentCode: 'PL' },
  { code: 'G5100', name: 'Direct Expenses', type: 'EXPENSE', financialStatement: 'PROFIT_AND_LOSS', isGroup: true, parentCode: 'PL-EXPENSE' },
  { code: '5101', name: 'Purchases', type: 'EXPENSE', financialStatement: 'PROFIT_AND_LOSS', groupType: 'DIRECT', isGroup: false, parentCode: 'G5100' },
  { code: 'G5200', name: 'Indirect Expenses', type: 'EXPENSE', financialStatement: 'PROFIT_AND_LOSS', isGroup: true, parentCode: 'PL-EXPENSE' },
];

function toInt(value) {
  if (value === undefined || value === null || value === '') return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function cleanGstin(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  return normalized.length === 15 ? normalized : null;
}

function cleanStateCode(value) {
  const normalized = String(value || '').trim().replace(/\D/g, '').slice(0, 2);
  return normalized.length === 2 ? normalized : null;
}

function stateCodeFromGstin(gstin) {
  const normalized = cleanGstin(gstin);
  return normalized ? normalized.slice(0, 2) : null;
}

function normalizeGstTreatment(value, hasCustomerGstin) {
  const treatment = String(value || '').trim().toUpperCase();
  if (['REGISTERED', 'UNREGISTERED', 'EXPORT', 'SEZ', 'EXEMPT'].includes(treatment)) return treatment;
  return hasCustomerGstin ? 'REGISTERED' : 'UNREGISTERED';
}

function getAccountingSettings(agency) {
  const raw = agency?.accountingSettings || {};
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

// Books-lock (period close): no entry may be posted on or before this date. Stored in
// agency.accountingSettings.booksLockedUntil as YYYY-MM-DD. Null = books fully open.
async function getBooksLockDate(agencyId, transaction = null) {
  const agency = await Agency.findByPk(agencyId, { attributes: ['id', 'accountingSettings'], transaction });
  const raw = getAccountingSettings(agency).booksLockedUntil;
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

async function getBooksLock(agencyId) {
  return { booksLockedUntil: await getBooksLockDate(agencyId) };
}

async function setBooksLock(agencyId, date) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  const lockDate = date || null;
  if (lockDate && !/^\d{4}-\d{2}-\d{2}$/.test(lockDate)) {
    throw Object.assign(new Error('Lock date must be YYYY-MM-DD'), { statusCode: 400, code: 'BAD_REQUEST' });
  }
  await agency.update({ accountingSettings: { ...getAccountingSettings(agency), booksLockedUntil: lockDate } });
  return { booksLockedUntil: lockDate };
}

function getSalesGstConfig(agency, booking = null) {
  const settings = getAccountingSettings(agency);
  const gst = settings.gst && typeof settings.gst === 'object' ? settings.gst : settings;
  const bookingMeta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {};
  const rawRate = bookingMeta.gstRateBps ?? gst.defaultSalesRateBps ?? gst.gstRateBps ?? 0;
  const rateBps = Math.max(0, Math.min(4000, toInt(rawRate)));
  const taxInclusive = bookingMeta.taxInclusive === undefined ? gst.taxInclusive !== false : bookingMeta.taxInclusive !== false;
  return {
    rateBps,
    taxInclusive,
    treatment: normalizeGstTreatment(bookingMeta.gstTreatment || gst.defaultTreatment, false),
  };
}

function getBookingItemName(booking) {
  if (!booking) return 'Travel sales';
  if (booking.itemType === 'PACKAGE') return booking.package?.name || 'Package';
  if (booking.itemType === 'PROPERTY') return booking.property?.name || 'Property';
  if (booking.itemType === 'CRUISE') return booking.cruise?.name || 'Cruise';
  if (booking.itemType === 'VISA') return booking.visa ? `${booking.visa.country} Visa` : 'Visa';
  if (booking.itemType === 'SERVICE') return booking.service?.name || 'Service';
  return booking.customItemName || 'Custom travel sale';
}

function customerLedgerName(customer) {
  const name = String(customer?.name || 'Customer').trim() || 'Customer';
  const phone = String(customer?.phone || customer?.contactPhone || '').trim();
  return phone ? `Customer - ${name} (${phone})` : `Customer - ${name}`;
}

function splitIndianGst(gstAmount, taxType) {
  const amount = toInt(gstAmount);
  if (amount <= 0 || taxType === 'NONE') return { cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
  if (taxType === 'IGST') return { cgstAmount: 0, sgstAmount: 0, igstAmount: amount };
  const cgstAmount = Math.floor(amount / 2);
  return { cgstAmount, sgstAmount: amount - cgstAmount, igstAmount: 0 };
}

function calculateIndianSalesTax(totalOrTaxableAmount, config, agency, customer) {
  const supplierGstin = cleanGstin(agency?.gstin);
  const customerGstin = cleanGstin(customer?.gstin);
  const supplierStateCode = cleanStateCode(agency?.stateCode) || stateCodeFromGstin(supplierGstin);
  const placeOfSupplyStateCode = cleanStateCode(customer?.stateCode) || stateCodeFromGstin(customerGstin) || supplierStateCode;
  const gstTreatment = normalizeGstTreatment(config.treatment, Boolean(customerGstin));
  const rateBps = gstTreatment === 'EXEMPT' ? 0 : toInt(config.rateBps);
  const base = Math.max(0, toInt(totalOrTaxableAmount));
  let taxableAmount = base;
  let gstAmount = 0;
  let totalAmount = base;

  if (rateBps > 0 && supplierGstin) {
    if (config.taxInclusive !== false) {
      taxableAmount = Math.round((base * 10000) / (10000 + rateBps));
      gstAmount = base - taxableAmount;
      totalAmount = base;
    } else {
      gstAmount = Math.round((base * rateBps) / 10000);
      totalAmount = taxableAmount + gstAmount;
    }
  }

  const taxType = gstAmount <= 0 ? 'NONE' : (supplierStateCode && placeOfSupplyStateCode && supplierStateCode !== placeOfSupplyStateCode ? 'IGST' : 'CGST_SGST');
  const split = splitIndianGst(gstAmount, taxType);
  return {
    supplierGstin,
    customerGstin,
    supplierStateCode,
    placeOfSupplyStateCode,
    gstTreatment,
    gstRateBps: rateBps,
    taxType,
    taxableAmount,
    gstAmount,
    totalAmount,
    ...split,
    taxBreakup: {
      taxSystem: 'INDIA_GST',
      taxInclusive: config.taxInclusive !== false,
      rateBps,
      taxType,
      supplierStateCode,
      placeOfSupplyStateCode,
      cgstAmount: split.cgstAmount,
      sgstAmount: split.sgstAmount,
      igstAmount: split.igstAmount,
    },
  };
}

async function addOutputGstLines(agencyId, lines, tax, transaction, description) {
  if (tax.cgstAmount > 0) {
    const ledger = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.GST_OUTPUT_CGST, transaction);
    lines.push({ ledgerId: ledger.id, credit: tax.cgstAmount, description: description || 'Output CGST' });
  }
  if (tax.sgstAmount > 0) {
    const ledger = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.GST_OUTPUT_SGST, transaction);
    lines.push({ ledgerId: ledger.id, credit: tax.sgstAmount, description: description || 'Output SGST' });
  }
  if (tax.igstAmount > 0) {
    const ledger = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.GST_OUTPUT_IGST, transaction);
    lines.push({ ledgerId: ledger.id, credit: tax.igstAmount, description: description || 'Output IGST' });
  }
}

async function addOutputGstReversalLines(agencyId, lines, tax, transaction) {
  if (tax.cgstAmount > 0) {
    const ledger = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.GST_OUTPUT_CGST, transaction);
    lines.push({ ledgerId: ledger.id, debit: tax.cgstAmount, description: 'Output CGST reversal' });
  }
  if (tax.sgstAmount > 0) {
    const ledger = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.GST_OUTPUT_SGST, transaction);
    lines.push({ ledgerId: ledger.id, debit: tax.sgstAmount, description: 'Output SGST reversal' });
  }
  if (tax.igstAmount > 0) {
    const ledger = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.GST_OUTPUT_IGST, transaction);
    lines.push({ ledgerId: ledger.id, debit: tax.igstAmount, description: 'Output IGST reversal' });
  }
}

async function getPaidPaymentTotal(agencyId, bookingId, transaction = null) {
  return toInt(await Payment.sum('amount', {
    where: { agencyId, bookingId, status: 'PAID' },
    transaction,
  }));
}

function invoiceStatus(totalAmount, paidAmount) {
  if (paidAmount >= totalAmount && totalAmount > 0) return 'PAID';
  if (paidAmount > 0) return 'PARTIALLY_PAID';
  return 'ISSUED';
}

async function ensureDefaultChartOfAccounts(agencyId, transaction = null) {
  const byCode = {};
  const existingLedgers = await AccountingLedger.findAll({ where: { agencyId }, transaction });
  for (const ledger of existingLedgers) {
    byCode[ledger.code] = ledger;
  }

  for (const item of DEFAULT_CHART) {
    const parentId = item.parentCode ? byCode[item.parentCode]?.id : null;
    let ledger = byCode[item.code];
    const values = {
      parentId,
      name: item.name,
      type: item.type,
      groupType: item.groupType || null,
      financialStatement: item.financialStatement,
      isGroup: item.isGroup,
      systemCreated: true,
      currency: ledger?.currency || 'INR',
      isActive: true,
    };
    if (ledger) {
      await ledger.update(values, { transaction });
    } else {
      try {
        ledger = await AccountingLedger.create({
          agencyId,
          code: item.code,
          ...values,
        }, { transaction });
      } catch (error) {
        if (error.name !== 'SequelizeUniqueConstraintError') throw error;
        ledger = await AccountingLedger.findOne({ where: { agencyId, code: item.code }, transaction });
        if (!ledger) throw error;
        await ledger.update(values, { transaction });
      }
    }
    byCode[item.code] = ledger;
  }
}

async function backfillDefaultChartOfAccounts() {
  const { Agency } = require('../models');
  const agencies = await Agency.findAll({ attributes: ['id'] });
  for (const agency of agencies) {
    await ensureDefaultChartOfAccounts(agency.id);
  }
  return { agencies: agencies.length };
}

async function getLedgerByCode(agencyId, code, transaction = null) {
  const ledger = await AccountingLedger.findOne({ where: { agencyId, code }, transaction });
  if (!ledger) {
    throw Object.assign(new Error(`Accounting ledger ${code} is missing`), { statusCode: 500, code: 'LEDGER_MISSING' });
  }
  return ledger;
}

const PAYMENT_METHOD_TYPES = ['CASH', 'BANK', 'UPI', 'CARD', 'WALLET', 'GATEWAY', 'OTHER'];

const POSTING_RULE_DEFAULT_CODES = {
  salesLedgerId: DEFAULT_LEDGER_CODES.TRAVEL_SALES,
  // Revenue head for COMMISSION_ONLY bookings. Defaults to the same Travel Sales head;
  // agencies can point it at a dedicated Commission Income ledger in settings.
  commissionSalesLedgerId: DEFAULT_LEDGER_CODES.TRAVEL_SALES,
  customerAdvanceLedgerId: DEFAULT_LEDGER_CODES.CUSTOMER_ADVANCES,
  tradeDebtorsLedgerId: DEFAULT_LEDGER_CODES.TRADE_DEBTORS,
  tradeCreditorsLedgerId: DEFAULT_LEDGER_CODES.TRADE_CREDITORS,
  vendorExpenseLedgerId: DEFAULT_LEDGER_CODES.VENDOR_EXPENSES,
};

function normalizePaymentMethodType(value) {
  const type = String(value || '').trim().toUpperCase();
  return PAYMENT_METHOD_TYPES.includes(type) ? type : 'BANK';
}

function paymentModeToMethodType(value) {
  const mode = String(value || '').trim().toUpperCase();
  if (mode === 'CASH') return 'CASH';
  return 'BANK';
}

function isDescendantOf(ledger, parentId, byId) {
  let current = ledger;
  const seen = new Set();
  while (current?.parentId) {
    if (current.parentId === parentId) return true;
    if (seen.has(current.parentId)) return false;
    seen.add(current.parentId);
    current = byId.get(current.parentId);
  }
  return false;
}

async function listCashBankLedgers(agencyId, transaction = null) {
  await ensureDefaultChartOfAccounts(agencyId, transaction);
  const cashBank = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.CASH_BANK, transaction);
  const ledgers = await AccountingLedger.findAll({
    where: { agencyId, isActive: true, type: 'ASSET' },
    order: [['code', 'ASC'], ['name', 'ASC']],
    transaction,
  });
  const byId = new Map(ledgers.map((ledger) => [ledger.id, ledger]));
  return ledgers.filter((ledger) => (
    !ledger.isGroup
    && (ledger.parentId === cashBank.id || isDescendantOf(ledger, cashBank.id, byId))
  ));
}

async function assertCashBankLedger(agencyId, ledgerId, transaction = null) {
  const ledgers = await listCashBankLedgers(agencyId, transaction);
  const ledger = ledgers.find((row) => row.id === ledgerId);
  if (!ledger) {
    throw Object.assign(new Error('Payment method ledger must be an active ledger under Cash & Bank'), {
      statusCode: 400,
      code: 'INVALID_PAYMENT_LEDGER',
    });
  }
  return ledger;
}

async function ensureDefaultPaymentMethods(agencyId, transaction = null) {
  await ensureDefaultChartOfAccounts(agencyId, transaction);
  const cash = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.CASH, transaction);
  const defaults = [
    { name: 'Cash', methodType: 'CASH', ledgerId: cash.id, isDefault: true, sortOrder: 20 },
  ];

  for (const item of defaults) {
    const existing = await AccountingPaymentMethod.findOne({
      where: { agencyId, name: item.name },
      transaction,
    });
    if (!existing) {
      await AccountingPaymentMethod.create({ agencyId, ...item }, { transaction });
    }
  }

  const activeDefault = await AccountingPaymentMethod.findOne({
    where: { agencyId, isActive: true, isDefault: true },
    transaction,
  });
  if (!activeDefault) {
    const first = await AccountingPaymentMethod.findOne({
      where: { agencyId, isActive: true },
      order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
      transaction,
    });
    if (first) await first.update({ isDefault: true }, { transaction });
  }
}

async function listPaymentMethodLedgers(agencyId) {
  return listCashBankLedgers(agencyId);
}

async function listPaymentMethods(agencyId, filters = {}) {
  await ensureDefaultPaymentMethods(agencyId);
  const where = { agencyId };
  if (filters.activeOnly !== false) where.isActive = true;
  return AccountingPaymentMethod.findAll({
    where,
    include: [{ model: AccountingLedger, as: 'ledger' }],
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
  });
}

async function getPaymentMethod(agencyId, id, transaction = null, options = {}) {
  if (!id) return null;
  const where = { id, agencyId };
  if (options.activeOnly !== false) where.isActive = true;
  const method = await AccountingPaymentMethod.findOne({
    where,
    include: [{ model: AccountingLedger, as: 'ledger' }],
    transaction,
  });
  if (!method) {
    throw Object.assign(new Error('Payment method not found'), { statusCode: 404, code: 'PAYMENT_METHOD_NOT_FOUND' });
  }
  return method;
}

async function resolvePaymentMethod(agencyId, payload = {}, transaction = null) {
  await ensureDefaultPaymentMethods(agencyId, transaction);
  if (payload.paymentMethodId) {
    return getPaymentMethod(agencyId, payload.paymentMethodId, transaction);
  }

  const methodType = paymentModeToMethodType(payload.paymentMode);
  const byType = await AccountingPaymentMethod.findOne({
    where: { agencyId, methodType, isActive: true },
    include: [{ model: AccountingLedger, as: 'ledger' }],
    order: [['isDefault', 'DESC'], ['sortOrder', 'ASC'], ['createdAt', 'ASC']],
    transaction,
  });
  if (byType) return byType;

  return AccountingPaymentMethod.findOne({
    where: { agencyId, isActive: true },
    include: [{ model: AccountingLedger, as: 'ledger' }],
    order: [['isDefault', 'DESC'], ['sortOrder', 'ASC'], ['createdAt', 'ASC']],
    transaction,
  });
}

async function createPaymentMethod(agencyId, payload) {
  const transaction = await sequelize.transaction();
  try {
    await ensureDefaultPaymentMethods(agencyId, transaction);
    const ledger = await assertCashBankLedger(agencyId, payload.ledgerId, transaction);
    if (payload.isDefault) {
      await AccountingPaymentMethod.update({ isDefault: false }, { where: { agencyId }, transaction });
    }
    const method = await AccountingPaymentMethod.create({
      agencyId,
      ledgerId: ledger.id,
      name: String(payload.name || ledger.name).trim(),
      methodType: normalizePaymentMethodType(payload.methodType),
      isDefault: Boolean(payload.isDefault),
      isActive: payload.isActive !== false,
      sortOrder: toInt(payload.sortOrder),
    }, { transaction });
    if (!method.isDefault && method.isActive) {
      const defaultCount = await AccountingPaymentMethod.count({ where: { agencyId, isActive: true, isDefault: true }, transaction });
      if (!defaultCount) await method.update({ isDefault: true }, { transaction });
    }
    await transaction.commit();
    return getPaymentMethod(agencyId, method.id, null, { activeOnly: false });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function updatePaymentMethod(agencyId, id, payload) {
  const transaction = await sequelize.transaction();
  try {
    await ensureDefaultPaymentMethods(agencyId, transaction);
    const method = await getPaymentMethod(agencyId, id, transaction, { activeOnly: false });
    const updates = {};
    if (payload.ledgerId !== undefined) {
      const ledger = await assertCashBankLedger(agencyId, payload.ledgerId, transaction);
      updates.ledgerId = ledger.id;
    }
    if (payload.name !== undefined) updates.name = String(payload.name || '').trim();
    if (payload.methodType !== undefined) updates.methodType = normalizePaymentMethodType(payload.methodType);
    if (payload.isActive !== undefined) updates.isActive = Boolean(payload.isActive);
    if (payload.sortOrder !== undefined) updates.sortOrder = toInt(payload.sortOrder);
    if (payload.isDefault !== undefined) updates.isDefault = Boolean(payload.isDefault);
    if (updates.isDefault) {
      await AccountingPaymentMethod.update({ isDefault: false }, { where: { agencyId }, transaction });
      updates.isActive = true;
    }
    await method.update(updates, { transaction });
    const defaultCount = await AccountingPaymentMethod.count({ where: { agencyId, isActive: true, isDefault: true }, transaction });
    if (!defaultCount) {
      const first = await AccountingPaymentMethod.findOne({
        where: { agencyId, isActive: true },
        order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
        transaction,
      });
      if (first) await first.update({ isDefault: true }, { transaction });
    }
    await transaction.commit();
    return getPaymentMethod(agencyId, id, null, { activeOnly: false });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getPostingRuleLedgers(agencyId, transaction = null) {
  await ensureDefaultChartOfAccounts(agencyId, transaction);
  const agency = await Agency.findOne({ where: { id: agencyId }, transaction });
  const configured = agency?.accountingSettings?.postingRules || {};
  const result = {};

  for (const [key, fallbackCode] of Object.entries(POSTING_RULE_DEFAULT_CODES)) {
    let ledger = null;
    const configuredId = configured[key];
    if (configuredId) {
      ledger = await AccountingLedger.findOne({ where: { id: configuredId, agencyId, isActive: true }, transaction });
    }
    if (!ledger) ledger = await getLedgerByCode(agencyId, fallbackCode, transaction);
    result[key] = ledger;
  }

  return result;
}

async function getPostingRules(agencyId) {
  const ledgers = await getPostingRuleLedgers(agencyId);
  return {
    salesLedgerId: ledgers.salesLedgerId?.id || null,
    commissionSalesLedgerId: ledgers.commissionSalesLedgerId?.id || null,
    customerAdvanceLedgerId: ledgers.customerAdvanceLedgerId?.id || null,
    tradeDebtorsLedgerId: ledgers.tradeDebtorsLedgerId?.id || null,
    tradeCreditorsLedgerId: ledgers.tradeCreditorsLedgerId?.id || null,
    vendorExpenseLedgerId: ledgers.vendorExpenseLedgerId?.id || null,
    ledgers,
  };
}

async function updatePostingRules(agencyId, payload = {}) {
  const allowed = Object.keys(POSTING_RULE_DEFAULT_CODES);
  const updates = {};
  for (const key of allowed) {
    if (payload[key] === undefined) continue;
    if (payload[key] === null || payload[key] === '') {
      updates[key] = null;
      continue;
    }
    const ledger = await AccountingLedger.findOne({ where: { id: payload[key], agencyId, isActive: true } });
    if (!ledger || ledger.isGroup) {
      throw Object.assign(new Error('Posting rule ledger must be an active posting ledger'), {
        statusCode: 400,
        code: 'INVALID_POSTING_RULE_LEDGER',
      });
    }
    updates[key] = ledger.id;
  }

  const agency = await Agency.findOne({ where: { id: agencyId } });
  if (!agency) throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  const accountingSettings = agency.accountingSettings || {};
  await agency.update({
    accountingSettings: {
      ...accountingSettings,
      postingRules: {
        ...(accountingSettings.postingRules || {}),
        ...updates,
      },
    },
  });
  return getPostingRules(agencyId);
}

// Atomic, gap-free sequential counter per (agency, scope). The INSERT … ON CONFLICT
// upsert takes a row lock, so concurrent transactions SERIALIZE on the same scope —
// they can neither collide on a number nor skip one. Because it runs inside the caller's
// transaction, a rollback also rolls back the increment (no orphan gap). `seedValue` is
// the highest number already issued via the legacy count()+1 scheme; GREATEST() lets the
// counter adopt that high-water mark on first use without ever re-issuing an old number.
async function nextSequentialNumber(agencyId, scopeKey, seedValue = 0, transaction = null) {
  const [rows] = await sequelize.query(
    `INSERT INTO accounting_counters (id, agency_id, scope_key, value, created_at, updated_at)
     VALUES (gen_random_uuid(), :agencyId, :scopeKey, :seedValue + 1, NOW(), NOW())
     ON CONFLICT (agency_id, scope_key)
     DO UPDATE SET value = GREATEST(accounting_counters.value, EXCLUDED.value - 1) + 1, updated_at = NOW()
     RETURNING value`,
    { replacements: { agencyId, scopeKey, seedValue }, transaction },
  );
  return Number(rows[0].value);
}

function periodScope(prefix) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${yearMonth}-`;
}

async function generateReferenceNumber(agencyId, type, transaction = null) {
  const startsWith = periodScope(JOURNAL_PREFIX[type] || 'JE');
  const legacyMax = await JournalEntry.count({ where: { agencyId, referenceNumber: { [Op.like]: `${startsWith}%` } }, transaction });
  const seq = await nextSequentialNumber(agencyId, startsWith, legacyMax, transaction);
  return `${startsWith}${String(seq).padStart(4, '0')}`;
}

async function generateInvoiceNumber(agencyId, transaction = null) {
  const startsWith = periodScope(JOURNAL_PREFIX.INVOICE);
  const legacyMax = await AccountInvoice.count({ where: { agencyId, invoiceNumber: { [Op.like]: `${startsWith}%` } }, transaction });
  const seq = await nextSequentialNumber(agencyId, startsWith, legacyMax, transaction);
  return `${startsWith}${String(seq).padStart(4, '0')}`;
}

function assertBalanced(lines) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw Object.assign(new Error('A journal entry needs at least two lines'), { statusCode: 400, code: 'INVALID_LINES' });
  }

  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    const debit = toInt(line.debit);
    const credit = toInt(line.credit);
    if (!line.ledgerId) {
      throw Object.assign(new Error('Every journal line needs a ledger'), { statusCode: 400, code: 'LEDGER_REQUIRED' });
    }
    if (debit < 0 || credit < 0 || (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      throw Object.assign(new Error('Each journal line must have either a debit or a credit amount'), { statusCode: 400, code: 'INVALID_AMOUNT' });
    }
    totalDebit += debit;
    totalCredit += credit;
  }

  if (totalDebit !== totalCredit) {
    throw Object.assign(new Error(`Unbalanced journal entry: debits ${totalDebit} must equal credits ${totalCredit}`), {
      statusCode: 400,
      code: 'UNBALANCED_JOURNAL_ENTRY',
    });
  }
}

async function validateLedgersBelongToAgency(agencyId, lines, transaction = null) {
  const ledgerIds = [...new Set(lines.map((line) => line.ledgerId))];
  const ledgers = await AccountingLedger.findAll({
    where: { agencyId, id: { [Op.in]: ledgerIds }, isActive: true },
    attributes: ['id', 'isGroup'],
    transaction,
  });
  if (ledgers.length !== ledgerIds.length) {
    throw Object.assign(new Error('One or more ledgers were not found for this agency'), { statusCode: 400, code: 'INVALID_LEDGER' });
  }
  // Postings must hit leaf ledgers only — posting to a GROUP corrupts rollup balances.
  const groupLedger = ledgers.find((ledger) => ledger.isGroup);
  if (groupLedger) {
    throw Object.assign(new Error('Cannot post a journal line to a group ledger; use a leaf account'), { statusCode: 400, code: 'GROUP_LEDGER_NOT_POSTABLE' });
  }
}

async function createJournalEntry(agencyId, payload, options = {}) {
  const transaction = options.transaction || await sequelize.transaction();
  const shouldCommit = !options.transaction;
  try {
    await ensureDefaultChartOfAccounts(agencyId, transaction);

    const type = payload.type || 'JOURNAL';
    const lines = (payload.lines || []).map((line) => ({
      ledgerId: line.ledgerId,
      description: line.description || payload.description || null,
      debit: toInt(line.debit),
      credit: toInt(line.credit),
      partyType: line.partyType || null,
      partyId: line.partyId || null,
    }));

    assertBalanced(lines);
    await validateLedgersBelongToAgency(agencyId, lines, transaction);

    // Reject future-dated postings (they distort current-period financials and aging),
    // unless explicitly flagged. Opening balances are back-dated, so only the future bound matters.
    const entryDate = payload.date || todayDate();
    if (!payload.allowFutureDate && entryDate > todayDate()) {
      throw Object.assign(new Error('Cannot post a journal entry with a future date'), { statusCode: 400, code: 'FUTURE_DATED_ENTRY' });
    }
    // Period lock: block posting into a closed period. Opening balances back-date
    // intentionally and pass allowLockedPeriod to bypass.
    if (!payload.allowLockedPeriod) {
      const lock = await getBooksLockDate(agencyId, transaction);
      if (lock && entryDate <= lock) {
        throw Object.assign(new Error(`Books are locked through ${lock}; cannot post an entry dated ${entryDate}`), { statusCode: 400, code: 'PERIOD_LOCKED' });
      }
    }

    if (payload.sourceType && payload.sourceId) {
      const existing = await JournalEntry.findOne({
        where: { agencyId, sourceType: payload.sourceType, sourceId: String(payload.sourceId), type },
        include: [{ model: JournalLine, as: 'lines', include: [{ model: AccountingLedger, as: 'ledger' }] }],
        transaction,
      });
      if (existing) {
        if (shouldCommit) await transaction.commit();
        return existing;
      }
    }

    const referenceNumber = payload.referenceNumber || await generateReferenceNumber(agencyId, type, transaction);
    const entry = await JournalEntry.create({
      agencyId,
      createdByAgentId: payload.createdByAgentId || null,
      date: payload.date || todayDate(),
      referenceNumber,
      type,
      sourceType: payload.sourceType || null,
      sourceId: payload.sourceId ? String(payload.sourceId) : null,
      description: payload.description || null,
      metadata: payload.metadata || {},
    }, { transaction });

    await JournalLine.bulkCreate(lines.map((line) => ({
      agencyId,
      journalEntryId: entry.id,
      ledgerId: line.ledgerId,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      partyType: line.partyType,
      partyId: line.partyId,
    })), { transaction });

    const created = await getJournalEntry(agencyId, entry.id, transaction);
    if (shouldCommit) await transaction.commit();
    return created;
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    throw error;
  }
}

// Posted entries are IMMUTABLE. The only sanctioned way to undo one is a reversal:
// a new balanced entry that swaps every line's debit/credit, leaving a permanent audit
// trail on both sides. Idempotent — reversing twice returns the existing reversal.
async function reverseJournalEntry(agencyId, entryId, options = {}) {
  const transaction = options.transaction || await sequelize.transaction();
  const shouldCommit = !options.transaction;
  try {
    const original = await JournalEntry.findOne({
      where: { id: entryId, agencyId },
      include: [{ model: JournalLine, as: 'lines' }],
      transaction,
    });
    if (!original) throw Object.assign(new Error('Journal entry not found'), { statusCode: 404, code: 'NOT_FOUND' });
    const meta = original.metadata || {};
    if (meta.reversesEntryId) {
      throw Object.assign(new Error('A reversal entry cannot itself be reversed'), { statusCode: 400, code: 'CANNOT_REVERSE_REVERSAL' });
    }
    if (meta.reversedByEntryId) {
      const existing = await JournalEntry.findOne({ where: { id: meta.reversedByEntryId, agencyId }, transaction });
      if (existing) {
        if (shouldCommit) await transaction.commit();
        return existing;
      }
    }
    const lines = (original.lines || []).map((line) => ({
      ledgerId: line.ledgerId,
      description: `Reversal: ${line.description || ''}`.trim(),
      debit: toInt(line.credit),
      credit: toInt(line.debit),
      partyType: line.partyType || null,
      partyId: line.partyId || null,
    }));
    const reversal = await createJournalEntry(agencyId, {
      type: original.type,
      date: options.date || todayDate(),
      sourceType: 'REVERSAL',
      sourceId: original.id,
      createdByAgentId: options.agentId || null,
      description: `Reversal of ${original.referenceNumber}${options.reason ? ` — ${options.reason}` : ''}`,
      lines,
      metadata: { reversesEntryId: original.id, reason: options.reason || null },
      allowLockedPeriod: options.allowLockedPeriod || false,
    }, { transaction });
    await original.update({ metadata: { ...meta, reversedByEntryId: reversal.id, reversedAt: todayDate() } }, { transaction });
    if (shouldCommit) await transaction.commit();
    return reversal;
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    throw error;
  }
}

async function getJournalEntry(agencyId, id, transaction = null) {
  return JournalEntry.findOne({
    where: { id, agencyId },
    include: [{ model: JournalLine, as: 'lines', include: [{ model: AccountingLedger, as: 'ledger' }] }],
    order: [[{ model: JournalLine, as: 'lines' }, 'createdAt', 'ASC']],
    transaction,
  });
}

async function listJournalEntries(agencyId, filters = {}) {
  const page = Math.max(1, parseInt(filters.page || 1, 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(filters.pageSize || filters.limit || 20, 10)));
  const where = { agencyId };
  if (filters.type) where.type = filters.type;
  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date[Op.gte] = filters.dateFrom;
    if (filters.dateTo) where.date[Op.lte] = filters.dateTo;
  }
  if (filters.search) {
    const search = `%${String(filters.search).trim()}%`;
    where[Op.or] = [
      { referenceNumber: { [Op.iLike]: search } },
      { description: { [Op.iLike]: search } },
      { type: { [Op.iLike]: search } },
    ];
  }

  const { count, rows } = await JournalEntry.findAndCountAll({
    where,
    include: [{ model: JournalLine, as: 'lines', include: [{ model: AccountingLedger, as: 'ledger' }] }],
    distinct: true,
    order: [['date', 'DESC'], ['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return { data: rows, total: count, page, pageSize };
}

async function listLedgers(agencyId, filters = {}) {
  await ensureDefaultChartOfAccounts(agencyId);
  const where = { agencyId };
  if (filters.activeOnly !== false) where.isActive = true;
  if (filters.type) where.type = filters.type;
  if (filters.isGroup !== undefined) where.isGroup = String(filters.isGroup) === 'true';
  if (filters.search) {
    const search = `%${String(filters.search).trim()}%`;
    where[Op.or] = [{ name: { [Op.iLike]: search } }, { code: { [Op.iLike]: search } }];
  }
  return AccountingLedger.findAll({ where, order: [['code', 'ASC']] });
}

function buildLedgerTree(rows, parentId = null) {
  return rows
    .filter((row) => String(row.parentId || '') === String(parentId || ''))
    .map((row) => ({
      ...row.toJSON(),
      children: buildLedgerTree(rows, row.id),
    }));
}

// Natural balance sign per account type (positive = the side the account normally sits on).
function naturalBalance(type, debit, credit) {
  return ['ASSET', 'EXPENSE'].includes(type) ? debit - credit : credit - debit;
}

// Build the tree and attach own balance + recursive rollup totals to every node.
function buildLedgerTreeWithBalances(rows, byLedger, parentId = null) {
  return rows
    .filter((row) => String(row.parentId || '') === String(parentId || ''))
    .map((row) => {
      const children = buildLedgerTreeWithBalances(rows, byLedger, row.id);
      const own = byLedger.get(row.id) || { debit: 0, credit: 0 };
      const balance = naturalBalance(row.type, own.debit, own.credit);
      // Rollup = own totals + every descendant's totals.
      const rollup = children.reduce(
        (acc, child) => ({
          debit: acc.debit + child.rollup.debit,
          credit: acc.credit + child.rollup.credit,
        }),
        { debit: own.debit, credit: own.credit },
      );
      return {
        ...row.toJSON(),
        debit: own.debit,
        credit: own.credit,
        balance,
        rollup: {
          debit: rollup.debit,
          credit: rollup.credit,
          balance: naturalBalance(row.type, rollup.debit, rollup.credit),
        },
        children,
      };
    });
}

async function getLedgerTree(agencyId, filters = {}) {
  const rows = await listLedgers(agencyId, filters);
  if (!filters.withBalances) return buildLedgerTree(rows);

  const lines = await JournalLine.findAll({
    where: { agencyId },
    include: [{ model: JournalEntry, as: 'journalEntry', attributes: ['date', 'sourceType'] }],
  });
  const byLedger = new Map();
  for (const line of lines) {
    // Always include opening balances (see getTrialBalance) so ledger balances are true.
    const isOpening = line.journalEntry.sourceType === 'OPENING_BALANCE';
    if (!isOpening) {
      if (filters.dateFrom && line.journalEntry.date < filters.dateFrom) continue;
      if (filters.dateTo && line.journalEntry.date > filters.dateTo) continue;
    }
    const current = byLedger.get(line.ledgerId) || { debit: 0, credit: 0 };
    current.debit += toInt(line.debit);
    current.credit += toInt(line.credit);
    byLedger.set(line.ledgerId, current);
  }
  return buildLedgerTreeWithBalances(rows, byLedger);
}

// Next sequential code for a type, e.g. ASSET -> 1018. Ignores group/suffixed codes (G4100, 4201IC).
async function getNextLedgerCode(agencyId, type) {
  await ensureDefaultChartOfAccounts(agencyId);
  const prefix = TYPE_CODE_PREFIX[type] || '9';
  const ledgers = await AccountingLedger.findAll({ where: { agencyId, type }, attributes: ['code'] });
  let max = Number(`${prefix}000`);
  for (const ledger of ledgers) {
    if (/^\d+$/.test(ledger.code) && ledger.code.startsWith(prefix)) {
      const numeric = Number(ledger.code);
      if (Number.isFinite(numeric) && numeric > max) max = numeric;
    }
  }
  return { code: String(max + 1) };
}

// Posts a back-dated opening balance for a ledger, balanced against Opening Balance Equity.
async function postOpeningBalance(agencyId, ledger, amount, transaction) {
  const obe = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.OPENING_BALANCE_EQUITY, transaction);
  const debitSide = ['ASSET', 'EXPENSE'].includes(ledger.type);
  // A positive opening balance increases the ledger's normal side.
  const ledgerDebit = (debitSide && amount > 0) || (!debitSide && amount < 0) ? Math.abs(amount) : 0;
  const ledgerCredit = ledgerDebit ? 0 : Math.abs(amount);
  const date = new Date();
  date.setFullYear(date.getFullYear() - 10); // back-date so it sorts before normal activity
  return createJournalEntry(agencyId, {
    type: 'JOURNAL',
    date: date.toISOString().slice(0, 10),
    sourceType: 'OPENING_BALANCE',
    sourceId: ledger.id,
    description: `Opening balance - ${ledger.name}`,
    allowLockedPeriod: true, // back-dated by design; not subject to the period lock
    lines: [
      { ledgerId: ledger.id, debit: ledgerDebit, credit: ledgerCredit },
      { ledgerId: obe.id, debit: ledgerCredit, credit: ledgerDebit },
    ],
  }, { transaction });
}

async function createLedger(agencyId, payload, outerTransaction = null) {
  await ensureDefaultChartOfAccounts(agencyId, outerTransaction);
  const code = payload.code || (await getNextLedgerCode(agencyId, payload.type)).code;
  const transaction = outerTransaction || await sequelize.transaction();
  const shouldCommit = !outerTransaction;
  try {
    const ledger = await AccountingLedger.create({
      agencyId,
      parentId: payload.parentId || null,
      code,
      name: payload.name,
      type: payload.type,
      groupType: payload.groupType || null,
      financialStatement: payload.financialStatement,
      isGroup: Boolean(payload.isGroup),
      systemCreated: false,
      currency: payload.currency || 'INR',
      gstin: payload.gstin || null,
    }, { transaction });
    const opening = toInt(payload.openingBalance);
    if (opening && !ledger.isGroup) {
      await postOpeningBalance(agencyId, ledger, opening, transaction);
    }
    if (shouldCommit) await transaction.commit();
    return ledger;
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    throw error;
  }
}

async function ensureCustomerLedger(agencyId, customerOrId, outerTransaction = null) {
  const transaction = outerTransaction || await sequelize.transaction();
  const shouldCommit = !outerTransaction;
  try {
    await ensureDefaultChartOfAccounts(agencyId, transaction);
    const customer = typeof customerOrId === 'string'
      ? await Customer.findOne({ where: { id: customerOrId, agencyId }, transaction })
      : customerOrId;
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404, code: 'CUSTOMER_NOT_FOUND' });

    if (customer.ledgerId) {
      const existingLedger = await AccountingLedger.findOne({
        where: { id: customer.ledgerId, agencyId },
        transaction,
      });
      if (existingLedger) {
        if (shouldCommit) await transaction.commit();
        return existingLedger;
      }
    }

    const debtors = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.TRADE_DEBTORS, transaction);
    const ledger = await createLedger(agencyId, {
      name: customerLedgerName(customer),
      type: 'ASSET',
      parentId: debtors.id,
      isGroup: false,
      financialStatement: 'BALANCE_SHEET',
      gstin: customer.gstin || null,
    }, transaction);
    await customer.update({ ledgerId: ledger.id }, { transaction });

    if (shouldCommit) await transaction.commit();
    return ledger;
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    throw error;
  }
}

function isSystemLedgerCode(code) {
  return DEFAULT_CHART.some((item) => item.code === code);
}

async function canDeleteLedger(agencyId, id) {
  const ledger = await AccountingLedger.findOne({ where: { id, agencyId } });
  if (!ledger) throw Object.assign(new Error('Ledger not found'), { statusCode: 404, code: 'NOT_FOUND' });
  if (isSystemLedgerCode(ledger.code)) return { canDelete: false, reason: 'System ledger cannot be deleted' };
  const childCount = await AccountingLedger.count({ where: { agencyId, parentId: id } });
  if (childCount > 0) return { canDelete: false, reason: 'Ledger has child ledgers' };
  const lineCount = await JournalLine.count({ where: { agencyId, ledgerId: id } });
  if (lineCount > 0) return { canDelete: false, reason: 'Ledger has posted transactions' };
  return { canDelete: true };
}

async function deleteLedger(agencyId, id) {
  const check = await canDeleteLedger(agencyId, id);
  if (!check.canDelete) throw Object.assign(new Error(check.reason), { statusCode: 400, code: 'LEDGER_DELETE_BLOCKED' });
  await AccountingLedger.destroy({ where: { id, agencyId } });
  return { deleted: true };
}

// Moves all transactions and child ledgers from source into target, then removes source.
async function mergeLedgers(agencyId, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) {
    throw Object.assign(new Error('Source and target ledgers must differ'), { statusCode: 400, code: 'BAD_REQUEST' });
  }
  const transaction = await sequelize.transaction();
  try {
    const source = await AccountingLedger.findOne({ where: { id: sourceId, agencyId }, transaction });
    const target = await AccountingLedger.findOne({ where: { id: targetId, agencyId }, transaction });
    if (!source || !target) throw Object.assign(new Error('Ledger not found'), { statusCode: 404, code: 'NOT_FOUND' });
    if (source.type !== target.type) throw Object.assign(new Error('Ledgers must be the same type to merge'), { statusCode: 400, code: 'BAD_REQUEST' });
    if (source.systemCreated || isSystemLedgerCode(source.code)) throw Object.assign(new Error('System ledger cannot be merged away'), { statusCode: 400, code: 'BAD_REQUEST' });

    // History integrity: re-pointing posted lines to a different ledger would retroactively
    // rewrite past trial balances and financials. Refuse — deactivate the ledger instead.
    const postedLines = await JournalLine.count({ where: { agencyId, ledgerId: sourceId }, transaction });
    if (postedLines > 0) {
      throw Object.assign(new Error('Cannot merge a ledger that has posted transactions; deactivate it instead to preserve history'), { statusCode: 400, code: 'LEDGER_HAS_TRANSACTIONS' });
    }

    const [movedLines] = await JournalLine.update({ ledgerId: targetId }, { where: { agencyId, ledgerId: sourceId }, transaction });
    await AccountingLedger.update({ parentId: targetId }, { where: { agencyId, parentId: sourceId }, transaction });
    await AccountingLedger.destroy({ where: { id: sourceId, agencyId }, transaction });
    await transaction.commit();
    return { merged: true, movedLines, target: target.toJSON() };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function updateLedger(agencyId, id, payload) {
  const ledger = await AccountingLedger.findOne({ where: { id, agencyId } });
  if (!ledger) throw Object.assign(new Error('Ledger not found'), { statusCode: 404, code: 'NOT_FOUND' });
  await ledger.update({
    parentId: payload.parentId === undefined ? ledger.parentId : payload.parentId,
    code: payload.code === undefined ? ledger.code : payload.code,
    name: payload.name === undefined ? ledger.name : payload.name,
    type: payload.type === undefined ? ledger.type : payload.type,
    groupType: payload.groupType === undefined ? ledger.groupType : payload.groupType,
    financialStatement: payload.financialStatement === undefined ? ledger.financialStatement : payload.financialStatement,
    isGroup: payload.isGroup === undefined ? ledger.isGroup : Boolean(payload.isGroup),
    currency: payload.currency === undefined ? ledger.currency : payload.currency,
    gstin: payload.gstin === undefined ? ledger.gstin : payload.gstin,
    isActive: payload.isActive === undefined ? ledger.isActive : Boolean(payload.isActive),
  });
  return ledger;
}

async function getLedgerBalance(agencyId, ledgerId) {
  const ledger = await AccountingLedger.findOne({ where: { agencyId, id: ledgerId } });
  if (!ledger) throw Object.assign(new Error('Ledger not found'), { statusCode: 404, code: 'NOT_FOUND' });

  const lines = await JournalLine.findAll({ where: { agencyId, ledgerId }, attributes: ['debit', 'credit'] });
  const debit = lines.reduce((sum, line) => sum + toInt(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + toInt(line.credit), 0);
  const balance = ['ASSET', 'EXPENSE'].includes(ledger.type) ? debit - credit : credit - debit;
  return { ledgerId, debit, credit, balance };
}

async function createVoucher(agencyId, type, payload, agentId) {
  return createJournalEntry(agencyId, {
    ...payload,
    type,
    createdByAgentId: agentId,
    sourceType: payload.sourceType || 'MANUAL',
    sourceId: payload.sourceId || undefined,
  });
}

async function postBookingInvoice(bookingId, agencyId, agentId = null, transaction = null) {
  const ownTransaction = transaction || await sequelize.transaction();
  const shouldCommit = !transaction;
  try {
    await ensureDefaultChartOfAccounts(agencyId, ownTransaction);
    const booking = await Booking.findOne({
      where: { id: bookingId, agencyId },
      include: [
        { model: Customer, as: 'customer' },
        { model: Package, as: 'package' },
        { model: Property, as: 'property' },
        { model: Cruise, as: 'cruise' },
        { model: Visa, as: 'visa' },
        { model: Service, as: 'service' },
      ],
      transaction: ownTransaction,
    });
    if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
    const agency = await Agency.findByPk(agencyId, { transaction: ownTransaction });

    const existingInvoice = await AccountInvoice.findOne({ where: { agencyId, bookingId }, transaction: ownTransaction });
    if (existingInvoice) {
      if (shouldCommit) await ownTransaction.commit();
      return existingInvoice;
    }

    const debtors = await ensureCustomerLedger(agencyId, booking.customer || booking.customerId, ownTransaction);
    const postingRules = await getPostingRuleLedgers(agencyId, ownTransaction);
    // COMMISSION_ONLY bookings: the agency only earns (and invoices) its commission.
    // The property balance is paid by the customer directly at the property, so it must
    // never reach the ledgers — post the commission, not the full package total. The
    // revenue head is settings-driven: commissionSalesLedgerId vs salesLedgerId.
    const isCommissionOnly = booking.settlementType === 'COMMISSION_ONLY';
    const sales = isCommissionOnly ? postingRules.commissionSalesLedgerId : postingRules.salesLedgerId;
    const invoiceableAmount = isCommissionOnly
      ? toInt(booking.commissionAmount ?? booking.advancePaid)
      : toInt(booking.totalAmount);
    const tax = calculateIndianSalesTax(invoiceableAmount, getSalesGstConfig(agency, booking), agency, booking.customer);
    const totalAmount = tax.totalAmount;
    const invoiceNumber = await generateInvoiceNumber(agencyId, ownTransaction);
    const invoiceLines = [
      { ledgerId: debtors.id, debit: totalAmount, description: booking.customer?.name || booking.bookingRef, partyType: 'CUSTOMER', partyId: booking.customerId },
      { ledgerId: sales.id, credit: tax.taxableAmount, description: getBookingItemName(booking) },
    ];
    await addOutputGstLines(agencyId, invoiceLines, tax, ownTransaction, `Output GST ${invoiceNumber}`);

    const entry = await createJournalEntry(agencyId, {
      type: 'INVOICE',
      date: todayDate(),
      sourceType: 'BOOKING',
      sourceId: booking.id,
      createdByAgentId: agentId,
      referenceNumber: invoiceNumber,
      description: `Travel booking invoice ${booking.bookingRef}`,
      lines: invoiceLines,
      metadata: {
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        tax: tax.taxBreakup,
        settlementType: booking.settlementType,
        ...(isCommissionOnly
          ? { packageTotal: toInt(booking.totalAmount), balanceAtProperty: Math.max(0, toInt(booking.totalAmount) - invoiceableAmount) }
          : {}),
      },
    }, { transaction: ownTransaction });

    const paidAmount = await getPaidPaymentTotal(agencyId, booking.id, ownTransaction);
    const invoice = await AccountInvoice.create({
      agencyId,
      customerId: booking.customerId,
      bookingId: booking.id,
      journalEntryId: entry.id,
      invoiceNumber,
      invoiceDate: todayDate(),
      dueDate: booking.travelDate,
      status: invoiceStatus(totalAmount, paidAmount),
      taxableAmount: tax.taxableAmount,
      gstAmount: tax.gstAmount,
      cgstAmount: tax.cgstAmount,
      sgstAmount: tax.sgstAmount,
      igstAmount: tax.igstAmount,
      totalAmount,
      paidAmount,
      gstin: tax.customerGstin,
      supplierGstin: tax.supplierGstin,
      supplierStateCode: tax.supplierStateCode,
      placeOfSupplyStateCode: tax.placeOfSupplyStateCode,
      gstTreatment: tax.gstTreatment,
      taxType: tax.taxType,
      gstRateBps: tax.gstRateBps,
      taxBreakup: tax.taxBreakup,
      narration: `Auto-created from booking ${booking.bookingRef}`,
      metadata: { bookingRef: booking.bookingRef, tax: tax.taxBreakup },
    }, { transaction: ownTransaction });

    if (shouldCommit) await ownTransaction.commit();

    // Generate and upload PDF asynchronously
    setTimeout(async () => {
      try {
        const invoicePdfService = require('./invoicePdfService');
        const mediaService = require('./mediaService');
        const pdfBuffer = await invoicePdfService.generateInvoicePdf(booking.id, invoice);
        const uploadResult = await mediaService.uploadInvoicePdf(pdfBuffer, agencyId, invoice.invoiceNumber);
        await invoice.update({ pdfUrl: uploadResult.secureUrl });

        // Auto-send the invoice to the customer over WhatsApp when enabled.
        // Routes through the shared sender so it uses the selected approved Meta
        // template (PDF as DOCUMENT header) when configured, else a plain doc.
        const documentDeliveryService = require('./documentDeliveryService');
        const agencyRecord = await Agency.findByPk(agencyId);
        if (agencyRecord && documentDeliveryService.isAutoSendEnabled(agencyRecord, 'invoice')) {
          const customer = await Customer.findByPk(booking.customerId);
          if (customer && customer.phone) {
            await documentDeliveryService.sendUploadedDocument({
              docType: 'invoice',
              agency: agencyRecord,
              recipient: { customerId: booking.customerId, phone: customer.phone, name: customer.name },
              url: uploadResult.secureUrl,
              filename: `${invoice.invoiceNumber || 'invoice'}.pdf`,
            });
          }
        }
      } catch (pdfErr) {
        console.warn('[AccountingService] PDF generation/upload/send failed:', pdfErr.message);
      }
    }, 0);

    return invoice;
  } catch (error) {
    if (shouldCommit) await ownTransaction.rollback();
    // Concurrent post (webhook + booking-confirm firing together): the other
    // transaction won the unique (agency_id, booking_id) / source-dedupe race.
    // Return its committed invoice rather than surfacing a 500 on a real event.
    if (error.name === 'SequelizeUniqueConstraintError') {
      const winner = await AccountInvoice.findOne({ where: { agencyId, bookingId } });
      if (winner) return winner;
    }
    throw error;
  }
}

async function postPaymentReceipt(paymentId, agencyId, transaction = null) {
  const ownTransaction = transaction || await sequelize.transaction();
  const shouldCommit = !transaction;
  try {
    await ensureDefaultChartOfAccounts(agencyId, ownTransaction);
    const payment = await Payment.findOne({
      where: { id: paymentId, agencyId },
      include: [{ model: Booking, as: 'booking', include: [{ model: Customer, as: 'customer' }] }],
      transaction: ownTransaction,
    });
    if (!payment || payment.status !== 'PAID') {
      if (shouldCommit) await ownTransaction.commit();
      return null;
    }

    const paymentMethod = await resolvePaymentMethod(agencyId, {
      paymentMethodId: payment.paymentMethodId,
    }, ownTransaction);
    if (!paymentMethod?.ledger) {
      throw Object.assign(new Error('Payment method ledger not found'), { statusCode: 400, code: 'PAYMENT_METHOD_LEDGER_MISSING' });
    }
    const debtors = payment.booking?.customer
      ? await ensureCustomerLedger(agencyId, payment.booking.customer, ownTransaction)
      : await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.TRADE_DEBTORS, ownTransaction);
    const invoice = await AccountInvoice.findOne({ where: { agencyId, bookingId: payment.bookingId }, transaction: ownTransaction });
    const postingRules = await getPostingRuleLedgers(agencyId, ownTransaction);
    const advances = postingRules.customerAdvanceLedgerId;

    const isAdvance = payment.type === 'ADVANCE';
    // If an invoice already exists, the receipt is a settlement of that receivable.
    // Customer Advances is only correct for money received before receivable recognition.
    const creditLedger = isAdvance && !invoice && advances ? advances : debtors;

    const entry = await createJournalEntry(agencyId, {
      type: 'RECEIPT',
      date: payment.paidAt ? new Date(payment.paidAt).toISOString().slice(0, 10) : todayDate(),
      sourceType: 'PAYMENT',
      sourceId: payment.id,
      description: `Receipt for booking ${payment.booking?.bookingRef || ''}`.trim(),
      lines: [
        { ledgerId: paymentMethod.ledger.id, debit: payment.amount, description: payment.razorpayPaymentId || paymentMethod.name || 'Customer payment' },
        { ledgerId: creditLedger.id, credit: payment.amount, description: payment.booking?.customer?.name || (isAdvance ? 'Advance receipt' : 'Customer receipt'), partyType: 'CUSTOMER', partyId: payment.booking?.customerId || null },
      ],
      metadata: { paymentId: payment.id, bookingId: payment.bookingId, razorpayPaymentId: payment.razorpayPaymentId, paymentMethodId: paymentMethod.id },
    }, { transaction: ownTransaction });

    if (invoice) {
      const paidAmount = await getPaidPaymentTotal(agencyId, payment.bookingId, ownTransaction);
      await invoice.update({
        paidAmount,
        status: invoiceStatus(toInt(invoice.totalAmount), paidAmount),
      }, { transaction: ownTransaction });
    }

    if (shouldCommit) await ownTransaction.commit();
    return entry;
  } catch (error) {
    if (shouldCommit) await ownTransaction.rollback();
    throw error;
  }
}

async function recordCustomerReceipt(agencyId, payload, agentId = null) {
  const transaction = await sequelize.transaction();
  try {
    await ensureDefaultChartOfAccounts(agencyId, transaction);

    const booking = await Booking.findOne({
      where: { id: payload.bookingId, agencyId },
      include: [{ model: Customer, as: 'customer' }],
      transaction,
    });
    if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404, code: 'NOT_FOUND' });

    await postBookingInvoice(booking.id, agencyId, agentId, transaction);

    const amount = toInt(payload.amount);
    if (amount <= 0) throw Object.assign(new Error('Receipt amount must be positive'), { statusCode: 400, code: 'BAD_REQUEST' });

    const paidToDate = toInt(await Payment.sum('amount', {
      where: { agencyId, bookingId: booking.id, status: 'PAID' },
      transaction,
    }));
    const receiptType = paidToDate + amount >= toInt(booking.totalAmount) ? 'FULL' : 'BALANCE';

    const payment = await Payment.create({
      bookingId: booking.id,
      agencyId,
      amount,
      paymentMethodId: payload.paymentMethodId || null,
      status: 'PAID',
      type: receiptType,
      razorpayPaymentId: payload.referenceNumber || null,
      paidAt: payload.receiptDate ? new Date(payload.receiptDate) : new Date(),
    }, { transaction });

    await booking.update({
      advancePaid: paidToDate + amount,
      status: paidToDate + amount >= toInt(booking.totalAmount) ? 'CONFIRMED' : booking.status,
    }, { transaction });

    const entry = await postPaymentReceipt(payment.id, agencyId, transaction);

    await transaction.commit();
    return { payment, entry };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function generateCreditNoteNumber(agencyId, transaction = null) {
  const startsWith = periodScope(JOURNAL_PREFIX.CREDIT_NOTE);
  const legacyMax = await CreditNote.count({ where: { agencyId, creditNoteNumber: { [Op.like]: `${startsWith}%` } }, transaction });
  const seq = await nextSequentialNumber(agencyId, startsWith, legacyMax, transaction);
  return `${startsWith}${String(seq).padStart(4, '0')}`;
}

// Issues a credit note against an invoice: reverses revenue (+ output GST) and reduces the receivable.
async function createCreditNote(agencyId, payload, agentId = null) {
  const transaction = await sequelize.transaction();
  try {
    await ensureDefaultChartOfAccounts(agencyId, transaction);
    const invoice = await AccountInvoice.findOne({
      where: { id: payload.invoiceId, agencyId },
      include: [{ model: Customer, as: 'customer' }],
      transaction,
    });
    if (!invoice) throw Object.assign(new Error('Invoice not found'), { statusCode: 404, code: 'NOT_FOUND' });

    let taxableAmount = toInt(payload.taxableAmount);
    let gstAmount = payload.gstAmount === undefined ? 0 : toInt(payload.gstAmount);
    let totalAmount = toInt(payload.totalAmount) || (taxableAmount + gstAmount);
    if (toInt(payload.totalAmount) > 0 && toInt(invoice.totalAmount) > 0) {
      const ratio = totalAmount / toInt(invoice.totalAmount);
      const cgstAmount = Math.round(toInt(invoice.cgstAmount) * ratio);
      const sgstAmount = Math.round(toInt(invoice.sgstAmount) * ratio);
      const igstAmount = Math.round(toInt(invoice.igstAmount) * ratio);
      gstAmount = cgstAmount + sgstAmount + igstAmount;
      taxableAmount = totalAmount - gstAmount;
    } else {
      totalAmount = taxableAmount + gstAmount;
    }
    if (totalAmount <= 0) throw Object.assign(new Error('Credit note amount must be positive'), { statusCode: 400, code: 'BAD_REQUEST' });

    const priorCredits = toInt(await CreditNote.sum('totalAmount', { where: { agencyId, invoiceId: invoice.id, status: 'ISSUED' }, transaction }));
    if (priorCredits + totalAmount > toInt(invoice.totalAmount)) {
      throw Object.assign(new Error('Credit note exceeds the invoice value'), { statusCode: 400, code: 'CREDIT_EXCEEDS_INVOICE' });
    }

    const debtors = await ensureCustomerLedger(agencyId, invoice.customer || invoice.customerId, transaction);
    const sales = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.TRAVEL_SALES, transaction);
    const number = await generateCreditNoteNumber(agencyId, transaction);
    const split = toInt(payload.totalAmount) > 0 && toInt(invoice.totalAmount) > 0
      ? {
        cgstAmount: Math.round(toInt(invoice.cgstAmount) * (totalAmount / toInt(invoice.totalAmount))),
        sgstAmount: Math.round(toInt(invoice.sgstAmount) * (totalAmount / toInt(invoice.totalAmount))),
        igstAmount: Math.round(toInt(invoice.igstAmount) * (totalAmount / toInt(invoice.totalAmount))),
      }
      : splitIndianGst(gstAmount, invoice.taxType || (toInt(invoice.igstAmount) > 0 ? 'IGST' : 'CGST_SGST'));
    const tax = {
      taxType: invoice.taxType || (split.igstAmount > 0 ? 'IGST' : (split.cgstAmount || split.sgstAmount ? 'CGST_SGST' : 'NONE')),
      gstRateBps: toInt(invoice.gstRateBps),
      taxableAmount,
      gstAmount: split.cgstAmount + split.sgstAmount + split.igstAmount,
      totalAmount,
      ...split,
      taxBreakup: {
        taxSystem: 'INDIA_GST',
        sourceInvoiceNumber: invoice.invoiceNumber,
        rateBps: toInt(invoice.gstRateBps),
        taxType: invoice.taxType || 'NONE',
        cgstAmount: split.cgstAmount,
        sgstAmount: split.sgstAmount,
        igstAmount: split.igstAmount,
      },
    };

    const lines = [{ ledgerId: sales.id, debit: taxableAmount, description: `Credit note ${number}` }];
    await addOutputGstReversalLines(agencyId, lines, tax, transaction);
    lines.push({ ledgerId: debtors.id, credit: totalAmount, description: invoice.customer?.name || invoice.invoiceNumber, partyType: 'CUSTOMER', partyId: invoice.customerId });

    const entry = await createJournalEntry(agencyId, {
      type: 'CREDIT_NOTE',
      date: payload.date || todayDate(),
      sourceType: 'CREDIT_NOTE',
      sourceId: number, // unique per note so partial credits aren't deduped together
      createdByAgentId: agentId,
      referenceNumber: number,
      description: `Credit note against ${invoice.invoiceNumber}${payload.reason ? ` - ${payload.reason}` : ''}`,
      lines,
    }, { transaction });

    const creditNote = await CreditNote.create({
      agencyId,
      invoiceId: invoice.id,
      journalEntryId: entry.id,
      creditNoteNumber: number,
      date: payload.date || todayDate(),
      taxableAmount,
      gstAmount: tax.gstAmount,
      cgstAmount: tax.cgstAmount,
      sgstAmount: tax.sgstAmount,
      igstAmount: tax.igstAmount,
      totalAmount,
      taxType: tax.taxType,
      gstRateBps: tax.gstRateBps,
      taxBreakup: tax.taxBreakup,
      reason: payload.reason || null,
      status: 'ISSUED',
    }, { transaction });

    // Void the invoice once fully credited so it drops out of receivables aging.
    const outstanding = toInt(invoice.totalAmount) - toInt(invoice.paidAmount);
    if (invoice.status !== 'PAID' && priorCredits + totalAmount >= outstanding) {
      await invoice.update({ status: 'VOID' }, { transaction });
    }

    await transaction.commit();
    return creditNote;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function listCreditNotes(agencyId, filters = {}) {
  const where = { agencyId };
  if (filters.status) where.status = filters.status;
  if (filters.invoiceId) where.invoiceId = filters.invoiceId;
  return CreditNote.findAll({
    where,
    include: [{ model: AccountInvoice, as: 'invoice', attributes: ['id', 'invoiceNumber', 'totalAmount', 'customerId'] }],
    order: [['createdAt', 'DESC']],
    limit: Math.min(Number(filters.limit) || 200, 500),
  });
}

async function listInvoices(agencyId, filters = {}) {
  const where = { agencyId };
  if (filters.status) where.status = filters.status;
  const rows = await AccountInvoice.findAll({
    where,
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: Booking, as: 'booking', attributes: ['id', 'bookingRef', 'travelDate'] },
    ],
    order: [['invoiceDate', 'DESC'], ['createdAt', 'DESC']],
    limit: Math.min(200, parseInt(filters.limit || 100, 10)),
  });
  return rows;
}

async function createReminder(agencyId, payload) {
  return AccountReminder.create({
    agencyId,
    relatedType: payload.relatedType,
    relatedId: payload.relatedId,
    title: payload.title,
    note: payload.note || null,
    dueAt: payload.dueAt,
    status: payload.status || 'PENDING',
  });
}

async function listReminders(agencyId, filters = {}) {
  const where = { agencyId };
  if (filters.status) where.status = filters.status;
  return AccountReminder.findAll({ where, order: [['dueAt', 'ASC']] });
}

async function reconcileLines(agencyId, journalLineIds, reconciled = true) {
  const ids = Array.isArray(journalLineIds) ? journalLineIds : [];
  await JournalLine.update(
    { isReconciled: reconciled, reconciledAt: reconciled ? new Date() : null },
    { where: { agencyId, id: { [Op.in]: ids } } }
  );
  return { updated: ids.length };
}

async function getBankReconciliation(agencyId, ledgerId) {
  if (!ledgerId) {
    throw Object.assign(new Error('Select a Cash & Bank ledger to reconcile'), {
      statusCode: 400,
      code: 'LEDGER_REQUIRED',
    });
  }
  const ledger = await AccountingLedger.findOne({ where: { agencyId, id: ledgerId } });
  if (!ledger) throw Object.assign(new Error('Bank ledger not found'), { statusCode: 404, code: 'NOT_FOUND' });
  const lines = await JournalLine.findAll({
    where: { agencyId, ledgerId: ledger.id },
    include: [{ model: JournalEntry, as: 'journalEntry' }],
    order: [['createdAt', 'DESC']],
  });
  return { ledger, transactions: lines };
}

async function getLedgerReport(agencyId, filters = {}) {
  const where = { agencyId };
  if (filters.ledgerId) where.ledgerId = filters.ledgerId;
  const entryWhere = {};
  if (filters.dateTo) {
    entryWhere.date = {};
    if (filters.dateTo) entryWhere.date[Op.lte] = filters.dateTo;
  }
  const rows = await JournalLine.findAll({
    where,
    include: [
      { model: AccountingLedger, as: 'ledger' },
      { model: JournalEntry, as: 'journalEntry', where: entryWhere },
    ],
    order: [[{ model: JournalEntry, as: 'journalEntry' }, 'date', 'ASC'], ['createdAt', 'ASC']],
  });

  const signedAmount = (row) => {
    const debit = toInt(row.debit);
    const credit = toInt(row.credit);
    return ['ASSET', 'EXPENSE'].includes(row.ledger.type) ? debit - credit : credit - debit;
  };

  const priorRows = filters.dateFrom
    ? rows.filter((row) => row.journalEntry?.date < filters.dateFrom)
    : [];
  const periodRows = filters.dateFrom
    ? rows.filter((row) => row.journalEntry?.date >= filters.dateFrom)
    : rows;

  let runningBalance = priorRows.reduce((sum, row) => sum + signedAmount(row), 0);
  const data = [];
  if (filters.dateFrom && runningBalance) {
    data.push({
      id: 'opening-balance',
      agencyId,
      ledgerId: filters.ledgerId || null,
      description: 'Opening balance',
      debit: 0,
      credit: 0,
      journalEntry: {
        date: filters.dateFrom,
        type: 'OPENING_BALANCE',
        description: 'Opening balance',
      },
      runningBalance,
    });
  }

  for (const row of periodRows) {
    const debit = toInt(row.debit);
    const credit = toInt(row.credit);
    const sign = signedAmount(row);
    runningBalance += sign;
    data.push({ ...row.toJSON(), runningBalance });
  }

  return {
    data,
    summary: {
      openingBalance: filters.dateFrom ? data[0]?.id === 'opening-balance' ? data[0].runningBalance : 0 : 0,
      debit: periodRows.reduce((s, r) => s + toInt(r.debit), 0),
      credit: periodRows.reduce((s, r) => s + toInt(r.credit), 0),
      balance: runningBalance,
    },
  };
}

async function getTrialBalance(agencyId, filters = {}) {
  const ledgers = await listLedgers(agencyId);
  const lines = await JournalLine.findAll({
    where: { agencyId },
    include: [{ model: JournalEntry, as: 'journalEntry' }],
  });
  const byLedger = new Map();
  for (const line of lines) {
    // Opening balances are the carried-forward starting position of a ledger, not period
    // activity — always include them so the trial balance reflects true balances even when
    // scoped to a period (e.g. FY). They only touch asset/equity ledgers, so P&L (which
    // filters REVENUE/EXPENSE off this same data) is unaffected.
    const isOpening = line.journalEntry.sourceType === 'OPENING_BALANCE';
    if (!isOpening) {
      if (filters.dateFrom && line.journalEntry.date < filters.dateFrom) continue;
      if (filters.dateTo && line.journalEntry.date > filters.dateTo) continue;
    }
    const current = byLedger.get(line.ledgerId) || { debit: 0, credit: 0 };
    current.debit += toInt(line.debit);
    current.credit += toInt(line.credit);
    byLedger.set(line.ledgerId, current);
  }
  const data = ledgers.filter((ledger) => !ledger.isGroup).map((ledger) => {
    const totals = byLedger.get(ledger.id) || { debit: 0, credit: 0 };
    const net = totals.debit - totals.credit;
    return {
      ledger: ledger.toJSON(),
      debit: net > 0 ? net : 0,
      credit: net < 0 ? Math.abs(net) : 0,
      totalDebit: totals.debit,
      totalCredit: totals.credit,
    };
  }).filter((row) => row.debit || row.credit || filters.includeZero === 'true');
  return {
    data,
    summary: {
      debit: data.reduce((sum, row) => sum + row.debit, 0),
      credit: data.reduce((sum, row) => sum + row.credit, 0),
    },
  };
}

async function getProfitLoss(agencyId, filters = {}) {
  const trial = await getTrialBalance(agencyId, filters);
  const income = trial.data.filter((row) => row.ledger.type === 'REVENUE');
  const expenses = trial.data.filter((row) => row.ledger.type === 'EXPENSE');

  // Direct (DIRECT groupType) vs indirect, so we can show Gross & Operating profit.
  const isDirect = (row) => String(row.ledger.groupType || '').toUpperCase() === 'DIRECT';
  const sumRevenue = (rows) => rows.reduce((sum, row) => sum + row.credit - row.debit, 0);
  const sumExpense = (rows) => rows.reduce((sum, row) => sum + row.debit - row.credit, 0);

  const operatingIncome = income.filter(isDirect);
  const otherIncomeRows = income.filter((r) => !isDirect(r));
  const directCosts = expenses.filter(isDirect);
  const operatingExpenseRows = expenses.filter((r) => !isDirect(r));

  const revenue = sumRevenue(operatingIncome);
  const otherIncome = sumRevenue(otherIncomeRows);
  const costOfSales = sumExpense(directCosts);
  const operatingExpenses = sumExpense(operatingExpenseRows);

  const grossProfit = revenue - costOfSales;
  const operatingProfit = grossProfit - operatingExpenses;
  const netProfit = operatingProfit + otherIncome;

  const totalIncome = revenue + otherIncome;
  const totalExpenses = costOfSales + operatingExpenses;
  // Margins are percentages with 2 decimals; amounts are exact integer paise.
  const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 10000) / 100 : 0);

  return {
    // backward-compatible flat keys (existing UI)
    income,
    expenses,
    // flonube-style structured sections
    sections: { operatingIncome, otherIncome: otherIncomeRows, directCosts, operatingExpenses: operatingExpenseRows },
    summary: {
      revenue,
      costOfSales,
      grossProfit,
      operatingExpenses,
      operatingProfit,
      otherIncome,
      netProfit,
      grossMargin: pct(grossProfit, revenue),
      netMargin: pct(netProfit, totalIncome),
      // backward-compatible aliases
      totalIncome,
      totalExpenses,
    },
  };
}

async function getBalanceSheet(agencyId, filters = {}) {
  // A balance sheet is point-in-time (inception → asOf). It must ignore dateFrom,
  // otherwise the back-dated opening-balance entries are excluded and it can't balance.
  const asOfFilters = { dateTo: filters.dateTo };
  const trial = await getTrialBalance(agencyId, asOfFilters);
  const assets = trial.data.filter((row) => row.ledger.type === 'ASSET');
  const liabilities = trial.data.filter((row) => row.ledger.type === 'LIABILITY');
  const equity = trial.data.filter((row) => row.ledger.type === 'EQUITY');
  const totalAssets = assets.reduce((sum, row) => sum + row.debit - row.credit, 0);
  const totalLiabilities = liabilities.reduce((sum, row) => sum + row.credit - row.debit, 0);
  const equityLedgerTotal = equity.reduce((sum, row) => sum + row.credit - row.debit, 0);

  // The period's net profit/loss must be carried into equity (retained/current-period
  // earnings) or the sheet never balances — revenue/expense ledgers are not in equity.
  // Retained/current earnings on a balance sheet are cumulative from inception to asOf,
  // so the embedded P&L also ignores dateFrom (unlike the standalone P&L report).
  const pnl = await getProfitLoss(agencyId, asOfFilters);
  const currentEarnings = pnl.summary.netProfit;
  const totalEquity = equityLedgerTotal + currentEarnings;
  const difference = totalAssets - (totalLiabilities + totalEquity);

  return {
    assets,
    liabilities,
    equity,
    currentEarnings,
    summary: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      equityLedgerTotal,
      currentEarnings,
      difference,
      isBalanced: Math.abs(difference) <= 1, // within 1 paise
    },
  };
}

async function getPayablesReceivables(agencyId) {
  const receivableLedger = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.TRADE_DEBTORS);
  const payableLedger = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.TRADE_CREDITORS);
  const receivables = await getLedgerBalance(agencyId, receivableLedger.id);
  const payables = await getLedgerBalance(agencyId, payableLedger.id);
  return { receivables, payables };
}

async function getCashFlow(agencyId, filters = {}) {
  // Cover every cash/bank leaf ledger (agencies can add their own and bind
  // payment methods to them), not just the two seeded defaults.
  const cashBankLedgers = await listCashBankLedgers(agencyId);
  const cashLedgerIds = new Set(cashBankLedgers.map((ledger) => ledger.id));
  const report = await getLedgerReport(agencyId, { ...filters });
  const cashRows = report.data.filter((row) => cashLedgerIds.has(row.ledgerId));
  return {
    data: cashRows,
    summary: {
      inflow: cashRows.reduce((sum, row) => sum + toInt(row.debit), 0),
      outflow: cashRows.reduce((sum, row) => sum + toInt(row.credit), 0),
    },
  };
}

async function getAging(agencyId, filters = {}) {
  // Receivables aging from outstanding invoices, bucketed by days past due date.
  const invoices = await AccountInvoice.findAll({
    where: { agencyId, status: { [Op.notIn]: ['PAID', 'VOID'] } },
    include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] }],
  });
  const asOf = filters.asOf ? new Date(filters.asOf) : new Date();
  const buckets = { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0 };
  const data = [];
  for (const inv of invoices) {
    const outstanding = toInt(inv.totalAmount) - toInt(inv.paidAmount);
    if (outstanding <= 0) continue;
    const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.invoiceDate);
    const overdueDays = Math.floor((asOf - due) / (1000 * 60 * 60 * 24));
    let bucket;
    if (overdueDays <= 0) bucket = 'current';
    else if (overdueDays <= 30) bucket = 'days1_30';
    else if (overdueDays <= 60) bucket = 'days31_60';
    else if (overdueDays <= 90) bucket = 'days61_90';
    else bucket = 'days90Plus';
    buckets[bucket] += outstanding;
    data.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customer: inv.customer ? { id: inv.customer.id, name: inv.customer.name, phone: inv.customer.phone } : null,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      totalAmount: toInt(inv.totalAmount),
      paidAmount: toInt(inv.paidAmount),
      outstanding,
      overdueDays: Math.max(0, overdueDays),
      bucket,
    });
  }
  data.sort((a, b) => b.overdueDays - a.overdueDays);
  const totalOutstanding = Object.values(buckets).reduce((sum, value) => sum + value, 0);
  return { asOf, data, summary: { ...buckets, totalOutstanding } };
}

// Ledger statement for one customer/supplier, derived from the party dimension on
// journal lines — so we never need a ledger per entity. Running balance is debit-credit
// (positive = owed to us for a customer; for a supplier, negative = we owe them).
async function getPartyStatement(agencyId, filters = {}) {
  const { partyType, partyId } = filters;
  if (!partyType || !partyId) {
    throw Object.assign(new Error('partyType and partyId are required'), { statusCode: 400, code: 'BAD_REQUEST' });
  }
  const entryWhere = {};
  if (filters.dateFrom || filters.dateTo) {
    entryWhere.date = {};
    if (filters.dateFrom) entryWhere.date[Op.gte] = filters.dateFrom;
    if (filters.dateTo) entryWhere.date[Op.lte] = filters.dateTo;
  }
  const rows = await JournalLine.findAll({
    where: { agencyId, partyType, partyId },
    include: [
      { model: AccountingLedger, as: 'ledger', attributes: ['id', 'code', 'name'] },
      { model: JournalEntry, as: 'journalEntry', where: entryWhere },
    ],
    order: [[{ model: JournalEntry, as: 'journalEntry' }, 'date', 'ASC'], ['createdAt', 'ASC']],
  });
  let runningBalance = 0;
  const data = rows.map((row) => {
    const debit = toInt(row.debit);
    const credit = toInt(row.credit);
    runningBalance += debit - credit;
    return {
      id: row.id,
      date: row.journalEntry?.date,
      referenceNumber: row.journalEntry?.referenceNumber,
      type: row.journalEntry?.type,
      description: row.description || row.journalEntry?.description,
      debit,
      credit,
      runningBalance,
    };
  });
  const debit = data.reduce((sum, row) => sum + row.debit, 0);
  const credit = data.reduce((sum, row) => sum + row.credit, 0);
  return { data, summary: { debit, credit, balance: debit - credit } };
}

const ITEM_ID_FIELDS = {
  PACKAGE: 'packageId',
  PROPERTY: 'propertyId',
  CRUISE: 'cruiseId',
  VISA: 'visaId',
  SERVICE: 'serviceId',
};

function normalizeItemType(value) {
  const type = String(value || '').trim().toUpperCase();
  return ['PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM'].includes(type) ? type : null;
}

function itemNameFromRecord(type, record, fallback) {
  if (!record) return fallback || 'Unmapped item';
  if (type === 'PROPERTY') return record.name || record.location || fallback || 'Property';
  if (type === 'VISA') return record.country ? `${record.country} Visa` : fallback || 'Visa';
  if (type === 'SERVICE') return record.name || record.category || fallback || 'Service';
  return record.name || fallback || type;
}

function itemFromBooking(booking) {
  const type = normalizeItemType(booking?.itemType) || 'PACKAGE';
  if (type === 'CUSTOM') {
    const name = booking?.customItemName || 'Custom item';
    return { itemType: type, itemId: name, itemName: name };
  }
  const idField = ITEM_ID_FIELDS[type];
  const itemId = booking?.[idField] || null;
  return {
    itemType: type,
    itemId,
    itemName: itemNameFromRecord(type, booking?.[type.toLowerCase()], booking?.customItemName),
  };
}

function itemFromVendorPayment(payment) {
  const type = normalizeItemType(payment?.itemType);
  if (!type) return null;
  if (type === 'CUSTOM') {
    const name = payment.customItemName || 'Custom item';
    return { itemType: type, itemId: name, itemName: name };
  }
  const idField = ITEM_ID_FIELDS[type];
  return {
    itemType: type,
    itemId: payment[idField] || null,
    itemName: itemNameFromRecord(type, payment[type.toLowerCase()], payment.customItemName),
  };
}

function itemFromMetadata(metadata) {
  const item = metadata?.item && typeof metadata.item === 'object' ? metadata.item : null;
  const type = normalizeItemType(item?.itemType);
  if (!type) return null;
  if (type === 'CUSTOM') {
    const name = item.customItemName || 'Custom item';
    return { itemType: type, itemId: name, itemName: name };
  }
  const idField = ITEM_ID_FIELDS[type];
  return { itemType: type, itemId: item?.[idField] || null, itemName: item?.itemName || null };
}

function itemKey(item) {
  return `${item.itemType}:${item.itemId || 'unmapped'}`;
}

function matchesItemFilter(item, filters = {}) {
  const type = normalizeItemType(filters.itemType);
  if (type && item.itemType !== type) return false;
  if (filters.itemId && String(item.itemId || '') !== String(filters.itemId)) return false;
  return true;
}

function getItemBucket(buckets, item) {
  const key = itemKey(item);
  if (!buckets.has(key)) {
    buckets.set(key, {
      itemType: item.itemType,
      itemId: item.itemId,
      itemName: item.itemName || 'Unmapped item',
      revenue: 0,
      collected: 0,
      receivable: 0,
      vendorBilled: 0,
      vendorPaid: 0,
      vendorCost: 0,
      payable: 0,
      grossProfit: 0,
      cashProfit: 0,
      bookingsCount: 0,
      customersCount: 0,
      customerReceivables: [],
      vendorPayables: [],
      _customers: new Set(),
      _vendorRows: new Map(),
    });
  }
  const bucket = buckets.get(key);
  if (item.itemName && bucket.itemName === 'Unmapped item') bucket.itemName = item.itemName;
  return bucket;
}

function getVendorRow(bucket, vendorId, vendorName) {
  const key = vendorId || vendorName || 'unknown';
  if (!bucket._vendorRows.has(key)) {
    bucket._vendorRows.set(key, {
      vendorId: vendorId || null,
      vendorName: vendorName || 'Unknown vendor',
      billed: 0,
      paid: 0,
      cost: 0,
      payable: 0,
    });
  }
  return bucket._vendorRows.get(key);
}

async function getItemProfitability(agencyId, filters = {}) {
  const invoiceWhere = { agencyId, status: { [Op.notIn]: ['VOID'] } };
  if (filters.dateFrom || filters.dateTo) {
    invoiceWhere.invoiceDate = {};
    if (filters.dateFrom) invoiceWhere.invoiceDate[Op.gte] = filters.dateFrom;
    if (filters.dateTo) invoiceWhere.invoiceDate[Op.lte] = filters.dateTo;
  }

  const invoices = await AccountInvoice.findAll({
    where: invoiceWhere,
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      {
        model: Booking,
        as: 'booking',
        include: [
          { model: Package, as: 'package', attributes: ['id', 'name'] },
          { model: Property, as: 'property', attributes: ['id', 'name', 'propertyType', 'location'] },
          { model: Cruise, as: 'cruise', attributes: ['id', 'name'] },
          { model: Visa, as: 'visa', attributes: ['id', 'country', 'visaType'] },
          { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
        ],
      },
    ],
    order: [['invoiceDate', 'DESC'], ['createdAt', 'DESC']],
  });

  const buckets = new Map();

  for (const invoice of invoices) {
    if (!invoice.booking) continue;
    const item = itemFromBooking(invoice.booking);
    if (!matchesItemFilter(item, filters)) continue;
    const bucket = getItemBucket(buckets, item);
    const totalAmount = toInt(invoice.totalAmount);
    const paidAmount = toInt(invoice.paidAmount);
    const outstanding = Math.max(0, totalAmount - paidAmount);

    bucket.revenue += totalAmount;
    bucket.collected += paidAmount;
    bucket.receivable += outstanding;
    bucket.bookingsCount += 1;
    if (invoice.customerId) bucket._customers.add(invoice.customerId);
    bucket.customerReceivables.push({
      customerId: invoice.customerId,
      customerName: invoice.customer?.name || 'Customer',
      phone: invoice.customer?.phone || null,
      bookingId: invoice.bookingId,
      bookingRef: invoice.booking?.bookingRef || null,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      totalAmount,
      paidAmount,
      outstanding,
      status: invoice.status,
    });
  }

  const paymentWhere = { agencyId };
  const paymentItemType = normalizeItemType(filters.itemType);
  if (paymentItemType) paymentWhere.itemType = paymentItemType;
  if (filters.dateFrom || filters.dateTo) {
    paymentWhere.paymentDate = {};
    if (filters.dateFrom) paymentWhere.paymentDate[Op.gte] = filters.dateFrom;
    if (filters.dateTo) paymentWhere.paymentDate[Op.lte] = filters.dateTo;
  }

  const vendorPayments = await VendorPayment.findAll({
    where: paymentWhere,
    include: [
      { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'type'] },
      { model: Package, as: 'package', attributes: ['id', 'name'] },
      { model: Property, as: 'property', attributes: ['id', 'name', 'propertyType', 'location'] },
      { model: Cruise, as: 'cruise', attributes: ['id', 'name'] },
      { model: Visa, as: 'visa', attributes: ['id', 'country', 'visaType'] },
      { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
    ],
  });

  for (const payment of vendorPayments) {
    const item = itemFromVendorPayment(payment);
    if (!item || !matchesItemFilter(item, filters)) continue;
    const bucket = getItemBucket(buckets, item);
    const row = getVendorRow(bucket, payment.vendorId, payment.vendor?.name);
    row.paid += toInt(payment.amount);
  }

  const billWhere = { agencyId, sourceType: 'VENDOR_BILL' };
  if (filters.dateFrom || filters.dateTo) {
    billWhere.date = {};
    if (filters.dateFrom) billWhere.date[Op.gte] = filters.dateFrom;
    if (filters.dateTo) billWhere.date[Op.lte] = filters.dateTo;
  }

  const billEntries = await JournalEntry.findAll({
    where: billWhere,
    include: [{ model: JournalLine, as: 'lines' }],
  });
  const vendorIds = [...new Set(billEntries.map((entry) => entry.metadata?.vendorId).filter(Boolean))];
  const vendors = vendorIds.length
    ? await Vendor.findAll({ where: { agencyId, id: { [Op.in]: vendorIds } }, attributes: ['id', 'name'] })
    : [];
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));

  for (const entry of billEntries) {
    const item = itemFromMetadata(entry.metadata);
    if (!item || !matchesItemFilter(item, filters)) continue;
    const bucket = getItemBucket(buckets, item);
    const vendorId = entry.metadata?.vendorId || null;
    const row = getVendorRow(bucket, vendorId, vendorById.get(vendorId)?.name);
    const billed = entry.lines
      .filter((line) => line.partyType === 'VENDOR' || line.partyId === vendorId)
      .reduce((sum, line) => sum + toInt(line.credit) - toInt(line.debit), 0);
    row.billed += Math.max(0, billed);
  }

  const data = [...buckets.values()].map((bucket) => {
    const vendorRows = [...bucket._vendorRows.values()].map((row) => ({
      ...row,
      cost: Math.max(row.billed, row.paid),
      payable: Math.max(0, row.billed - row.paid),
    })).sort((a, b) => b.cost - a.cost);
    const vendorCost = vendorRows.reduce((sum, row) => sum + row.cost, 0);
    const vendorBilled = vendorRows.reduce((sum, row) => sum + row.billed, 0);
    const vendorPaid = vendorRows.reduce((sum, row) => sum + row.paid, 0);
    const payable = vendorRows.reduce((sum, row) => sum + row.payable, 0);
    return {
      itemType: bucket.itemType,
      itemId: bucket.itemId,
      itemName: bucket.itemName,
      revenue: bucket.revenue,
      collected: bucket.collected,
      receivable: bucket.receivable,
      vendorBilled,
      vendorPaid,
      vendorCost,
      payable,
      grossProfit: bucket.revenue - vendorCost,
      cashProfit: bucket.collected - vendorPaid,
      bookingsCount: bucket.bookingsCount,
      customersCount: bucket._customers.size,
      customerReceivables: bucket.customerReceivables.sort((a, b) => b.outstanding - a.outstanding),
      vendorPayables: vendorRows,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    data,
    summary: {
      revenue: data.reduce((sum, row) => sum + row.revenue, 0),
      collected: data.reduce((sum, row) => sum + row.collected, 0),
      receivable: data.reduce((sum, row) => sum + row.receivable, 0),
      vendorCost: data.reduce((sum, row) => sum + row.vendorCost, 0),
      vendorPaid: data.reduce((sum, row) => sum + row.vendorPaid, 0),
      payable: data.reduce((sum, row) => sum + row.payable, 0),
      grossProfit: data.reduce((sum, row) => sum + row.grossProfit, 0),
      cashProfit: data.reduce((sum, row) => sum + row.cashProfit, 0),
    },
  };
}

async function getVatReport(agencyId, filters = {}) {
  await ensureDefaultChartOfAccounts(agencyId);
  let inputLedger, outputLedger;
  const inputLedgers = [];
  const outputLedgers = [];
  try { inputLedger = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.GST_INPUT); } catch(e) {}
  try { outputLedger = await getLedgerByCode(agencyId, DEFAULT_LEDGER_CODES.GST_OUTPUT); } catch(e) {}
  for (const code of [DEFAULT_LEDGER_CODES.GST_INPUT_CGST, DEFAULT_LEDGER_CODES.GST_INPUT_SGST, DEFAULT_LEDGER_CODES.GST_INPUT_IGST]) {
    try { inputLedgers.push(await getLedgerByCode(agencyId, code)); } catch(e) {}
  }
  for (const code of [DEFAULT_LEDGER_CODES.GST_OUTPUT_CGST, DEFAULT_LEDGER_CODES.GST_OUTPUT_SGST, DEFAULT_LEDGER_CODES.GST_OUTPUT_IGST]) {
    try { outputLedgers.push(await getLedgerByCode(agencyId, code)); } catch(e) {}
  }
  
  const inputIds = [inputLedger, ...inputLedgers].map((ledger) => ledger?.id).filter(Boolean);
  const outputIds = [outputLedger, ...outputLedgers].map((ledger) => ledger?.id).filter(Boolean);
  const validIds = [...inputIds, ...outputIds];
  const lines = validIds.length ? await JournalLine.findAll({
    where: { agencyId, ledgerId: { [Op.in]: validIds } },
    include: [{ model: JournalEntry, as: 'journalEntry' }],
  }) : [];
  let inputTax = 0;
  let outputTax = 0;
  for (const line of lines) {
    if (filters.dateFrom && line.journalEntry.date < filters.dateFrom) continue;
    if (filters.dateTo && line.journalEntry.date > filters.dateTo) continue;
    if (inputIds.includes(line.ledgerId)) inputTax += toInt(line.debit) - toInt(line.credit);
    else outputTax += toInt(line.credit) - toInt(line.debit);
  }
  // Output (collected on sales) less Input (paid on purchases) = net payable to tax authority.
  const netPayable = outputTax - inputTax;
  return { summary: { inputTax, outputTax, netPayable } };
}

module.exports = {
  DEFAULT_LEDGER_CODES,
  ensureDefaultChartOfAccounts,
  ensureDefaultPaymentMethods,
  backfillDefaultChartOfAccounts,
  getLedgerByCode,
  listPaymentMethodLedgers,
  listPaymentMethods,
  getPaymentMethod,
  resolvePaymentMethod,
  createPaymentMethod,
  updatePaymentMethod,
  getPostingRules,
  updatePostingRules,
  getPostingRuleLedgers,
  ensureCustomerLedger,
  listLedgers,
  getLedgerTree,
  getNextLedgerCode,
  createLedger,
  updateLedger,
  canDeleteLedger,
  deleteLedger,
  mergeLedgers,
  getLedgerBalance,
  createJournalEntry,
  reverseJournalEntry,
  getBooksLock,
  setBooksLock,
  listJournalEntries,
  getJournalEntry,
  createVoucher,
  postBookingInvoice,
  postPaymentReceipt,
  recordCustomerReceipt,
  createCreditNote,
  listCreditNotes,
  listInvoices,
  createReminder,
  listReminders,
  reconcileLines,
  getBankReconciliation,
  getLedgerReport,
  getTrialBalance,
  getProfitLoss,
  getBalanceSheet,
  getPayablesReceivables,
  getCashFlow,
  getAging,
  getItemProfitability,
  getVatReport,
  getPartyStatement,
};
