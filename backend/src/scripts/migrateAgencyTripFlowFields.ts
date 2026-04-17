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

  await ensureColumn('agencies', 'whatsapp_trip_flow_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_trip_flow_name', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_trip_flow_status', {
    type: Sequelize.STRING(50),
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_trip_flow_error', {
    type: Sequelize.TEXT,
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_trip_flow_last_synced_at', {
    type: Sequelize.DATE,
    allowNull: true,
  });
}

migrate()
  .then(async () => {
    console.log('Agency trip flow migration complete');
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
