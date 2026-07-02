// FILE: /backend/src/utils/hrmCalc.js
// Pure, side-effect-free HRM calculations. Unit-tested in scripts/testHrmCalc.ts.

/**
 * Parse "HH:MM" into minutes since midnight.
 * @param {string} hhmm
 * @returns {number}
 */
function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

/**
 * Minutes-since-midnight (local time) for a Date.
 * @param {Date} date
 * @returns {number}
 */
function localMinutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Whether a punch-in is late given the agency workday start + grace.
 * @param {Date} punchInAt
 * @param {string} workdayStartTime "HH:MM"
 * @param {number} graceMinutes
 * @returns {boolean}
 */
function isLatePunch(punchInAt, workdayStartTime, graceMinutes = 0) {
  if (!punchInAt) return false;
  return localMinutesOfDay(punchInAt) > timeToMinutes(workdayStartTime) + (graceMinutes || 0);
}

/**
 * Worked minutes between two timestamps (0 if invalid / negative).
 * @param {Date|string|null} punchInAt
 * @param {Date|string|null} punchOutAt
 * @returns {number}
 */
function workedMinutes(punchInAt, punchOutAt) {
  if (!punchInAt || !punchOutAt) return 0;
  const inMs = new Date(punchInAt).getTime();
  const outMs = new Date(punchOutAt).getTime();
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) return 0;
  return Math.round((outMs - inMs) / 60000);
}

/**
 * Resolve a present-day status from worked minutes and the day thresholds.
 * @param {number} minutes
 * @param {{ fullDayMinutes: number, halfDayMinutes: number }} settings
 * @returns {'PRESENT'|'HALF_DAY'|'ABSENT'}
 */
function statusFromWorkedMinutes(minutes, settings) {
  if (minutes >= settings.fullDayMinutes) return 'PRESENT';
  if (minutes >= settings.halfDayMinutes) return 'HALF_DAY';
  return 'ABSENT';
}

/**
 * Number of calendar days in a YYYY-MM period.
 * @param {string} periodMonth "YYYY-MM"
 * @returns {number}
 */
function daysInMonth(periodMonth) {
  const [y, m] = periodMonth.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m, 0).getDate();
}

/**
 * List every date in a period as "YYYY-MM-DD" with its weekday (0=Sun..6=Sat).
 * @param {string} periodMonth "YYYY-MM"
 * @returns {Array<{ date: string, weekday: number }>}
 */
function listMonthDays(periodMonth) {
  const [y, m] = periodMonth.split('-').map((n) => parseInt(n, 10));
  const total = daysInMonth(periodMonth);
  const out = [];
  for (let d = 1; d <= total; d += 1) {
    const dateObj = new Date(y, m - 1, d);
    const date = `${periodMonth}-${String(d).padStart(2, '0')}`;
    out.push({ date, weekday: dateObj.getDay() });
  }
  return out;
}

/**
 * Count working days in a month = calendar days minus weekly-offs minus holidays.
 * @param {string} periodMonth "YYYY-MM"
 * @param {number[]} weeklyOffDays weekday numbers that are off
 * @param {Set<string>|string[]} holidayDates "YYYY-MM-DD" entries
 * @returns {number}
 */
