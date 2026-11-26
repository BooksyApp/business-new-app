# PORT REPORT P4 (branch feat/port-p4, PR #10 into feat/new-ui)

Method: new kit-backed drop-in layer `src/components/bz/p4-compat.tsx` (+ `p4-kit.tsx`) with the same names/props as the legacy
page template (BooqiScope, PageHeader, EmptyState, StatCard, StatusChip, FilterChips, PeriodPicker, Panel, KpiTile, Empty, pageBody),
emitting kit markup (.mainx, .pgt, .esx, .stl, .st, .chip, .a-card). 30 pages switched by import only, so all logic/hooks/handlers/i18n are untouched.
Beyond that, per page: Skeleton for loading, ErrorState for *loadFailed, StatusPill instead of raw amber/sky/emerald chips, crd2 card wrappers.

## Ported (kit header/empty/tiles/chips/panels + deeper conversion)
- GiftCards: full (DataTable, StatusPill, EmptyState, Skeleton)
- Invoices: full (chips, DataTable, LedgerPill, EmptyState/ErrorState/Skeleton)
- Payments (money): full (chips, Tiles, Cards, RowItem rows, LedgerPill, states)
- Tax: full (Tiles, DataTable, Btn)
- AuditLog: DataTable + Avatar + StatusPill, SectionCard filters
- Reviews: chips filters, fld/sel selects, Skeleton/ErrorState (reply/case flow untouched)
- Support, Referral, Timesheet: status pills/Note on tokens (no raw colours)

## Partial (frame, header, empty, stat tiles, status chips, loading/error on kit; body forms/lists unchanged)
Marketing, Offers, Memberships (loyalty), Passes, PromotionPage (Reklam), Money (tips/cash/more), BooqiPayouts, Profit, Expenses, Analytics,
ReportDetail, ReportBuilder, Looks, SocialImages, Notifications, Help, CentralPrices, BranchComparison, ConsentForms, Photos, ApiDocs, MyDay, Payroll.

## Skipped
- HomePage (`tasks`): does not use BooqiScope/PageHeader; built on ui/Card, left untouched (rewrite too large for this pass, risk of logic change).
- Loyalty/Marketing sub-cards in components/page/* (AutomationCard, LoyaltyTiersCard, BookingLinkCard, MarketplacePromotionCard): outside page files.

## Does not fit / not placed
- FormSheet side sheets (Marketing, Offers, Memberships, Passes, Expenses, Timesheet, Payroll): still legacy radix sheet; kit Sheet/Drawer not wired (focus/validation risk).
- Radix Tabs (Marketing, Money): not replaced by kit Tabs (value/content coupling).
- Page inputs use shadcn Input/Select with fieldCls inside legacy Field; kit Field (.fld) would double borders, so only plain selects/search were moved to .fld.
- Sticky page header dropped (kit .pgt is not sticky).
- Review edit/delete/hide: not added (reply/case only, per rule).
- No real field was removed. CI (typecheck + web build) green on the last commit; no revert needed.
