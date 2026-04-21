// FILE: /backend/src/services/leadService.js
// DEPS: sequelize

const { Op } = require('sequelize');
const { Lead, Customer, Agent, Package, Message, Booking, FollowUp, LeadNote } = require('../models');
const { normalizePhone, isValidIndianPhone } = require('../utils/phoneUtils');
const whatsappService = require('./whatsappService');

/**
 * Lists leads for an agency with filtering and pagination.
 * @param {string} agencyId - Agency ID
 * @param {object} filters - { status, agentId, search, dateFrom, dateTo, page, pageSize }
 * @returns {Promise<object>} { data, total, page, pageSize }
 */
function isAdmin(requester) {
  return requester?.role === 'ADMIN';
}

function scopedLeadWhere(agencyId, requester, extra = {}) {
  const where = { agencyId, ...extra };
  if (requester?.id && !isAdmin(requester)) {
    where.assignedAgentId = requester?.id;
  }
  return where;
}

async function listLeads(agencyId, filters = {}, requester = null) {
  const { status, agentId, search, dateFrom, dateTo, page = 1, pageSize = 20 } = filters;

  const where = scopedLeadWhere(agencyId, requester);

  if (status) {
    if (Array.isArray(status)) {
      where.status = { [Op.in]: status };
    } else {
      where.status = status;
    }
  }

  if (agentId && isAdmin(requester)) where.assignedAgentId = agentId;

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
    if (dateTo) where.createdAt[Op.lte] = new Date(dateTo);
  }

  // Search by customer name or phone
  const customerWhere = {};
  if (search) {
    customerWhere[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * pageSize;

  const { count, rows } = await Lead.findAndCountAll({
    where,
    include: [
      { model: Customer, as: 'customer', where: Object.keys(customerWhere).length ? customerWhere : undefined },
      { model: Agent, as: 'assignedAgent', attributes: ['id', 'name', 'email'] },
      { model: Package, as: 'package', attributes: ['id', 'name', 'basePrice'] },
      { model: FollowUp, as: 'followUps', required: false, where: { status: 'Scheduled' } },
    ],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset,
  });

  return { data: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) };
}

/**
 * Gets a single lead with full details including messages and booking.
 * @param {string} leadId - Lead ID
 * @param {string} agencyId - Agency ID (for scoping)
 * @returns {Promise<object>} Lead with all relations
 */
