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

  await ensureColumn('agencies', 'auto_review_collection_enabled', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  });

  await ensureColumn('agencies', 'auto_review_delay_days', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 2,
  });
}

migrate()
  .then(async () => {
    console.log('Agency review settings migration complete');
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
