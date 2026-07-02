require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
});

async function clearData() {
  const agencyId = '5f64bd06-24d7-4f8a-beb2-c37e6e1b1018';

  const tablesToDeleteFrom = [
    // Accounting
    'accounting_ledgers', 'journal_entries', 'journal_lines', 'account_invoices',
    'account_reminders', 'credit_notes', 'vendor_payments',

    // Marketing & Operations
    'messages', 'bot_sessions', 'drip_enrollments', 'drip_steps', 'drip_sequences',
    'campaign_recipients', 'campaigns', 'referral_codes', 'reviews', 'message_templates',
    
    // Core Leads & Bookings
    'lead_notes', 'follow_ups', 'itineraries', 'scheduled_jobs', 'payments', 'bookings',
    'leads', 'customers',
    
    // Integrations & Logs
    'instagram_automation_logs', 'instagram_automations', 'meta_lead_sync_events',
    'meta_lead_forms', 'meta_ad_campaigns', 'call_logs'
  ];

  try {
    for (const table of tablesToDeleteFrom) {
      console.log(`Deleting from ${table}...`);
      // Since some tables might not exist or might not have agency_id directly, 
      // we need to handle them carefully. Some might fail if they don't have agency_id.
      // But based on the Sequelize model list, most have agencyId.
      
      try {
        const [results, metadata] = await sequelize.query(`DELETE FROM "${table}" WHERE agency_id = :agencyId`, {
          replacements: { agencyId }
        });
        console.log(`Deleted ${metadata.rowCount || 0} rows from ${table}`);
      } catch (err) {
        if (err.message.includes('column "agency_id" does not exist') || err.message.includes('relation') && err.message.includes('does not exist')) {
          console.log(`Skipped ${table} (no agency_id or table doesn't exist)`);
        } else {
          console.error(`Error deleting from ${table}:`, err.message);
        }
      }
    }
    
    console.log('Cleanup complete!');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

clearData();
