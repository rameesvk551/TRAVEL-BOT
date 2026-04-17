// FILE: /backend/src/services/dripService.ts

const { Op } = require('sequelize');
const { DripSequence, DripStep, DripEnrollment, Customer, Lead } = require('../models');

/**
 * Create a drip sequence with steps.
 */
async function createSequence(agencyId, data) {
  const { steps, ...seqData } = data;
  const sequence = await DripSequence.create({ ...seqData, agencyId });

  if (steps && steps.length > 0) {
    const stepData = steps.map((step, index) => ({
      ...step,
      sequenceId: sequence.id,
      order: index + 1,
    }));
    await DripStep.bulkCreate(stepData);
  }

  return DripSequence.findByPk(sequence.id, {
    include: [{ model: DripStep, as: 'steps', order: [['order', 'ASC']] }],
  });
}

/**
 * Update a sequence and its steps.
 */
async function updateSequence(id, agencyId, data) {
  const sequence = await DripSequence.findOne({ where: { id, agencyId } });
  if (!sequence) throw new Error('Sequence not found');

  const { steps, ...seqData } = data;
  await sequence.update(seqData);

  if (steps) {
    await DripStep.destroy({ where: { sequenceId: id } });
    const stepData = steps.map((step, index) => ({
      ...step,
      sequenceId: id,
      order: index + 1,
    }));
    await DripStep.bulkCreate(stepData);
  }

  return DripSequence.findByPk(id, {
    include: [{ model: DripStep, as: 'steps', order: [['order', 'ASC']] }],
  });
}

/**
 * List sequences for an agency.
 */
async function listSequences(agencyId) {
  return DripSequence.findAll({
    where: { agencyId },
    include: [{ model: DripStep, as: 'steps', attributes: ['id', 'order', 'delayHours', 'messageType'] }],
    order: [['createdAt', 'DESC']],
  });
}

/**
 * Get sequence detail.
 */
async function getSequence(id, agencyId) {
  return DripSequence.findOne({
    where: { id, agencyId },
    include: [
      { model: DripStep, as: 'steps', order: [['order', 'ASC']] },
      {
        model: DripEnrollment,
        as: 'enrollments',
        include: [{ model: Customer, as: 'customer', attributes: ['name', 'phone'] }],
        limit: 50,
        order: [['createdAt', 'DESC']],
      },
    ],
  });
}

/**
 * Toggle sequence active status.
 */
async function toggleSequence(id, agencyId) {
  const sequence = await DripSequence.findOne({ where: { id, agencyId } });
  if (!sequence) throw new Error('Sequence not found');
  return sequence.update({ isActive: !sequence.isActive });
}

/**
 * Enroll a customer in a drip sequence.
 */
async function enrollCustomer(sequenceId, customerId, leadId, agencyId) {
  const sequence = await DripSequence.findOne({
    where: { id: sequenceId, agencyId, isActive: true },
    include: [{ model: DripStep, as: 'steps', where: { order: 1 }, required: false }],
  });
  if (!sequence) throw new Error('Sequence not found or inactive');

  const existing = await DripEnrollment.findOne({
    where: { sequenceId, customerId },
  });
  if (existing) return existing;

  const firstStep = sequence.steps?.[0];
  const delayMs = firstStep ? firstStep.delayHours * 60 * 60 * 1000 : 0;

  const enrollment = await DripEnrollment.create({
    sequenceId,
    customerId,
    leadId,
    agencyId,
    currentStepOrder: 1,
    status: 'ACTIVE',
    nextRunAt: new Date(Date.now() + delayMs),
  });

  await sequence.increment('enrollmentCount');
  return enrollment;
}

/**
 * Auto-enroll based on trigger event.
 */
async function autoEnroll(trigger, customerId, leadId, agencyId, destination) {
  const where = { agencyId, isActive: true, trigger };
  const sequences = await DripSequence.findAll({ where });

  for (const seq of sequences) {
    if (seq.destinationFilter && destination) {
      const filters = Array.isArray(seq.destinationFilter) ? seq.destinationFilter : [seq.destinationFilter];
      const match = filters.some((f) => destination.toLowerCase().includes(f.toLowerCase()));
      if (!match) continue;
    }
    await enrollCustomer(seq.id, customerId, leadId, agencyId).catch(() => {});
  }
}

/**
 * Pause/cancel an enrollment.
 */
async function updateEnrollment(enrollmentId, agencyId, status) {
  const enrollment = await DripEnrollment.findOne({ where: { id: enrollmentId, agencyId } });
  if (!enrollment) throw new Error('Enrollment not found');
  return enrollment.update({
    status,
    completedAt: ['COMPLETED', 'CANCELLED'].includes(status) ? new Date() : null,
  });
}

/**
 * Get due enrollments for processing.
 */
async function getDueEnrollments() {
  return DripEnrollment.findAll({
    where: {
      status: 'ACTIVE',
      nextRunAt: { [Op.lte]: new Date() },
    },
    include: [
      { model: DripSequence, as: 'sequence', include: [{ model: DripStep, as: 'steps' }] },
      { model: Customer, as: 'customer' },
      { model: Lead, as: 'lead' },
    ],
    limit: 50,
  });
}

module.exports = {
  createSequence,
  updateSequence,
  listSequences,
  getSequence,
  toggleSequence,
  enrollCustomer,
  autoEnroll,
  updateEnrollment,
  getDueEnrollments,
};
