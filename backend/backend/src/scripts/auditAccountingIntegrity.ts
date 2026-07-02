/**
 * Read-only accounting integrity audit.
 *
 * Verifies the core double-entry invariants against LIVE data for one agency
 * (pass an agencyId) or every agency (no arg). Mutates nothing — safe to run in
 * production. Exits non-zero if any invariant is violated, so it can gate CI/deploys.
 *
 * Usage:
 *   npm run audit:accounts                 # all agencies
 *   npm run audit:accounts -- <agencyId>   # one agency
 *
 * Invariants checked per agency:
 *   1. Every journal entry balances: sum(debits) === sum(credits).
 *   2. Trial balance totals match: total debit === total credit.
 *   3. Balance sheet balances: Assets === Liabilities + Equity + current earnings.
 *   4. No journal line posts to a group (non-leaf) ledger.
 *   5. No invoice has paidAmount > totalAmount (silent over-collection).
 *   6. No invoice references a non-existent journal entry (orphan linkage).
 */
const {
  sequelize,
  Agency,
  AccountingLedger,
  JournalEntry,
  JournalLine,
  AccountInvoice,
} = require('../models');
const accountingService = require('../services/accountingService');

type Violation = { agencyId: string; check: string; detail: string };

function paise(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}₹${(abs / 100).toFixed(2)}`;
}

async function auditAgency(agencyId: string): Promise<Violation[]> {
  const violations: Violation[] = [];

  // --- 1. Per-entry balance -------------------------------------------------
  const entries = await JournalEntry.findAll({
    where: { agencyId },
    include: [{ model: JournalLine, as: 'lines' }],
  });
  for (const entry of entries) {
    let debit = 0;
    let credit = 0;
    for (const line of entry.lines || []) {
      debit += Number(line.debit) || 0;
      credit += Number(line.credit) || 0;
    }
    if (debit !== credit) {
      violations.push({
        agencyId,
        check: 'entry-balance',
        detail: `JE ${entry.referenceNumber} (${entry.id}) unbalanced: debit ${paise(debit)} vs credit ${paise(credit)}`,
      });
    }
  }

  // --- 4. No posting to group ledgers --------------------------------------
  const groupLedgers = await AccountingLedger.findAll({ where: { agencyId, isGroup: true }, attributes: ['id', 'code', 'name'] });
  const groupIds = new Set(groupLedgers.map((l: any) => l.id));
  if (groupIds.size) {
    const offendingLines = await JournalLine.findAll({ where: { agencyId, ledgerId: { [sequelize.Sequelize.Op.in]: [...groupIds] } } });
    for (const line of offendingLines) {
      violations.push({
        agencyId,
        check: 'group-ledger-posting',
        detail: `Journal line ${line.id} posts to group ledger ${line.ledgerId}`,
      });
    }
  }

  // --- 2. Trial balance totals ---------------------------------------------
  const trial = await accountingService.getTrialBalance(agencyId, {});
  if (trial.summary.debit !== trial.summary.credit) {
    violations.push({
      agencyId,
      check: 'trial-balance',
      detail: `Trial balance off: debit ${paise(trial.summary.debit)} vs credit ${paise(trial.summary.credit)}`,
    });
  }

  // --- 3. Balance sheet balances -------------------------------------------
  const bs = await accountingService.getBalanceSheet(agencyId, {});
  if (!bs.summary.isBalanced) {
    violations.push({
      agencyId,
      check: 'balance-sheet',
      detail: `Balance sheet off by ${paise(bs.summary.difference)} (assets ${paise(bs.summary.totalAssets)} vs L+E ${paise(bs.summary.totalLiabilities + bs.summary.totalEquity)})`,
    });
  }

  // --- 5. Over-collection ---------------------------------------------------
  const invoices = await AccountInvoice.findAll({ where: { agencyId } });
  for (const inv of invoices) {
    if (Number(inv.paidAmount) > Number(inv.totalAmount)) {
      violations.push({
        agencyId,
        check: 'over-collection',
        detail: `Invoice ${inv.invoiceNumber} paid ${paise(Number(inv.paidAmount))} > total ${paise(Number(inv.totalAmount))}`,
      });
    }
  }

  // --- 6. Orphan invoice linkage -------------------------------------------
  const entryIds = new Set(entries.map((e: any) => e.id));
  for (const inv of invoices) {
    if (inv.journalEntryId && !entryIds.has(inv.journalEntryId)) {
      violations.push({
        agencyId,
        check: 'orphan-invoice',
        detail: `Invoice ${inv.invoiceNumber} references missing journal entry ${inv.journalEntryId}`,
      });
    }
  }

  // --- 7. Duplicate auto-invoice per booking -------------------------------
  const byBooking = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.bookingId) continue;
    byBooking.set(inv.bookingId, (byBooking.get(inv.bookingId) || 0) + 1);
  }
  for (const [bookingId, n] of byBooking) {
    if (n > 1) {
      violations.push({ agencyId, check: 'duplicate-booking-invoice', detail: `Booking ${bookingId} has ${n} invoices (expected 1)` });
    }
  }

  // --- 8. Dangling reversal linkage ----------------------------------------
  for (const entry of entries) {
    const meta = entry.metadata || {};
    if (meta.reversesEntryId && !entryIds.has(meta.reversesEntryId)) {
      violations.push({ agencyId, check: 'dangling-reversal', detail: `Reversal ${entry.referenceNumber} points at missing original ${meta.reversesEntryId}` });
    }
  }

  return violations;
}

async function main() {
  const argAgencyId = process.argv[2];
  const agencies = argAgencyId
    ? [{ id: argAgencyId, name: argAgencyId }]
    : await Agency.findAll({ attributes: ['id', 'name'] });

  let total = 0;
  for (const agency of agencies) {
    const violations = await auditAgency(agency.id);
    total += violations.length;
    if (violations.length) {
      console.log(`\n❌ ${agency.name} (${agency.id}) — ${violations.length} issue(s):`);
      for (const v of violations) console.log(`   [${v.check}] ${v.detail}`);
    } else {
      console.log(`✅ ${agency.name} (${agency.id}) — books balanced, no integrity issues`);
    }
  }

  console.log(`\n${total === 0 ? '✅ ALL CLEAN' : `❌ ${total} total violation(s)`} across ${agencies.length} agency(ies).`);
  await sequelize.close();
  process.exit(total === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(2);
});
