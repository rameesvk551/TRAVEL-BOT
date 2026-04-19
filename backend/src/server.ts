// FILE: /backend/src/server.js
// DEPS: dotenv
// ENV: PORT, DATABASE_URL

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const app = require('./app');
const { sequelize } = require('./models');
const { startWorker } = require('./services/schedulerService');
const { ensureProductionSchema } = require('./services/schemaBootstrap');
const { seedPrebuiltTemplates } = require('./services/templateService');

const PORT = process.env.PORT || 3000;

/**
 * Starts the backend server after syncing database and initializing workers.
 */
async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');

    if (process.env.NODE_ENV === 'production') {
      await ensureProductionSchema();
      console.log('Production schema checked');
    } else {
      await sequelize.sync();
      console.log('Database synced');
    }
    
    await seedPrebuiltTemplates();

    try {
      startWorker();
      console.log('Scheduler worker started');
    } catch (err) {
      console.warn('Scheduler worker failed to start (Redis may be unavailable):', err.message);
    }

    app.listen(PORT, () => {
      console.log(`TravelBot Backend running on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`API:    http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
