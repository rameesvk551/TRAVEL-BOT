// FILE: /backend/src/services/hrmService.js
// DEPS: sequelize

const { Op } = require('sequelize');
const {
  Agent,
  EmployeeProfile,
  Attendance,
  LeaveType,
  LeaveRequest,
  Holiday,
  HrmSetting,
  Payslip,
} = require('../models');
const calc = require('../utils/hrmCalc');

function httpError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function localDateString(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthBounds(month) {
  return { start: `${month}-01`, end: `${month}-${pad(calc.daysInMonth(month))}` };
}

const DEFAULT_LEAVE_TYPES = [
  { name: 'Casual Leave', code: 'CL', isPaid: true, annualQuota: 12, color: '#6366f1' },
  { name: 'Sick Leave', code: 'SL', isPaid: true, annualQuota: 8, color: '#f59e0b' },
  { name: 'Leave Without Pay', code: 'LWP', isPaid: false, annualQuota: 0, color: '#ef4444' },
];

// ---------------------------------------------------------------------------
// Settings & seeding
// ---------------------------------------------------------------------------

async function getSettings(agencyId) {
  let settings = await HrmSetting.findOne({ where: { agencyId } });
  if (!settings) {
    settings = await HrmSetting.create({ agencyId });
  }
  return settings;
}

async function ensureSeedLeaveTypes(agencyId) {
  const count = await LeaveType.count({ where: { agencyId } });
  if (count > 0) return;
  await LeaveType.bulkCreate(DEFAULT_LEAVE_TYPES.map((t) => ({ ...t, agencyId })));
}

async function resolveWeeklyOffDays(profile, settings) {
  const own = Array.isArray(profile?.weeklyOffDays) ? profile.weeklyOffDays : [];
  return own.length ? own : (settings.defaultWeeklyOffDays || [0]);
}

// ---------------------------------------------------------------------------
// Self-service: punching & timesheet
// ---------------------------------------------------------------------------

async function getOrCreateToday(agencyId, agentId) {
  const date = localDateString();
  let row = await Attendance.findOne({ where: { agencyId, agentId, date } });
  if (!row) {
    row = await Attendance.create({ agencyId, agentId, date, status: 'ABSENT' });
  }
  return row;
}

function locationFields(location, prefix) {
  if (!location || location.lat == null || location.lng == null) return {};
  return {
    [`${prefix}Lat`]: location.lat,
    [`${prefix}Lng`]: location.lng,
    [`${prefix}Accuracy`]: location.accuracy != null ? Math.round(location.accuracy) : null,
  };
}

async function punchIn(agencyId, agentId, location) {
  const settings = await getSettings(agencyId);
  const row = await getOrCreateToday(agencyId, agentId);
  if (row.punchInAt) {
    throw httpError('You have already punched in today.', 400, 'ALREADY_PUNCHED_IN');
  }
  const now = new Date();
  row.punchInAt = now;
  row.isLate = calc.isLatePunch(now, settings.workdayStartTime, settings.graceMinutes);
  row.status = 'PRESENT';
  row.source = 'SELF';
  row.set(locationFields(location, 'punchIn'));
  await row.save();
  return row;
}

async function punchOut(agencyId, agentId, location) {
  const settings = await getSettings(agencyId);
  const date = localDateString();
  const row = await Attendance.findOne({ where: { agencyId, agentId, date } });
  if (!row || !row.punchInAt) {
    throw httpError('Punch in first before punching out.', 400, 'NOT_PUNCHED_IN');
  }
  if (row.punchOutAt) {
    throw httpError('You have already punched out today.', 400, 'ALREADY_PUNCHED_OUT');
  }
  const now = new Date();
  row.punchOutAt = now;
  row.workedMinutes = calc.workedMinutes(row.punchInAt, now);
  row.status = calc.statusFromWorkedMinutes(row.workedMinutes, settings);
  row.set(locationFields(location, 'punchOut'));
  await row.save();
  return row;
}

async function getTimesheet(agencyId, agentId, month) {
  const m = month || currentMonth();
  const { start, end } = monthBounds(m);
  const rows = await Attendance.findAll({
    where: { agencyId, agentId, date: { [Op.between]: [start, end] } },
    order: [['date', 'ASC']],
  });
  const leaves = await LeaveRequest.findAll({
    where: {
      agencyId,
      agentId,
      status: 'APPROVED',
      startDate: { [Op.lte]: end },
      endDate: { [Op.gte]: start },
    },
    include: [{ model: LeaveType, as: 'leaveType' }],
  });
  const [holidays, settings] = await Promise.all([
    Holiday.findAll({ where: { agencyId, date: { [Op.between]: [start, end] } }, order: [['date', 'ASC']] }),
    getSettings(agencyId),
  ]);
  const profile = await EmployeeProfile.findOne({ where: { agencyId, agentId } });
  const weeklyOffDays = await resolveWeeklyOffDays(profile, settings);
  return { month: m, attendance: rows, leaves, holidays, weeklyOffDays };
}

async function getLeaveBalances(agencyId, agentId) {
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const types = await LeaveType.findAll({ where: { agencyId, isActive: true }, order: [['name', 'ASC']] });
  const approved = await LeaveRequest.findAll({
    where: {
      agencyId,
      agentId,
      status: 'APPROVED',
      startDate: { [Op.between]: [yearStart, yearEnd] },
    },
  });
  const usedByType = {};
  for (const lr of approved) {
    usedByType[lr.leaveTypeId] = (usedByType[lr.leaveTypeId] || 0) + Number(lr.dayCount);
  }
  return types.map((t) => {
    const used = usedByType[t.id] || 0;
    const quota = Number(t.annualQuota);
    return {
      leaveTypeId: t.id,
      name: t.name,
      code: t.code,
      color: t.color,
      isPaid: t.isPaid,
      quota,
      used,
      balance: quota > 0 ? Math.max(0, quota - used) : null,
    };
  });
}

/**
 * Whether this employee must punch in before using the app today. True only for
 * an active HR-tracked employee on a working day who hasn't punched in yet —
 * never on a weekly-off, holiday, or approved-leave day.
 */
async function computeRequiresPunchIn(agencyId, agentId, profile, todayRow, settings, agentRole) {
  if (settings && settings.forcePunchIn === false) return false;
  // Owner/admins are never trapped behind the punch wall.
  if (agentRole === 'ADMIN') return false;
  // A deactivated employee is exempt. A staff user with NO profile is still
  // gated (every AGENT counts as an employee) — as long as the agency uses HRM.
  if (profile && profile.isActive === false) return false;
  if (todayRow?.punchInAt) return false;
  // Only enforce for agencies that actually use HRM (have set up at least one
  // employee). Agencies not using HRM never force punch-in on their staff.
  const hrmInUse = await EmployeeProfile.count({ where: { agencyId } });
  if (!hrmInUse) return false;
  const date = localDateString();
  const weekday = new Date().getDay();
  const weeklyOffDays = await resolveWeeklyOffDays(profile, settings);
  if (Array.isArray(weeklyOffDays) && weeklyOffDays.includes(weekday)) return false;
  const holiday = await Holiday.findOne({ where: { agencyId, date } });
  if (holiday) return false;
  const onLeave = await LeaveRequest.findOne({
    where: {
      agencyId,
      agentId,
      status: 'APPROVED',
      startDate: { [Op.lte]: date },
      endDate: { [Op.gte]: date },
    },
  });
  if (onLeave) return false;
  return true;
}

async function getMySpace(agencyId, agentId, agentRole) {
  await ensureSeedLeaveTypes(agencyId);
  const date = localDateString();
  const [profile, today, balances, pending, settings] = await Promise.all([
    EmployeeProfile.findOne({ where: { agencyId, agentId } }),
    Attendance.findOne({ where: { agencyId, agentId, date } }),
    getLeaveBalances(agencyId, agentId),
    LeaveRequest.count({ where: { agencyId, agentId, status: 'PENDING' } }),
    getSettings(agencyId),
  ]);
  const requiresPunchIn = await computeRequiresPunchIn(agencyId, agentId, profile, today, settings, agentRole);
  return { profile, today, balances, pendingLeaves: pending, date, requiresPunchIn };
}

// ---------------------------------------------------------------------------
// Leave requests
// ---------------------------------------------------------------------------

async function listLeaveTypes(agencyId, { activeOnly = false } = {}) {
  await ensureSeedLeaveTypes(agencyId);
  const where = { agencyId };
  if (activeOnly) where.isActive = true;
  return LeaveType.findAll({ where, order: [['name', 'ASC']] });
}

async function requestLeave(agencyId, agentId, data) {
  const leaveType = await LeaveType.findOne({ where: { agencyId, id: data.leaveTypeId, isActive: true } });
  if (!leaveType) throw httpError('Leave type not found.', 404, 'LEAVE_TYPE_NOT_FOUND');
  if (data.endDate < data.startDate) {
    throw httpError('End date cannot be before start date.', 400, 'INVALID_RANGE');
  }
  const isHalfDay = Boolean(data.isHalfDay);
  if (isHalfDay && data.startDate !== data.endDate) {
    throw httpError('Half-day leave must be a single day.', 400, 'INVALID_HALF_DAY');
  }
  const dayCount = calc.leaveDayCount(data.startDate, data.endDate, isHalfDay);
  return LeaveRequest.create({
    agencyId,
    agentId,
    leaveTypeId: data.leaveTypeId,
    startDate: data.startDate,
    endDate: data.endDate,
    isHalfDay,
    dayCount,
    reason: data.reason || null,
    status: 'PENDING',
  });
}

async function listMyLeaves(agencyId, agentId) {
  return LeaveRequest.findAll({
    where: { agencyId, agentId },
    include: [{ model: LeaveType, as: 'leaveType' }],
    order: [['createdAt', 'DESC']],
  });
}

async function cancelMyLeave(agencyId, agentId, id) {
  const lr = await LeaveRequest.findOne({ where: { agencyId, agentId, id } });
  if (!lr) throw httpError('Leave request not found.', 404, 'LEAVE_NOT_FOUND');
  if (lr.status !== 'PENDING') {
    throw httpError('Only pending requests can be cancelled.', 400, 'NOT_CANCELLABLE');
  }
  lr.status = 'CANCELLED';
  await lr.save();
  return lr;
}

// ---------------------------------------------------------------------------
// Management: employees
// ---------------------------------------------------------------------------

async function listEmployees(agencyId) {
  const agents = await Agent.findAll({
    where: { agencyId },
    attributes: { exclude: ['passwordHash', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
    include: [{ model: EmployeeProfile, as: 'employeeProfile' }],
    order: [['name', 'ASC']],
  });
  return agents;
}

async function getEmployee(agencyId, agentId) {
  const agent = await Agent.findOne({
    where: { agencyId, id: agentId },
    attributes: { exclude: ['passwordHash', 'resetPasswordTokenHash', 'resetPasswordExpiresAt'] },
    include: [{ model: EmployeeProfile, as: 'employeeProfile' }],
  });
  if (!agent) throw httpError('Employee not found.', 404, 'EMPLOYEE_NOT_FOUND');
  return agent;
}

async function upsertEmployeeProfile(agencyId, agentId, data) {
  const agent = await Agent.findOne({ where: { agencyId, id: agentId } });
  if (!agent) throw httpError('Employee not found.', 404, 'EMPLOYEE_NOT_FOUND');
  let profile = await EmployeeProfile.findOne({ where: { agencyId, agentId } });
  const fields = {
    employeeCode: data.employeeCode,
    department: data.department,
    designation: data.designation,
    employmentType: data.employmentType,
    joiningDate: data.joiningDate,
    monthlySalary: data.monthlySalary,
    weeklyOffDays: data.weeklyOffDays,
    isActive: data.isActive,
  };
  Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);
  if (profile) {
    await profile.update(fields);
  } else {
    profile = await EmployeeProfile.create({ agencyId, agentId, ...fields });
  }
  return profile;
}

// ---------------------------------------------------------------------------
// Management: attendance
// ---------------------------------------------------------------------------

async function listAttendance(agencyId, { date, month, agentId } = {}) {
  const where = { agencyId };
  if (agentId) where.agentId = agentId;
  if (date) {
    where.date = date;
  } else {
    const m = month || currentMonth();
    const { start, end } = monthBounds(m);
    where.date = { [Op.between]: [start, end] };
  }
  return Attendance.findAll({
    where,
    include: [{ model: Agent, as: 'agent', attributes: ['id', 'name', 'email'] }],
    order: [['date', 'DESC'], ['createdAt', 'DESC']],
  });
}

async function markAttendance(agencyId, data) {
  const settings = await getSettings(agencyId);
  const { agentId, date } = data;
  // Ensure the target employee belongs to this agency (no cross-tenant writes).
  const agent = await Agent.findOne({ where: { agencyId, id: agentId } });
  if (!agent) throw httpError('Employee not found.', 404, 'EMPLOYEE_NOT_FOUND');
  let row = await Attendance.findOne({ where: { agencyId, agentId, date } });
  const patch = {
    status: data.status,
    notes: data.notes,
    punchInAt: data.punchInAt,
    punchOutAt: data.punchOutAt,
    source: 'ADMIN',
  };
  if (data.punchInAt && data.punchOutAt) {
    patch.workedMinutes = calc.workedMinutes(data.punchInAt, data.punchOutAt);
  }
  if (data.punchInAt) {
    patch.isLate = calc.isLatePunch(new Date(data.punchInAt), settings.workdayStartTime, settings.graceMinutes);
  }
  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
  if (row) {
    await row.update(patch);
  } else {
    row = await Attendance.create({ agencyId, agentId, date, ...patch });
  }
  return row;
}

async function updateAttendance(agencyId, id, data) {
  const row = await Attendance.findOne({ where: { agencyId, id } });
  if (!row) throw httpError('Attendance record not found.', 404, 'ATTENDANCE_NOT_FOUND');
  return markAttendance(agencyId, { agentId: row.agentId, date: row.date, ...data });
}

// ---------------------------------------------------------------------------
// Management: leave approvals
// ---------------------------------------------------------------------------

async function listLeaves(agencyId, { status } = {}) {
  const where = { agencyId };
  if (status) where.status = status;
  return LeaveRequest.findAll({
    where,
    include: [
      { model: LeaveType, as: 'leaveType' },
      { model: Agent, as: 'agent', attributes: ['id', 'name', 'email'] },
    ],
    order: [['createdAt', 'DESC']],
  });
}

async function reviewLeave(agencyId, id, reviewerId, decision, note) {
  const lr = await LeaveRequest.findOne({ where: { agencyId, id } });
  if (!lr) throw httpError('Leave request not found.', 404, 'LEAVE_NOT_FOUND');
  if (lr.status !== 'PENDING') {
    throw httpError('This request has already been reviewed.', 400, 'ALREADY_REVIEWED');
  }
  lr.status = decision; // APPROVED | REJECTED
  lr.reviewedByAgentId = reviewerId;
  lr.reviewedAt = new Date();
  lr.reviewNote = note || null;
  await lr.save();
  return lr;
}

// ---------------------------------------------------------------------------
// Management: leave types, holidays, settings
// ---------------------------------------------------------------------------

async function createLeaveType(agencyId, data) {
  // A soft-deleted type keeps its (agency, code) row; reactivate it on re-add
  // instead of hitting the unique constraint.
  const existing = await LeaveType.findOne({ where: { agencyId, code: data.code } });
  if (existing) {
    await existing.update({ ...data, isActive: true });
    return existing;
  }
  return LeaveType.create({ ...data, agencyId });
}

async function updateLeaveType(agencyId, id, data) {
  const lt = await LeaveType.findOne({ where: { agencyId, id } });
  if (!lt) throw httpError('Leave type not found.', 404, 'LEAVE_TYPE_NOT_FOUND');
  await lt.update(data);
  return lt;
}

async function deleteLeaveType(agencyId, id) {
  const lt = await LeaveType.findOne({ where: { agencyId, id } });
  if (!lt) throw httpError('Leave type not found.', 404, 'LEAVE_TYPE_NOT_FOUND');
  await lt.update({ isActive: false });
  return { id };
}

async function listHolidays(agencyId, { year } = {}) {
  const where = { agencyId };
  if (year) {
    where.date = { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };
  }
  return Holiday.findAll({ where, order: [['date', 'ASC']] });
}

async function createHoliday(agencyId, data) {
  const existing = await Holiday.findOne({ where: { agencyId, date: data.date } });
  if (existing) {
    await existing.update({ name: data.name });
    return existing;
  }
  return Holiday.create({ ...data, agencyId });
}

async function deleteHoliday(agencyId, id) {
  const h = await Holiday.findOne({ where: { agencyId, id } });
  if (!h) throw httpError('Holiday not found.', 404, 'HOLIDAY_NOT_FOUND');
  await h.destroy();
  return { id };
}

async function updateSettings(agencyId, data) {
  const settings = await getSettings(agencyId);
  await settings.update(data);
  return settings;
}

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

function buildLeaveLookup(leaves) {
  // date string -> { isPaid, fraction }
  const map = {};
  for (const lr of leaves) {
    const isPaid = lr.leaveType ? lr.leaveType.isPaid : true;
    let d = new Date(`${lr.startDate}T00:00:00`);
    const end = new Date(`${lr.endDate}T00:00:00`);
    while (d <= end) {
      const key = localDateString(d);
      map[key] = { isPaid, fraction: lr.isHalfDay ? 0.5 : 1 };
      d = new Date(d.getTime() + 86400000);
    }
  }
  return map;
}

const applyAdjustments = calc.applyAdjustments;

/** Sum the unpaid (docked) days across a month given the resolved day maps. */
function sumUnpaidDays(month, attByDate, leaveByDate, offSet, holidaySet, today) {
  let unpaidDays = 0;
  for (const { date, weekday } of calc.listMonthDays(month)) {
    if (offSet.has(weekday) || holidaySet.has(date)) continue; // not a working day
    if (date > today) continue; // don't dock future days
    unpaidDays += calc.unpaidForWorkingDay(attByDate[date]?.status || null, leaveByDate[date] || null);
  }
  return unpaidDays;
}

/** Load a single employee's attendance + approved leaves for a month as lookup maps. */
async function loadMonthMaps(agencyId, agentId, month) {
  const { start, end } = monthBounds(month);
  const [attendance, leaves] = await Promise.all([
    Attendance.findAll({ where: { agencyId, agentId, date: { [Op.between]: [start, end] } } }),
    LeaveRequest.findAll({
      where: {
        agencyId,
        agentId,
        status: 'APPROVED',
        startDate: { [Op.lte]: end },
        endDate: { [Op.gte]: start },
      },
      include: [{ model: LeaveType, as: 'leaveType' }],
    }),
  ]);
  const attByDate = {};
  attendance.forEach((a) => { attByDate[a.date] = a; });
  return { attendance, leaves, attByDate, leaveByDate: buildLeaveLookup(leaves) };
}

async function computeEmployeeMonth(agencyId, profile, month, settings, holidaySet) {
  const agentId = profile.agentId;
  const weeklyOff = await resolveWeeklyOffDays(profile, settings);
  const workingDays = calc.countWorkingDays(month, weeklyOff, holidaySet);

  const { attByDate, leaveByDate } = await loadMonthMaps(agencyId, agentId, month);
  const offSet = new Set(weeklyOff);
  const today = localDateString();
  const unpaidDays = sumUnpaidDays(month, attByDate, leaveByDate, offSet, holidaySet, today);

  const denominator = settings.payrollDaysBasis === 'CALENDAR'
    ? calc.daysInMonth(month)
    : settings.payrollDaysBasis === 'FIXED_30'
      ? 30
      : workingDays;

  const base = Number(profile.monthlySalary) || 0;
  const figures = calc.computePayslip({
    baseSalary: base,
    payableDenominator: denominator,
    unpaidDays,
    earnings: [],
    deductions: [],
  });

  return {
    workingDays,
    unpaidDays: calc.round2(unpaidDays),
    paidDays: calc.round2(Math.max(0, workingDays - unpaidDays)),
    baseSalary: base,
    lossOfPay: figures.lossOfPay,
    grossPay: figures.grossPay,
    netPay: figures.netPay,
  };
}

async function generatePayroll(agencyId, month) {
  const m = month || currentMonth();
  const settings = await getSettings(agencyId);
  const holidays = await Holiday.findAll({ where: { agencyId, date: { [Op.between]: [monthBounds(m).start, monthBounds(m).end] } } });
  const holidaySet = new Set(holidays.map((h) => h.date));
  const profiles = await EmployeeProfile.findAll({ where: { agencyId, isActive: true } });

  const results = [];
  for (const profile of profiles) {
    const calcd = await computeEmployeeMonth(agencyId, profile, m, settings, holidaySet);
    let slip = await Payslip.findOne({ where: { agencyId, agentId: profile.agentId, periodMonth: m } });
    if (slip && slip.status !== 'DRAFT') {
      results.push(slip); // never overwrite finalized/paid
      continue;
    }
    const payload = {
      agencyId,
      agentId: profile.agentId,
      periodMonth: m,
      baseSalary: calcd.baseSalary,
      earnings: slip ? slip.earnings : [],
      deductions: slip ? slip.deductions : [],
      workingDays: calcd.workingDays,
      paidDays: calcd.paidDays,
      unpaidDays: calcd.unpaidDays,
      lossOfPay: calcd.lossOfPay,
      grossPay: calcd.grossPay,
      netPay: calcd.netPay,
      status: 'DRAFT',
      generatedAt: new Date(),
    };
    // Re-apply any preserved manual earnings/deductions on top of the
    // basis-aware loss-of-pay from computeEmployeeMonth (do NOT re-derive LOP).
    const adj = applyAdjustments(calcd.baseSalary, calcd.lossOfPay, payload.earnings, payload.deductions);
    payload.grossPay = adj.grossPay;
    payload.netPay = adj.netPay;

    if (slip) {
      await slip.update(payload);
    } else {
      slip = await Payslip.create(payload);
    }
    results.push(slip);
  }
  return getPayroll(agencyId, m);
}

async function getPayroll(agencyId, month) {
  const m = month || currentMonth();
  const slips = await Payslip.findAll({
    where: { agencyId, periodMonth: m },
    include: [{ model: Agent, as: 'agent', attributes: ['id', 'name', 'email'] }],
    order: [['createdAt', 'ASC']],
  });
  const totals = slips.reduce(
    (acc, s) => {
      acc.gross += Number(s.grossPay);
      acc.net += Number(s.netPay);
      acc.lop += Number(s.lossOfPay);
      return acc;
    },
    { gross: 0, net: 0, lop: 0 }
  );
  return { month: m, payslips: slips, totals, count: slips.length };
}

async function getPayslip(agencyId, id) {
  const slip = await Payslip.findOne({
    where: { agencyId, id },
    include: [{ model: Agent, as: 'agent', attributes: ['id', 'name', 'email'] }],
  });
  if (!slip) throw httpError('Payslip not found.', 404, 'PAYSLIP_NOT_FOUND');
  return slip;
}

async function updatePayslip(agencyId, id, data) {
  const slip = await getPayslip(agencyId, id);
  if (slip.status === 'PAID') throw httpError('Paid payslips cannot be edited.', 400, 'PAYSLIP_LOCKED');
  const earnings = data.earnings !== undefined ? data.earnings : slip.earnings;
  const deductions = data.deductions !== undefined ? data.deductions : slip.deductions;
  // Loss-of-pay is fixed by attendance; editing line items only changes gross/net.
  const adj = applyAdjustments(Number(slip.baseSalary), Number(slip.lossOfPay), earnings, deductions);
  await slip.update({
    earnings,
    deductions,
    notes: data.notes !== undefined ? data.notes : slip.notes,
    grossPay: adj.grossPay,
    netPay: adj.netPay,
  });
  return slip;
}

async function setPayslipStatus(agencyId, id, status) {
  const slip = await getPayslip(agencyId, id);
  const patch = { status };
  if (status === 'PAID') patch.paidAt = new Date();
  await slip.update(patch);
  return slip;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/**
 * Per-employee attendance summary for a month: present/half/absent days, leave,
 * late arrivals, hours worked, unpaid (LOP) days and an attendance percentage.
 */
async function getAttendanceReport(agencyId, month) {
  const m = month || currentMonth();
  const settings = await getSettings(agencyId);
  const { start, end } = monthBounds(m);
  const today = localDateString();

  const [profiles, holidays] = await Promise.all([
    EmployeeProfile.findAll({
      where: { agencyId, isActive: true },
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name', 'email'] }],
    }),
    Holiday.findAll({ where: { agencyId, date: { [Op.between]: [start, end] } } }),
  ]);
  const holidaySet = new Set(holidays.map((h) => h.date));

  const rows = [];
  for (const profile of profiles) {
    const weeklyOff = await resolveWeeklyOffDays(profile, settings);
    const offSet = new Set(weeklyOff);
    const workingDays = calc.countWorkingDays(m, weeklyOff, holidaySet);
    const { attendance, attByDate, leaveByDate } = await loadMonthMaps(agencyId, profile.agentId, m);

    let present = 0;
    let half = 0;
    let lateCount = 0;
    let workedMinutes = 0;
    attendance.forEach((a) => {
      if (a.status === 'PRESENT') present += 1;
      else if (a.status === 'HALF_DAY') half += 1;
      if (a.isLate) lateCount += 1;
      workedMinutes += a.workedMinutes || 0;
    });

    // Leave days that actually fall on working days within the month.
    let leaveDays = 0;
    for (const { date, weekday } of calc.listMonthDays(m)) {
      if (offSet.has(weekday) || holidaySet.has(date)) continue;
      const lv = leaveByDate[date];
      if (lv) leaveDays += lv.fraction;
    }

    const unpaidDays = calc.round2(sumUnpaidDays(m, attByDate, leaveByDate, offSet, holidaySet, today));
    const workedDays = calc.round2(present + half * 0.5);
    const paidDays = calc.round2(Math.max(0, workingDays - unpaidDays));
    const attendancePct = workingDays > 0 ? Math.round((workedDays / workingDays) * 100) : 0;

    rows.push({
      agentId: profile.agentId,
      name: profile.agent?.name || '—',
      email: profile.agent?.email || '',
      department: profile.department || '',
      designation: profile.designation || '',
      workingDays,
      workedDays,
      present,
      half,
      leaveDays: calc.round2(leaveDays),
      unpaidDays,
      paidDays,
      lateCount,
      totalHours: calc.round2(workedMinutes / 60),
      attendancePct,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  const totals = rows.reduce(
    (acc, r) => {
      acc.workedDays += r.workedDays;
      acc.leaveDays += r.leaveDays;
      acc.unpaidDays += r.unpaidDays;
      acc.lateCount += r.lateCount;
      acc.totalHours += r.totalHours;
      acc.attendancePctSum += r.attendancePct;
      return acc;
    },
    { workedDays: 0, leaveDays: 0, unpaidDays: 0, lateCount: 0, totalHours: 0, attendancePctSum: 0 }
  );
  const avgAttendancePct = rows.length ? Math.round(totals.attendancePctSum / rows.length) : 0;

  return {
    month: m,
    rows,
    count: rows.length,
    totals: {
      workedDays: calc.round2(totals.workedDays),
      leaveDays: calc.round2(totals.leaveDays),
      unpaidDays: calc.round2(totals.unpaidDays),
      lateCount: totals.lateCount,
      totalHours: calc.round2(totals.totalHours),
      avgAttendancePct,
    },
  };
}

module.exports = {
  getSettings,
  updateSettings,
  // self
  getMySpace,
  punchIn,
  punchOut,
  getTimesheet,
  getLeaveBalances,
  listLeaveTypes,
  requestLeave,
  listMyLeaves,
  cancelMyLeave,
  // employees
  listEmployees,
  getEmployee,
  upsertEmployeeProfile,
  // attendance
  listAttendance,
  markAttendance,
  updateAttendance,
  // leaves mgmt
  listLeaves,
  reviewLeave,
  // config
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  listHolidays,
  createHoliday,
  deleteHoliday,
  // payroll
  generatePayroll,
  getPayroll,
  getPayslip,
  updatePayslip,
  setPayslipStatus,
  // reports
  getAttendanceReport,
};
