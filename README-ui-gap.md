# UI gap: area C pages vs business-final artifact (feat/new-ui-c)

Method: static scan of every area C page (BooqiScope/PageHeader/EmptyState use, table row padding, legacy colour classes, hex) against `_spec/audit.md` and BF60-BF79. Nothing was run in a browser; field lists and step order were not re-diffed against area-c.md, so the field-level rows below are UNVERIFIED.

| page | mismatch | size |
|---|---|---|
| Timesheet, Payroll, Expenses, CentralPrices, BranchComparison | table cells `py-2`/tight vs roomy rows | S (fixed) |
| Billing | alert boxes `rounded-lg p-3` vs 20px cards | S (fixed) |
| Registration (11 steps) | inline-styled `--reg-*` pages; step order/field list not diffed against BF77 | M (needs visual pass) |
| Billing/plans, Marketing, Memberships, Passes, Offers | long forms are single scroll, artifact uses sections/tabs | M |
| Money, Payments, Invoices, Tax, Profit, Payouts | no EmptyState/error state in file (1 loading/error mention each) | M |
| Reports (Analytics, ReportDetail, ReportBuilder) | ReportDetail/Analytics have no EmptyState | M |
| Reviews, Notifications, Support, Help, ConsentForms, Photos, Looks | no EmptyState; status chips use raw amber/slate/emerald classes instead of tokens | M |
| Tables (Invoices, Tax, Profit, AuditLog, ApiDocs, Timesheet, Payroll) | no avatar + status chip in rows | M |
| Memberships | 7 hard-coded hex colours | S/M (not touched, may be colour pickers) |
| Photos | red/gray utility colours on destructive/overlay buttons | S (not touched: semantic) |
