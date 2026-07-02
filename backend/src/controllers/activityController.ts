const { Op } = require('sequelize');
const { ActivityLog, Agent } = require('../models');

const MAX_LIMIT = 100;

/**
 * List activity log entries for the current agency.
 *
 * Scope rules:
 *   - ADMIN agents see all activity within their agency.
 *   - non-ADMIN agents see only their own actions.
 *
 * Filters (query): actorId, module, action, from (ISO date), to (ISO date),
 * search (matches summary), page, limit.
 */
async function list(req, res, next) {
  try {
    const agencyId = req.agency.id;
    const isAdmin = req.agent.role === 'ADMIN';

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const where = { agencyId };

    // Non-admins are locked to their own actions regardless of query params.
    if (!isAdmin) {
      where.actorId = req.agent.id;
    } else if (req.query.actorId) {
      where.actorId = req.query.actorId;
    }

    if (req.query.module) where.module = req.query.module;
    if (req.query.action) where.action = req.query.action;

    if (req.query.search) {
      where.summary = { [Op.iLike]: `%${String(req.query.search).trim()}%` };
    }

    const createdAt = {};
    if (req.query.from) {
      const from = new Date(req.query.from);
      if (!Number.isNaN(from.getTime())) createdAt[Op.gte] = from;
    }
    if (req.query.to) {
      const to = new Date(req.query.to);
      if (!Number.isNaN(to.getTime())) createdAt[Op.lte] = to;
    }
    if (Object.getOwnPropertySymbols(createdAt).length > 0) {
      where.createdAt = createdAt;
    }

    const { rows, count } = await ActivityLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Filter dropdown options: distinct modules seen for this agency, plus the
 * list of agents (admins only — agents can only see themselves).
 */
async function filters(req, res, next) {
  try {
    const agencyId = req.agency.id;
    const isAdmin = req.agent.role === 'ADMIN';

    const moduleRows = await ActivityLog.findAll({
      attributes: ['module'],
      where: { agencyId },
      group: ['module'],
      order: [['module', 'ASC']],
      raw: true,
    });
    const modules = moduleRows.map((r) => r.module).filter(Boolean);

    let actors = [];
    if (isAdmin) {
      actors = await Agent.findAll({
        attributes: ['id', 'name'],
        where: { agencyId },
        order: [['name', 'ASC']],
        raw: true,
      });
    }

    res.json({ success: true, data: { modules, actors, canFilterByActor: isAdmin } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  filters,
};
