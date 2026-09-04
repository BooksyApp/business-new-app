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
| Staff — add / edit / assign a service | ✅ verified 2026-09-04 | Created a staff member, edited it, assigned a service to them — all clean, 0 console errors. |
| Services — create a service | ✅ verified 2026-09-04 | 0 console errors. **But** every price shown uses a hardcoded "zł" (Polish złoty) regardless of the business's real currency — see #12. |
| Clients / Sales checkout / Analytics / Business Hours settings UI | ⬜ not yet tested | Next up. |

## Known issues filed (frontend root cause)

| Issue | Severity | Summary | Status |
|---|---|---|---|
| [#3](https://github.com/BooksyApp/salon-hub/issues/3) | critical | `appointmentService.ts` called `/api/appointments/**` (doesn't exist) instead of `/api/bookings/**` | Fixed, PR [#5](https://github.com/BooksyApp/salon-hub/pull/5) merged |
| [#4](https://github.com/BooksyApp/salon-hub/issues/4) | low | Registration Step 1 password fields not wrapped in a `<form>` | Fixed, PR [#5](https://github.com/BooksyApp/salon-hub/pull/5) merged |
| [#6](https://github.com/BooksyApp/salon-hub/issues/6) | critical | Every registration created two businesses (backend auto-creates one, frontend redundantly `POST`ed a second instead of `PUT`-ing the first) | Fixed, PR [#8](https://github.com/BooksyApp/salon-hub/pull/8) + booksy-backend PR [#453](https://github.com/BooksyApp/booksy-backend/pull/453), both merged. Re-verified live 2026-09-04 with a fresh account (DB-checked: 1 row). |
| [#9](https://github.com/BooksyApp/salon-hub/issues/9) | mixed | No owner profile in sidebar (dead "THEM" placeholder); no way back to "Select Business"; no "Add Business" option; login corrupted the stored `user` object | Fixed, PR [#10](https://github.com/BooksyApp/salon-hub/pull/10) merged. Sidebar avatar/Switch-Business re-verified live 2026-09-04; the Add Business page itself not yet re-clicked live. |
| [#12](https://github.com/BooksyApp/salon-hub/issues/12) | low (cosmetic, not functional) | Every price display hardcodes "zł" (Polish złoty) instead of the business's real `currency` — 139 occurrences across 21 files | Open — deliberately deferred (too large to blanket-fix mid-QA-pass without sign-off); scoped fix described in the issue |

## Reproduction data still on the VPS

- `qa-test-2026090401@booksy-test.dev` (owner id 1): the original #6 repro — two businesses (ids 1, 2), both "QA Test Salon 04-09". Safe to delete now that #6 is fixed and re-verified.
- `qa-test-2026090402@booksy-test.dev` (owner id 2, business id 3, "QA Test Salon Two 04-09"): the account used for the #6 re-verification and this session's Staff/Services checks — has one staff member ("Aylin Qasimova") and one service ("Haircut & Style") on it. Fine to keep or delete.
