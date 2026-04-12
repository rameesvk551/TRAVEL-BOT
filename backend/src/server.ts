// FILE: /backend/src/server.js
// DEPS: dotenv
// ENV: PORT, DATABASE_URL

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const app = require('./app');
const { sequelize } = require('./models');
const { startWorker } = require('./services/schedulerService');

const PORT = process.env.PORT || 3000;

/**
 * Starts the backend server after syncing database and initializing workers.
 */
async function start() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Sync models (use migrations in production)
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync();
      console.log('✅ Database synced');
    }

    // Start BullMQ reminder worker
    try {
      startWorker();
      console.log('✅ Scheduler worker started');
    } catch (err) {
      console.warn('⚠️  Scheduler worker failed to start (Redis may be unavailable):', err.message);
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 TravelBot Backend running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   API:    http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
