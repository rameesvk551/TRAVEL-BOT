require('dotenv').config({ path: '../.env' });

const { sequelize } = require('./dist/models');
const templateService = require('./dist/services/templateService');

const AGENCY_ID = 'bc915bd9-0b3b-4c43-9a48-aeb8689434d8';
const TEMPLATE_IDS = [
  'dd5837d4-1978-4d71-9635-0b89ba7194c1',
  '80965799-d5f6-411e-807a-02aadff0ace1',
];

async function main() {
  const results = [];

  for (const id of TEMPLATE_IDS) {
    try {
      const template = await templateService.submitForApproval(id, AGENCY_ID);
      results.push({
        id,
        name: template.name,
        status: template.status,
        metaTemplateId: template.metaTemplateId,
        ok: true,
      });
    } catch (err) {
      results.push({
        id,
        ok: false,
        message: err.message,
        statusCode: err.statusCode || err.response?.status || null,
        details: err.details || err.response?.data || null,
      });
    }
  }

  console.log(JSON.stringify(results, null, 2));
  await sequelize.close();

  if (results.some((result) => !result.ok)) {
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error(err);
  try {
    await sequelize.close();
  } catch (_) {}
  process.exit(1);
});
