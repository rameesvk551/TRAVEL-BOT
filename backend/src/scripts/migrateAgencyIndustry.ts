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

async function migrate() {
  await sequelize.authenticate();

  // Passive vertical marker. Backend logic stays industry-agnostic; the frontend
  // uses this to relabel the UI and choose which modules to show. Existing rows
  // default to TRAVEL so current behaviour is unchanged.
  await ensureColumn('agencies', 'industry', {
    type: Sequelize.ENUM('TRAVEL', 'RESORT', 'CLEANING', 'LAUNDRY'),
    allowNull: false,
    defaultValue: 'TRAVEL',
  });
}

migrate()
  .then(async () => {
    console.log('Agency industry migration complete');
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
