require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { sequelize } = require('../models');

/**
 * Backfills the single source of truth for inbox ownership: a conversation
 * (Customer) should be owned by whoever owns its lead. The Lead->Customer sync
 * hook only fires when a lead's assignment CHANGES, so conversations whose lead
 * was assigned before the hook shipped still show "Unassigned". This sets each
 * unassigned conversation's owner to its most-recently-updated assigned lead.
 *
 * Raw SQL on purpose: it does NOT bump customers.updated_at, so it won't
 * reorder the inbox / clobber "last activity". Idempotent — re-running only
 * touches conversations that are still unassigned.
 */
async function migrate() {
  await sequelize.authenticate();

  const [, meta] = await sequelize.query(`
    UPDATE customers c
    SET assigned_agent_id = sub.aid
    FROM (
      SELECT DISTINCT ON (customer_id) customer_id, assigned_agent_id AS aid
      FROM leads
      WHERE assigned_agent_id IS NOT NULL
      ORDER BY customer_id, updated_at DESC
    ) sub
    WHERE c.id = sub.customer_id
      AND c.assigned_agent_id IS NULL
  `);

  const affected = typeof meta?.rowCount === 'number' ? meta.rowCount : (meta || 0);
  console.log(`+ Backfilled conversation owner from lead on ${affected} conversations`);
}

migrate()
  .then(async () => {
    console.log('Conversation assignee backfill complete');
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await sequelize.close();
    } catch {}
    process.exit(1);
  });
