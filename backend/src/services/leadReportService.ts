// FILE: /backend/src/services/leadReportService.ts
// Professional Lead Report Export — PDF & Excel

const { Op } = require('sequelize');
const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const {
  Lead, Customer, Agent, Package, Property, Service, Visa, Cruise,
  Campaign, FollowUp, LeadNote, CallLog, Booking, Payment,
} = require('../models');

// ─── Formatting Helpers ──────────────────────────────────────────────

function formatCurrencyReport(paise) {
  const amount = Number(paise || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return `₹${Math.round(amount / 100).toLocaleString('en-IN')}`;
}

// Report is generated server-side (UTC clock); render in IST so timestamps
// match the in-app UI, which formats in the user's local (India) timezone.
const REPORT_TIME_ZONE = 'Asia/Kolkata';

function formatDateReport(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: REPORT_TIME_ZONE });
}

function formatDateTimeReport(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: REPORT_TIME_ZONE });
}

function formatStatusLabel(status) {
  return String(status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown';
}

function formatSourceLabel(source) {
  return String(source || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusColor(status) {
  const map = {
    CONVERTED: '#16a34a', BOOKED: '#2563eb', QUOTED: '#7c3aed', NEGOTIATING: '#d97706',
    CONTACTED: '#0891b2', ENQUIRY: '#6366f1', NEW: '#3b82f6', JUST_CONTACTED: '#06b6d4',
    PACKAGE_SEARCHED: '#8b5cf6', PACKAGE_INTERESTED: '#a855f7',
    LOST: '#dc2626', CANCELLED: '#6b7280', UNKNOWN: '#9ca3af',
  };
  return map[status] || '#6b7280';
}

function followUpStatusColor(status) {
  if (status === 'Done') return '#16a34a';
  if (status === 'Cancelled') return '#dc2626';
  return '#d97706';
}

// ─── Evaluation Helpers ──────────────────────────────────────────────

// Pipeline order for grouping leads by status in the report.
const STATUS_ORDER = [
  'NEW', 'JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'ENQUIRY',
  'CONTACTED', 'QUOTED', 'NEGOTIATING', 'BOOKED', 'CONVERTED',
  'LOST', 'CANCELLED', 'UNKNOWN',
];

function statusRank(status) {
  const idx = STATUS_ORDER.indexOf(status || 'UNKNOWN');
  return idx === -1 ? STATUS_ORDER.length : idx;
}

// Group leads into ordered [status, leads[]] sections; empty statuses skipped.
function groupLeadsByStatus(leads) {
  const groups = {};
  leads.forEach((l) => {
    const s = l.status || 'JUST_CONTACTED';
    (groups[s] = groups[s] || []).push(l);
  });
  return Object.entries(groups).sort((a, b) => statusRank(a[0]) - statusRank(b[0]));
}

// A follow-up is completed once it is Done or Cancelled. updatedAt is the time it
// moved to that state (same approximation the rest of the app uses).
function isCompletedFollowUp(fu) {
  return fu.status === 'Done' || fu.status === 'Cancelled';
}

function completionTime(fu) {
  return isCompletedFollowUp(fu) ? fu.updatedAt : null;
}

// Human-readable gap between two dates, e.g. "2 days", "5 hours", "20 min".
function describeGap(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

// Timeliness of a COMPLETED follow-up: { label, color } comparing done-time to schedule.
// Cancelled follow-ups are reported as "Cancelled" rather than on-time/late.
function followUpTimeliness(fu) {
  if (fu.status === 'Cancelled') return { label: 'Cancelled', color: '#6b7280' };
  const sched = fu.scheduledAt ? new Date(fu.scheduledAt).getTime() : null;
  const done = fu.updatedAt ? new Date(fu.updatedAt).getTime() : null;
  if (!sched || !done || isNaN(sched) || isNaN(done)) {
    return { label: 'Done', color: '#16a34a' };
  }
  // Allow a small 5-minute grace so trivial diffs still read as on-time.
  if (done <= sched + 5 * 60000) return { label: 'On-time', color: '#16a34a' };
  return { label: `Late (${describeGap(done - sched)})`, color: '#dc2626' };
}

// A SCHEDULED follow-up is overdue when its scheduled time has already passed.
function isOverdueFollowUp(fu, now) {
  if (fu.status !== 'Scheduled' || !fu.scheduledAt) return false;
  const sched = new Date(fu.scheduledAt).getTime();
  return !isNaN(sched) && sched < now;
}

// ─── Data Fetching ───────────────────────────────────────────────────

function isAdmin(requester) {
  return requester?.role === 'ADMIN';
}

function scopedWhere(agencyId, requester, extra = {}) {
  const where = { agencyId, ...extra };
  if (requester?.id && !isAdmin(requester)) {
    where.assignedAgentId = requester.id;
  }
  return where;
}

async function fetchAllLeadsForReport(agencyId, filters = {}, requester = null) {
  const {
    status, agentId, search, source, tag, dateFrom, dateTo,
    sortBy = 'newest', channelId,
  } = filters;

  const where = scopedWhere(agencyId, requester);
  const andConditions = [];

  if (status) {
    // 'JUST_CONTACTED' is an alias for the empty (null) entry status.
    if (status === 'JUST_CONTACTED') where.status = { [Op.is]: null };
    else where.status = Array.isArray(status) ? { [Op.in]: status } : status;
  }

  if (agentId === 'mine' && requester?.id) where.assignedAgentId = requester.id;
  else if (agentId === 'unassigned') where.assignedAgentId = null;
  else if (agentId && isAdmin(requester)) where.assignedAgentId = agentId;

  if (source) {
    if (String(source).includes(',')) {
      where.source = { [Op.in]: String(source).split(',').map((s) => s.trim()).filter(Boolean) };
    } else {
      where.source = { [Op.iLike]: `%${source}%` };
    }
  }

  if (tag) where.tags = { [Op.contains]: [String(tag)] };

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
    if (dateTo) where.createdAt[Op.lte] = new Date(dateTo);
  }

  if (search) {
    const searchText = String(search).trim();
    if (searchText) {
      const [matchingCustomers, matchingAgents] = await Promise.all([
        Customer.findAll({
          attributes: ['id'],
          where: {
            agencyId,
            [Op.or]: [
              { name: { [Op.iLike]: `%${searchText}%` } },
              { phone: { [Op.iLike]: `%${searchText}%` } },
              { email: { [Op.iLike]: `%${searchText}%` } },
            ],
          },
          raw: true,
        }),
        Agent.findAll({
          attributes: ['id'],
          where: { agencyId, name: { [Op.iLike]: `%${searchText}%` } },
          raw: true,
        }),
      ]);
      const customerIds = matchingCustomers.map((c) => c.id).filter(Boolean);
      const agentIds = matchingAgents.map((a) => a.id).filter(Boolean);
      andConditions.push({
        [Op.or]: [
          { destination: { [Op.iLike]: `%${searchText}%` } },
          { source: { [Op.iLike]: `%${searchText}%` } },
          ...(customerIds.length ? [{ customerId: { [Op.in]: customerIds } }] : []),
          ...(agentIds.length ? [{ assignedAgentId: { [Op.in]: agentIds } }] : []),
        ],
      });
    }
  }

  if (andConditions.length > 0) where[Op.and] = andConditions;

  const customerWhere = {};
  if (channelId) customerWhere.channelId = channelId;

  const order = (() => {
    if (sortBy === 'oldest') return [['createdAt', 'ASC']];
    if (sortBy === 'highestBudget') return [['budgetPerPerson', 'DESC'], ['createdAt', 'DESC']];
    if (sortBy === 'hot') return [['leadScore', 'DESC'], ['createdAt', 'DESC']];
    return [['createdAt', 'DESC']];
  })();

  // Fetch all leads (max 5000)
  const leads = await Lead.findAll({
    where,
    include: [
      { model: Customer, as: 'customer', where: Object.keys(customerWhere).length ? customerWhere : undefined },
      { model: Agent, as: 'assignedAgent', attributes: ['id', 'name', 'email', 'phone'] },
      { model: Package, as: 'package', attributes: ['id', 'name', 'basePrice'] },
      { model: Property, as: 'property', attributes: ['id', 'name'] },
      { model: Service, as: 'service', attributes: ['id', 'name'] },
      { model: Visa, as: 'visa', attributes: ['id', 'country', 'visaType'] },
      { model: Cruise, as: 'cruise', attributes: ['id', 'name'] },
    ],
    order,
    limit: 5000,
  });

  // Fetch all notes, follow-ups, call logs in bulk for performance
  const leadIds = leads.map((l) => l.id);
  if (leadIds.length === 0) return [];

  const [allNotes, allFollowUps, allCallLogs] = await Promise.all([
    LeadNote.findAll({
      where: { leadId: { [Op.in]: leadIds } },
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    }),
    FollowUp.findAll({
      where: { leadId: { [Op.in]: leadIds }, agencyId },
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }],
      order: [['scheduledAt', 'ASC']],
    }),
    CallLog.findAll({
      where: { leadId: { [Op.in]: leadIds }, agencyId },
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }],
      order: [['startedAt', 'DESC']],
      limit: 5000,
    }),
  ]);

  // Group by leadId
  const notesByLead = {};
  const followUpsByLead = {};
  const callLogsByLead = {};
  allNotes.forEach((n) => {
    const j = n.toJSON ? n.toJSON() : n;
    (notesByLead[j.leadId] = notesByLead[j.leadId] || []).push(j);
  });
  allFollowUps.forEach((f) => {
    const j = f.toJSON ? f.toJSON() : f;
    (followUpsByLead[j.leadId] = followUpsByLead[j.leadId] || []).push(j);
  });
  allCallLogs.forEach((c) => {
    const j = c.toJSON ? c.toJSON() : c;
    (callLogsByLead[j.leadId] = callLogsByLead[j.leadId] || []).push(j);
  });

  return leads.map((lead) => {
    const l = lead.toJSON ? lead.toJSON() : lead;
    return {
      ...l,
      notesList: notesByLead[l.id] || [],
      followUps: followUpsByLead[l.id] || [],
      callLogs: callLogsByLead[l.id] || [],
    };
  });
}

