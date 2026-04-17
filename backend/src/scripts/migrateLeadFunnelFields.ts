require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { sequelize, Sequelize } = require('../models');

async function ensureColumn(tableName, columnName, definition) {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable(tableName);

  if (table[columnName]) {
    console.log(`- ${tableName}.${columnName} already exists`);
    return;
  }

  await queryInterface.addColumn(tableName, columnName, definition);
  console.log(`+ Added ${tableName}.${columnName}`);
}

async function ensureLeadStatusValues() {
  const values = ['JUST_CONTACTED', 'ENQUIRY'];

  for (const value of values) {
    try {
      await sequelize.query(`ALTER TYPE "enum_leads_status" ADD VALUE IF NOT EXISTS '${value}'`);
      console.log(`+ Ensured leads.status enum value ${value}`);
    } catch (err) {
      console.warn(`! Could not ensure enum value ${value}:`, err.message);
    }
  }
}

async function migrate() {
  await sequelize.authenticate();

  await ensureColumn('leads', 'interest', {
    type: Sequelize.STRING(50),
    allowNull: true,
  });

  await ensureColumn('leads', 'source', {
    type: Sequelize.STRING(100),
    allowNull: true,
    defaultValue: 'whatsapp_organic',
  });

  await ensureColumn('leads', 'referral_code_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('leads', 'lead_score', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
  });

  await ensureLeadStatusValues();
}

migrate()
  .then(async () => {
    console.log('Lead funnel migration complete');
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
