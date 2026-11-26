# Parity: salon hub (web) vs business mobile app

Sources of truth: `salon-hub/src` (pages, services; current hub), tag `old-web-before-reset` of this repo, backend DTOs in `booksy-backend`.
Status: **done** (field/action works against the real API), **partial** (works, some options missing), **missing** (not in the app), **web** (deliberately web only, reason given).
`new` = added in this pass (commits on `main`, see API-CONTRACT.md for the backend side). Money is a plain number in the salon currency; times are `HH:mm`; dates `YYYY-MM-DD`; ids are opaque strings.

## 1. Onboarding and account (day-1 priority)

| Hub item | Field / action | Type, required | Endpoint, key | Mobile | Where |
|---|---|---|---|---|---|
| Registration step 1 | first name, last name | text, req (owner) | `POST /auth/register/business` `firstName,lastName` | done new | app/register.tsx |
| | email, password (min 8), phone | email req, text req, text opt | `email,password,phone` | done new | register.tsx |
| | terms + marketing opt-in | bool req / bool | `consent{acceptTerms,termsVersion,marketingOptIn,source}` | done new | register.tsx, lib/config.ts TERMS_VERSION |
| | referral code | text opt | `referralCode` | partial (API supported, no input field) | lib/api-onboard.ts |
| Registration step 2 | business name, category (backend list), address, city, phone | text req / enum req / text opt | `PUT /businesses/{id}` `name,category,address,city,country,phone` | done new (street+city as two fields; geocoder search, lat/lon, building/apartment on sign-up are web only) | register.tsx |
| Registration step 3 | weekly hours | 7x{enabled,start,end} | `PUT /business-hours/business/{id}` array | done new | register.tsx |
| Registration step 4 | team size, first services, staff list | enum, list, list | `POST /services/business/{id}`, `POST /staff/business/{id}`, `PUT /services/assignments/...` | partial new (one first service, solo owner auto-added as specialist like hub LR-03; team added later from Komanda; weeklySchedule/workLocation/profileLiveDate/helpOptions/previousTools survey fields are hub analytics only) | register.tsx |
| Signups closed switch | platform flag | bool | `GET /public/platform` `businessSignupsOpen` | done new | register.tsx |
| Login | emailOrPhone, password, `app` audience | text req | `POST /public/auth/login` | done | app/login.tsx |
| Wrong-app error codes | ACCOUNT_IS_CUSTOMER etc. | 403 detail | login | done new | lib/api-onboard.ts authErrorKey |
| Forgot / reset password | email; token + newPassword | text | `POST /public/auth/password/forgot|reset` | done new | app/forgot.tsx |
| Accept team invite | link/token, name, password | text | `GET /public/staff-invites/{t}`, `POST .../accept` | done new (paste link or `booqibiz://accept-invite?token=`) | app/accept-invite.tsx |
| Create business (extra salon) | name, category, city, address, phone | text/enum | `POST /businesses` | done new | app/create-business.tsx, salons.tsx |
| Setup checklist | category, services, staff, hours, online booking, share link, invite team | readiness list | `GET /businesses/{id}/readiness` | done new (hub SetupPage items; photos/verification are "recommended" only) | components/SetupChecklist.tsx |
| Security | change password | text | `POST /auth/change-password` | done new | Settings.tsx |
| Close account | delete | password | `DELETE /auth/me` is customer-only on the backend | partial new (request to support) | Settings.tsx, API-CONTRACT.md |
| Subscription / billing | plans, checkout | enum | `GET /businesses/{id}/subscription`, `POST .../checkout` | partial (status card; checkout stays web: store policy for subscriptions, Stripe off in MVP) | SettingsMore.tsx:140 |
| Salon switch | list, choose | | `GET /businesses/owner/{id}` | done | app/salons.tsx |
| Roles on screens | hide pages the role cannot open | `myPermissions` | `GET /businesses/{id}` | done new | lib/access.ts, section/[key].tsx, more.tsx |

## 2. Salon profile and online booking settings

