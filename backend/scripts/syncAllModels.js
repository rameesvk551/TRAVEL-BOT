require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { sequelize } = require('../src/models');

async function syncAll() {
  try {
    await sequelize.authenticate();
    console.log('DB connection OK. Running sync...');
    await sequelize.sync({ alter: true });
    console.log('All models synchronized (tables/columns created or updated).');
    await sequelize.close();
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  }
}

syncAll();
