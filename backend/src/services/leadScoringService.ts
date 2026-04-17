// FILE: /backend/src/services/leadScoringService.ts

const { Op } = require('sequelize');
const { Lead, Message, BotSession } = require('../models');

/**
 * Calculates a lead score (0-100) based on engagement and fit.
 */
async function calculateScore(leadId, agencyId) {
  const lead = await Lead.findOne({ where: { id: leadId, agencyId } });
  if (!lead) throw new Error('Lead not found');

  let score = 0;

  // Fit Score (0-40)
  if (lead.budgetPerPerson > 50000) score += 20;
  else if (lead.budgetPerPerson > 20000) score += 10;
  
  if (lead.travellers && lead.travellers > 2) score += 10;
  
  if (lead.travelStart) {
    const daysToTravel = (new Date(lead.travelStart) - new Date()) / (1000 * 60 * 60 * 24);
    if (daysToTravel > 0 && daysToTravel <= 15) score += 10; // urgent
    else if (daysToTravel > 15 && daysToTravel <= 45) score += 5;
  }

  // Engagement Score (0-60)
  const messagesCount = await Message.count({
    where: { agencyId, customerId: lead.customerId, senderType: 'CUSTOMER' },
  });
  
  if (messagesCount > 10) score += 30;
  else if (messagesCount > 5) score += 20;
  else if (messagesCount > 0) score += 10;

  const session = await BotSession.findOne({
    where: { agencyId, customerId: lead.customerId },
  });
  
  if (session) {
    if (session.isHandedOff) score += 20; // Active human interaction
    
    // Recency
    const daysSinceLastActive = (new Date() - new Date(session.lastActivityAt)) / (1000 * 60 * 60 * 24);
    if (daysSinceLastActive <= 1) score += 10;
    else if (daysSinceLastActive <= 3) score += 5;
    else if (daysSinceLastActive > 15) score -= 10; // cold
  }

  // Ensure bounds
  score = Math.max(0, Math.min(100, score));

  // Update lead
  await lead.update({ leadScore: score });
  return score;
}

/**
 * Batch score recalculation for active leads.
 */
async function batchScore(agencyId) {
  const activeLeads = await Lead.findAll({
    where: { agencyId, status: { [Op.notIn]: ['BOOKED', 'LOST', 'CANCELLED'] } },
    attributes: ['id'],
    raw: true,
  });

  for (const lead of activeLeads) {
    await calculateScore(lead.id, agencyId).catch((err) => console.error(`Failed to score ${lead.id}:`, err));
  }
}

module.exports = { calculateScore, batchScore };
