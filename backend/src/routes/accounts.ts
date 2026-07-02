const { Router } = require('express');
const { z } = require('zod');
const accountsController = require('../controllers/accountsController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const ledgerSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(40).optional(), // auto-generated from type when omitted
  name: z.string().min(1).max(255),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  groupType: z.enum(['DIRECT', 'INDIRECT']).nullable().optional(),
  financialStatement: z.enum(['BALANCE_SHEET', 'PROFIT_AND_LOSS']),
  isGroup: z.boolean().optional(),
  currency: z.string().length(3).optional(),
  gstin: z.string().max(32).nullable().optional(),
  isActive: z.boolean().optional(),
  openingBalance: z.number().int().optional(), // signed, in paise
});

const mergeSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
});

const paymentMethodSchema = z.object({
  name: z.string().min(1).max(120),
  methodType: z.enum(['CASH', 'BANK', 'UPI', 'CARD', 'WALLET', 'GATEWAY', 'OTHER']),
  ledgerId: z.string().uuid(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const postingRulesSchema = z.object({
  salesLedgerId: z.string().uuid().nullable().optional(),
  commissionSalesLedgerId: z.string().uuid().nullable().optional(),
  customerAdvanceLedgerId: z.string().uuid().nullable().optional(),
  tradeDebtorsLedgerId: z.string().uuid().nullable().optional(),
  tradeCreditorsLedgerId: z.string().uuid().nullable().optional(),
  vendorExpenseLedgerId: z.string().uuid().nullable().optional(),
});

const journalLineSchema = z.object({
  ledgerId: z.string().uuid(),
  description: z.string().optional(),
  debit: z.number().int().min(0).optional(),
  credit: z.number().int().min(0).optional(),
});

const journalSchema = z.object({
  date: z.string().optional(),
  referenceNumber: z.string().max(40).optional(),
  type: z.enum(['JOURNAL', 'INVOICE', 'RECEIPT', 'PAYMENT', 'EXPENSE_VOUCHER', 'OTHER_PURCHASE', 'OTHER_SALE', 'INTERNAL_FUND_TRANSFER', 'CREDIT_NOTE']).optional(),
  sourceType: z.string().max(80).optional(),
  sourceId: z.string().max(80).optional(),
  description: z.string().optional(),
  lines: z.array(journalLineSchema).min(2),
  metadata: z.record(z.any()).optional(),
});

const creditNoteSchema = z.object({
  invoiceId: z.string().uuid(),
  date: z.string().optional(),
  taxableAmount: z.number().int().min(0).optional(), // in paise
  gstAmount: z.number().int().min(0).optional(),
  totalAmount: z.number().int().min(1).optional(),
  reason: z.string().max(500).optional(),
}).refine((value) => Boolean(value.totalAmount || value.taxableAmount), {
  message: 'Either totalAmount or taxableAmount is required',
});

const reminderSchema = z.object({
  relatedType: z.enum(['LEDGER', 'INVOICE', 'JOURNAL_ENTRY']),
  relatedId: z.string().uuid(),
  title: z.string().min(1).max(255),
  note: z.string().optional(),
  dueAt: z.string().min(1),
  status: z.enum(['PENDING', 'DONE', 'CANCELLED']).optional(),
});

const reconcileSchema = z.object({
  journalLineIds: z.array(z.string().uuid()).min(1),
  reconciled: z.boolean().optional(),
});

const reverseSchema = z.object({
  reason: z.string().max(500).optional(),
  date: z.string().optional(),
});

const booksLockSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const customerReceiptSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().int().positive(),
  paymentMethodId: z.string().uuid().optional(),
  receiptDate: z.string().optional(),
  referenceNumber: z.string().optional(),
});

router.use(authenticate);

router.post('/seed-chart', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), accountsController.seedChart);

router.get('/ledgers/tree', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.ledgerTree);
router.get('/ledgers/next-code', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.nextLedgerCode);
router.get('/payment-method-ledgers', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.paymentMethodLedgers);
router.get('/payment-methods', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.paymentMethods);
router.post('/payment-methods', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(paymentMethodSchema), accountsController.createPaymentMethod);
router.patch('/payment-methods/:id', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(paymentMethodSchema.partial()), accountsController.updatePaymentMethod);
router.get('/posting-rules', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.postingRules);
router.put('/posting-rules', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(postingRulesSchema), accountsController.updatePostingRules);
router.get('/ledgers/:id/balance', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.ledgerBalance);
router.get('/ledgers/:id/can-delete', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.canDeleteLedger);
router.get('/ledgers', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.ledgers);
router.post('/ledgers/merge', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(mergeSchema), accountsController.mergeLedgers);
router.post('/ledgers', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(ledgerSchema), accountsController.createLedger);
router.patch('/ledgers/:id', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(ledgerSchema.partial()), accountsController.updateLedger);
router.delete('/ledgers/:id', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), accountsController.deleteLedger);

router.get('/journal-entries', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.journalEntries);
router.get('/journal-entries/:id', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.journalEntry);
router.post('/journal-entries', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(journalSchema), accountsController.createJournalEntry);
router.post('/journal-entries/:id/reverse', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(reverseSchema), accountsController.reverseJournalEntry);
router.post('/customer-receipts', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(customerReceiptSchema), accountsController.createCustomerReceipt);

router.get('/books-lock', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.booksLock);
router.put('/books-lock', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(booksLockSchema), accountsController.setBooksLock);

router.get('/invoices', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.invoices);
router.post('/invoices', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(journalSchema), accountsController.createInvoice);
router.get('/credit-notes', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.creditNotes);
router.post('/credit-notes', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(creditNoteSchema), accountsController.createCreditNote);
router.post('/receipts', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(journalSchema), accountsController.createReceipt);
router.post('/payments', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(journalSchema), accountsController.createPayment);
router.post('/expense-vouchers', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(journalSchema), accountsController.createExpenseVoucher);
router.post('/other-purchases', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(journalSchema), accountsController.createOtherPurchase);
router.post('/other-sales', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(journalSchema), accountsController.createOtherSale);
router.post('/internal-fund-transfers', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(journalSchema), accountsController.createInternalFundTransfer);

router.get('/reconciliation', requirePermission(PERMISSIONS.ACCOUNTS_RECONCILE), accountsController.bankReconciliation);
router.put('/reconciliation', requirePermission(PERMISSIONS.ACCOUNTS_RECONCILE), validateBody(reconcileSchema), accountsController.reconcile);

router.get('/reminders', requirePermission(PERMISSIONS.ACCOUNTS_VIEW), accountsController.reminders);
router.post('/reminders', requirePermission(PERMISSIONS.ACCOUNTS_MANAGE), validateBody(reminderSchema), accountsController.createReminder);

router.get('/reports/:name', requirePermission(PERMISSIONS.ACCOUNTS_REPORTS), accountsController.report);

module.exports = router;
