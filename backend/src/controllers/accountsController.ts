const accountingService = require('../services/accountingService');
const { logActivity } = require('../services/activityService');

function send(res, data, message) {
  res.json({ success: true, data, ...(message ? { message } : {}) });
}

async function ledgers(req, res, next) {
  try {
    send(res, await accountingService.listLedgers(req.agency.id, req.query));
  } catch (err) {
    next(err);
  }
}

async function ledgerTree(req, res, next) {
  try {
    send(res, await accountingService.getLedgerTree(req.agency.id, {
      withBalances: String(req.query.withBalances) === 'true',
      dateFrom: req.query.dateFrom || undefined,
      dateTo: req.query.dateTo || undefined,
    }));
  } catch (err) {
    next(err);
  }
}

async function ledgerBalance(req, res, next) {
  try {
    send(res, await accountingService.getLedgerBalance(req.agency.id, req.params.id));
  } catch (err) {
    next(err);
  }
}

async function createLedger(req, res, next) {
  try {
    const ledger = await accountingService.createLedger(req.agency.id, req.body);
    res.status(201).json({ success: true, data: ledger, message: 'Ledger created' });
  } catch (err) {
    next(err);
  }
}

async function updateLedger(req, res, next) {
  try {
    send(res, await accountingService.updateLedger(req.agency.id, req.params.id, req.body), 'Ledger updated');
  } catch (err) {
    next(err);
  }
}

async function nextLedgerCode(req, res, next) {
  try {
    send(res, await accountingService.getNextLedgerCode(req.agency.id, req.query.type));
  } catch (err) {
    next(err);
  }
}

async function paymentMethodLedgers(req, res, next) {
  try {
    send(res, await accountingService.listPaymentMethodLedgers(req.agency.id));
  } catch (err) {
    next(err);
  }
}

async function paymentMethods(req, res, next) {
  try {
    send(res, await accountingService.listPaymentMethods(req.agency.id, {
      activeOnly: String(req.query.activeOnly || 'true') !== 'false',
    }));
  } catch (err) {
    next(err);
  }
}

async function createPaymentMethod(req, res, next) {
  try {
    const method = await accountingService.createPaymentMethod(req.agency.id, req.body);
    res.status(201).json({ success: true, data: method, message: 'Payment method created' });
  } catch (err) {
    next(err);
  }
}

async function updatePaymentMethod(req, res, next) {
  try {
    send(res, await accountingService.updatePaymentMethod(req.agency.id, req.params.id, req.body), 'Payment method updated');
  } catch (err) {
    next(err);
  }
}

async function postingRules(req, res, next) {
  try {
    send(res, await accountingService.getPostingRules(req.agency.id));
  } catch (err) {
    next(err);
  }
}

async function updatePostingRules(req, res, next) {
  try {
    send(res, await accountingService.updatePostingRules(req.agency.id, req.body), 'Posting rules updated');
  } catch (err) {
    next(err);
  }
}

async function canDeleteLedger(req, res, next) {
  try {
    send(res, await accountingService.canDeleteLedger(req.agency.id, req.params.id));
  } catch (err) {
    next(err);
  }
}

async function deleteLedger(req, res, next) {
  try {
    send(res, await accountingService.deleteLedger(req.agency.id, req.params.id), 'Ledger deleted');
  } catch (err) {
    next(err);
  }
}

async function mergeLedgers(req, res, next) {
  try {
    send(res, await accountingService.mergeLedgers(req.agency.id, req.body.sourceId, req.body.targetId), 'Ledgers merged');
  } catch (err) {
    next(err);
  }
}

async function journalEntries(req, res, next) {
  try {
    send(res, await accountingService.listJournalEntries(req.agency.id, req.query));
  } catch (err) {
    next(err);
  }
}

async function journalEntry(req, res, next) {
  try {
    const entry = await accountingService.getJournalEntry(req.agency.id, req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: 'Journal entry not found' });
    send(res, entry);
  } catch (err) {
    next(err);
  }
}

async function createJournalEntry(req, res, next) {
  try {
    const entry = await accountingService.createJournalEntry(req.agency.id, {
      ...req.body,
      createdByAgentId: req.agent.id,
    });
    await logActivity(req, {
      action: 'journal_entry.created',
      module: 'accounts',
      targetType: 'JournalEntry',
      targetId: entry?.id,
      summary: `Posted journal entry ${entry?.entryNumber || entry?.reference || ''}`.trim(),
    });
    res.status(201).json({ success: true, data: entry, message: 'Journal entry created' });
  } catch (err) {
    next(err);
  }
}

async function reverseJournalEntry(req, res, next) {
  try {
    const entry = await accountingService.reverseJournalEntry(req.agency.id, req.params.id, {
      agentId: req.agent.id,
      reason: req.body?.reason,
      date: req.body?.date,
    });
    await logActivity(req, {
      action: 'journal_entry.reversed',
      module: 'accounts',
      targetType: 'JournalEntry',
      targetId: req.params.id,
      summary: `Reversed journal entry${req.body?.reason ? `: ${req.body.reason}` : ''}`,
      metadata: { reversalEntryId: entry?.id, reason: req.body?.reason || null },
    });
    res.status(201).json({ success: true, data: entry, message: 'Journal entry reversed' });
  } catch (err) {
    next(err);
  }
}

async function booksLock(req, res, next) {
  try {
    send(res, await accountingService.getBooksLock(req.agency.id));
  } catch (err) {
    next(err);
  }
}

async function setBooksLock(req, res, next) {
  try {
    send(res, await accountingService.setBooksLock(req.agency.id, req.body?.date ?? null), 'Books lock updated');
  } catch (err) {
    next(err);
  }
}

