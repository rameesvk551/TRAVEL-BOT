// FILE: /backend/src/scripts/testHrmCalc.js
// Standalone unit checks for hrmCalc (no test framework in this project).
// Run: npx tsx src/scripts/testHrmCalc.ts

const assert = require('assert');
const calc = require('../utils/hrmCalc');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

check('timeToMinutes', () => {
  assert.strictEqual(calc.timeToMinutes('09:30'), 570);
  assert.strictEqual(calc.timeToMinutes('00:00'), 0);
});

check('isLatePunch respects grace', () => {
  const onTime = new Date(2026, 5, 17, 9, 40); // 09:40 local
  const late = new Date(2026, 5, 17, 9, 46);
  assert.strictEqual(calc.isLatePunch(onTime, '09:30', 15), false); // within grace
  assert.strictEqual(calc.isLatePunch(late, '09:30', 15), true);
});

check('workedMinutes', () => {
  const inAt = new Date(2026, 5, 17, 9, 30);
  const outAt = new Date(2026, 5, 17, 18, 0);
  assert.strictEqual(calc.workedMinutes(inAt, outAt), 510);
  assert.strictEqual(calc.workedMinutes(inAt, null), 0);
  assert.strictEqual(calc.workedMinutes(outAt, inAt), 0); // negative guarded
});

check('statusFromWorkedMinutes', () => {
  const s = { fullDayMinutes: 480, halfDayMinutes: 240 };
  assert.strictEqual(calc.statusFromWorkedMinutes(500, s), 'PRESENT');
  assert.strictEqual(calc.statusFromWorkedMinutes(300, s), 'HALF_DAY');
  assert.strictEqual(calc.statusFromWorkedMinutes(100, s), 'ABSENT');
});

check('daysInMonth', () => {
  assert.strictEqual(calc.daysInMonth('2026-02'), 28);
  assert.strictEqual(calc.daysInMonth('2024-02'), 29);
  assert.strictEqual(calc.daysInMonth('2026-06'), 30);
});

check('countWorkingDays excludes weekly offs + holidays', () => {
  // June 2026: 30 days. Sundays (weekday 0) in June 2026: 7,14,21,28 => 4 Sundays.
  const wd = calc.countWorkingDays('2026-06', [0], []);
  assert.strictEqual(wd, 26);
  const wdWithHoliday = calc.countWorkingDays('2026-06', [0], ['2026-06-15']);
  assert.strictEqual(wdWithHoliday, 25);
});

check('computePayslip basic LOP', () => {
  const r = calc.computePayslip({
    baseSalary: 26000,
    payableDenominator: 26,
    unpaidDays: 2,
    earnings: [{ label: 'Bonus', amount: 1000 }],
    deductions: [{ label: 'Advance', amount: 500 }],
  });
  assert.strictEqual(r.perDay, 1000);
  assert.strictEqual(r.lossOfPay, 2000);
  assert.strictEqual(r.grossPay, 27000); // base + bonus
  assert.strictEqual(r.netPay, 24500); // 27000 - 2000 - 500
});

check('computePayslip half-day unpaid', () => {
  const r = calc.computePayslip({ baseSalary: 30000, payableDenominator: 30, unpaidDays: 0.5 });
  assert.strictEqual(r.perDay, 1000);
  assert.strictEqual(r.lossOfPay, 500);
  assert.strictEqual(r.netPay, 29500);
});

check('unpaidForWorkingDay covers attendance + leave combinations', () => {
  const paidLeave = { isPaid: true, fraction: 1 };
  const unpaidLeave = { isPaid: false, fraction: 1 };
  const unpaidHalf = { isPaid: false, fraction: 0.5 };
  // Present / on-leave / admin off days never dock.
  assert.strictEqual(calc.unpaidForWorkingDay('PRESENT', null), 0);
  assert.strictEqual(calc.unpaidForWorkingDay('ON_LEAVE', null), 0);
  assert.strictEqual(calc.unpaidForWorkingDay('WEEKLY_OFF', null), 0);
  assert.strictEqual(calc.unpaidForWorkingDay('HOLIDAY', null), 0);
  // Half day worked: other half unpaid unless a paid leave covers it.
  assert.strictEqual(calc.unpaidForWorkingDay('HALF_DAY', null), 0.5);
  assert.strictEqual(calc.unpaidForWorkingDay('HALF_DAY', paidLeave), 0);
  assert.strictEqual(calc.unpaidForWorkingDay('HALF_DAY', unpaidHalf), 0.5); // not double-docked
  // No attendance: depends on leave.
  assert.strictEqual(calc.unpaidForWorkingDay(null, paidLeave), 0);
  assert.strictEqual(calc.unpaidForWorkingDay(null, unpaidLeave), 1);
  assert.strictEqual(calc.unpaidForWorkingDay(null, unpaidHalf), 0.5);
  assert.strictEqual(calc.unpaidForWorkingDay(null, null), 1); // plain absence
  assert.strictEqual(calc.unpaidForWorkingDay('ABSENT', null), 1);
});

check('applyAdjustments keeps loss-of-pay fixed', () => {
  // Editing earnings/deductions must NOT change the docked loss-of-pay.
  const r = calc.applyAdjustments(30000, 1000, [{ label: 'Bonus', amount: 2000 }], [{ label: 'Advance', amount: 500 }]);
  assert.strictEqual(r.grossPay, 32000); // base + bonus
  assert.strictEqual(r.netPay, 30500); // 32000 - 1000 LOP - 500
  const empty = calc.applyAdjustments(30000, 1000, [], []);
  assert.strictEqual(empty.netPay, 29000); // base - LOP only
});

check('leaveDayCount', () => {
  assert.strictEqual(calc.leaveDayCount('2026-06-01', '2026-06-01', false), 1);
  assert.strictEqual(calc.leaveDayCount('2026-06-01', '2026-06-03', false), 3);
  assert.strictEqual(calc.leaveDayCount('2026-06-01', '2026-06-01', true), 0.5);
});

console.log(`\n${passed} hrmCalc checks passed.`);
