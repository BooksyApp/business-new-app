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
| Registration Step 1 (account) | ✅ fixed (#4) | Password fields weren't in a `<form>`; fixed in PR #5 (merged). |
| Registration Step 2–6 (business/location/team/etc.) | 🔴 open bug, see #6 | Completing the wizard creates **two** businesses per signup, not one — see #6, not yet fixed (needs a paired backend DTO change, see booksy-backend's QA-LOG). |
| Login (`/login`) | ✅ verified 2026-09-04 | Re-logged-in with the QA test account after logout — 0 console errors, correct redirect to "Select Business". |
| Logout | ✅ verified 2026-09-04 | Clean redirect to `/login`. |
| Calendar (`/​{businessId}/calendar`) | ✅ fixed (#3) | `appointmentService.ts` was calling nonexistent `/api/appointments/**`; fixed in PR #5 (merged) to hit `/api/bookings/**`. Not yet re-verified live with real appointment data. |
| Realtime (WebSocket) | ✅ fixed, backend-side (booksy-backend#449) | Not re-verified live after deploy. |
| Staff / Services / Clients / Sales checkout / Analytics / Business Hours settings UI | ⬜ not yet tested | Next up. |

## Known issues filed (frontend root cause)

| Issue | Severity | Summary | Status |
|---|---|---|---|
| [#3](https://github.com/BooksyApp/salon-hub/issues/3) | critical | `appointmentService.ts` called `/api/appointments/**` (doesn't exist) instead of `/api/bookings/**` — calendar couldn't load/create/edit/cancel anything | Fixed, PR [#5](https://github.com/BooksyApp/salon-hub/pull/5) merged 2026-09-04 |
| [#4](https://github.com/BooksyApp/salon-hub/issues/4) | low | Registration Step 1 password fields not wrapped in a `<form>` | Fixed, PR [#5](https://github.com/BooksyApp/salon-hub/pull/5) merged 2026-09-04 |
| [#6](https://github.com/BooksyApp/salon-hub/issues/6) | critical | Every registration creates two businesses (backend auto-creates one via `/api/auth/register/business`, frontend redundantly `POST`s a second instead of `PUT`-ing the first) | Open — not fixed yet, needs a small paired backend change (see booksy-backend QA-LOG "Open backend-side gap") |

## Reproduction data still on the VPS

Test account `qa-test-2026090401@booksy-test.dev` / business owner id 1 — live proof of
#6 (two businesses, ids 1 and 2, both "QA Test Salon 04-09"). Left in place
intentionally as evidence; clean up once #6 is fixed and verified.
