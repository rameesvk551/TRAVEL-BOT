const path = require('path');
const { Op } = require('sequelize');
const { Lead, Customer, Package } = require(path.resolve(__dirname, '../../../backend/src/models/index.ts'));
const leadService = require(path.resolve(__dirname, '../../../backend/src/services/leadService.ts'));
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));

const ACTIVE_STATUSES = ['JUST_CONTACTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING'];

function normalizeText(value = '') {
  return String(value || '').trim();
}

function formatBudget(value) {
  const amount = Number(value || 0);
  if (!amount) return 'Not shared yet';
  return `₹${Math.round(amount / 100).toLocaleString('en-IN')}`;
}

async function findLatestLeadForAgent(agent, agency, leadId = '') {
  const normalizedLeadId = normalizeText(leadId);

  if (normalizedLeadId) {
    const directLead = await Lead.findOne({
      where: { id: normalizedLeadId, agencyId: agency.id },
    });

    if (directLead) {
      return directLead;
    }
  }

  return Lead.findOne({
    where: {
      agencyId: agency.id,
      assignedAgentId: agent.id,
      status: { [Op.in]: ACTIVE_STATUSES },
    },
    order: [['createdAt', 'DESC']],
  });
}

async function appendLeadNote(lead, agencyId, note) {
  const mergedNotes = [lead.notes, note].filter(Boolean).join(' | ');
  return leadService.updateLead(lead.id, agencyId, { notes: mergedNotes });
}

async function sendLeadSummaryToAgent(agent, agency, lead) {
  const customer = await Customer.findOne({ where: { id: lead.customerId, agencyId: agency.id } });
  const pkg = lead.packageId
    ? await Package.findOne({ where: { id: lead.packageId, agencyId: agency.id } })
    : null;
  const summary = [
    '🔥 Lead Details',
    '',
    `Name: ${customer?.name || 'Unknown'}`,
    `Phone: ${customer?.phone || 'Unknown'}`,
    `Package: ${pkg?.name || 'Not selected'}`,
    `Date: ${lead.travelDates || 'Not shared yet'}`,
    `People: ${lead.travellers || 'Not shared yet'}`,
    `Budget: ${formatBudget(lead.budgetPerPerson)}`,
    '',
    'Reply NOTE: <text> to add a note.',
  ].join('\n');

  return whatsappService.sendTextMessage(
    agent.phone,
    summary,
    { customerId: lead.customerId, agencyId: agency.id }
  );
}

async function handleAgentLeadAction({ agent, agency, incoming }) {
  const actionId = normalizeText(incoming?.actionId || '');
  const text = normalizeText(incoming?.text || '');
  const leadId = actionId.includes(':') ? actionId.split(':').slice(1).join(':') : '';
  const lowerText = text.toLowerCase();

  const isNoteCommand = lowerText.startsWith('note:') || lowerText.startsWith('add note:');
  const isContactedCommand = actionId.startsWith('lead_contacted:') || lowerText === 'contacted' || lowerText === 'mark as contacted';
  const isBookedCommand = actionId.startsWith('lead_booked:') || lowerText === 'booked' || lowerText === 'mark as booked';
  const isCallCommand = actionId.startsWith('lead_call:') || lowerText === 'call now' || lowerText === 'call';

  const lead = await findLatestLeadForAgent(agent, agency, leadId);

  if (!lead) {
    return whatsappService.sendTextMessage(
      agent.phone,
      'I could not find an active lead for that update.',
      { agencyId: agency.id }
    );
  }

  if (isCallCommand) {
    const customer = await Customer.findOne({ where: { id: lead.customerId, agencyId: agency.id } });
    const pkg = lead.packageId
      ? await Package.findOne({ where: { id: lead.packageId, agencyId: agency.id } })
      : null;
    const callSummary = [
      '📞 Call this customer',
      '',
      `Name: ${customer?.name || 'Unknown'}`,
      `Phone: ${customer?.phone || 'Unknown'}`,
      `Package: ${pkg?.name || 'Not selected'}`,
      `Date: ${lead.travelDates || 'Not shared yet'}`,
      `People: ${lead.travellers || 'Not shared yet'}`,
    ].join('\n');

    return whatsappService.sendTextMessage(
      agent.phone,
      callSummary,
      { customerId: lead.customerId, agencyId: agency.id }
    );
  }

  if (isContactedCommand) {
    const updatedLead = await leadService.updateLead(lead.id, agency.id, { status: 'CONTACTED' });
    await appendLeadNote(updatedLead, agency.id, 'Marked as contacted via WhatsApp');
    return whatsappService.sendTextMessage(
      agent.phone,
      'Lead updated to CONTACTED.',
      { customerId: lead.customerId, agencyId: agency.id }
    );
  }

  if (isBookedCommand) {
    const updatedLead = await leadService.updateLead(lead.id, agency.id, { status: 'BOOKED' });
    await appendLeadNote(updatedLead, agency.id, 'Marked as booked via WhatsApp');
    return whatsappService.sendTextMessage(
      agent.phone,
      'Lead updated to BOOKED.',
      { customerId: lead.customerId, agencyId: agency.id }
    );
  }

  if (isNoteCommand) {
    const note = text.replace(/^add note:\s*/i, '').replace(/^note:\s*/i, '').trim();
    if (!note) {
      return whatsappService.sendTextMessage(
        agent.phone,
        'Please send the note after NOTE: ...',
        { customerId: lead.customerId, agencyId: agency.id }
      );
    }

    await appendLeadNote(lead, agency.id, `Agent note: ${note}`);
    return whatsappService.sendTextMessage(
      agent.phone,
      'Note added to the lead.',
      { customerId: lead.customerId, agencyId: agency.id }
    );
  }

  return sendLeadSummaryToAgent(agent, agency, lead);
}

module.exports = { handleAgentLeadAction };
