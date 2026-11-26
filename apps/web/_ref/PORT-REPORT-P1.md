# PORT-REPORT P1

Frames used: BF45 (Mesajlar), BF46/BF47 (Kassa/Əməliyyatlar), BF48 (Müştəri siyahısı, add/import). INDEX block ids are approximate (BF45 is mainly waitlist; Mesajlar is its 10th frame).

## Ported
- InboxPage: PageHead, `.a-two/.a-lst/.a-av/.pill`, `.a-msg(.me/.fail)`, kit Field/Btn/EmptyState; report form is now kit Dialog (was inline panel).
- ClientCrmFilters: Toolbar + Field(sel) + Btn.
- ClientImportDialog: kit Dialog, Tiles, Field(sel), DataTable, Note, EmptyState-style upload zone (kit Dialog has no Escape/focus trap, unlike Radix).

## Partial
- SalesPage: header (PageHead + SegPills), transactions tab (Tiles, DataTable desktop, StatusPill, Tag, EmptyState, Skeleton). Kassa catalogue/basket/tenders, paid-receipt screen, mobile list, transaction FormSheet: NOT restyled (heavy bespoke Tailwind, no safe 1:1 mapping blind).
- ClientsPage: PageHead, search (`.srch`), segment chips, density SegPills, empty/loading states, Add-client dialog (kit Dialog + Field + FormGrid). NOT restyled: sortable client table, invitation dialog (Radix Select portals would sit under the kit dialog), client card Sheet + tabs (+ClientFieldsSection etc.), SharedClientsPanel.
- SaleRefundDialog: kept Radix Dialog (it opens above a Radix FormSheet; kit Dialog would be unclickable under Radix pointer-events lock); body uses kit Tiles/Note/SegPills/Chip/Field/RowItem/Btn.

## Skipped
- AppointmentModal, WaitlistAddDialog, BookingConflictDialog: live in `components/calendar/*` (off-limits). New/edit booking form: inside CalendarPage.tsx (off-limits).
- BenefitsAndTenders (components/checkout): not touched.

## Does not fit artifact structure
- Sales: till basket/tenders split-payment UI, gift-card/membership/package tender rows, ticket mobile sheet.
- Clients: density "detailed" extra columns, sortable headers, per-row status chip, client-card tabs.
- Inbox: customer email shown as subtitle under name in thread header (artifact has name only).
