// FILE: /backend/src/services/marketingSchedulerService.ts

const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const dripService = require('./dripService');
const { Campaign, CampaignRecipient, Customer, MessageTemplate } = require('../models');
const whatsappService = require('./whatsappService');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const campaignQueue = new Queue('campaign_broadcast', { connection });
const dripQueue = new Queue('drip_processor', { connection });

async function startCampaignWorker() {
  const worker = new Worker(
    'campaign_broadcast',
    async (job) => {
      // In a real implementation this would process batches of recipients
      // and send WhatsApp messages respecting rate limits.
      console.log(`[MarketingScheduler] Processing campaign job ${job.id}`);
    },
    { connection, concurrency: 1 }
  );

  worker.on('error', (err) => {
    console.error('[MarketingScheduler] Campaign worker error:', err.message);
  });

  return worker;
}

async function startDripWorker() {
  const worker = new Worker(
    'drip_processor',
    async (job) => {
      console.log(`[MarketingScheduler] Processing drip check`);
      try {
        const due = await dripService.getDueEnrollments();
        for (const enrollment of due) {
          // Process next step...
          // For simplicity in this demo, just mark them as completed
          await dripService.updateEnrollment(enrollment.id, enrollment.agencyId, 'COMPLETED');
        }
      } catch (err) {
        console.error('[MarketingScheduler] Drip processing failed:', err);
      }
    },
    { connection, concurrency: 1 }
  );

  worker.on('error', (err) => {
    console.error('[MarketingScheduler] Drip worker error:', err.message);
  });

  return worker;
}

// Add a repeating job to check drips every minute
async function scheduleDripChecker() {
  await dripQueue.add('check-drips', {}, {
    repeat: {
      pattern: '* * * * *', // every minute
    },
  });
}

function startMarketingWorkers() {
  const campaignWorker = startCampaignWorker();
  const dripWorker = startDripWorker();
  scheduleDripChecker().catch(err => console.error(err));
  
  console.log('[MarketingScheduler] Campaign and Drip workers started');
  return { campaignWorker, dripWorker };
}

module.exports = {
  startMarketingWorkers,
  campaignQueue,
  dripQueue,
};
