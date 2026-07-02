import dotenv from 'dotenv';
dotenv.config();

import { listLeads } from './src/services/leadService';
import { sequelize } from './src/models';

async function run() {
  try {
    const agencyId = '5f64bd06-24d7-4f8a-beb2-c37e6e1b1018'; // TravAround
    const filters = { channelId: '687d287f-24a9-4cb9-908a-a7c68f0324f8' }; // The newly added channel
    console.log('Testing with channelId:', filters.channelId);
    
    // We can enable logging temporarily to see the SQL
    sequelize.options.logging = console.log;
    
    const res = await listLeads(agencyId, filters, null);
    console.log('Result length:', res.data.length);
    if (res.data.length > 0) {
      console.log('First lead:', res.data[0].id, res.data[0].customer?.channelId);
    }
  } catch (err) {
    console.error('Error running listLeads:', err);
  } finally {
    process.exit(0);
  }
}

run();