| Field | Type | Key (`PUT /businesses/{id}`) | Mobile | Where |
|---|---|---|---|---|
| name, description, phone, email, website | text | same | done | Profile.tsx |
| category | enum | `category` | done new | Profile.tsx:44 |
| address, city | text | `address,city` | done | Profile.tsx |
| buildingNumber, apartmentNumber | text | same | done new | Profile.tsx |
| zipCode, state, country | text | same | missing (country sent on sign-up only) | |
| latitude, longitude, map pin | number | `latitude,longitude` | missing (geocoder is web) | |
| onlineBookingEnabled | bool | same | done | Profile.tsx |
| minBookingNoticeMinutes, maxBookingDaysAhead | int | same | done | Profile.tsx |
| cancellationWindowHours, lateCancellationFee | int / money | same | done new (fee) | Profile.tsx |
| depositPercent | 0-100 | same | done | Profile.tsx |
| taxRate | 0-100 | same | done new | Profile.tsx:102 |
| acceptedPaymentMethods | CASH,CARD,ONLINE | same | done new | Profile.tsx:31 |
| googleReviewUrl | url | `PUT /businesses/{id}/google-review-link {url}` | done new (was sent in the wrong call and silently dropped) | Profile.tsx |
| logo, cover photo | upload | `logoUrl,coverImageUrl` | done (cover new) | Profile.tsx:53 |
| brandColor, receiptFooter | hex / text | same | done (footer new) | Profile.tsx |
| staffAssignmentMode, allowParallelServices, healthSafetyNote | enum / bool / text | same | done new (healthSafety checkbox list is web) | Profile.tsx |
| Business hours | 7 days | `PUT /business-hours/business/{id}` | done | SettingsMore.tsx:25 |
| Hours exceptions | closed range + note | `/business-hours-exceptions` | partial (closed days only; special open/close times missing) | SettingsMore.tsx |
| Photos gallery | upload/delete | `/businesses/{id}/photos` | partial (add; reorder/delete in web) | Looks.tsx |
| Locations / branches | list, add | `/businesses/{id}/branches` | done | More2.tsx:144 |
| Notification texts | per event | `/businesses/{id}/settings/notification-texts` | missing | |
| Notification settings | email toggles, reminder hours, sender, reply-to | `/businesses/{id}/notification-settings` | done | SettingsMore.tsx:105 |

## 3. Services

| Field | Type | Key | Mobile | Where |
|---|---|---|---|---|
| name, description, category | text/enum | `name,description,categoryId` | done | Services.tsx |
| durationMinutes, price, priceType FIXED/FROM/RANGE | int/money/enum | same | done | Services.tsx:40 |
| depositPercent (-1 inherit) | -1..100 | same | done | Services.tsx:41 |
| taxRate | 0-100 | same | done | Services.tsx |
| serviceType standard/package/course | enum | `serviceType` | done new | Services.tsx:53 |
| color | #RRGGBB | `color` | done new | Services.tsx |
| staffIds | id list | `staffIds` | done | Services.tsx |
| isVisible (online) | bool | same | done | Services.tsx |
| messageToClient | text 1000 | same | done | Services.tsx:52 |
| questions (max 10: text, required) | list | `questions[]` | done new | Services.tsx:60 (answers shown in booking card) |
| paddingBefore/After, bookingInterval, parallelClients | int | same | done | Services.tsx |
| processingDuring / processingAfter | int | same | done new | Services.tsx:56 |
| mobileService + travelFee + serviceArea | bool/money/text | same | done new | Services.tsx:58 |
| virtualAppointment | bool | same | done new | Services.tsx |
| isClass + maxParticipants | bool/int | same | done | Services.tsx:50 |
| peak pricing rules | weekday,time,percent | `/bookings/business/{id}/services/{s}/peak-pricing` | done | Services.tsx |
| availableFrom / availableTo | date | same | done new | Services.tsx |
| resourceTypeId (rooms, chairs) | id | `/resource-types` | missing (needs resource type CRUD) | |
| staffOverrides (per-staff price/duration) | list | `staffOverrides[]` | missing | |
| imageUrl | url | `imageUrl` | missing | |
| combo services (steps) | list | `PUT /services/{id}/package` | done | Combos.tsx |
| categories CRUD, archive/restore | | `/categories`, `/services/.../archived` | done | Services.tsx |
| add-ons, packages, quick-sale | | `/addons`, `/packages`, `/quick-sale` | done | ServiceExtras.tsx |

## 4. Team

| Field | Type | Key | Mobile | Where |
|---|---|---|---|---|
| name, email, phone, position | text | `POST/PUT /staff/...` | done | Team.tsx |
| photo | upload | `avatarUrl` | done | Team.tsx |
| showInCalendar | bool | `isActive` | done | Team.tsx:38 |
| weekly schedule | 7 days | `schedule{DAY:[from,to]}` | done | Team.tsx:50 |
| services performed | id list | `PUT /services/assignments/business/{b}/staff/{s} {serviceIds}` | done new (was sent in the staff body and ignored by the backend) | Team.tsx:73 |
| permission level (role) | role id | `PUT /staff/{id}/role {roleId}` | done new (salon roles, default role preselected) | Team.tsx:40 |
| invite by email | | `POST /staff/{id}/invite` | done | Team.tsx |
| time off (one-off, recurring) | | `/time-off` | done | Team.tsx, BlockTimeSheet.tsx |
| commission rules, targets, payroll, timesheet, rota | | `/commission-rules`, `/staff-targets`, `/payroll`, `/timesheets`, `/rota` | done | Payroll.tsx, More2.tsx:205 |
| roles editor | name, permissions | `/businesses/{id}/roles` | done | Roles.tsx |
| portfolio photos | upload | `/businesses/{id}/staff/{s}/portfolio` | missing | |
| chair rent | amount, payments | `/staff/business/{b}/{s}/chair-rent` | missing | |
| calendar feed (ICS token) | | `/calendar/staff/{s}/token` | missing | |

## 5. Clients

