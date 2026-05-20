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

  await ensureColumn('agencies', 'welcome_message', {
    type: Sequelize.TEXT,
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_menu_labels', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureColumn('agencies', 'whatsapp_menu_config', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: [],
  });

  await ensureColumn('agencies', 'whatsapp_flow_config', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureColumn('packages', 'tour_type', {
    type: Sequelize.STRING(80),
    allowNull: true,
  });
}

migrate()
  .then(async () => {
    console.log('Agency welcome menu settings migration complete');
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
