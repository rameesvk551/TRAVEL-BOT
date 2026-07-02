// FILE: /backend/src/routes/hrm.js
// DEPS: zod

const { Router } = require('express');
const { z } = require('zod');
const hrm = require('../controllers/hrmController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const VIEW = requirePermission(PERMISSIONS.HRM_VIEW, PERMISSIONS.HRM_MANAGE);
const MANAGE = requirePermission(PERMISSIONS.HRM_MANAGE);

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const lineItem = z.object({ label: z.string().min(1).max(80), amount: z.number() });
const weekdays = z.array(z.number().int().min(0).max(6)).max(7);

// ---------- self-service ----------
const punchSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
});

// Self-service is the user's OWN data (punch, timesheet, leaves) — every
// authenticated staff member gets it regardless of the hrm.view permission,
// so the force-punch-in gate can apply to all AGENTs, not just HR users.
router.get('/me', authenticate, hrm.mySpace);
router.post('/attendance/punch-in', authenticate, validateBody(punchSchema), hrm.punchIn);
router.post('/attendance/punch-out', authenticate, validateBody(punchSchema), hrm.punchOut);
router.get('/attendance/me', authenticate, hrm.myTimesheet);
router.get('/leaves/me', authenticate, hrm.myLeaves);
router.get('/leave-types', authenticate, hrm.listLeaveTypes);

const requestLeaveSchema = z.object({
  leaveTypeId: z.string().uuid(),
  startDate: dateStr,
  endDate: dateStr,
  isHalfDay: z.boolean().optional(),
  reason: z.string().max(500).optional(),
});
router.post('/leaves', authenticate, VIEW, validateBody(requestLeaveSchema), hrm.requestLeave);
router.delete('/leaves/me/:id', authenticate, VIEW, hrm.cancelMyLeave);

// ---------- employees (manage) ----------
router.get('/employees', authenticate, MANAGE, hrm.listEmployees);
router.get('/employees/:id', authenticate, MANAGE, hrm.getEmployee);

const employeeSchema = z.object({
  employeeCode: z.string().max(40).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  designation: z.string().max(100).nullable().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).optional(),
  joiningDate: dateStr.nullable().optional(),
  monthlySalary: z.number().min(0).optional(),
  weeklyOffDays: weekdays.optional(),
  isActive: z.boolean().optional(),
});
router.patch('/employees/:id', authenticate, MANAGE, validateBody(employeeSchema), hrm.updateEmployee);

// ---------- attendance (manage) ----------
router.get('/attendance', authenticate, MANAGE, hrm.listAttendance);

const markAttendanceSchema = z.object({
  agentId: z.string().uuid(),
  date: dateStr,
  status: z.enum(['PRESENT', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'WEEKLY_OFF', 'HOLIDAY']).optional(),
  punchInAt: z.string().datetime().nullable().optional(),
  punchOutAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
router.post('/attendance', authenticate, MANAGE, validateBody(markAttendanceSchema), hrm.markAttendance);

const updateAttendanceSchema = z.object({
  status: z.enum(['PRESENT', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'WEEKLY_OFF', 'HOLIDAY']).optional(),
  punchInAt: z.string().datetime().nullable().optional(),
  punchOutAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
router.patch('/attendance/:id', authenticate, MANAGE, validateBody(updateAttendanceSchema), hrm.updateAttendance);

// ---------- leave approvals (manage) ----------
router.get('/leaves', authenticate, MANAGE, hrm.listLeaves);
const reviewSchema = z.object({ note: z.string().max(500).optional() });
router.patch('/leaves/:id/approve', authenticate, MANAGE, validateBody(reviewSchema), hrm.approveLeave);
router.patch('/leaves/:id/reject', authenticate, MANAGE, validateBody(reviewSchema), hrm.rejectLeave);

// ---------- leave types (manage) ----------
const leaveTypeSchema = z.object({
  name: z.string().min(1).max(80),
  code: z.string().min(1).max(20),
  isPaid: z.boolean().optional(),
  annualQuota: z.number().min(0).optional(),
  color: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
});
router.post('/leave-types', authenticate, MANAGE, validateBody(leaveTypeSchema), hrm.createLeaveType);
router.patch('/leave-types/:id', authenticate, MANAGE, validateBody(leaveTypeSchema.partial()), hrm.updateLeaveType);
router.delete('/leave-types/:id', authenticate, MANAGE, hrm.deleteLeaveType);

// ---------- holidays (manage) ----------
router.get('/holidays', authenticate, VIEW, hrm.listHolidays);
const holidaySchema = z.object({ date: dateStr, name: z.string().min(1).max(120) });
router.post('/holidays', authenticate, MANAGE, validateBody(holidaySchema), hrm.createHoliday);
router.delete('/holidays/:id', authenticate, MANAGE, hrm.deleteHoliday);

// ---------- settings (manage) ----------
router.get('/settings', authenticate, MANAGE, hrm.getSettings);
const settingsSchema = z.object({
  workdayStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  graceMinutes: z.number().int().min(0).max(240).optional(),
  fullDayMinutes: z.number().int().min(0).max(1440).optional(),
  halfDayMinutes: z.number().int().min(0).max(1440).optional(),
  defaultWeeklyOffDays: weekdays.optional(),
  payrollDaysBasis: z.enum(['CALENDAR', 'WORKING', 'FIXED_30']).optional(),
  forcePunchIn: z.boolean().optional(),
});
router.patch('/settings', authenticate, MANAGE, validateBody(settingsSchema), hrm.updateSettings);

// ---------- payroll (manage) ----------
router.get('/payroll', authenticate, MANAGE, hrm.getPayroll);
const generateSchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });
router.post('/payroll/generate', authenticate, MANAGE, validateBody(generateSchema), hrm.generatePayroll);
router.get('/payslips/:id', authenticate, MANAGE, hrm.getPayslip);
const updatePayslipSchema = z.object({
  earnings: z.array(lineItem).max(30).optional(),
  deductions: z.array(lineItem).max(30).optional(),
  notes: z.string().max(500).nullable().optional(),
});
router.patch('/payslips/:id', authenticate, MANAGE, validateBody(updatePayslipSchema), hrm.updatePayslip);
router.post('/payslips/:id/finalize', authenticate, MANAGE, hrm.finalizePayslip);
router.post('/payslips/:id/mark-paid', authenticate, MANAGE, hrm.markPayslipPaid);

// ---------- reports (manage) ----------
router.get('/reports/attendance', authenticate, MANAGE, hrm.attendanceReport);

module.exports = router;
