# HRM Module — Design

**Date:** 2026-06-17
**Status:** Approved, implementing

## Goal

A small, non-complicated HRM module for travel-bot: attendance (punch in/out),
leave management, and payroll. Enableable per-agency like other modules. Best-in-class,
fully responsive (mobile/tablet/desktop) UI/UX.

## Decisions (from brainstorming)

- **Employees = existing dashboard staff (Agents).** They self-punch. No new auth surface.
- **Payroll: simple monthly payslip now**, but schema is component-ready (JSONB earnings/deductions)
  so it can grow to salary structures later with no migration.
- **Salary stored in rupees** (`DECIMAL(12,2)`), not paise. (Rest of system uses paise; convert at
  the accounting boundary if ever integrated.)
- **Leave: request → admin approves.** Configurable leave types + annual quotas per agency.
- **Attendance v1 includes:** late tracking, work-hours total, half-day support, weekly offs + holidays.

## Module integration

- Module path: `/hrm`. Gated per-agency via `Agency.sidebarPreferences` + industry-profile defaults
  (same as every existing module). Admin toggles in **Settings → Sidebar Modules**.
- Permissions: two new keys.
  - `HRM_VIEW` (`hrm.view`) — self-service: punch, my timesheet, my leave. Added to default agent perms.
  - `HRM_MANAGE` (`hrm.manage`) — admin: employees, approvals, payroll, settings. `ADMIN` role bypasses.
- Self-contained: all HRM data in its own tables linked to `agents` via `agent_id`. `Agent` model is
  NOT modified. Removing the module = drop HRM tables; Agent untouched.

## Data model (7 new Sequelize models, all agency-scoped, snake_case, JS/CommonJS style)

| Model | Table | Key fields |
|---|---|---|
| `EmployeeProfile` | `employee_profiles` | agencyId, agentId (unique), employeeCode, department, designation, employmentType, joiningDate, monthlySalary DECIMAL(12,2), weeklyOffDays JSONB int[], isActive |
| `Attendance` | `attendances` | agencyId, agentId, date DATEONLY, punchInAt, punchOutAt, status ENUM(PRESENT/HALF_DAY/ABSENT/ON_LEAVE/WEEKLY_OFF/HOLIDAY), isLate, workedMinutes, source ENUM(SELF/ADMIN), notes — unique (agency,agent,date) |
| `LeaveType` | `leave_types` | agencyId, name, code, isPaid, annualQuota, color, isActive |
| `LeaveRequest` | `leave_requests` | agencyId, agentId, leaveTypeId, startDate, endDate, isHalfDay, dayCount DECIMAL(4,1), reason, status ENUM(PENDING/APPROVED/REJECTED/CANCELLED), reviewedByAgentId, reviewedAt, reviewNote |
| `Holiday` | `holidays` | agencyId, date DATEONLY, name — unique (agency,date) |
| `HrmSetting` | `hrm_settings` | agencyId (unique), workdayStartTime "HH:MM", graceMinutes, fullDayMinutes, halfDayMinutes, defaultWeeklyOffDays JSONB, payrollDaysBasis ENUM(CALENDAR/WORKING/FIXED_30) |
| `Payslip` | `payslips` | agencyId, agentId, periodMonth "YYYY-MM", baseSalary, earnings JSONB[{label,amount}], deductions JSONB[{label,amount}], paidDays, unpaidDays, lossOfPay, grossPay, netPay DECIMAL, status ENUM(DRAFT/FINALIZED/PAID), notes — unique (agency,agent,period) |

## Backend API (`/api/hrm`)

**Self-service** (`authenticate` + `HRM_VIEW`):
- `GET  /me` — my profile, today's attendance, leave balances
- `POST /attendance/punch-in`, `POST /attendance/punch-out`
- `GET  /attendance/me?month=YYYY-MM` — my timesheet
- `GET  /leaves/me`, `POST /leaves` (request), `DELETE /leaves/:id` (cancel own pending)
- `GET  /leave-types` (active, for the request form)

**Management** (`authenticate` + `HRM_MANAGE`):
- Employees: `GET/POST /employees`, `GET/PATCH /employees/:id`
- Attendance: `GET /attendance?date=&month=`, `POST /attendance` (manual), `PATCH /attendance/:id`
- Leaves: `GET /leaves?status=`, `PATCH /leaves/:id/approve`, `PATCH /leaves/:id/reject`
- Leave types: `GET/POST /leave-types`, `PATCH/DELETE /leave-types/:id`
- Holidays: `GET/POST /holidays`, `DELETE /holidays/:id`
- Settings: `GET /settings`, `PATCH /settings`
- Payroll: `GET /payroll?month=`, `POST /payroll/generate` (month), `PATCH /payslips/:id`,
  `POST /payslips/:id/finalize`, `POST /payslips/:id/mark-paid`

Standard stack per route: `authenticate → requirePermission → validateBody(zod) → controller → service`.
Controllers thin, return `{ success, data, message }`, scope by `req.agency.id`.

## Core logic (pure, unit-tested in `hrmCalc`)

- **Late detection:** punchIn time-of-day > workdayStart + grace → isLate.
- **Worked minutes:** punchOut − punchIn (null until punch-out).
- **Working days in month:** calendar days minus weekly-offs minus holidays (per payrollDaysBasis).
- **Payroll per employee for month:**
  - perDay = baseSalary / (basis: working-days | calendar-days | 30)
  - unpaidDays = absent + unpaid-leave days (half-days count 0.5)
  - lossOfPay = round(perDay × unpaidDays)
  - gross = baseSalary + Σ earnings; net = gross − lossOfPay − Σ deductions
  - Produces a DRAFT payslip; admin can edit earnings/deductions, then finalize → mark-paid.

## Frontend (React + Tailwind + Headless UI + React Query, responsive-first)

Single `/hrm` page with tabbed sub-navigation (mobile = bottom tab bar / segmented control, desktop = side tabs):

1. **My Space** (all staff): big live-clock punch card (Punch In/Out), today status, my month timesheet
   calendar (color-coded), my leave balances + "Request Leave" slide-over.
2. **People** (manage): employee list → HR profile editor (department, salary, weekly offs, etc.).
3. **Attendance** (manage): day view grid + month calendar, inline correct/mark.
4. **Leaves** (manage): approval queue with approve/reject.
5. **Payroll** (manage): month picker → generate → payslip table → payslip detail (printable).
6. **Settings** (manage): work hours/grace, weekly offs, leave types, holiday calendar.

UI/UX: status pills, color-coded calendar, slide-over forms (Headless UI Dialog), optimistic punch,
toast feedback, skeleton loaders, empty states. Built with `frontend-design` skill for polish.

## Schema provisioning

- Dev: `sequelize.sync()` auto-creates the new tables.
- Prod: add `ensureHrmTables()` to `schemaBootstrap.ensureProductionSchema()` (idempotent createTable + indexes).

## Testing

- Unit: `hrmCalc` pure functions (late, worked minutes, working-days, payroll math, leave day count).
- Integration (smoke): punch-in/out flow, leave request→approve, agency scoping, payroll generate.
- Verify: backend boots + syncs, frontend builds.
