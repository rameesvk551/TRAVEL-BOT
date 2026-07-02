const { sequelize } = require('../src/models');

async function main() {
  const [agency] = await sequelize.query(
    `
      SELECT id,
             name,
             whatsapp_provider AS "whatsappProvider",
             whatsapp_connection_status AS "whatsappConnectionStatus",
             whatsapp_connection_error AS "whatsappConnectionError",
             whatsapp_onboarding_mode AS "whatsappOnboardingMode",
             whatsapp_coexistence_status AS "whatsappCoexistenceStatus",
             whatsapp_contact_sync_status AS "whatsappContactSyncStatus",
             whatsapp_history_sync_status AS "whatsappHistorySyncStatus",
             marketing_os_tenant_id AS "marketingOsTenantId",
             whatsapp_business_account_id AS "whatsappBusinessAccountId",
             whatsapp_phone_number_id AS "whatsappPhoneNumberId",
             whatsapp_display_phone_number AS "whatsappDisplayPhoneNumber",
             whatsapp_number AS "whatsappNumber",
             whatsapp_coexistence_last_synced_at AS "whatsappCoexistenceLastSyncedAt",
             updated_at AS "updatedAt"
        FROM agencies
       WHERE lower(name) LIKE '%al%arab%tour%'
       ORDER BY created_at DESC
       LIMIT 1
    `,
    { type: sequelize.QueryTypes.SELECT }
  );

  if (!agency) {
    console.log(JSON.stringify({ agency: null }, null, 2));
    return;
  }

  const [messageStats] = await sequelize.query(
    `
      SELECT COUNT(*)::int AS total,
             MAX(timestamp) AS "lastMessageAt"
        FROM messages
       WHERE agency_id = :agencyId
    `,
    { replacements: { agencyId: agency.id }, type: sequelize.QueryTypes.SELECT }
  );

  console.log(JSON.stringify({ agency, messageStats }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error(error);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
