# Accounting Module — Design (2026-06-14)

Best-in-class accounting workspace for the travel agency, exposing the existing
double-entry backend through a polished, single-route tabbed UI. Centerpiece is
an expandable Chart of Accounts tree.

## Scope

- Full module, single `/accounts` route, top tab bar.
- VAT report **excluded** (per user).
- One backend change only (tree balances); everything else reuses existing endpoints.

## Backend (one change)

`getLedgerTree(agencyId, { withBalances, dateFrom, dateTo })`:
- Existing `GET /accounts/ledgers/tree` gains optional query params — backward compatible.
- One pass over `JournalLine` (date-filtered) → per-ledger `{ debit, credit, balance }`.
- Recursively attach to tree nodes; group nodes get rolled-up `rollup { debit, credit, balance }`.
- Amounts stay integer paise.

No model/schema changes. Attachments use existing `JournalEntry.metadata` JSONB
(`metadata.attachments = [url...]`) via the existing media upload service.

## Tabs

### 1. Overview
KPI stats (cash, receivables, payables, net profit MTD) + unpaid bookings +
recent journal entries. Upgrades current page.

### 2. Chart of Accounts (centerpiece)
Renders raw parent→child hierarchy from `getLedgerTree` (roots = `BS`/`PL`,
then sub-groups, then G-groups, then leaf accounts).
- Folder icon = group (`isGroup`), file icon = leaf.
- Dotted indent guide-lines; chevron expand/collapse per node.
- Always-visible green `+` on group rows (add child); pencil / merge / trash on
  hover for editable (non-system) rows.
- Right-aligned balance column (Dr/Cr, color-coded; bold rollup on groups; hidden
  when zero). Toggleable for a clean look.
- Expand all / Collapse all; live search (auto-expands matching branches).
- As-of date + period range → re-fetch balances.
- Click leaf → slide-over ledger statement (journal lines + running balance) via
  `getLedgerReport`.
- Add ledger uses `getNextLedgerCode` (auto-code) + opening balance.
- Delete pre-checks `canDeleteLedger`; Merge picks a target.
- "Seed defaults" when empty.
- Top strip: total Assets / Liabilities / Equity + Balanced ✓/✗.

### 3. Journals
Toolbar with distinct actions: **All Journal Entries** (default list),
**+ Receipt**, **+ Payment**, **+ Expense Voucher**, **+ Journal Entry** (bulk).
- List: period chips (Today / Month / FY / Custom) + month/year dropdowns +
  search (reference, description, ledger name). Columns: Reference # / Date / Type / Description.
- **Bulk Journal Entry editor**: date; multi-line rows (Ledger select w/ current
  Balance, Credit, Debit, remove); Add Line; live Total Debit / Total Credit /
  Difference (green when 0); narration; image dropzone (attachments). Posts to
  `POST /accounts/journal-entries`.
- **Receipt / Payment / Expense** = guided 2-line builders that construct the
  balanced debit/credit pair, posting to `/receipts`, `/payments`,
  `/expense-vouchers` (all accept `journalSchema`).

### 4. Invoices
Invoices + credit notes lists; create credit note modal; per-customer statement
slide-over (`getPartyStatement`).

### 5. Reports
Trial Balance, structured P&L, Balance Sheet (`isBalanced`), Aging, Cash Flow.
Shared date-range picker. No VAT.

## Shared UI kit
`Tabs`, `TreeNode`, `SlideOver`, `Money`, `DrCrBadge`, `PeriodPicker`,
`LedgerSelect` — Tailwind, matching existing neutral/emerald palette. Currency
from agency setting.

## Verification
- Backend: `node --check` on changed files; manual balance roll-up sanity check.
- Frontend: `vite build`.
- No live DB test harness exists (note from prior work).
