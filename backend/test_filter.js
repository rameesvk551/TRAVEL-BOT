require('dotenv').config({ path: __dirname + '/.env' });
const { Sequelize } = require('sequelize');
const leadService = require('./src/services/leadService');

async function run() {
  try {
    const agencyId = '5f64bd06-24d7-4f8a-beb2-c37e6e1b1018'; // TravAround
    const filters = { channelId: '687d287f-24a9-4cb9-908a-a7c68f0324f8' }; // The newly added channel
    const res = await leadService.listLeads(agencyId, filters, null);
    console.log('Result length:', res.data.length);
    if (res.data.length > 0) {
      console.log('First lead:', res.data[0].id, res.data[0].customer?.channelId);
    }
  } catch (err) {
    console.error('Error running listLeads:', err);
  }
  process.exit(0);
}

run();
