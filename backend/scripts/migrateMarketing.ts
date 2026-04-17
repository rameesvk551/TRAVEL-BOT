// FILE: /backend/scripts/migrateMarketing.ts

import { sequelize, Customer, Lead, Booking, Agency, Package, Payment, Message, BotSession, Agent, MessageTemplate, Campaign, CampaignRecipient, DripSequence, DripStep, DripEnrollment, ReferralCode, Review } from '../src/models';

async function migrate() {
  console.log('Starting migration for Marketing objects...');
  
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    
    // We use alter so we don't drop existing tables (Customer, Booking)
    await sequelize.sync({ alter: true });
    console.log('All models were synchronized successfully.');

    process.exit(0);
  } catch (error) {
    console.error('Unable to connect to the database or sync:', error);
    process.exit(1);
  }
}

migrate();
