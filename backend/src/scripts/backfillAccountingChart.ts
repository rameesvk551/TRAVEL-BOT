require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { sequelize } = require('../models');
const accountingService = require('../services/accountingService');
const { ensureAccountingTables } = require('../services/schemaBootstrap');

async function main() {
  await ensureAccountingTables();
  const result = await accountingService.backfillDefaultChartOfAccounts();
  console.log(`[Accounting] Default chart ready for ${result.agencies} agencies`);
}

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[Accounting] Backfill failed:', error);
    await sequelize.close();
    process.exit(1);
  });