async function getLeadById(leadId, agencyId, requester = null) {
  const lead = await Lead.findOne({
    where: scopedLeadWhere(agencyId, requester, { id: leadId }),
    include: [
      { model: Customer, as: 'customer' },
      { model: Agent, as: 'assignedAgent', attributes: ['id', 'name', 'email', 'phone'] },
      { model: Package, as: 'package' },
      { model: Booking, as: 'booking' },
    ],
  });

  if (!lead) {
    throw Object.assign(new Error('Lead not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  // Get followups and notes
  const [followUps, notes, messages] = await Promise.all([
    FollowUp.findAll({ where: { leadId, agencyId }, order: [['scheduledAt', 'ASC']] }),
    LeadNote.findAll({ 
      where: { leadId }, 
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']] 
    }),
    Message.findAll({
      where: { customerId: lead.customerId, agencyId },
      order: [['timestamp', 'DESC']],
      limit: 20,
    })
  ]);

  return { ...lead.toJSON(), messages: messages.reverse(), followUps, notesList: notes };
}

/**
 * Creates a new lead.
 * @param {object} data - Lead data
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Created lead
 */
async function resolveCustomer(data, agencyId) {
  if (data.customerId) {
    const customer = await Customer.findOne({ where: { id: data.customerId, agencyId } });
    if (!customer) {
      throw Object.assign(new Error('Customer not found'), { statusCode: 404, code: 'CUSTOMER_NOT_FOUND' });
    }
    return customer;
  }

  const rawPhone = String(data.customerPhone || '').trim();
  if (!rawPhone) {
    throw Object.assign(new Error('Customer phone is required'), { statusCode: 400, code: 'CUSTOMER_PHONE_REQUIRED' });
  }

  const phone = normalizePhone(rawPhone);
  if (!isValidIndianPhone(phone)) {
    throw Object.assign(new Error('Invalid customer phone'), { statusCode: 400, code: 'INVALID_CUSTOMER_PHONE' });
  }

  const customerName = String(data.customerName || '').trim() || null;
  const customerSource = String(data.customerSource || 'manual').trim() || 'manual';

  const [customer, created] = await Customer.findOrCreate({
    where: { agencyId, phone },
    defaults: {
      agencyId,
      phone,
      name: customerName,
      source: customerSource,
    },
  });

  if (!created) {
    const customerUpdates = {};
    if (customerName && customer.name !== customerName) customerUpdates.name = customerName;
    if (!customer.source && customerSource) customerUpdates.source = customerSource;

    if (Object.keys(customerUpdates).length > 0) {
      await customer.update(customerUpdates);
    }
  }

  return customer;
}

async function createLead(data, agencyId) {
  const {
    destination,
    travelDates,
    travellers,
    budgetPerPerson,
    interest,
    notes,
    assignedAgentId,
    packageId,
    lostReason,
    travelStart,
    travelEnd,
    status = 'NEW',
  } = data;

  const customer = await resolveCustomer(data, agencyId);

  if (assignedAgentId) {
    const agent = await Agent.findOne({ where: { id: assignedAgentId, agencyId } });
    if (!agent) {
      throw Object.assign(new Error('Assigned agent not found'), { statusCode: 404, code: 'AGENT_NOT_FOUND' });
    }
  }

  if (packageId) {
    const pkg = await Package.findOne({ where: { id: packageId, agencyId } });
    if (!pkg) {
      throw Object.assign(new Error('Package not found'), { statusCode: 404, code: 'PACKAGE_NOT_FOUND' });
    }
  }

  const lead = await Lead.create({
    customerId: customer.id,
    agencyId,
    assignedAgentId: assignedAgentId || null,
    destination,
    travelDates,
    travellers,
    budgetPerPerson,
    interest,
    packageId: packageId || null,
    notes,
    lostReason,
    travelStart,
    travelEnd,
    status,
  });

  const fullLead = await getLeadById(lead.id, agencyId);

  if (lead.status === 'CONVERTED') {
    if (customer && !customer.isCustomer) {
      await customer.update({ isCustomer: true });
    }
  }

  if (assignedAgentId) {
    const agent = fullLead.assignedAgent;
    if (agent && agent.phone) {
      const pkgName = fullLead.package ? fullLead.package.name : 'None';
      const msg = `*New Lead Assigned*\n\nCustomer: ${fullLead.customer?.name || 'Unknown'}\nPhone: ${fullLead.customer?.phone || 'Unknown'}\nDestination: ${fullLead.destination || 'Not specified'}\nPackage: ${pkgName}\nEnquiry Date: ${fullLead.createdAt ? new Date(fullLead.createdAt).toDateString() : new Date().toDateString()}`;
      whatsappService.sendSystemNotificationWhatsApp(agent.phone, msg, { agencyId }).catch(err => {
        console.error('Failed to send agent notification', err);
      });
    }
  }

  return fullLead;
}

/**
 * Updates a lead's fields.
 * @param {string} leadId - Lead ID
 * @param {string} agencyId - Agency ID
 * @param {object} updates - Allowed fields to update
 * @returns {Promise<object>} Updated lead
 */
async function updateLead(leadId, agencyId, updates, requester = null) {
  const lead = await Lead.findOne({ where: scopedLeadWhere(agencyId, requester, { id: leadId }) });
  if (!lead) {
    throw Object.assign(new Error('Lead not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const allowedFields = [
    'status', 'assignedAgentId', 'destination', 'travelDates',
    'travellers', 'budgetPerPerson', 'packageId', 'notes', 'lostReason',
    'travelStart', 'travelEnd', 'interest', 'source',
  ];

  const filtered = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  // Handle Customer updates
  const customerUpdates = {};
  if (updates.customerName !== undefined) customerUpdates.name = updates.customerName;
  if (updates.customerPhone !== undefined) customerUpdates.phone = updates.customerPhone;
  if (updates.customerEmail !== undefined) customerUpdates.email = updates.customerEmail;

  if (Object.keys(customerUpdates).length > 0) {
    const customer = await Customer.findByPk(lead.customerId);
    if (customer) {
      await customer.update(customerUpdates);
    }
  }

  const isNewAgentAssigned = updates.assignedAgentId && lead.assignedAgentId !== updates.assignedAgentId;
  await lead.update(filtered);

  if (filtered.status === 'CONVERTED') {
    const customer = await Customer.findByPk(lead.customerId);
    if (customer && !customer.isCustomer) {
      await customer.update({ isCustomer: true });
    }
  }

  if (isNewAgentAssigned) {
    const fullLead = await getLeadById(lead.id, agencyId, { role: 'ADMIN' });
    const agent = fullLead.assignedAgent;
    if (agent && agent.phone) {
      const pkgName = fullLead.package ? fullLead.package.name : 'None';
      const msg = `*New Lead Assigned*\n\nCustomer: ${fullLead.customer?.name || 'Unknown'}\nPhone: ${fullLead.customer?.phone || 'Unknown'}\nDestination: ${fullLead.destination || 'Not specified'}\nPackage: ${pkgName}\nEnquiry Date: ${fullLead.createdAt ? new Date(fullLead.createdAt).toDateString() : new Date().toDateString()}`;
      whatsappService.sendSystemNotificationWhatsApp(agent.phone, msg, { agencyId }).catch(err => {
        console.error('Failed to send agent notification', err);
      });
    }
  }

  return lead;
}

/**
 * Soft-deletes a lead by setting status to CANCELLED.
 * @param {string} leadId - Lead ID
 * @param {string} agencyId - Agency ID
 */
async function deleteLead(leadId, agencyId, requester = null) {
  const lead = await Lead.findOne({ where: scopedLeadWhere(agencyId, requester, { id: leadId }) });
  if (!lead) {
    throw Object.assign(new Error('Lead not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  await lead.update({ status: 'CANCELLED' });
  return lead;
}

/**
 * Finds the least-busy online agent for an agency.
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object|null>} Agent or null
 */
async function findLeastBusyAgent(agencyId) {
  const agents = await Agent.findAll({
    where: { agencyId, isOnline: true },
    attributes: ['id', 'name', 'email', 'phone'],
  });

  if (agents.length === 0) return null;

  // Count active leads per agent
  const agentLoads = await Promise.all(
    agents.map(async (agent) => {
      const count = await Lead.count({
        where: {
          assignedAgentId: agent.id,
          status: { [Op.in]: ['JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] },
        },
      });
      return { agent, count };
    })
  );

  // Sort by load ascending, return least busy
  agentLoads.sort((a, b) => a.count - b.count);
  return agentLoads[0].agent;
}

/**
 * Follow Ups
 */
async function addFollowUp(leadId, agencyId, data, requester = null) {
  const { scheduledAt, note, agentId } = data;
  const lead = await Lead.findOne({ where: scopedLeadWhere(agencyId, requester, { id: leadId }) });
  if (!lead) throw Object.assign(new Error('Lead not found'), { statusCode: 404 });

  const followUp = await FollowUp.create({
    leadId,
    agencyId,
    agentId: isAdmin(requester) ? (agentId || lead.assignedAgentId || null) : requester?.id,
    scheduledAt,
    note,
    status: 'Scheduled',
  });

  return followUp;
}

async function listFollowUps(agencyId, filters = {}, requester = null) {
  const {
    status,
    agentId,
    search,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 50,
  } = filters;

  const where = { agencyId };
  const leadWhere = { agencyId };

  if (status && status !== 'All') where.status = status;
  if (isAdmin(requester) && agentId) where.agentId = agentId;
  if (!isAdmin(requester)) where.agentId = requester?.id;

  if (dateFrom || dateTo) {
    where.scheduledAt = {};
    if (dateFrom) where.scheduledAt[Op.gte] = new Date(dateFrom);
    if (dateTo) where.scheduledAt[Op.lte] = new Date(dateTo);
  }

  if (search) {
    const matchedLeads = await Lead.findAll({
      attributes: ['id'],
      where: {
        agencyId,
        [Op.or]: [
          { destination: { [Op.iLike]: `%${search}%` } },
          { '$customer.name$': { [Op.iLike]: `%${search}%` } },
          { '$customer.phone$': { [Op.iLike]: `%${search}%` } },
          { '$customer.email$': { [Op.iLike]: `%${search}%` } },
        ],
      },
      include: [{ model: Customer, as: 'customer', attributes: [], required: false }],
      raw: true,
    });
    where.leadId = { [Op.in]: matchedLeads.map((lead) => lead.id) };
  }

  const limit = Math.min(parseInt(pageSize, 10) || 50, 200);
  const currentPage = parseInt(page, 10) || 1;
  const offset = (currentPage - 1) * limit;

  const { count, rows } = await FollowUp.findAndCountAll({
    where,
    include: [
      {
        model: Lead,
        as: 'lead',
        required: true,
        where: leadWhere,
        include: [
          { model: Customer, as: 'customer' },
          { model: Package, as: 'package', attributes: ['id', 'name', 'basePrice'] },
          { model: Agent, as: 'assignedAgent', attributes: ['id', 'name', 'email'] },
        ],
      },
      { model: Agent, as: 'agent', attributes: ['id', 'name', 'email', 'phone'] },
    ],
    order: [['scheduledAt', 'ASC']],
    limit,
    offset,
  });

  return { data: rows, total: count, page: currentPage, pageSize: limit };
}

async function updateFollowUp(leadId, followUpId, agencyId, updates, requester = null) {
  const where = { id: followUpId, leadId, agencyId };
  if (!isAdmin(requester)) where.agentId = requester?.id;
  const followUp = await FollowUp.findOne({ where });
  if (!followUp) throw Object.assign(new Error('FollowUp not found'), { statusCode: 404 });

  const allowed = ['status', 'scheduledAt', 'note', 'agentId'];
  const filtered = {};
  for(const k of allowed) if (updates[k] !== undefined) filtered[k] = updates[k];
  if (!isAdmin(requester)) delete filtered.agentId;

  await followUp.update(filtered);
  return followUp;
}

async function deleteFollowUp(leadId, followUpId, agencyId, requester = null) {
  const where = { id: followUpId, leadId, agencyId };
  if (!isAdmin(requester)) where.agentId = requester?.id;
  const followUp = await FollowUp.findOne({ where });
  if (!followUp) throw Object.assign(new Error('FollowUp not found'), { statusCode: 404 });
  await followUp.destroy();
  return { success: true };
}

/**
 * Lead Notes
 */
async function addNote(leadId, agencyId, agentId, content) {
  const lead = await Lead.findOne({ where: { id: leadId, agencyId } });
  if (!lead) throw Object.assign(new Error('Lead not found'), { statusCode: 404 });

  const note = await LeadNote.create({
    leadId,
    agentId,
    content,
  });

  return LeadNote.findByPk(note.id, {
    include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }]
  });
}

module.exports = {
  listLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  findLeastBusyAgent,
  listFollowUps,
  addFollowUp,
  updateFollowUp,
  deleteFollowUp,
  addNote,
};
