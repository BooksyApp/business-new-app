# Live QA log — frontend

Findings from exercising the deployed manager site (`https://srv1946733.hstgr.cloud`)
with a real browser, cross-checked against `booksy-backend` source + VPS server logs
where the root cause needed confirming. Kept so a later session can read this instead
of re-running a full live pass. Update this file (not just the GitHub issue) whenever a
finding here gets fixed or a new one surfaces — one line per finding, most-recent flow
first.

See also: [`booksy-backend/docs/QA-LOG.md`](https://github.com/BooksyApp/booksy-backend/blob/main/docs/QA-LOG.md)
for backend-only findings from the same passes.

## Status by flow

| Flow | Status | Notes |
|---|---|---|
| Registration (all 6 steps) | ✅ verified 2026-09-04 | Fresh account end to end, deliberate (non-rapid) clicks — no auto-skip, no duplicate business. DB-checked: exactly 1 business row, all fields populated. |
| Login (`/login`) | ✅ verified 2026-09-04 | Fresh account, 0 console errors, correct redirect. |
| Logout | ✅ verified 2026-09-04 | Clean redirect to `/login`. |
| Calendar data load | ✅ verified 2026-09-04 | `GET /api/bookings/business/{id}` → 200, `WebSocket: 🟢 Connected` badge showing on the page. |
| Sidebar — owner profile / Switch Business | ✅ verified 2026-09-04 | Avatar shows real initials ("NM"), "Switch Business" button present and working. |
| Add Business (`/create-business`) | ⬜ not yet re-verified live | Built this session (category/address/map/phone form, not a bare-name stub) — needs a live click-through pass. |
| Staff — add / edit / assign a service | ✅ fixed + verified 2026-09-04 | #13's fixes re-verified live end to end: WORKING HOURS tab now shows real saved hours (not fake defaults), Save persists correctly without touching email/phone/position, Permission Level loads/saves the real role, Edit dialog's Services checklist now loads/saves real assignments. |
| Services — create a service | ✅ verified 2026-09-04 | 0 console errors. **But** every price shown uses a hardcoded "zł" (Polish złoty) regardless of the business's real currency — see #12. |
| **Domain check: staff working hours → calendar booking** | ✅ verified 2026-09-04 | Per explicit instruction to verify domain effects, not just DB writes: a staff member's personal hours (09:00–17:00) correctly override/gate independently from business hours (10:00–19:00) at booking-creation time. Tested via direct API: an 18:00 booking for that staff member → `422 "Requested time is after the staff member finishes work (17:00)"` even though the business itself is still open; an 11:00 booking → `201` success. `BookingScheduleValidator` (backend) is correctly wired to `StaffWorkingHours`. |
| **Domain check: commission rule → earnings** | ⚠️ calculation correct, never shown — see #15 | Set a 10% commission rule, confirmed a real $80 sale for that staff member → DB shows a `commissions` row with `commission_amount = 8.00` (exactly right). But nothing in the UI ever displays earned/pending commissions (the COMMISSIONS tab only manages rules), and walk-in Quick Sales default to `staff[0]` — not necessarily who performed the service — for commission attribution. |
| Clients / Sales checkout (beyond payment-confirmation) / Analytics / Business Hours settings UI | ⬜ not yet tested | Next up. |

## Known issues filed (frontend root cause)

| Issue | Severity | Summary | Status |
|---|---|---|---|
| [#3](https://github.com/BooksyApp/salon-hub/issues/3) | critical | `appointmentService.ts` called `/api/appointments/**` (doesn't exist) instead of `/api/bookings/**` | Fixed, PR [#5](https://github.com/BooksyApp/salon-hub/pull/5) merged |
| [#4](https://github.com/BooksyApp/salon-hub/issues/4) | low | Registration Step 1 password fields not wrapped in a `<form>` | Fixed, PR [#5](https://github.com/BooksyApp/salon-hub/pull/5) merged |
| [#6](https://github.com/BooksyApp/salon-hub/issues/6) | critical | Every registration created two businesses (backend auto-creates one, frontend redundantly `POST`ed a second instead of `PUT`-ing the first) | Fixed, PR [#8](https://github.com/BooksyApp/salon-hub/pull/8) + booksy-backend PR [#453](https://github.com/BooksyApp/booksy-backend/pull/453), both merged. Re-verified live 2026-09-04 with a fresh account (DB-checked: 1 row). |
| [#9](https://github.com/BooksyApp/salon-hub/issues/9) | mixed | No owner profile in sidebar (dead "THEM" placeholder); no way back to "Select Business"; no "Add Business" option; login corrupted the stored `user` object | Fixed, PR [#10](https://github.com/BooksyApp/salon-hub/pull/10) merged. Sidebar avatar/Switch-Business re-verified live 2026-09-04; the Add Business page itself not yet re-clicked live. |
| [#12](https://github.com/BooksyApp/salon-hub/issues/12) | low (cosmetic, not functional) | Every price display hardcodes "zł" (Polish złoty) instead of the business's real `currency` — 139 occurrences across 21 files | Open — deliberately deferred (too large to blanket-fix mid-QA-pass without sign-off); scoped fix described in the issue |
| [#13](https://github.com/BooksyApp/salon-hub/issues/13) | **critical** (silent data loss) | Staff detail's "WORKING HOURS" tab read a field the backend never sends, so it always showed fake data; its Save button sent the wrong field name, which the backend's replace-semantics turned into deleting all working hours — plus nulled email/phone/position. Also: Permission Level was decorative; two "visibility" checkboxes did nothing; "SHOW CALENDAR" badge was a hardcoded literal 5. | Fixed, PR [#14](https://github.com/BooksyApp/salon-hub/pull/14) + booksy-backend PR [#454](https://github.com/BooksyApp/booksy-backend/pull/454), both merged. Re-verified live 2026-09-04 (see Status-by-flow above), including the working-hours→calendar domain effect. |
| [#15](https://github.com/BooksyApp/salon-hub/issues/15) | medium | Walk-in Quick Sales silently defaulted commission/staff attribution to `staff[0]`. | Fixed, PR [#18](https://github.com/BooksyApp/salon-hub/pull/18). Surfacing (the other half of this issue) fully resolved via #17's fix. |
| [#16](https://github.com/BooksyApp/salon-hub/issues/16) | low | "Copy Schedule" gave a false-success toast for an unsaved change. | Fixed, PR [#18](https://github.com/BooksyApp/salon-hub/pull/18). The bigger product question in this issue (unused `Shift` feature, `/api/shifts/**` fully built but dead) is still open — not addressed, needs a product decision first. |
| [#17](https://github.com/BooksyApp/salon-hub/issues/17) | high (crashed the page) | Two bugs, not one: (a) the actual crash — `getTotalPendingCommission` fetched `{totalPending: N}` typed as bare `number`, so `.toFixed()` on the resulting object threw mid-render; (b) a real, separate backend gap — no `commission_payments` table/endpoints ever existed for recording a payout, despite `commissions.payment_id` referencing one since V1 and the frontend's "Create Payment" dialog already being built against the exact contract. | Both fixed. (a): PR [#19](https://github.com/BooksyApp/salon-hub/pull/19). (b): booksy-backend PR [#455](https://github.com/BooksyApp/booksy-backend/pull/455) (new table + `CommissionPaymentService`/`Controller`, boot-verified against real Postgres). |

Also fixed this round, prompted by live feedback that staff working-hours defaults were hardcoded instead of matching the salon's own hours: `AddStaffPage.tsx` now seeds a new staff member's schedule from the business's real hours (`useBusinessHours`); the WORKING HOURS tab's placeholder start/end for an unconfigured day does the same. Same PR [#18](https://github.com/BooksyApp/salon-hub/pull/18).

## Reproduction / test data still on the VPS

- `qa-test-2026090401@booksy-test.dev` (owner id 1): the original #6 repro — two businesses (ids 1, 2), both "QA Test Salon 04-09". Safe to delete now that #6 is fixed and re-verified.
- `qa-test-2026090402@booksy-test.dev` (owner id 2, business id 3, "QA Test Salon Two 04-09"): the account used for #6/#13's re-verification and the domain checks above. Staff id 1 ("Aylin Qasimova") now has real contact info + Mon–Fri 09:00–17:00 hours + role MANAGER (restored/set during #13's verification). Also has: 1 confirmed booking (id 1, 2026-09-07 11:00), 1 completed sale (id 1, $80.00), 1 commission row ($8.00, 10% rule), 1 rejected-then-abandoned booking attempt (Saturday, correctly 422'd — no row created). All real, correctly-behaving data — safe to keep or delete.