async function createCustomerReceipt(req, res, next) {
  try {
    const result = await accountingService.recordCustomerReceipt(req.agency.id, req.body, req.agent.id);
    await logActivity(req, {
      action: 'payment.received',
      module: 'accounts',
      targetType: 'JournalEntry',
      targetId: result?.journalEntry?.id || result?.id,
      summary: `Recorded customer receipt${req.body?.amount ? ` of ${req.body.amount}` : ''}`,
      metadata: { amount: req.body?.amount ?? null, customerId: req.body?.customerId ?? null },
    });
    res.status(201).json({ success: true, data: result, message: 'Customer receipt recorded' });
  } catch (err) {
    next(err);
  }
}

function voucher(type) {
  return async (req, res, next) => {
    try {
      const entry = await accountingService.createVoucher(req.agency.id, type, req.body, req.agent.id);
      await logActivity(req, {
        action: 'voucher.created',
        module: 'accounts',
        targetType: 'JournalEntry',
        targetId: entry?.id,
        summary: `Created ${type} voucher ${entry?.entryNumber || ''}`.trim(),
        metadata: { voucherType: type },
      });
      res.status(201).json({ success: true, data: entry, message: 'Voucher created' });
    } catch (err) {
      next(err);
    }
  };
}

async function invoices(req, res, next) {
  try {
    send(res, await accountingService.listInvoices(req.agency.id, req.query));
  } catch (err) {
    next(err);
  }
}

async function createInvoice(req, res, next) {
  try {
    const entry = await accountingService.createVoucher(req.agency.id, 'INVOICE', req.body, req.agent.id);
    await logActivity(req, {
      action: 'invoice.created',
      module: 'accounts',
      targetType: 'JournalEntry',
      targetId: entry?.id,
      summary: `Created invoice ${entry?.entryNumber || ''}`.trim(),
    });
    res.status(201).json({ success: true, data: entry, message: 'Invoice journal created' });
  } catch (err) {
    next(err);
  }
}

async function creditNotes(req, res, next) {
  try {
    send(res, await accountingService.listCreditNotes(req.agency.id, req.query));
  } catch (err) {
    next(err);
  }
}

async function createCreditNote(req, res, next) {
  try {
    const note = await accountingService.createCreditNote(req.agency.id, req.body, req.agent.id);
    await logActivity(req, {
      action: 'credit_note.created',
      module: 'accounts',
      targetType: 'CreditNote',
      targetId: note?.id,
      summary: `Issued credit note ${note?.creditNoteNumber || note?.number || ''}`.trim(),
    });
    res.status(201).json({ success: true, data: note, message: 'Credit note issued' });
  } catch (err) {
    next(err);
  }
}

async function reminders(req, res, next) {
  try {
    send(res, await accountingService.listReminders(req.agency.id, req.query));
  } catch (err) {
    next(err);
  }
}

async function createReminder(req, res, next) {
  try {
    const reminder = await accountingService.createReminder(req.agency.id, req.body);
    res.status(201).json({ success: true, data: reminder, message: 'Reminder created' });
  } catch (err) {
    next(err);
  }
}

async function bankReconciliation(req, res, next) {
  try {
    send(res, await accountingService.getBankReconciliation(req.agency.id, req.query.ledgerId));
  } catch (err) {
    next(err);
  }
}

async function reconcile(req, res, next) {
  try {
    send(res, await accountingService.reconcileLines(req.agency.id, req.body.journalLineIds, req.body.reconciled !== false), 'Reconciliation updated');
  } catch (err) {
    next(err);
  }
}

async function report(req, res, next) {
  try {
    const name = req.params.name;
    const handlers = {
      ledger: accountingService.getLedgerReport,
      'trial-balance': accountingService.getTrialBalance,
      'profit-loss': accountingService.getProfitLoss,
      'balance-sheet': accountingService.getBalanceSheet,
      'payables-receivables': accountingService.getPayablesReceivables,
      'cash-flow': accountingService.getCashFlow,
      aging: accountingService.getAging,
      'item-profitability': accountingService.getItemProfitability,
      vat: accountingService.getVatReport,
      'party-statement': accountingService.getPartyStatement,
    };
    const handler = handlers[name];
    if (!handler) return res.status(404).json({ success: false, error: 'Report not found' });
    send(res, await handler(req.agency.id, req.query));
  } catch (err) {
    next(err);
  }
}

async function seedChart(req, res, next) {
  try {
    await accountingService.ensureDefaultChartOfAccounts(req.agency.id);
    send(res, { seeded: true }, 'Chart of accounts ready');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  ledgers,
  ledgerTree,
  ledgerBalance,
  nextLedgerCode,
  paymentMethodLedgers,
  paymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  postingRules,
  updatePostingRules,
  createLedger,
  updateLedger,
  canDeleteLedger,
  deleteLedger,
  mergeLedgers,
  journalEntries,
  journalEntry,
  createJournalEntry,
  reverseJournalEntry,
  booksLock,
  setBooksLock,
  createCustomerReceipt,
  createReceipt: voucher('RECEIPT'),
  createPayment: voucher('PAYMENT'),
  createExpenseVoucher: voucher('EXPENSE_VOUCHER'),
  createOtherPurchase: voucher('OTHER_PURCHASE'),
  createOtherSale: voucher('OTHER_SALE'),
  createInternalFundTransfer: voucher('INTERNAL_FUND_TRANSFER'),
  invoices,
  createInvoice,
  creditNotes,
  createCreditNote,
  reminders,
  createReminder,
  bankReconciliation,
  reconcile,
  report,
  seedChart,
};
