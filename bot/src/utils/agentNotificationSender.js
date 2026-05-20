const path = require('path');
const { Op } = require('sequelize');
const { MessageTemplate } = require(path.resolve(__dirname, '../../../backend/src/models/index.ts'));
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));

const NOT_SHARED = 'Not shared yet';

function valueOrFallback(value, fallback = NOT_SHARED) {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function formatBudget(details = {}) {
  const explicit = details.budgetText ?? details.budgetLabel ?? details.budget;
  if (valueOrFallback(explicit, '')) return valueOrFallback(explicit);

  const amountPaise = Number(details.budgetPerPerson || 0);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) return NOT_SHARED;
  return `\u20B9${Math.round(amountPaise / 100).toLocaleString('en-IN')}`;
}

function packageOrDestination(details = {}) {
  return valueOrFallback(
    details.packageName || details.package?.name || details.destination,
    'Not selected'
  );
}

async function findApprovedAgentTemplate(agencyId, suffix) {
  if (!agencyId || !suffix) return null;

  return MessageTemplate.findOne({
    where: {
      agencyId,
      status: 'APPROVED',
      name: { [Op.iLike]: `%${suffix}` },
    },
    order: [['updatedAt', 'DESC']],
  });
}

function buildLeadAssignmentVariables(details = {}) {
  return [
    valueOrFallback(details.customerName || details.name, 'Unknown'),
    valueOrFallback(details.phone, 'Unknown'),
    packageOrDestination(details),
    valueOrFallback(details.travelDate || details.dates || details.travelDates),
    valueOrFallback(details.travellers || details.people),
    formatBudget(details),
    valueOrFallback(details.notes),
  ];
}

function renderLeadAssignmentFallback(variables) {
  return [
    'New Enquiry',
    '',
    `Name: ${variables[0]}`,
    `Call customer: ${variables[1]}`,
    `Package: ${variables[2]}`,
    `Date: ${variables[3]}`,
    `People: ${variables[4]}`,
    `Budget: ${variables[5]}`,
    `Notes: ${variables[6]}`,
    '',
    'Tap the phone number above to call the customer.',
  ].join('\n');
}

function buildTalkToAgentVariables(details = {}) {
  return [
    valueOrFallback(details.customerName || details.name, 'Unknown'),
    valueOrFallback(details.phone, 'Unknown'),
    packageOrDestination(details),
  ];
}

function renderTalkToAgentFallback(variables) {
  return [
    'Talk-to-agent intent',
    '',
    `Customer: ${variables[0]}`,
    `Call customer: ${variables[1]}`,
    `Package: ${variables[2]}`,
    '',
    'Tap the phone number above to call the customer.',
  ].join('\n');
}

async function sendAgentLeadAssignment(agentPhone, agencyId, details, context) {
  const variables = buildLeadAssignmentVariables(details);
  const template = await findApprovedAgentTemplate(agencyId, 'agent_new_enquiry_assignment');

  if (template) {
    return whatsappService.sendTemplateMessage(
      agentPhone,
      template.name,
      variables,
      context,
      { template }
    );
  }

  return whatsappService.sendTextMessage(
    agentPhone,
    renderLeadAssignmentFallback(variables),
    context
  );
}

async function sendAgentTalkToAgentIntent(agentPhone, agencyId, details, context) {
  const variables = buildTalkToAgentVariables(details);
  const template = await findApprovedAgentTemplate(agencyId, 'agent_talk_to_agent_intent');

  if (template) {
    return whatsappService.sendTemplateMessage(
      agentPhone,
      template.name,
      variables,
      context,
      { template }
    );
  }

  return whatsappService.sendTextMessage(
    agentPhone,
    renderTalkToAgentFallback(variables),
    context
  );
}

module.exports = {
  sendAgentLeadAssignment,
  sendAgentTalkToAgentIntent,
};
