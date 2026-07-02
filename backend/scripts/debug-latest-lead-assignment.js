const { sequelize } = require('../src/models');

async function main() {
  const rows = await sequelize.query(
    `
      SELECT l.id AS "leadId",
             l.updated_at AS "leadUpdatedAt",
             l.assigned_agent_id AS "assignedAgentId",
             a.name AS "agentName",
             a.phone AS "agentPhone",
             c.name AS "customerName",
             c.phone AS "customerPhone",
             ag.id AS "agencyId",
             ag.name AS "agencyName",
             ag.whatsapp_provider AS "whatsappProvider",
             ag.marketing_os_tenant_id AS "marketingOsTenantId"
        FROM leads l
        LEFT JOIN agents a ON a.id = l.assigned_agent_id
        LEFT JOIN customers c ON c.id = l.customer_id
        LEFT JOIN agencies ag ON ag.id = l.agency_id
       WHERE l.assigned_agent_id IS NOT NULL
       ORDER BY l.updated_at DESC
       LIMIT 10
    `,
    { type: sequelize.QueryTypes.SELECT }
  );

  const templates = await sequelize.query(
    `
      SELECT agency_id AS "agencyId", name, status, language, updated_at AS "updatedAt"
        FROM message_templates
       WHERE name ILIKE '%agent_new_enquiry_assignment%'
       ORDER BY updated_at DESC
       LIMIT 20
    `,
    { type: sequelize.QueryTypes.SELECT }
  );

  console.log(JSON.stringify({ assignments: rows, templates }, null, 2));
}

main()
  .then(async () => sequelize.close())
  .catch(async (err) => {
    console.error(err);
    try { await sequelize.close(); } catch (_) {}
    process.exit(1);
  });