// ─── PDF Generation ──────────────────────────────────────────────────

function buildSummaryStats(leads) {
  const statusCounts = {};
  const sourceCounts = {};
  leads.forEach((l) => {
    const s = l.status || 'JUST_CONTACTED';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
    const src = l.source || 'unknown';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  const converted = statusCounts['CONVERTED'] || 0;
  const lost = statusCounts['LOST'] || 0;
  const conversionRate = leads.length > 0 ? ((converted / leads.length) * 100).toFixed(1) : '0';
  return { statusCounts, sourceCounts, converted, lost, conversionRate, total: leads.length };
}

function isManualNote(content) {
  if (!content) return true;
  return !(
    content.startsWith('Lead status updated:') ||
    content.startsWith('Lead details updated:') ||
    content.startsWith('Assignment updated:') ||
    content.startsWith('Follow-up assigned') ||
    content.startsWith('Follow-up completed') ||
    content.startsWith('Follow-up cancelled')
  );
}

function buildReportHtml(leads, agencyName, filters) {
  const stats = buildSummaryStats(leads);
  const now = Date.now();
  const filterDesc = [];
  if (filters.status) filterDesc.push(`Status: ${formatStatusLabel(filters.status)}`);
  if (filters.source) filterDesc.push(`Source: ${formatSourceLabel(filters.source)}`);
  if (filters.dateFrom) filterDesc.push(`From: ${formatDateReport(filters.dateFrom)}`);
  if (filters.dateTo) filterDesc.push(`To: ${formatDateReport(filters.dateTo)}`);
  if (filters.search) filterDesc.push(`Search: ${filters.search}`);
  const filterText = filterDesc.length ? filterDesc.join(' • ') : 'All Leads';

  // Build one continuous numbering across all leads for reference.
  let leadCounter = 0;

  function renderLeadCard(lead) {
    leadCounter += 1;
    const idx = leadCounter;
    const name = escapeHtml(lead.customer?.name || 'Unnamed Lead');
    const phone = escapeHtml(lead.customer?.phone || '');
    const place = escapeHtml(lead.place || '');
    const destination = escapeHtml(lead.destination || '');
    const status = lead.status || 'JUST_CONTACTED';
    const source = escapeHtml(formatSourceLabel(lead.source));
    const createdAt = formatDateTimeReport(lead.createdAt);

    const identityItems = [
      phone ? `<div class="detail-item"><span class="detail-label">Phone</span><span class="detail-value">${phone}</span></div>` : '',
      place ? `<div class="detail-item"><span class="detail-label">Place</span><span class="detail-value">${place}</span></div>` : '',
      destination ? `<div class="detail-item"><span class="detail-label">Destination</span><span class="detail-value">${destination}</span></div>` : '',
      `<div class="detail-item"><span class="detail-label">Source</span><span class="detail-value">${source}</span></div>`,
      `<div class="detail-item"><span class="detail-label">First Contact</span><span class="detail-value">${createdAt}</span></div>`,
    ].filter(Boolean).join('');

    const allFollowUps = lead.followUps || [];
    const scheduled = allFollowUps.filter((f) => (f.status || 'Scheduled') === 'Scheduled');
    const completed = allFollowUps.filter((f) => isCompletedFollowUp(f));

    // Scheduled follow-ups — pending work, flag overdue.
    let scheduledHtml = '';
    if (scheduled.length > 0) {
      const rows = scheduled.map((f) => {
        const overdue = isOverdueFollowUp(f, now);
        return `
          <tr>
            <td class="nowrap">${formatDateTimeReport(f.scheduledAt)}${overdue ? ' <span class="pill pill-overdue">OVERDUE</span>' : ''}</td>
            <td>${escapeHtml(f.note || '')}</td>
          </tr>
        `;
      }).join('');
      scheduledHtml = `
        <div class="sub-section">
          <div class="sub-title">📅 Scheduled Follow-Ups (${scheduled.length})</div>
          <table class="detail-table">
            <thead><tr><th width="170">Scheduled For</th><th>Note</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }

    // Completed follow-ups — scheduled vs actual, with on-time/late marker.
    let completedHtml = '';
    if (completed.length > 0) {
      const rows = completed.map((f) => {
        const t = followUpTimeliness(f);
        return `
          <tr>
            <td class="nowrap">${formatDateTimeReport(f.scheduledAt)}</td>
            <td class="nowrap">${formatDateTimeReport(completionTime(f))}</td>
            <td class="nowrap"><span class="pill" style="background:${t.color}15;color:${t.color}">${t.label}</span></td>
            <td>${escapeHtml(f.note || '')}</td>
          </tr>
        `;
      }).join('');
      completedHtml = `
        <div class="sub-section">
          <div class="sub-title">✅ Completed Follow-Ups (${completed.length})</div>
          <table class="detail-table">
            <thead><tr><th width="150">Scheduled For</th><th width="150">Done On</th><th width="110">Timeliness</th><th>Note</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }

    // Manual notes only — auto bot/system messages excluded.
    let notesHtml = '';
    const manualNotes = (lead.notesList || []).filter((n) => isManualNote(n.content));
    if (manualNotes.length > 0) {
      const rows = manualNotes.map((n) => `
        <tr>
          <td class="note-date nowrap">${formatDateTimeReport(n.createdAt)}</td>
          <td class="note-content">${escapeHtml(n.content || '')}</td>
        </tr>
      `).join('');
      notesHtml = `
        <div class="sub-section">
          <div class="sub-title">📝 Notes (${manualNotes.length})</div>
          <table class="detail-table">
            <thead><tr><th width="170">Date</th><th>Content</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }

    const noActivity = !scheduledHtml && !completedHtml && !notesHtml
      ? '<div class="empty-note">No follow-ups or notes recorded.</div>'
      : '';

    return `
      <div class="lead-card">
        <div class="lead-header">
          <div class="lead-number">#${idx}</div>
          <div class="lead-name">${name}</div>
          <span class="status-badge" style="background:${statusColor(status)};color:#fff">${formatStatusLabel(status)}</span>
        </div>
        <div class="details-grid">${identityItems}</div>
        ${scheduledHtml}
        ${completedHtml}
        ${notesHtml}
        ${noActivity}
      </div>
    `;
  }

  // Group leads by status into pipeline-ordered sections.
  const sections = groupLeadsByStatus(leads).map(([status, groupLeads]) => {
    const color = statusColor(status);
    const cards = groupLeads.map(renderLeadCard).join('');
    return `
      <div class="status-group">
        <div class="status-group-header" style="border-left:5px solid ${color}">
          <span class="status-group-name" style="color:${color}">${formatStatusLabel(status)}</span>
          <span class="status-group-count">${groupLeads.length} lead${groupLeads.length === 1 ? '' : 's'}</span>
        </div>
        ${cards}
      </div>
    `;
  }).join('');

  const leadSections = leads.length
    ? sections
    : '<div class="empty-note" style="margin:40px;text-align:center">No leads match the selected filters.</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Lead Report — ${escapeHtml(agencyName)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.5; background: #fff; }

  .report-header {
    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
    color: #fff; padding: 32px 40px; page-break-inside: avoid;
  }
  .report-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px; }
  .report-header .agency { font-size: 14px; font-weight: 600; color: #93c5fd; margin-bottom: 8px; }
  .report-header .meta { font-size: 10px; color: #94a3b8; }
  .report-header .meta span { margin-right: 16px; }

  .summary-section {
    display: flex; gap: 12px; padding: 24px 40px; background: #f8fafc;
    border-bottom: 1px solid #e2e8f0; page-break-inside: avoid; flex-wrap: wrap;
  }
  .summary-card {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 16px 20px; min-width: 120px; text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .summary-card .num { font-size: 24px; font-weight: 800; color: #0f172a; }
  .summary-card .label { font-size: 9px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

  .status-group { margin-bottom: 8px; }
  .status-group-header {
    display: flex; align-items: baseline; gap: 10px; padding: 8px 14px;
    margin: 18px 0 12px; background: #f8fafc; border-radius: 6px;
    page-break-after: avoid; page-break-inside: avoid;
  }
  .status-group-name { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .status-group-count { font-size: 10px; font-weight: 600; color: #94a3b8; }

  .leads-container { padding: 16px 40px; }
  .lead-card {
    border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px;
    overflow: hidden; page-break-inside: avoid; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .lead-header {
    display: flex; align-items: center; gap: 10px; padding: 14px 20px;
    background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-bottom: 1px solid #e2e8f0;
  }
  .lead-number { font-size: 11px; font-weight: 800; color: #94a3b8; min-width: 28px; }
  .lead-name { font-size: 14px; font-weight: 700; color: #0f172a; flex: 1; }
  .status-badge {
    display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 9px;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
  }

  .details-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 0;
    padding: 0; border-bottom: 1px solid #f1f5f9;
  }
  .detail-item {
    padding: 8px 20px; border-bottom: 1px solid #f8fafc;
    border-right: 1px solid #f8fafc;
  }
  .detail-label { display: block; font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .detail-value { display: block; font-size: 11px; font-weight: 500; color: #1e293b; word-break: break-word; }

  .sub-section { padding: 12px 20px; border-top: 1px solid #f1f5f9; }
  .sub-title { font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 8px; }
  .empty-note { padding: 10px 20px; font-size: 10px; color: #94a3b8; font-style: italic; border-top: 1px solid #f1f5f9; }

  .detail-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .detail-table th {
    text-align: left; padding: 6px 8px; font-size: 8px; font-weight: 700;
    color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;
    background: #f8fafc; border-bottom: 1px solid #e2e8f0;
  }
  .detail-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; color: #334155; }
  .detail-table tr:last-child td { border-bottom: none; }
  .nowrap { white-space: nowrap; }
  .note-date { color: #64748b; font-size: 9px; }
  .note-content { color: #1e293b; }

  .pill {
    display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700;
  }
  .pill-overdue { background: #fee2e2; color: #dc2626; margin-left: 6px; }

  .footer {
    text-align: center; padding: 20px 40px; font-size: 9px; color: #94a3b8;
    border-top: 1px solid #e2e8f0; margin-top: 24px;
  }

  @media print {
    .lead-card { page-break-inside: avoid; }
    .report-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="report-header">
  <div class="agency">${escapeHtml(agencyName)}</div>
  <h1>Lead Evaluation Report</h1>
  <div class="meta">
    <span>Generated: ${formatDateTimeReport(new Date())}</span>
    <span>Filters: ${escapeHtml(filterText)}</span>
    <span>Total Leads: ${stats.total}</span>
  </div>
</div>

<div class="summary-section">
  <div class="summary-card"><div class="num">${stats.total}</div><div class="label">Total Leads</div></div>
  <div class="summary-card"><div class="num" style="color:#16a34a">${stats.converted}</div><div class="label">Converted</div></div>
  <div class="summary-card"><div class="num" style="color:#dc2626">${stats.lost}</div><div class="label">Lost</div></div>
  <div class="summary-card"><div class="num" style="color:#2563eb">${stats.conversionRate}%</div><div class="label">Conversion Rate</div></div>
</div>

<div class="leads-container">
  ${leadSections}
</div>

<div class="footer">
  ${escapeHtml(agencyName)} • Lead Report • Generated on ${formatDateTimeReport(new Date())} • Confidential
</div>

</body>
</html>`;
}

async function generatePdfReport(leads, agencyName, filters = {}) {
  const html = buildReportHtml(leads, agencyName, filters);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '10mm', bottom: '16mm', left: '10mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width:100%;text-align:center;font-size:8px;color:#94a3b8;font-family:Inter,sans-serif;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ─── Excel Generation ────────────────────────────────────────────────

async function generateExcelReport(leads, agencyName, filters = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = agencyName;
  workbook.created = new Date();

  const stats = buildSummaryStats(leads);

  // ── Colors & Styles ──
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
  const subHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  const subHeaderFont = { bold: true, color: { argb: 'FF334155' }, size: 10, name: 'Calibri' };
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
  const altRowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  // ═══ Sheet 1: Summary ═══
  const summarySheet = workbook.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF0F172A' } } });
  summarySheet.columns = [
    { width: 30 }, { width: 20 }, { width: 15 },
  ];

  // Title
  summarySheet.mergeCells('A1:C1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = `${agencyName} — Lead Report`;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle' };
  summarySheet.getRow(1).height = 36;

  summarySheet.mergeCells('A2:C2');
  summarySheet.getCell('A2').value = `Generated: ${formatDateTimeReport(new Date())}`;
  summarySheet.getCell('A2').font = { color: { argb: 'FF64748B' }, size: 10 };

  // Key Metrics
  summarySheet.getCell('A4').value = 'Key Metrics';
  summarySheet.getCell('A4').font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };

  const metricsData = [
    ['Total Leads', stats.total],
    ['Converted', stats.converted],
    ['Lost', stats.lost],
    ['Conversion Rate', `${stats.conversionRate}%`],
  ];
  metricsData.forEach(([label, value], i) => {
    const row = summarySheet.getRow(5 + i);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, color: { argb: 'FF475569' } };
    row.getCell(2).value = value;
    row.getCell(2).font = { bold: true, color: { argb: 'FF0F172A' }, size: 12 };
    row.getCell(1).border = thinBorder;
    row.getCell(2).border = thinBorder;
  });

  // Status Breakdown
  let currentRow = 5 + metricsData.length + 2;
  summarySheet.getCell(`A${currentRow}`).value = 'Status Breakdown';
  summarySheet.getCell(`A${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };
  currentRow++;

  const statusHeader = summarySheet.getRow(currentRow);
  statusHeader.getCell(1).value = 'Status';
  statusHeader.getCell(2).value = 'Count';
  statusHeader.getCell(3).value = 'Percentage';
  [1, 2, 3].forEach((c) => {
    statusHeader.getCell(c).fill = headerFill;
    statusHeader.getCell(c).font = headerFont;
    statusHeader.getCell(c).border = thinBorder;
  });
  currentRow++;

  Object.entries(stats.statusCounts).sort((a, b) => b[1] - a[1]).forEach(([s, count], i) => {
    const row = summarySheet.getRow(currentRow + i);
    row.getCell(1).value = formatStatusLabel(s);
    row.getCell(2).value = count;
    row.getCell(3).value = stats.total > 0 ? `${((count / stats.total) * 100).toFixed(1)}%` : '0%';
    [1, 2, 3].forEach((c) => {
      row.getCell(c).border = thinBorder;
      if (i % 2 === 1) row.getCell(c).fill = altRowFill;
    });
  });
  currentRow += Object.keys(stats.statusCounts).length + 2;

  // Source Breakdown
  summarySheet.getCell(`A${currentRow}`).value = 'Source Breakdown';
  summarySheet.getCell(`A${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };
  currentRow++;

  const sourceHeader = summarySheet.getRow(currentRow);
  sourceHeader.getCell(1).value = 'Source';
  sourceHeader.getCell(2).value = 'Count';
  sourceHeader.getCell(3).value = 'Percentage';
  [1, 2, 3].forEach((c) => {
    sourceHeader.getCell(c).fill = headerFill;
    sourceHeader.getCell(c).font = headerFont;
    sourceHeader.getCell(c).border = thinBorder;
  });
  currentRow++;

  Object.entries(stats.sourceCounts).sort((a, b) => b[1] - a[1]).forEach(([s, count], i) => {
    const row = summarySheet.getRow(currentRow + i);
    row.getCell(1).value = formatSourceLabel(s);
    row.getCell(2).value = count;
    row.getCell(3).value = stats.total > 0 ? `${((count / stats.total) * 100).toFixed(1)}%` : '0%';
    [1, 2, 3].forEach((c) => {
      row.getCell(c).border = thinBorder;
      if (i % 2 === 1) row.getCell(c).fill = altRowFill;
    });
  });

  // Order all detail sheets by status pipeline so the report reads per-status.
  const orderedLeads = [...leads].sort((a, b) => statusRank(a.status) - statusRank(b.status));

  // ═══ Sheet 2: Lead Details ═══ (evaluation fields only — no agent/marketing columns)
  const leadsSheet = workbook.addWorksheet('Lead Details', { properties: { tabColor: { argb: 'FF3B82F6' } } });
  const leadColumns = [
    { header: 'SL No', key: 'sl', width: 7 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Place', key: 'place', width: 18 },
    { header: 'Destination', key: 'destination', width: 18 },
    { header: 'Source', key: 'source', width: 16 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'First Contact', key: 'firstContact', width: 18 },
  ];
  leadsSheet.columns = leadColumns;

  // Style header row
  const leadHeaderRow = leadsSheet.getRow(1);
  leadHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  leadHeaderRow.height = 24;
  leadsSheet.views = [{ state: 'frozen', ySplit: 1 }];

  orderedLeads.forEach((lead, idx) => {
    const row = leadsSheet.addRow({
      sl: idx + 1,
      name: lead.customer?.name || '',
      phone: lead.customer?.phone || '',
      place: lead.place || '',
      destination: lead.destination || '',
      source: formatSourceLabel(lead.source),
      status: formatStatusLabel(lead.status),
      firstContact: formatDateTimeReport(lead.createdAt),
    });
    row.eachCell((cell) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: 'top', wrapText: true };
      if (idx % 2 === 1) cell.fill = altRowFill;
    });
  });

  leadsSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: leads.length + 1, column: leadColumns.length } };

  // ═══ Sheet 3: Notes ═══ (manual notes only — no author/agent column)
  const notesSheet = workbook.addWorksheet('Notes', { properties: { tabColor: { argb: 'FFF59E0B' } } });
  notesSheet.columns = [
    { header: 'SL No', key: 'sl', width: 7 },
    { header: 'Lead Name', key: 'leadName', width: 22 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Note Content', key: 'content', width: 60 },
  ];
  const notesHeaderRow = notesSheet.getRow(1);
  notesHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle' };
  });
  notesHeaderRow.height = 24;
  notesSheet.views = [{ state: 'frozen', ySplit: 1 }];

  let noteIdx = 0;
  orderedLeads.forEach((lead) => {
    const leadName = lead.customer?.name || 'Unnamed';
    const leadStatus = formatStatusLabel(lead.status);
    const manualNotes = (lead.notesList || []).filter((note) => isManualNote(note.content));
    manualNotes.forEach((note) => {
      noteIdx++;
      const row = notesSheet.addRow({
        sl: noteIdx,
        leadName,
        status: leadStatus,
        date: formatDateTimeReport(note.createdAt),
        content: note.content || '',
      });
      row.eachCell((cell) => {
        cell.border = thinBorder;
        cell.alignment = { vertical: 'top', wrapText: true };
        if (noteIdx % 2 === 0) cell.fill = altRowFill;
      });
    });
  });

  if (noteIdx > 0) {
    notesSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: noteIdx + 1, column: 5 } };
  }

  // ═══ Sheet 4: Follow-Ups ═══ (scheduled vs actual, with timeliness — no agent column)
  const fuNow = Date.now();
  const fuSheet = workbook.addWorksheet('Follow-Ups', { properties: { tabColor: { argb: 'FF16A34A' } } });
  fuSheet.columns = [
    { header: 'SL No', key: 'sl', width: 7 },
    { header: 'Lead Name', key: 'leadName', width: 22 },
    { header: 'Lead Status', key: 'leadStatus', width: 16 },
    { header: 'Follow-Up Status', key: 'status', width: 14 },
    { header: 'Scheduled For', key: 'scheduledAt', width: 18 },
    { header: 'Done On', key: 'completedAt', width: 18 },
    { header: 'Timeliness', key: 'timeliness', width: 16 },
    { header: 'Note', key: 'note', width: 45 },
  ];
  const fuHeaderRow = fuSheet.getRow(1);
  fuHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  fuHeaderRow.height = 24;
  fuSheet.views = [{ state: 'frozen', ySplit: 1 }];

  let fuIdx = 0;
  orderedLeads.forEach((lead) => {
    const leadName = lead.customer?.name || 'Unnamed';
    const leadStatus = formatStatusLabel(lead.status);
    (lead.followUps || []).forEach((fu) => {
      fuIdx++;
      const fuStatus = fu.status || 'Scheduled';
      const completed = isCompletedFollowUp(fu);
      let timeliness;
      if (completed) timeliness = followUpTimeliness(fu).label;
      else timeliness = isOverdueFollowUp(fu, fuNow) ? 'Overdue' : 'Pending';
      const row = fuSheet.addRow({
        sl: fuIdx,
        leadName,
        leadStatus,
        status: fuStatus,
        scheduledAt: formatDateTimeReport(fu.scheduledAt),
        completedAt: completed ? formatDateTimeReport(fu.updatedAt) : '-',
        timeliness,
        note: fu.note || '',
      });
      row.eachCell((cell) => {
        cell.border = thinBorder;
        cell.alignment = { vertical: 'top', wrapText: true };
        if (fuIdx % 2 === 0) cell.fill = altRowFill;
      });
      // Color-code follow-up status cell
      const statusCell = row.getCell('status');
      if (fuStatus === 'Done') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        statusCell.font = { bold: true, color: { argb: 'FF16A34A' } };
      } else if (fuStatus === 'Cancelled') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        statusCell.font = { bold: true, color: { argb: 'FFDC2626' } };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
        statusCell.font = { bold: true, color: { argb: 'FFD97706' } };
      }
      // Color-code timeliness cell
      const tCell = row.getCell('timeliness');
      if (timeliness === 'On-time') tCell.font = { bold: true, color: { argb: 'FF16A34A' } };
      else if (timeliness.startsWith('Late') || timeliness === 'Overdue') tCell.font = { bold: true, color: { argb: 'FFDC2626' } };
      else tCell.font = { color: { argb: 'FF64748B' } };
    });
  });

  if (fuIdx > 0) {
    fuSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: fuIdx + 1, column: 8 } };
  }

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  fetchAllLeadsForReport,
  generatePdfReport,
  generateExcelReport,
};
