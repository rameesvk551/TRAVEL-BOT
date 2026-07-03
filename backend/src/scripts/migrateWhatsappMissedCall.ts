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

  await ensureColumn('agencies', 'whatsapp_missed_call_auto_reply_enabled', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });

  await ensureColumn('agencies', 'whatsapp_missed_call_auto_reply_message', {
    type: Sequelize.TEXT,
    allowNull: true,
  });

  // Postgres needs the enum type created before the column can use it. addColumn
  // with an ENUM handles this, but guard for re-runs where the type may linger.
  await ensureColumn('agencies', 'whatsapp_missed_call_unknown_action', {
    type: Sequelize.ENUM('LOG_ONLY', 'CREATE_LEAD'),
    allowNull: false,
    defaultValue: 'LOG_ONLY',
  });

  // The whatsapp_calls table itself is created by sequelize.sync() on boot; this
  // sync() call makes the script self-sufficient when run standalone.
  await sequelize.sync();
}

migrate()
  .then(async () => {
    console.log('WhatsApp missed-call migration complete');
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
