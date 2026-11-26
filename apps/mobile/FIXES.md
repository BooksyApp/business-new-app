# Pre-release fix list (business app, native)

Status: DONE = implemented and type-checked; STUB = native placeholder, needs backend/data; NOTE = caveat.
Verification so far is by code reading plus `tsc` (no device run, no screenshots).

## A. Frame fidelity
1. DONE Clients list: five segment chips (all / new / regular / 60+ days away / no visits), computed from the client stats the list endpoint returns.
2. DONE Clients list: stats strip (clients, returning, average spend).
3. DONE Clients list rows: avatar photo when present, New/Regular/Away pill, next visit line, visits and spend.
4. DONE Add-client bottom sheet (BF48 form): name, phone, e-mail, two consents; needs phone or e-mail.
5. DONE Clients empty / no-result / error / offline states with actions, skeleton, pull-to-refresh.
6. DONE Client card: contact actions, stats (visits, spent, average check, last/next visit, favourites, no-shows), notes (add only), history, error state.
7. DONE Client card: "new appointment" opens the booking flow with the client preselected.
8. DONE Login: show/hide password, keyboard next/go, error haptic and alert role. Salon picker: selection haptic.
9. DONE Tab badges: bookings waiting for confirmation + waitlist on the Alerts tab (refresh after every mutation).
10. DONE Alerts: inline "Confirm" on pending bookings, tap opens the booking sheet, waitlist rows with the user-plus icon.
11. DONE More: takings row opens Sales, profile row opens Settings, pull-to-refresh.
12. NOTE Bottom sheets: one shared draggable sheet is used by every new sheet; no per-frame pixel check was possible without a device.

## B. Icons and photos
13. DONE Five real sprite icons added to the shared icon set and regenerated: user-plus, user-check, clock-alert, note, check-badge (copied from apps/web/src/bz-static/Sprite.tsx). Tile markers now use note, user-check, check-badge, clock-alert.
14. DONE Avatar shows the photo (staff, clients) with initials fallback if the URL is missing or fails.

## C. Calendar
15. DONE Week view (Həftə): seven day columns on one hour scale, staff filter applies, header tap opens the day.
16. DONE Staff filter chips (Day / Week / Everyone / each master) visible by default, toggle on the sliders button.
17. DONE Block time: new sheet (master, whole day or from-to, reason) creates an approved time-off; blocks draw on the day timeline; tap one to remove it.
18. DONE New booking: multi-service (booked back to back).
19. DONE New booking: repeat (weekly / every 2 weeks / monthly, 2-12 times) with a per-date failure report.
20. DONE New booking: conflict message with "confirm anyway" when the server marks it overridable.
21. DONE New booking: inline client creation kept in the client step; client preselect from the client card.
22. DONE Mark completed (button in the booking sheet) - needs the backend endpoint below.

## D. Real screens instead of "Tezliklə"
23. DONE Services: list, on/off switch, edit price and duration.
24. DONE Team: staff list with photo, position, role, contact actions.
25. DONE Sales: day switcher, day total, sale rows (read only).
26. DONE Messages: inbox, thread, reply (endpoints exist in the web service).
27. DONE Settings basics: salon details (read only), language, push, account, sign out.
28. KEPT native Tezliklə: Looks (views) and Reviews (no mobile endpoints wired).

## E. Backend
29. DONE `PUT /api/bookings/{id}/complete` added in booksy-backend (state machine already allowed it).
30. NOTE Notifications inbox: no server inbox exists; Alerts stays derived (pending bookings + waitlist). Visit count / average check / favourites exist on the client list (wired). VIP and a client-level "new" marker are not in the booking payload: calendar tile markers for new/returning/VIP stay hidden (STUB). Online marker now matches any `web*` booking_source.

## F. Quality
31. DONE i18n AZ/EN/RU for every new string (src/i18n/extra.ts plus inserted keys).
32. DONE Accessibility labels on new buttons, switches, tiles, badges; offline banner has role alert.
33. DONE Haptics on create/confirm/complete/add/send and errors.
34. DONE Keyboard handling: sheets use the animated keyboard offset, thread and booking flow use KeyboardAvoidingView.
35. DONE Offline banner (any failed network call shows it, the next answered call hides it).
36. DONE 401 refresh: one rotating-refresh retry already lives in api.ts; kept.
37. DONE Deep links: `booqibiz://booking/<id>` and a tapped push open the booking sheet; other pushes open Alerts.
38. DONE Push token: sent silently after sign-in when permission is already granted; the explicit button remains.
39. DONE Hardcoded colours moved to theme tokens (gradients, action bar, wordmark); remaining literals are white on violet and the tile palette in the calendar.
