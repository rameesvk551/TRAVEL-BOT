const leadService = require('../services/leadService');
const leadReportService = require('../services/leadReportService');
const { logActivity } = require('../services/activityService');

async function list(req, res, next) {
  try {
    const result = await leadService.listLeads(req.agency.id, req.query, req.agent);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const lead = await leadService.getLeadById(req.params.id, req.agency.id, req.agent);
    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const lead = await leadService.createLead(req.body, req.agency.id);
    await logActivity(req, {
      action: 'lead.created',
      module: 'leads',
      targetType: 'Lead',
      targetId: lead?.id,
      summary: `Created lead "${lead?.name || lead?.customerName || 'Untitled'}"`,
    });
    res.status(201).json({ success: true, data: lead, message: 'Lead created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const lead = await leadService.updateLead(req.params.id, req.agency.id, req.body, req.agent);
    const changedFields = Object.keys(req.body || {});
    const statusChanged = changedFields.includes('status') || changedFields.includes('pipelineStageId');
    await logActivity(req, {
      action: statusChanged ? 'lead.status_changed' : 'lead.updated',
      module: 'leads',
      targetType: 'Lead',
      targetId: lead?.id || req.params.id,
      summary: statusChanged
        ? `Changed status of lead "${lead?.name || 'lead'}" to ${lead?.status ?? 'updated'}`
        : `Updated lead "${lead?.name || 'lead'}" (${changedFields.join(', ') || 'no fields'})`,
      metadata: { changedFields },
    });
    res.json({ success: true, data: lead, message: 'Lead updated' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await leadService.deleteLead(req.params.id, req.agency.id, req.agent);
    await logActivity(req, {
      action: 'lead.deleted',
      module: 'leads',
      targetType: 'Lead',
      targetId: req.params.id,
      summary: 'Cancelled/deleted a lead',
    });
    res.json({ success: true, message: 'Lead cancelled' });
  } catch (err) {
    next(err);
  }
}

async function listFollowUps(req, res, next) {
  try {
    const result = await leadService.listFollowUps(req.agency.id, req.query, req.agent);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function addFollowUp(req, res, next) {
  try {
    const followUp = await leadService.addFollowUp(req.params.id, req.agency.id, req.body, req.agent);
    res.status(201).json({ success: true, data: followUp, message: 'Follow-up scheduled' });
  } catch (err) {
    next(err);
  }
}

async function updateFollowUp(req, res, next) {
  try {
    const followUp = await leadService.updateFollowUp(req.params.id, req.params.followUpId, req.agency.id, req.body, req.agent);
    res.json({ success: true, data: followUp });
  } catch (err) {
    next(err);
  }
}

async function deleteFollowUp(req, res, next) {
  try {
    await leadService.deleteFollowUp(req.params.id, req.params.followUpId, req.agency.id, req.agent);
    res.json({ success: true, message: 'Follow-up deleted' });
  } catch (err) {
    next(err);
  }
}

async function addNote(req, res, next) {
  try {
    const note = await leadService.addNote(req.params.id, req.agency.id, req.user?.id || req.agent?.id || req.agency?.id, req.body.content);
    res.status(201).json({ success: true, data: note, message: 'Note added' });
  } catch (err) {
    next(err);
  }
}

async function bulkAssign(req, res, next) {
  try {
    const { leadIds, agentId } = req.body;
    const result = await leadService.bulkAssignLeads(leadIds, agentId || null, req.agency.id, req.agent);
    await logActivity(req, {
      action: 'lead.assigned',
      module: 'leads',
      targetType: 'Lead',
      summary: `Assigned ${result.updated} lead(s)${agentId ? '' : ' (unassigned)'}`,
      metadata: { leadIds, agentId: agentId || null, updated: result.updated },
    });
    res.json({ success: true, data: result, message: `${result.updated} leads assigned` });
  } catch (err) {
    next(err);
  }
}

async function exportPdf(req, res, next) {
  try {
    const leads = await leadReportService.fetchAllLeadsForReport(req.agency.id, req.query, req.agent);
    const agencyName = req.agency.name || 'Agency';
    const pdfBuffer = await leadReportService.generatePdfReport(leads, agencyName, req.query);
    const filename = `lead-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const leads = await leadReportService.fetchAllLeadsForReport(req.agency.id, req.query, req.agent);
    const agencyName = req.agency.name || 'Agency';
    const excelBuffer = await leadReportService.generateExcelReport(leads, agencyName, req.query);
    const filename = `lead-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    res.send(Buffer.from(excelBuffer));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  bulkAssign,
  listFollowUps,
  addFollowUp,
  updateFollowUp,
  deleteFollowUp,
  addNote,
  exportPdf,
  exportExcel,
};
