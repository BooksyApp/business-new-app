# CODEMAP — apps/mobile (read this FIRST; open only exact line ranges)
Expo SDK 57, expo-router (`app/`), `@/` = `src/`. i18n: AZ default; strings via `t('key')` from `@/i18n`
(tables az.ts/en.ts/ru.ts + extension files biz, extra, more, ob, par, ux, v2, v3 merged in `src/i18n/index.ts`).
tsc: symlink customer-new-app/node_modules into apps/mobile (gitignored, remove after); never npm install.

## Routes (app/) -> screen file, key parts, api calls
| Route | File | Key components | API |
|---|---|---|---|
| tabs shell | app/(tabs)/_layout.tsx | tab bar, dock | - |
| Bu gün | app/(tabs)/today.tsx + components/TodayHome.tsx, SetupChecklist, LocationCard | hero next-booking, pending, stories | api.appointments, confirmAppointment, clientsWithStats, staff, apiX.stories |
| Təqvim ('Ümumi' header pill -> components/CalendarOverview.tsx: all-staff day grid + Gün/Həftə) | app/(tabs)/calendar.tsx + components/calendar.tsx (DayStrip, Timeline, Agenda, WeekView, StaffRail, MonthView) | BlockTimeSheet, BookingSheet | api.appointments, clientsWithStats, staff, timeOffOn |
| Müştərilər (one chip row: Hamısı/Yeni/Daimi/İtirilmiş; profile = ONE tab row Rezervlər/Qeydlər/Haqqında; notes add/edit/delete via api.updateClientNote/deleteClientNote; no edit, no delete; block/unblock only; import add-only) | app/(tabs)/clients.tsx | AddClientSheet, ImportSheet, rememberClients | api.clientsWithStats |
| Looks | app/(tabs)/looks.tsx + screens/Looks.tsx | | api.services, apiX.looks/reviewSummary/stories |
| Daha çox | app/(tabs)/more.tsx | sections grid, day sheet | api.daySheet, staff |
| Booking detail | app/booking/[id].tsx | BookingSheet (components/BookingSheet.tsx: BookingSheet, Reschedule, WaReminder) | api.appointment/confirm/complete/noShow/cancel |
| New booking | app/booking/new.tsx, classic.tsx (calendar-style, combos) | | api.slots, createAppointment, createClient, apiM.combos/bookCombo |
| Bookings list | app/bookings.tsx (BookingRow) | | api.appointments |
| Client profile | app/client/[id].tsx | ClientPackages, (EditClientSheet) | api.clientRecord, addClientNote, apiB.crm/block/unblock/balance/settle/loyalty/setVip, apiX.clientConsents |
| Notifications/inbox | app/notifications.tsx | WaitlistSheet | api.appointments, confirmAppointment, waitlist, apiB.inbox/readInbox, apiX.hubEvents |
| Section host | app/section/[key].tsx -> screens/* (switch on key) | | see below |
| Auth | login.tsx, register.tsx, forgot.tsx, accept-invite.tsx, create-business.tsx, salons.tsx, index.tsx | | apiO.* (api-onboard.ts) |
| Stories/posts | story/create.tsx, story/view.tsx, post/[id].tsx, post-stats/[id].tsx | | apiX |
| Root | app/_layout.tsx | ToastHost, PermissionIntro, Opening, crash boundary, demo | - |

## Booking flow (wave 4)
- Statuses: PENDING (Təsdiqlə / Rədd et) -> CONFIRMED (primary 'Bitir və ödəniş al' = components/CheckoutSheet.tsx: CheckoutSheet / CheckoutBody -> apiX.confirmPayment, COMPLETED+PAID in one step; '...' = 'Ödənişsiz bitir'; Köçür, Gəlmədi, Ləğv et). No arrived/late states.
- BookingSheet embeds CheckoutBody as a step (no nested Modal). booking/[id]?checkout=1|reject=1 auto-opens checkout / reject sheet.
- Manual confirmation setting: Profile.tsx radio cards -> apiB.bookingSettings/saveConfirmation (GET/PUT /businesses/{b}/settings requireConfirmation). Today pending card + notifications.tsx 'Yeni rezerv təsdiq gözləyir'.
- Looks header 'Saxlayanlar': apiX.favoritesSummary (GET /businesses/{b}/favorites/summary).
- Slot step: Profile.tsx 'Onlayn rezerv' chips 5..30 -> apiB.saveSlotInterval (PUT /settings slotIntervalMinutes). Cleanup time = Services.tsx paddingAfter field (bookingInterval field removed); add-on duration in ServiceExtras.tsx Addons.
- Slot pills = backend availableSlots as-is (no device generation): new.tsx (merged per-staff) + classic.tsx TimeStep; empty -> n4.noFree + 'Növbəti boş gün' button from nextAvailableDate.
- 409 friendly text: src/lib/booking-errors.ts `bookingErrorText(e)` (codes/conflict types -> n4.c* keys in v4.ts); override Alert (askOverride) kept.
- i18n for wave 4: src/i18n/v4.ts (namespace n4).

## screens/ (section keys in app/section/[key].tsx)
Services, Groups, Promotion, Suppliers, Combos, Inventory, Expenses, Marketing, Finance, Payroll, Roles, Integrations,
CustomReports, Profile, Support/Offers/Branches/OnlineShop/RotaView (More2.tsx), Reports, Reviews, Messages, Sales (till list),
Settings (Settings.tsx + SettingsMore.tsx: HoursEditor, NotifEditor, SubscriptionCard, PushPrefsEditor), Team,
HubExtras.tsx (ResourceTypes, RevenuePlan, LoyaltyCards, NotifTextsEditor, PortfolioSheet, ChairRentSheet, FeedSheet, GallerySheet),
ServiceExtras.tsx (Packages, Addons), NewSale.tsx (till; ItemPicker/ClientSelect in SalePick.tsx).

## API layer (src/lib)
- api.ts: `request<T>`, `requestList<T>` (unwraps {content}/arrays), `cleanBooking`, `validId`, `api.*` core (bookings, staff, services, clients, notes, waitlist, daySheet, device token). Types: Appointment, Client, ClientNote, ClientRecord, ApptStatus.
- api-ext.ts `apiX`: stories, looks, reviews, `confirmPayment` (POST /payment-confirmation, SaleBody), sales, clientCrm/tags/fields, updateClient (do NOT use), hubEvents.
- api-biz.ts `apiB`: business profile, onlineSales (GET/PUT /businesses/{b}/online-sales), inbox, client crm/block/unblock/balance/settle.
- api-hub.ts `apiH`, api-more.ts `apiM` (deleteClient - unused, import preview/run, combos, time-off), api-onboard.ts `apiO`.

## Shared primitives
- components/kit.tsx: T, Title, TopBar, BackBar, SecHead, Card, Pill, Button, Chip/ChipRow, Avatar, ListItem, KV, Segmented, Field, Toggle, CtaBar, EmptyState, Skeleton, Tile, UnderTabs, Stars, BarRow.
- components/ui.tsx: Screen, Header, SearchBar, ListRow, Hero, Btn, Field, Pill, Row, StateView, ErrorState, Chip, HeroCard, StatCard, Section, StickyCta.
- components/form.tsx: ToggleRow, Choice, MultiChoice, TabBar, Line. BottomSheet.tsx (modal sheet; bumps modalCount so a local toast shows). 
- lib/toast.ts `toast(text, kind)`; ToastHost.tsx root host; modals must render their own ToastHost.
- PermissionIntro.tsx `askWithIntro`; lib/pick.ts (pickImage/uploadPicked/pickAndUpload); lib/push.ts (Expo push register + notification tap routing); lib/useLoad.ts `useLoad(fn, deps)`; lib/client-cache.ts (client list -> profile hand-off); lib/app.tsx (session/salon context); lib/format.ts; lib/day.ts.
- Demo: src/demo/index.ts (fetch interceptor, writes = no-op toast), fixtures.ts (routes: regexes -> data), live.ts.
- ScreenError.tsx error boundary wraps every screen.

## Conventions
- Always `cleanBooking` before POST/PUT /bookings. Lists via `requestList`. No Alert for feedback: `toast`.
- Backend contract: API-CONTRACT.md. Customers are platform-wide: salon may only add notes + block (see client profile).
