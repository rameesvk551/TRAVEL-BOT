// FILE: /backend/src/services/pipelineService.ts
// DEPS: sequelize
//
// Agency-configurable CRM sales pipeline. Stages are seeded once from the
// built-in Lead.status taxonomy, after which the agency owns them fully
// (rename, recolor, reorder, add, remove, remap statuses).

const { PipelineStage, sequelize } = require('../models');

// Sensible defaults derived from the Lead.status enum. Seeded the first time an
// agency opens the CRM so the funnel is never empty.
const DEFAULT_STAGES = [
  { name: 'New', kind: 'OPEN', color: '#0ea5e9', leadStatuses: ['JUST_CONTACTED', 'NEW', 'ENQUIRY', 'UNKNOWN'] },
  { name: 'Package Searched', kind: 'OPEN', color: '#f59e0b', leadStatuses: ['PACKAGE_SEARCHED'] },
  { name: 'Package Interested', kind: 'OPEN', color: '#6366f1', leadStatuses: ['PACKAGE_INTERESTED'] },
  { name: 'Contacted', kind: 'OPEN', color: '#8b5cf6', leadStatuses: ['CONTACTED', 'QUOTED', 'NEGOTIATING'] },
  { name: 'Converted', kind: 'WON', color: '#10b981', leadStatuses: ['CONVERTED', 'BOOKED'] },
  { name: 'Lost', kind: 'LOST', color: '#f43f5e', leadStatuses: ['LOST', 'CANCELLED'] },
];

function serialize(stage) {
  return {
    id: stage.id,
    name: stage.name,
    position: stage.position,
    color: stage.color,
    leadStatuses: stage.leadStatuses || [],
    kind: stage.kind,
    isActive: stage.isActive,
  };
}

/**
 * Seed the default funnel for an agency that has none yet. Idempotent and
 * race-safe: counts inside a transaction with a row lock on the agency's rows.
 */
async function ensureDefaultStages(agencyId) {
  const existing = await PipelineStage.count({ where: { agencyId } });
  if (existing > 0) return;

  await sequelize.transaction(async (transaction) => {
    const stillEmpty = await PipelineStage.count({ where: { agencyId }, transaction });
    if (stillEmpty > 0) return;

    await PipelineStage.bulkCreate(
      DEFAULT_STAGES.map((s, i) => ({ ...s, agencyId, position: i })),
      { transaction }
    );
  });
}

/**
 * The canonical Lead.status kept in sync with a chosen stage, so legacy signals
 * (isCustomer on Won, lost-reason on Lost, score bumps) keep working. Entry-stage
 * statuses collapse to null — a lead in the first "New" column carries no status.
 */
function primaryStatusForStage(stage) {
  if (!stage) return null;
  if (stage.kind === 'WON') return 'CONVERTED';
  if (stage.kind === 'LOST') return 'LOST';
  const first = (stage.leadStatuses || []).find(Boolean);
  const normalized = (first === 'JUST_CONTACTED' || first === '') ? null : first;
  return normalized || 'NEW';
}

async function getStageById(agencyId, id) {
  if (!id) return null;
  return PipelineStage.findOne({ where: { id, agencyId } });
}

/**
 * Map a Lead.status to the agency stage that owns it.
 * Returns:
 *   undefined - the agency has no funnel yet → leave pipelineStageId untouched.
 *   null      - the lead has no status → no stage (status stays optional).
 *   <id>      - the matching stage (or first OPEN stage for an unmapped status).
 */
async function resolveStageIdForStatus(agencyId, status) {
  const normalized = (status === 'JUST_CONTACTED' || status === '') ? null : status;
  const stages = await PipelineStage.findAll({
    where: { agencyId },
    order: [['position', 'ASC'], ['createdAt', 'ASC']],
  });
  if (stages.length === 0) return undefined;
  if (normalized == null) return null;
  const match = stages.find((s) => (s.leadStatuses || []).includes(normalized));
  if (match) return match.id;
  const firstOpen = stages.find((s) => s.kind === 'OPEN');
  return firstOpen ? firstOpen.id : null;
}

async function listStages(agencyId) {
  await ensureDefaultStages(agencyId);
  const stages = await PipelineStage.findAll({
    where: { agencyId },
    order: [['position', 'ASC'], ['createdAt', 'ASC']],
  });
  return stages.map(serialize);
}

async function createStage(agencyId, data) {
  const max = await PipelineStage.max('position', { where: { agencyId } });
  const stage = await PipelineStage.create({
    agencyId,
    name: String(data.name || 'New stage').slice(0, 80),
    color: data.color || '#5b7c99',
    kind: ['OPEN', 'WON', 'LOST'].includes(data.kind) ? data.kind : 'OPEN',
    leadStatuses: Array.isArray(data.leadStatuses) ? data.leadStatuses : [],
    isActive: data.isActive !== false,
    position: Number.isFinite(max) ? max + 1 : 0,
  });
  return serialize(stage);
}

async function updateStage(agencyId, id, data) {
  const stage = await PipelineStage.findOne({ where: { id, agencyId } });
  if (!stage) return null;

  const patch = {};
  if (data.name !== undefined) patch.name = String(data.name).slice(0, 80);
  if (data.color !== undefined) patch.color = data.color;
  if (data.kind !== undefined && ['OPEN', 'WON', 'LOST'].includes(data.kind)) patch.kind = data.kind;
  if (data.leadStatuses !== undefined && Array.isArray(data.leadStatuses)) patch.leadStatuses = data.leadStatuses;
  if (data.isActive !== undefined) patch.isActive = Boolean(data.isActive);
  if (data.position !== undefined && Number.isFinite(Number(data.position))) patch.position = Number(data.position);

  await stage.update(patch);
  return serialize(stage);
}

async function deleteStage(agencyId, id) {
  const deleted = await PipelineStage.destroy({ where: { id, agencyId } });
  return deleted > 0;
}

/**
 * Persist a new ordering. `orderedIds` is the full list of stage ids in the
 * desired top-to-bottom order; positions are rewritten to match.
 */
async function reorderStages(agencyId, orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return listStages(agencyId);

  await sequelize.transaction(async (transaction) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await PipelineStage.update(
        { position: i },
        { where: { id: orderedIds[i], agencyId }, transaction }
      );
    }
  });

  return listStages(agencyId);
}

module.exports = {
  DEFAULT_STAGES,
  ensureDefaultStages,
  listStages,
  createStage,
  updateStage,
  deleteStage,
  reorderStages,
  getStageById,
  primaryStatusForStage,
  resolveStageIdForStatus,
};
