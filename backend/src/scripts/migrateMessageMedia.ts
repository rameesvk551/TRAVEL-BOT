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

  // Media metadata so received WhatsApp media (photo, voice, video, document)
  // can be streamed on demand by the media proxy instead of showing a
  // placeholder. Nullable — existing text messages keep NULLs.
  await ensureColumn('messages', 'media_id', { type: Sequelize.STRING(255), allowNull: true });
  await ensureColumn('messages', 'mime_type', { type: Sequelize.STRING(255), allowNull: true });
  await ensureColumn('messages', 'media_filename', { type: Sequelize.STRING(500), allowNull: true });

  // Video messages need a new enum value. ADD VALUE IF NOT EXISTS is idempotent
  // (Postgres 9.6+) and cannot run inside a transaction, so run it standalone.
  try {
    await sequelize.query(`ALTER TYPE "enum_messages_type" ADD VALUE IF NOT EXISTS 'VIDEO'`);
    console.log('+ Ensured enum_messages_type has VIDEO');
  } catch (err) {
    console.warn('! Could not add VIDEO enum value (may already exist):', err.message);
  }
}

migrate()
  .then(async () => {
    console.log('Message media migration complete');
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
