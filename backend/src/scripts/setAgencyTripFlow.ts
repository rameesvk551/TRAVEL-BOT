require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { sequelize } = require('../models');

async function main() {
  const [, , agencyEmail, flowId, flowStatus = 'PUBLISHED', ...nameParts] = process.argv;
  const flowName = nameParts.join(' ').trim() || null;

  if (!agencyEmail || !flowId) {
    throw new Error('Usage: node backend/src/scripts/setAgencyTripFlow.ts <agency_email> <flow_id> [flow_status] [flow_name]');
  }

  await sequelize.authenticate();

  const agencyRows = await sequelize.query(
    'SELECT id, email, whatsapp_trip_flow_id, whatsapp_trip_flow_status, whatsapp_trip_flow_name FROM agencies WHERE email = $1 LIMIT 1',
    {
      bind: [agencyEmail],
    }
  );

  const agency = agencyRows[0];
  if (!agency) {
    throw new Error(`Agency not found for email ${agencyEmail}`);
  }

  const nextFlowName = flowName || agency.whatsapp_trip_flow_name || null;

  await sequelize.query(
    `UPDATE agencies
     SET whatsapp_trip_flow_id = $1,
         whatsapp_trip_flow_status = $2,
         whatsapp_trip_flow_name = $3,
         whatsapp_trip_flow_error = NULL,
         whatsapp_trip_flow_last_synced_at = NOW()
     WHERE email = $4`,
    {
      bind: [flowId, flowStatus, nextFlowName, agencyEmail],
    }
  );

  console.log(JSON.stringify({
    agencyId: agency.id,
    email: agency.email,
    whatsappTripFlowId: flowId,
    whatsappTripFlowStatus: flowStatus,
    whatsappTripFlowName: nextFlowName,
  }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err.message || err);
    try {
      await sequelize.close();
    } catch {}
    process.exit(1);
  });
