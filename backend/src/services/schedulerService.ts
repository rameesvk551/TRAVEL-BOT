const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const { Booking, Customer, Agency, ScheduledJob, BotSession, Package } = require('../models');
const whatsappService = require('./whatsappService');
const { setISTTime, addDays, delayUntil, formatDateShort } = require('../utils/dateUtils');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const reminderQueue = new Queue('reminders', { connection });
const chatFollowUpQueue = new Queue('chat_followups', { connection });

function getFollowUpJobId(customerId, agencyId, slot) {
  return `chat-followup:${agencyId}:${customerId}:${slot}`;
}

async function scheduleBookingReminders(booking) {
  const jobs = [
    {
      jobType: 'REMINDER_3DAY',
      scheduledAt: setISTTime(addDays(booking.travelDate, -3), 9, 0),
    },
    {
      jobType: 'REMINDER_1DAY',
      scheduledAt: setISTTime(addDays(booking.travelDate, -1), 8, 0),
    }
  ];

  if (booking.agency && booking.agency.autoReviewCollectionEnabled !== false) {
    const delayDays = booking.agency.autoReviewDelayDays ?? 2;
    jobs.push({
      jobType: 'REVIEW_REQUEST',
      scheduledAt: setISTTime(addDays(booking.returnDate, delayDays), 10, 0),
    });
  }

  for (const { jobType, scheduledAt } of jobs) {
    const delay = delayUntil(scheduledAt);
    if (delay <= 0) {
      console.log(`[Scheduler] Skipping ${jobType} for ${booking.bookingRef} - already past`);
      continue;
    }

    const bullJob = await reminderQueue.add(
      jobType,
      {
        bookingId: booking.id,
        agencyId: booking.agencyId,
        jobType,
      },
      {
        delay,
        attempts: 2,
        backoff: { type: 'fixed', delay: 10 * 60 * 1000 },
      }
    );

    await ScheduledJob.create({
      bookingId: booking.id,
      agencyId: booking.agencyId,
      jobType,
      scheduledAt,
      status: 'PENDING',
      bullJobId: bullJob.id,
    });

    console.log(`[Scheduler] Scheduled ${jobType} for ${booking.bookingRef} at ${scheduledAt.toISOString()}`);
  }
}

async function cancelBookingReminders(bookingId) {
  const jobs = await ScheduledJob.findAll({
    where: { bookingId, status: 'PENDING' },
  });

  for (const job of jobs) {
    try {
      if (job.bullJobId) {
        const bullJob = await reminderQueue.getJob(job.bullJobId);
        if (bullJob) await bullJob.remove();
      }
      await job.update({ status: 'CANCELLED' });
    } catch (err) {
      console.error(`[Scheduler] Failed to cancel job ${job.id}:`, err.message);
    }
  }
}

async function cancelChatFollowUps(customerId, agencyId) {
  const jobIds = [
    getFollowUpJobId(customerId, agencyId, '10m'),
    getFollowUpJobId(customerId, agencyId, '24h'),
  ];

  for (const jobId of jobIds) {
    const job = await chatFollowUpQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }
}

async function scheduleChatFollowUps(payload) {
  const { customerId, agencyId } = payload;
  if (!customerId || !agencyId) return;

  await cancelChatFollowUps(customerId, agencyId);

  const followUps = [
    { slot: '10m', name: 'CHAT_FOLLOWUP_10M', delay: 10 * 60 * 1000 },
    { slot: '24h', name: 'CHAT_FOLLOWUP_24H', delay: 24 * 60 * 60 * 1000 },
  ];

  for (const followUp of followUps) {
    await chatFollowUpQueue.add(
      followUp.name,
      { ...payload, slot: followUp.slot },
      {
        jobId: getFollowUpJobId(customerId, agencyId, followUp.slot),
        delay: followUp.delay,
        removeOnComplete: true,
        removeOnFail: 100,
      }
    );
  }
}

function composeFollowUpMessage(payload, slot, packageName) {
  const destination = payload.destination || 'your trip';
  const packageText = packageName ? ` ${packageName} is still worth a look.` : '';

  if (slot === '10m') {
    return `👋 Hi again! Just checking if you had any questions about ${destination}.${packageText} Reply View Packages to continue or Talk to Agent anytime. Reply STOP to opt out.`;
  }

  return `Hello! Still interested in ${destination}${payload.datesLabel ? ` for ${payload.datesLabel}` : ''}? I can help you review the options again, and our team can lock the latest available rate. Reply STOP to opt out.`;
}

