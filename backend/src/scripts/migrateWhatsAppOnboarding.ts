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

  await ensureColumn('agencies', 'whatsapp_provider', {
    type: Sequelize.ENUM('SELF_HOSTED', 'INTERAKT', 'MARKETING_OS'),
    allowNull: false,
    defaultValue: 'SELF_HOSTED',
  });

  await ensureColumn('agencies', 'whatsapp_connection_status', {
    type: Sequelize.ENUM('NOT_CONNECTED', 'PENDING', 'CONNECTED', 'FAILED'),
    allowNull: false,
    defaultValue: 'NOT_CONNECTED',
  });

  await ensureColumn('agencies', 'marketing_os_tenant_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_channel_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_business_account_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_phone_number_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_display_phone_number', {
    type: Sequelize.STRING(30),
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_onboarding_mode', {
    type: Sequelize.ENUM('STANDARD', 'COEXISTENCE'),
    allowNull: false,
    defaultValue: 'STANDARD',
  });

  await ensureColumn('agencies', 'whatsapp_coexistence_status', {
    type: Sequelize.ENUM('NOT_ENABLED', 'PENDING', 'ACTIVE', 'DISCONNECTED', 'FAILED'),
    allowNull: false,
    defaultValue: 'NOT_ENABLED',
  });

  await ensureColumn('agencies', 'whatsapp_contact_sync_status', {
    type: Sequelize.ENUM('NOT_STARTED', 'PENDING', 'COMPLETE', 'FAILED'),
    allowNull: false,
    defaultValue: 'NOT_STARTED',
  });

  await ensureColumn('agencies', 'whatsapp_history_sync_status', {
    type: Sequelize.ENUM('NOT_STARTED', 'PENDING', 'COMPLETE', 'FAILED', 'DECLINED'),
    allowNull: false,
    defaultValue: 'NOT_STARTED',
  });

  await ensureColumn('agencies', 'whatsapp_coexistence_last_synced_at', {
    type: Sequelize.DATE,
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_catalog_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_connection_error', {
    type: Sequelize.TEXT,
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_last_synced_at', {
    type: Sequelize.DATE,
    allowNull: true,
  });
}

migrate()
  .then(async () => {
    console.log('WhatsApp onboarding migration complete');
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
