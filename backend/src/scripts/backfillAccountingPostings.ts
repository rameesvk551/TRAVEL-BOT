// Backfills accounting journal entries for bookings/payments created before
// auto-posting was wired in. Idempotent: postBookingInvoice / postPaymentReceipt
// dedupe by source, so this can be run repeatedly without double-posting.
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { sequelize, Agency, Booking, Payment } = require('../models');
const accountingService = require('../services/accountingService');
const { ensureAccountingTables } = require('../services/schemaBootstrap');

async function backfillAgency(agencyId) {
  await accountingService.ensureDefaultChartOfAccounts(agencyId);
  const stats = { invoices: 0, receipts: 0, failures: 0 };

  // Confirmed/completed bookings -> invoice journal entries.
  const bookings = await Booking.findAll({
    where: { agencyId, status: ['CONFIRMED', 'COMPLETED'] },
    attributes: ['id', 'bookingRef'],
  });
  for (const booking of bookings) {
    try {
      await accountingService.postBookingInvoice(booking.id, agencyId);
      stats.invoices += 1;
    } catch (error) {
      stats.failures += 1;
      console.warn(`  ! invoice for booking ${booking.bookingRef || booking.id}: ${error.message}`);
    }
  }

  // Paid payments -> receipt journal entries.
  const payments = await Payment.findAll({
    where: { agencyId, status: 'PAID' },
    attributes: ['id'],
  });
  for (const payment of payments) {
    try {
      await accountingService.postPaymentReceipt(payment.id, agencyId);
      stats.receipts += 1;
    } catch (error) {
      stats.failures += 1;
      console.warn(`  ! receipt for payment ${payment.id}: ${error.message}`);
    }
  }

  return stats;
}

async function main() {
  await ensureAccountingTables();
  const agencies = await Agency.findAll({ attributes: ['id', 'name'] });
  console.log(`[Accounting] Backfilling postings for ${agencies.length} agencies...`);

  const totals = { invoices: 0, receipts: 0, failures: 0 };
  for (const agency of agencies) {
    const stats = await backfillAgency(agency.id);
    totals.invoices += stats.invoices;
    totals.receipts += stats.receipts;
    totals.failures += stats.failures;
    console.log(`  ${agency.name || agency.id}: ${stats.invoices} invoices, ${stats.receipts} receipts, ${stats.failures} skipped`);
  }

  console.log(`[Accounting] Done. ${totals.invoices} invoices, ${totals.receipts} receipts processed, ${totals.failures} skipped.`);
}

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[Accounting] Posting backfill failed:', error);
    await sequelize.close();
    process.exit(1);
  });
