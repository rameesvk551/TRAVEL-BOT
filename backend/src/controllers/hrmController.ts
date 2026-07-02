// FILE: /backend/src/controllers/hrmController.js

const hrmService = require('../services/hrmService');

function agencyId(req) {
  return req.agency.id;
}

// ---- self-service ----

async function mySpace(req, res, next) {
  try {
    const data = await hrmService.getMySpace(agencyId(req), req.agent.id, req.agent.role);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function punchIn(req, res, next) {
  try {
    const data = await hrmService.punchIn(agencyId(req), req.agent.id, req.body);
    res.json({ success: true, data, message: 'Punched in' });
  } catch (err) { next(err); }
}

async function punchOut(req, res, next) {
  try {
    const data = await hrmService.punchOut(agencyId(req), req.agent.id, req.body);
    res.json({ success: true, data, message: 'Punched out' });
  } catch (err) { next(err); }
}

async function myTimesheet(req, res, next) {
  try {
    const data = await hrmService.getTimesheet(agencyId(req), req.agent.id, req.query.month);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function myLeaves(req, res, next) {
  try {
    const data = await hrmService.listMyLeaves(agencyId(req), req.agent.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function requestLeave(req, res, next) {
  try {
    const data = await hrmService.requestLeave(agencyId(req), req.agent.id, req.body);
    res.status(201).json({ success: true, data, message: 'Leave requested' });
  } catch (err) { next(err); }
}

async function cancelMyLeave(req, res, next) {
  try {
    const data = await hrmService.cancelMyLeave(agencyId(req), req.agent.id, req.params.id);
    res.json({ success: true, data, message: 'Leave cancelled' });
  } catch (err) { next(err); }
}

async function listLeaveTypes(req, res, next) {
  try {
    const data = await hrmService.listLeaveTypes(agencyId(req), { activeOnly: req.query.active === 'true' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ---- employees ----

async function listEmployees(req, res, next) {
  try {
    const data = await hrmService.listEmployees(agencyId(req));
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getEmployee(req, res, next) {
  try {
    const data = await hrmService.getEmployee(agencyId(req), req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function updateEmployee(req, res, next) {
  try {
    const data = await hrmService.upsertEmployeeProfile(agencyId(req), req.params.id, req.body);
    res.json({ success: true, data, message: 'Employee profile saved' });
  } catch (err) { next(err); }
}

// ---- attendance mgmt ----

async function listAttendance(req, res, next) {
  try {
    const data = await hrmService.listAttendance(agencyId(req), req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function markAttendance(req, res, next) {
  try {
    const data = await hrmService.markAttendance(agencyId(req), req.body);
    res.status(201).json({ success: true, data, message: 'Attendance saved' });
  } catch (err) { next(err); }
}

async function updateAttendance(req, res, next) {
  try {
    const data = await hrmService.updateAttendance(agencyId(req), req.params.id, req.body);
    res.json({ success: true, data, message: 'Attendance updated' });
  } catch (err) { next(err); }
}

// ---- leave approvals ----

async function listLeaves(req, res, next) {
  try {
    const data = await hrmService.listLeaves(agencyId(req), req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function approveLeave(req, res, next) {
  try {
    const data = await hrmService.reviewLeave(agencyId(req), req.params.id, req.agent.id, 'APPROVED', req.body.note);
    res.json({ success: true, data, message: 'Leave approved' });
  } catch (err) { next(err); }
}

async function rejectLeave(req, res, next) {
  try {
    const data = await hrmService.reviewLeave(agencyId(req), req.params.id, req.agent.id, 'REJECTED', req.body.note);
    res.json({ success: true, data, message: 'Leave rejected' });
  } catch (err) { next(err); }
}

// ---- leave types ----

async function createLeaveType(req, res, next) {
  try {
    const data = await hrmService.createLeaveType(agencyId(req), req.body);
    res.status(201).json({ success: true, data, message: 'Leave type created' });
  } catch (err) { next(err); }
}

async function updateLeaveType(req, res, next) {
  try {
    const data = await hrmService.updateLeaveType(agencyId(req), req.params.id, req.body);
    res.json({ success: true, data, message: 'Leave type updated' });
  } catch (err) { next(err); }
}

async function deleteLeaveType(req, res, next) {
  try {
    const data = await hrmService.deleteLeaveType(agencyId(req), req.params.id);
    res.json({ success: true, data, message: 'Leave type removed' });
  } catch (err) { next(err); }
}

// ---- holidays ----

async function listHolidays(req, res, next) {
  try {
    const data = await hrmService.listHolidays(agencyId(req), req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function createHoliday(req, res, next) {
  try {
    const data = await hrmService.createHoliday(agencyId(req), req.body);
    res.status(201).json({ success: true, data, message: 'Holiday saved' });
  } catch (err) { next(err); }
}

async function deleteHoliday(req, res, next) {
  try {
    const data = await hrmService.deleteHoliday(agencyId(req), req.params.id);
    res.json({ success: true, data, message: 'Holiday removed' });
  } catch (err) { next(err); }
}

// ---- settings ----

async function getSettings(req, res, next) {
  try {
    const data = await hrmService.getSettings(agencyId(req));
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function updateSettings(req, res, next) {
  try {
    const data = await hrmService.updateSettings(agencyId(req), req.body);
    res.json({ success: true, data, message: 'Settings saved' });
  } catch (err) { next(err); }
}

// ---- payroll ----

async function getPayroll(req, res, next) {
  try {
    const data = await hrmService.getPayroll(agencyId(req), req.query.month);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function generatePayroll(req, res, next) {
  try {
    const data = await hrmService.generatePayroll(agencyId(req), req.body.month);
    res.json({ success: true, data, message: 'Payroll generated' });
  } catch (err) { next(err); }
}

async function getPayslip(req, res, next) {
  try {
    const data = await hrmService.getPayslip(agencyId(req), req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function updatePayslip(req, res, next) {
  try {
    const data = await hrmService.updatePayslip(agencyId(req), req.params.id, req.body);
    res.json({ success: true, data, message: 'Payslip updated' });
  } catch (err) { next(err); }
}

async function finalizePayslip(req, res, next) {
  try {
    const data = await hrmService.setPayslipStatus(agencyId(req), req.params.id, 'FINALIZED');
    res.json({ success: true, data, message: 'Payslip finalized' });
  } catch (err) { next(err); }
}

async function markPayslipPaid(req, res, next) {
  try {
    const data = await hrmService.setPayslipStatus(agencyId(req), req.params.id, 'PAID');
    res.json({ success: true, data, message: 'Payslip marked paid' });
  } catch (err) { next(err); }
}

// ---- reports ----

async function attendanceReport(req, res, next) {
  try {
    const data = await hrmService.getAttendanceReport(agencyId(req), req.query.month);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = {
  mySpace, punchIn, punchOut, myTimesheet, myLeaves, requestLeave, cancelMyLeave, listLeaveTypes,
  listEmployees, getEmployee, updateEmployee,
  listAttendance, markAttendance, updateAttendance,
  listLeaves, approveLeave, rejectLeave,
  createLeaveType, updateLeaveType, deleteLeaveType,
  listHolidays, createHoliday, deleteHoliday,
  getSettings, updateSettings,
  getPayroll, generatePayroll, getPayslip, updatePayslip, finalizePayslip, markPayslipPaid,
  attendanceReport,
};
