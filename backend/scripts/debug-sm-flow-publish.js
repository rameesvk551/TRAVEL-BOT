const { sequelize, WhatsAppFlow } = require('../src/models');

async function main() {
  const [agency] = await sequelize.query(
    `SELECT id, name,
            whatsapp_provider AS "whatsappProvider",
            whatsapp_connection_status AS "whatsappConnectionStatus",
            marketing_os_tenant_id AS "marketingOsTenantId",
            whatsapp_channel_id AS "whatsappChannelId",
            whatsapp_business_account_id AS "whatsappBusinessAccountId",
            whatsapp_phone_number_id AS "whatsappPhoneNumberId",
            whatsapp_trip_flow_id AS "whatsappTripFlowId",
            whatsapp_trip_flow_name AS "whatsappTripFlowName",
            whatsapp_trip_flow_status AS "whatsappTripFlowStatus",
            whatsapp_trip_flow_error AS "whatsappTripFlowError",
            whatsapp_trip_flow_last_synced_at AS "whatsappTripFlowLastSyncedAt",
            updated_at AS "updatedAt"
       FROM agencies
      WHERE lower(name) LIKE lower(:name)
      ORDER BY created_at DESC
      LIMIT 1`,
    {
      replacements: { name: '%sm%tour%travel%' },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  if (!agency) {
    console.log(JSON.stringify({ agency: null }, null, 2));
    return;
  }

  const flows = await WhatsAppFlow.findAll({
    where: { agencyId: agency.id },
    order: [['updatedAt', 'DESC']],
    raw: true,
  });

  console.log(JSON.stringify({ agency, flows }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (err) => {
    console.error(err.message);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