async function startReminderWorker() {
  const worker = new Worker(
    'reminders',
    async (job) => {
      const { bookingId, jobType } = job.data;
      const booking = await Booking.findByPk(bookingId, {
        include: [
          { model: Customer, as: 'customer' },
          { model: Agency, as: 'agency' },
        ],
      });

      if (!booking) {
        console.log(`[Scheduler] Booking ${bookingId} not found, skipping ${jobType}`);
        return;
      }

      if (booking.status === 'CANCELLED') {
        await ScheduledJob.update(
          { status: 'CANCELLED' },
          { where: { bookingId, jobType, status: 'PENDING' } }
        );
        return;
      }

      const context = { customerId: booking.customerId, agencyId: booking.agencyId };
      const customerName = booking.customer.name || 'Customer';

      try {
        switch (jobType) {
          case 'REMINDER_3DAY':
            await whatsappService.sendTemplateMessage(
              booking.customer.phone,
              'pre_trip_checklist',
              [customerName, booking.notes || 'your destination', formatDateShort(booking.travelDate), booking.agency.phone],
              context
            );
            break;
          case 'REMINDER_1DAY':
            await whatsappService.sendTemplateMessage(
              booking.customer.phone,
              'trip_tomorrow',
              [customerName, 'Check your booking details', 'your pickup location', '', ''],
              context
            );
            break;
          case 'REVIEW_REQUEST':
            await whatsappService.sendTemplateMessage(
              booking.customer.phone,
              'review_request',
              [customerName, booking.notes || 'your trip'],
              context
            );
            await BotSession.update(
              { currentStep: 'REVIEW' },
              { where: { customerId: booking.customerId, agencyId: booking.agencyId } }
            );
            break;
        }

        await ScheduledJob.update(
          { status: 'SENT' },
          { where: { bookingId, jobType, status: 'PENDING' } }
        );
      } catch (err) {
        console.error(`[Scheduler] Failed to send ${jobType} for ${booking.bookingRef}:`, err.message);
        await ScheduledJob.update(
          { status: 'FAILED' },
          { where: { bookingId, jobType, status: 'PENDING' } }
        );
        throw err;
      }
    },
    { connection, concurrency: 5 }
  );

  worker.on('error', (err) => {
    console.error('[Scheduler] Reminder worker error:', err.message);
  });

  return worker;
}

async function startChatFollowUpWorker() {
  const worker = new Worker(
    'chat_followups',
    async (job) => {
      const { customerId, agencyId, slot, packageId } = job.data;

      const [customer, agency, session] = await Promise.all([
        Customer.findOne({ where: { id: customerId, agencyId } }),
        Agency.findByPk(agencyId),
        BotSession.findOne({ where: { customerId, agencyId } }),
      ]);

      if (!customer || !agency || !session) return;
      if (session.isHandedOff) return;
      if (session.collectedData?.followUpOptOut) return;
      if (!['SHOWING_PACKAGES', 'PACKAGE_DETAIL'].includes(session.currentStep)) return;

      const pkg = packageId
        ? await Package.findOne({ where: { id: packageId, agencyId }, attributes: ['name'] })
        : null;

      const body = composeFollowUpMessage(job.data, slot, pkg?.name || job.data.packageName);
      const context = { customerId, agencyId };

      await whatsappService.sendButtonsMessage(
        customer.phone,
        body,
        [
          { id: 'followup_view_packages', title: 'View Packages' },
          { id: 'menu_talk_agent', title: 'Talk to Agent' },
          { id: 'global_stop', title: 'Stop' },
        ],
        context,
        {
          headerText: 'Trip Reminder',
          footerText: 'We send at most two follow-ups.',
        }
      );
    },
    { connection, concurrency: 5 }
  );

  worker.on('error', (err) => {
    console.error('[Scheduler] Chat follow-up worker error:', err.message);
  });

  return worker;
}

function startWorker() {
  const reminderWorker = startReminderWorker();
  const chatFollowUpWorker = startChatFollowUpWorker();
  console.log('[Scheduler] Reminder worker started');
  console.log('[Scheduler] Chat follow-up worker started');
  return { reminderWorker, chatFollowUpWorker };
}

function getFollowUpJobId(customerId, agencyId, slot) {
  return `chat-followup-${agencyId}-${customerId}-${slot}`;
}

function composeFollowUpMessage(payload, slot, packageName) {
  const destination = payload.destination || 'your trip';
  const packageText = packageName ? ` ${packageName} is still available to review.` : '';

  if (slot === '10m') {
    return `Hi again! Just checking if you had any questions about ${destination}.${packageText} I can show the best options again or connect you to an agent. Reply STOP to opt out.`;
  }

  return `Hello! Still interested in ${destination}${payload.datesLabel ? ` for ${payload.datesLabel}` : ''}? If you want, I can help you review the package again and our team can hold the latest available rate. Reply STOP to opt out.`;
}

module.exports = {
  scheduleBookingReminders,
  cancelBookingReminders,
  scheduleChatFollowUps,
  cancelChatFollowUps,
  startWorker,
  reminderQueue,
  chatFollowUpQueue,
};
