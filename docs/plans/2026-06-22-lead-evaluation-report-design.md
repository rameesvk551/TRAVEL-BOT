# Lead Evaluation Report — Design

Date: 2026-06-22

## Purpose

Replace the existing bulk lead export (PDF + Excel) with a clean, status-grouped
report built purely for **evaluation** — judging how well leads are being worked:
were follow-ups scheduled, were they completed, and were they completed on time.

The current export at `backend/src/services/leadReportService.ts` already carries
the right data but presents it as one flat, cluttered list. The complaint is
presentation ("looks bad / messy"), not missing data.

## Scope of change

Single file: `backend/src/services/leadReportService.ts`. Controller, routes,
endpoints and frontend buttons are unchanged — same `generatePdfReport` /
`generateExcelReport` signatures, same `fetchAllLeadsForReport`.

## Grouping

Leads are grouped into sections **by status**, in pipeline order:

```
NEW, JUST_CONTACTED, PACKAGE_SEARCHED, PACKAGE_INTERESTED, ENQUIRY,
CONTACTED, QUOTED, NEGOTIATING, BOOKED, CONVERTED, LOST, CANCELLED, UNKNOWN
```

Empty statuses are skipped. Each section header shows the status label and lead
count. Within a section leads keep the fetched order (newest first by default).

## Per-lead block (lean — evaluation fields only)

- Header: lead name + status badge
- Identity row: phone · place · destination · source · first contact
- **Scheduled Follow-Ups** (status = Scheduled): scheduled date/time · note.
  Flagged **OVERDUE** when the scheduled time is in the past.
- **Completed Follow-Ups** (status = Done/Cancelled): scheduled time → actual done
  time · note · **On-time / Late (N)** marker.
- **Notes** (manual only): date · content. Auto bot-messages excluded via
  `isManualNote()` (prefixes like "Lead status updated", "Follow-up assigned").

Deliberately removed to reduce clutter: **all agent/staff fields** (assigned-to,
follow-up agent, note author), call logs, lead score, tags, campaign,
budget/value, and the global status/source breakdown badge rows. This report
evaluates the lead, not the agent.

## On-time vs late

`completionTime = updatedAt` (the time status moved to Done/Cancelled — same
approximation the current report uses). Compared to `scheduledAt`:

- done at/before scheduled → **On-time**
- done after scheduled → **Late (N days)** (or hours when < 1 day)

Overdue = still Scheduled and `scheduledAt < now`.

## Outputs

- **PDF**: redesigned, status-grouped, clean cards, split follow-up tables, late marker.
- **Excel**:
  - Summary sheet keeps key totals.
  - Lead Details trimmed to evaluation fields, with a Status column. No agent columns.
  - Follow-Ups sheet sorted by status group, with `Scheduled` / `Completed On` /
    `Timeliness` (On-time / Late N / Overdue) columns. No agent column.
  - Notes sheet: manual notes only, no author column.