function countWorkingDays(periodMonth, weeklyOffDays = [], holidayDates = []) {
  const offSet = new Set(weeklyOffDays);
  const holSet = holidayDates instanceof Set ? holidayDates : new Set(holidayDates);
  return listMonthDays(periodMonth).filter(
    ({ date, weekday }) => !offSet.has(weekday) && !holSet.has(date)
  ).length;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function sumAmounts(items) {
  return (items || []).reduce((acc, it) => acc + (Number(it && it.amount) || 0), 0);
}

/**
 * Compute a payslip's money figures.
 * @param {object} input
 * @param {number} input.baseSalary rupees
 * @param {number} input.payableDenominator days used as the per-day divisor
 * @param {number} input.unpaidDays days to dock (half-days as 0.5)
 * @param {Array<{label:string, amount:number}>} input.earnings
 * @param {Array<{label:string, amount:number}>} input.deductions
 * @returns {{ perDay:number, lossOfPay:number, grossPay:number, netPay:number, totalEarnings:number, totalDeductions:number }}
 */
function computePayslip({ baseSalary, payableDenominator, unpaidDays, earnings = [], deductions = [] }) {
  const base = Number(baseSalary) || 0;
  const denom = Number(payableDenominator) || 0;
  const perDay = denom > 0 ? base / denom : 0;
  const lossOfPay = round2(perDay * (Number(unpaidDays) || 0));
  const totalEarnings = round2(sumAmounts(earnings));
  const totalDeductions = round2(sumAmounts(deductions));
  const grossPay = round2(base + totalEarnings);
  const netPay = round2(grossPay - lossOfPay - totalDeductions);
  return {
    perDay: round2(perDay),
    lossOfPay,
    grossPay,
    netPay,
    totalEarnings,
    totalDeductions,
  };
}

/**
 * Unpaid fraction to dock for a single WORKING day (caller has already excluded
 * weekly-offs, holidays and future days).
 * @param {string|null} attStatus attendance status for the day, or null if no record
 * @param {{ isPaid: boolean, fraction: number }|null} leave approved leave covering the day, or null
 * @returns {number} 0, 0.5 or 1
 */
function unpaidForWorkingDay(attStatus, leave) {
  // Paid / non-docked statuses.
  if (attStatus === 'PRESENT' || attStatus === 'ON_LEAVE'
    || attStatus === 'WEEKLY_OFF' || attStatus === 'HOLIDAY') return 0;
  // Worked half a day: the other half is unpaid unless a paid leave covers it.
  if (attStatus === 'HALF_DAY') return (leave && leave.isPaid) ? 0 : 0.5;
  // No qualifying attendance — rely on approved leave, else full absence.
  if (leave) return leave.isPaid ? 0 : leave.fraction;
  return 1;
}

/**
 * Apply manual earnings/deductions on top of an already-fixed loss-of-pay.
 * Loss-of-pay is determined by attendance and must NOT be re-derived here, so
 * editing line items never changes the docked amount.
 * @param {number} baseSalary
 * @param {number} lossOfPay
 * @param {Array<{label:string, amount:number}>} earnings
 * @param {Array<{label:string, amount:number}>} deductions
 * @returns {{ grossPay:number, netPay:number, totalEarnings:number, totalDeductions:number }}
 */
function applyAdjustments(baseSalary, lossOfPay, earnings = [], deductions = []) {
  const base = Number(baseSalary) || 0;
  const totalEarnings = round2(sumAmounts(earnings));
  const totalDeductions = round2(sumAmounts(deductions));
  const grossPay = round2(base + totalEarnings);
  const netPay = round2(grossPay - (Number(lossOfPay) || 0) - totalDeductions);
  return { grossPay, netPay, totalEarnings, totalDeductions };
}

/**
 * Inclusive whole-day count between two YYYY-MM-DD dates (half-day => 0.5).
 * @param {string} startDate
 * @param {string} endDate
 * @param {boolean} isHalfDay
 * @returns {number}
 */
function leaveDayCount(startDate, endDate, isHalfDay = false) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms < 0) return isHalfDay ? 0.5 : 0;
  const days = Math.round(ms / 86400000) + 1;
  return isHalfDay ? 0.5 : days;
}

module.exports = {
  timeToMinutes,
  localMinutesOfDay,
  isLatePunch,
  workedMinutes,
  statusFromWorkedMinutes,
  daysInMonth,
  listMonthDays,
  countWorkingDays,
  computePayslip,
  unpaidForWorkingDay,
  applyAdjustments,
  leaveDayCount,
  round2,
  sumAmounts,
};
