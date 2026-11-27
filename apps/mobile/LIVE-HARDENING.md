# Live response hardening (0.7.x field report)

Method: backend source read (BookingController.BookingRequest, TimeOffController/CreateTimeOffRequest, LooksService, StoriesService, ReviewController, BusinessClientDirectory, GlobalExceptionHandler, IdOfJsonModule). The `?mock=live` web harness (`src/demo/live.ts`, real-shaped JSON) was added, but the dev Metro would not hot-reload the new variant in this sandbox (could not restart it), so screens were NOT exercised against it; verification is tsc + source reading. Nothing was read from or written to staging.

| Screen | Endpoint | Issue | Fix |
|---|---|---|---|
| Vaxtı blokla (Bu gün "+", Təqvim menu) | none (UI) | Sheet launched from another sheet: `setQuick(false); setBlock(true)` presents a 2nd RN Modal while the 1st is still dismissing; iOS drops it silently, so the sheet "did not open". | `BottomSheet` serialises: a sheet waits until closing sheets are gone (+160 ms settle, 900 ms cap). `BlockTimeSheet` also tolerates staff arriving late (`who` fallback). |
| Vaxtı blokla save | POST /api/time-off | Body already matches CreateTimeOffRequest (ids, ISO date, HH:mm, isFullDay). | none |
| Görünüşlər tab | GET /businesses/{id}/looks, /stories, /reviews/business/{id}/summary, /services | Not reproducible from source (DTO shapes match). Fragile points: `null`/non-array bodies, `average` not a number, one render error blanking the tab (red crash page). | `requestList` + `reviewSummary` normalisation; per-route error boundary with retry. |
| Rezerv yarat (new + classic) | POST /api/bookings | Picker sent `clientId: "null"/"0"/"new-123"` for guest rows (backend `clientId` has no row: id null/0) and `staffId` non-id. IdOf deserialiser rejects non-id strings -> 400 "Malformed or invalid request". | `cleanBooking()` in api.ts: ids only if UUID/positive number, staffId 0 = unassigned, price number, HH:mm only, empty optionals dropped; guests/walk-ins sent by name/phone/email; picker passes phone/email. Combo (/bookings/package) body cleaned the same way. |
| Toasts for 400 | any | Generic "Malformed or invalid request" hid the cause. | core.ts appends fieldErrors/errors and "(HTTP 400)". |
| All list endpoints (api, api-ext, api-biz, api-more, api-hub, api-onboard: 69 calls) | GET lists | `null`, paged `{content/items/data/results}` or error object broke `.map`. | `requestList<T>` always returns `T[]` without null rows. |
| Bu gün | day-sheet, readiness, inbox, unread-count, hub-events | object bodies could be `null`/missing fields. | normalised at API layer (numbers coerced, arrays default `[]`). |
| Təqvim / Müştərilər / Daha çox / pushed screens | analytics dashboard, reviews | same | dashboard normalised; every route file exports `ErrorBoundary` (kit EmptyState + "Yenidən cəhd et") via `components/ScreenError.tsx`. |
| All buttons | UI | `numberOfLines={1}` + fixed height cut "Rezerv et" etc. | kit `Button`, ui `Btn`: minHeight, 2 lines, `adjustsFontSizeToFit` (0.85), padding 16-20, minWidth 0; `StickyCta` stacks two long labels; Segmented shrinks; classic.tsx dark-bar action no longer squeezed. |

Open: item-level field renames inside screens (e.g. `.average.toFixed`) were not individually audited for every pushed screen; the boundary keeps a failure to one screen.
