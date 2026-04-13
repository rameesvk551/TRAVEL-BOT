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

  await ensureColumn('packages', 'category', {
    type: Sequelize.STRING(32),
    allowNull: true,
  });

  await ensureColumn('packages', 'summary', {
    type: Sequelize.TEXT,
    allowNull: true,
  });

  await ensureColumn('packages', 'brochure_url', {
    type: Sequelize.STRING(1000),
    allowNull: true,
  });

  await ensureColumn('packages', 'brochure_file_name', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });
}

migrate()
  .then(async () => {
    console.log('Package brochure migration complete');
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
