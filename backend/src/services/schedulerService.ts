const { Queue, Worker } = require('bullmq');
const { Op } = require('sequelize');
const IORedis = require('ioredis');
const { Booking, Customer, Agency, ScheduledJob, BotSession, Package, Agent, FollowUp, Lead } = require('../models');
const whatsappService = require('./whatsappService');
const { setISTTime, addDays, delayUntil, formatDateShort } = require('../utils/dateUtils');

const redisUrl = process.env.REDIS_URL || (process.env.NODE_ENV === 'production' ? null : 'redis://localhost:6379');
const redisEnabled = Boolean(redisUrl);
let redisWarningShown = false;

function logRedisDisabled(reason) {
  if (redisWarningShown) return;
  redisWarningShown = true;
  console.warn(`[Scheduler] Redis unavailable, queue-backed scheduling is disabled${reason ? `: ${reason}` : ''}`);
}

let connection = null;
let reminderQueue = null;
let chatFollowUpQueue = null;

if (redisEnabled) {
  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });
  connection.on('error', (err) => {
    logRedisDisabled(err.message);
  });

  reminderQueue = new Queue('reminders', { connection });
  chatFollowUpQueue = new Queue('chat_followups', { connection });
} else {
  logRedisDisabled('REDIS_URL is not configured');
}

function getFollowUpJobId(customerId, agencyId, slot) {
  return `chat-followup:${agencyId}:${customerId}:${slot}`;
}

async function scheduleBookingReminders(booking) {
  if (!reminderQueue) return [];
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
  if (!reminderQueue) return;
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
  if (!chatFollowUpQueue) return;
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
  if (!chatFollowUpQueue) return;

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

function composeReviewRequestText(customerName, tripName) {
  return `Welcome back, ${customerName}!\n\nHow was your ${tripName} trip? We'd love to hear about it!\n\nRate your experience from 1-5 and share a quick review.\n\nYour feedback helps us serve you better!`;
}

async function startReminderWorker() {
  if (!connection) return null;
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
            await whatsappService.sendTemplateOrTextIn24hWindow(
              booking.customer.phone,
              {
                templateName: 'review_request',
                variables: [customerName, booking.notes || 'recent'],
                text: composeReviewRequestText(customerName, booking.notes || 'recent'),
                context,
              }
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
  if (!connection) return null;
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
  if (!connection || !reminderQueue || !chatFollowUpQueue) {
    logRedisDisabled(redisEnabled ? 'connection could not be established' : 'REDIS_URL is not configured');
    return { reminderWorker: null, chatFollowUpWorker: null, agentPoller: startAgentFollowUpReminderPoller() };
  }
  const reminderWorker = startReminderWorker();
  const chatFollowUpWorker = startChatFollowUpWorker();
  const agentPoller = startAgentFollowUpReminderPoller();
  console.log('[Scheduler] Reminder worker started');
  console.log('[Scheduler] Chat follow-up worker started');
  console.log('[Scheduler] Agent follow-up poller started');
  return { reminderWorker, chatFollowUpWorker, agentPoller };
}

function startAgentFollowUpReminderPoller() {
  const timer = setInterval(async () => {
    try {
      const now = new Date();
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
      
      const upcomingFollowUps = await FollowUp.findAll({
        where: {
          status: 'Scheduled',
          notificationSent: false,
          scheduledAt: {
            [Op.gt]: now,
            [Op.lte]: nextHour
          }
        },
        include: [
          { model: Agent, as: 'agent' },
          { model: Agency, as: 'agency' },
          { model: Lead, as: 'lead', include: [{ model: Customer, as: 'customer' }] }
        ]
      });

      for (const followUp of upcomingFollowUps) {
        const agency = followUp.agency;
        if (!agency || agency.followUpReminderEnabled === false) continue;
        
        const reminderMinutes = agency.followUpReminderMinutes || 30;
        const timeDiffMins = (followUp.scheduledAt.getTime() - now.getTime()) / 60000;
        
        if (timeDiffMins <= reminderMinutes) {
          if (followUp.agent && followUp.agent.phone) {
            const msg = `*Follow-up Reminder*\n\nYou have a follow-up scheduled in ${Math.round(timeDiffMins)} mins.\n\nCustomer: ${followUp.lead?.customer?.name || 'Unknown'}\nNote: ${followUp.note || 'No notes'}`;
            await whatsappService.sendSystemNotificationWhatsApp(followUp.agent.phone, msg, { agencyId: agency.id }).catch(console.error);
          }
          await followUp.update({ notificationSent: true });
        }
      }
    } catch (e) {
      console.error('[Scheduler] Agent follow-up poller error:', e.message);
    }
  }, 60000);
  return timer;
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