| Field / action | Key | Mobile | Where |
|---|---|---|---|
| list, search, segments, stats | `GET /bookings/business/{b}/clients` | done | clients.tsx |
| create: first/last name, phone, email, marketing/SMS consent | `POST /clients/business/{b}` | done | AddClientSheet.tsx |
| edit: same + consents | `PUT /clients/{id}` | done new (backend fix: consents were dropped) | EditClientSheet.tsx:17 |
| patchTestDate | `patchTestDate` | done new | EditClientSheet.tsx |
| tags (list, create, assign) | `/client-tags`, `PUT /clients/{c}/tags` | done new | EditClientSheet.tsx |
| custom fields (TEXT/NUMBER/DATE/SELECT) | `GET/PUT /clients/{c}/fields` | done new (values; defining fields stays web) | EditClientSheet.tsx |
| notes, history, photos, consent forms | `/businesses/{b}/clients/{c}/record|notes|photos` | done | client/[id].tsx |
| vip, block/unblock | `vip`, `PUT/DELETE .../block` | done | client/[id].tsx |
| balance, loyalty, packages | `/clients/{id}/balance`, `/packages/client/{id}` | done | client/[id].tsx, ClientPackages.tsx |
| CSV import | `/clients/business/{b}/import[/preview]` | done | ImportSheet.tsx |
| delete | `DELETE /clients/{id}` | done | client/[id].tsx |
| birthday | not in update DTO | missing (backend has no field on update) | |
| export (GDPR) | `GET /clients/{id}/export` | missing | |

## 6. Calendar and booking form

| Field / action | Key | Mobile | Where |
|---|---|---|---|
| day / week / month, staff columns, now line | `GET /bookings/business/{b}` | done | calendar.tsx |
| client (pick or walk-in), service(s), staff (0 = any), date, start/end | `POST /bookings` `clientId,clientName,clientPhone,serviceId,staffId,appointmentDate,startTime,endTime` | done | booking/new.tsx:35, classic.tsx:43 |
| price override, notes | `price,notes` | done | classic.tsx |
| multi-service visit (`visitId`, `visitPending`) | | done | classic.tsx |
| conflict override | `override{confirm}` | done | new.tsx |
| repeat series | N bookings | done (hub also previews with `/bookings/series-preview`) | classic.tsx |
| clientEmail, color | `clientEmail,color` | missing on the form (client card holds email) | |
| package / group booking | `/bookings/package`, classes | done | Combos.tsx, Groups.tsx |
| booking card: status, confirm, arrived, complete, no-show, cancel with reason, reschedule | `/bookings/{id}/...` | done | booking/[id].tsx:34 |
| answers to service questions, visit address + travel fee, promo code, cancel reason | `clientAnswers,clientAddress,travelFee,promoCode,cancellationReason` | done new | booking/[id].tsx |
| late notice, WhatsApp reminder, waitlist, block time | | done | |
| take payment for a booking | `POST /payment-confirmation` with `appointmentId` | done new (till opens prefilled, settles the booking) | NewSale.tsx:25 |

## 7. Till, sales, money

| Hub item | Endpoint | Mobile |
|---|---|---|
| Take payment (cash, card, split, gift card by code, membership/package cover per line, tip, discount, appointment link, idempotency) | `POST /payment-confirmation` | done new (mobile used `POST /sales`, which ignores gift card codes and never settles the booking or books commission) |
| Multi-tender `payments[]`, PREPAID credit, promo code | same | missing (single method + split) |
| Product lines and stock decrement | `items[].productId` | missing in till (services and custom lines only) |
| Sales list by day, refund | `GET /sales/business/{b}`, `POST /sales/{id}/refunds` | done (Sales.tsx) |
| Invoices, cash drawer, tips report, pay-out | `/businesses/{b}/invoices|cash-drawer|tips` | done (Finance.tsx, Sales.tsx) |
| Gift cards sell/lookup, memberships, loyalty settings | `/gift-cards`, `/memberships`, `/loyalty-settings` | done; loyalty-card stamps missing |
| Expenses, P&L, tax, reports, custom reports | | done |
| Revenue plan | `/revenue-plan` | missing |

## 8. Marketing, reviews, inventory, other

| Area | Mobile |
|---|---|
| Campaigns, automation (birthday, win-back), promo codes, offers, referral program (paths fixed), integrations (pixel/GA) | done (Marketing.tsx, More2.tsx, Integrations.tsx) |
| Reviews list + reply | done (Reviews.tsx) |
| Looks, stories, post stats, paid promotion (UI) | done (Looks.tsx, story/*) |
| Inventory products, suppliers, purchase orders, stock count | done |
| Notifications inbox + push preferences | done (notifications.tsx) |
| Messages (customer inbox) | done (Messages.tsx) |
| Online shop orders | partial (OnlineShop in More2.tsx:173) |
| Support tickets | done (More2.tsx:25) |
| Analytics dashboard | done (Reports.tsx) |
| Branding page (colour, logo) | done inside Profile |
| Help center | web |

## Parity count

Counted from the tables above (rows with a status; "partial" counts half): see the script note at the end of the final report.
