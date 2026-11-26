# API contract check: business mobile vs booksy-backend

Method: every `request(...)` path in `src/lib/{api,api-biz,api-ext,api-more,push,pick}.ts` was matched (method + path) against every `@*Mapping` in `booksy-backend/src/main/java` (854 mappings, script-extracted, class-level `@RequestMapping` joined). Then the request DTO records, validation annotations and response shapes were read for the day-1 flows (auth, onboarding, business, services, staff, clients, bookings, till). Backend on branch `staging/2026-11-15`. Nothing was run against a live server; all of this is from source.

Result of the path match: 219 call sites, 0 unknown paths after fixing 2 (referral). The remaining value is in body and field level, below.

## Mismatches found and fixed

| # | Where | Problem (backend source) | Fix |
|---|---|---|---|
| 1 | `apiB.refCodes/refStats` | mobile called `/referral-codes/business/{b}` and `/referral-analytics/business/{b}`; backend is `/referrals/codes/business/{b}` and `/referrals/analytics/business/{b}` (ReferralController). Both 404. | paths fixed, lib/api-biz.ts |
| 2 | Team editor, services of a specialist | mobile sent `serviceIds` in `POST/PUT /staff`; `StaffCreateRequest` has no such field (Jackson drops it), assignments live in `PUT /services/assignments/business/{b}/staff/{s} {serviceIds}` (ServiceCatalogController). Services chosen for a new master were never saved and the editor never loaded them (`StaffDto` has no `serviceIds`). | load with `GET`, save with `PUT` after the staff call, Team.tsx:73, lib/api-ext.ts |
| 3 | Till | mobile posted `POST /sales` (SaleRequest has no `giftCardCode`, no coverage, does not touch the appointment). Hub till posts `POST /payment-confirmation` (spends the gift card, `coveredBy` MEMBERSHIP/PACKAGE per line, settles the booking via `appointmentId`, books commission, idempotency). A GIFT_CARD sale from mobile recorded a sale without spending the card. | `apiX.confirmPayment`, till switched, SPLIT added, opens from a booking with `appointmentId`, NewSale.tsx |
| 4 | Salon profile, Google review link | sent as `googleReviewUrl` inside `PUT /businesses/{id}`; `BusinessUpdateRequest` has no such field, it is `PUT /businesses/{id}/google-review-link {url}`. Silently dropped. | `apiB.setReviewLink`, Profile.tsx |
| 5 | Client edit, consents | `PUT /clients/{id}` was sent `allowMarketingEmails/allowSmsNotifications`; `ClientUpdateRequest` lacked them (create had them). Toggles never saved. | backend change (below), EditClientSheet.tsx |
| 6 | Team role | mobile sent `{role: 'OWNER'|'MANAGER'|'STAFF'}` (legacy tier) and showed raw tier names, only for existing staff. Hub sends `{roleId}` of the salon's own roles. | role picker from `GET /businesses/{b}/roles` (`memberIds`), `setStaffRoleId`, Team.tsx:40 |
| 7 | Salon link | share link was `booqi.az/<slug>` (invented). Hub uses `<site>/salon/<slug or id>?src=link` (`salonShareUrl`). | `salonShareLink` in lib/config.ts, Today, More |
| 8 | Login errors | 403 detail codes `ACCOUNT_IS_CUSTOMER|ACCOUNT_IS_ADMIN|ACCOUNT_NOT_FOR_THIS_APP` were shown raw. | mapped to words, authErrorKey |

Added fields the DTOs accept but mobile never sent (silent feature gaps, not errors): service `serviceType,color,virtualAppointment,processingDuring,processingAfter,travelFee,serviceArea,questions[],availableFrom,availableTo`; business `category,taxRate,lateCancellationFee,acceptedPaymentMethods,receiptFooter,coverImageUrl,buildingNumber,apartmentNumber,staffAssignmentMode,allowParallelServices,healthSafetyNote`; client `patchTestDate`; appointment read fields `clientAnswers,clientAddress,travelFee,promoCode,cancellationReason`.

## Backend changes (booksy-backend, branch staging/2026-11-15, local commits)

| Commit | Change |
|---|---|
| 2a390b3 | `ClientUpdateRequest` + `ClientService.update`: `allowMarketingEmails`, `allowSmsNotifications` (COALESCE, null = unchanged). `spotless:apply`, `mvn compile`, `ClientServiceTest` green. |

## Verified OK (no change)

| Area | Checked against | Result |
|---|---|---|
| Login | `LoginRequest{emailOrPhone,password,app}`, `AppAudience` | field is `emailOrPhone`; `IOS_BUSINESS`/`ANDROID_BUSINESS` map to hub audience; business roles `BUSINESS_OWNER`,`STAFF` map to HUB; a customer account gets 403 `ACCOUNT_IS_CUSTOMER` |
| Refresh | `POST /auth/refresh {refreshToken}` | rotation; mobile renews once under a lock, 5xx is not treated as a revoked session |
| Register | `RegisterRequest` (min password 8, `consent`, `businessName`, `referralCode`) | `POST /auth/register/business` forces BUSINESS_OWNER, returns 201 + `AuthResponse{accessToken,refreshToken,userId,fullName,email,role,businessId}`; 409 when the email exists; category is not in `RegisterRequest`, so a follow-up `PUT /businesses/{id}` is required (app does it, checklist shows "category" if it failed) |
| Password reset | `/public/auth/password/forgot` (always 200), `/reset {token,newPassword}` | matches app/forgot.tsx |
| Change password | `POST /auth/change-password {currentPassword,newPassword}` | matches; server signs out other devices |
| Staff invite | `GET /public/staff-invites/{t}` -> `{salonName,staffName,email,accountExists}`, `POST .../accept {firstName,lastName,password}` | matches; 409 for a customer email, 401 wrong password for an existing account |
| Salon switching | no header exists | the business id is in every path and the tenant filter checks ownership from the JWT; the app has nothing to send |
| Business hours | `BusinessHoursItemDto{dayOfWeek,enabled,startTime,endTime}` | matches (`MONDAY`..., `HH:mm`) |
| Hours exceptions | `BusinessHoursExceptionDto{businessId,startDate,endDate,closed,openTime,closeTime,notes}` | matches (closed days only in the UI) |
| Services create/update | `ServiceCreateRequest` | existing keys match; `depositPercent` -1 inherit; `price >= 0`; `color` must be `#RRGGBB`; `questions <= 10` |
| Bookings create | `BookingController.BookingRequest` | `staffId 0` = any, `endTime` optional, past slot 400, `visitId` UUID, `override{confirm}`; app sends these |
| Clients create | `ClientCreateRequest{firstName,lastName,email,phone,sendInvitation,allowMarketingEmails,allowSmsNotifications}` | matches |
| Tags and fields | `ClientTagController` (`tagIds`, `values{fieldId:value}`) | matches |
| Readiness | `BusinessService.readiness` -> `{bookable,missing[category,services,staff,hours,onlineBooking,suspended],recommended[photos,verification]}` | matches |
| Categories | `GET /public/business-categories?locale=` -> `{slug,name,label,names}` | send `name` (stable English key); `POST /businesses` and register need one |
| Create business | `BusinessCreateRequest{ownerId,name,category(req),address,city,country,phone,lat,lon}` | matches |
| Device token | `POST /notifications/device-tokens {token,platform}` | matches |
| Ids | all ids are opaque strings (`@IdOf`) | the app never parses ids as numbers |
| Money, dates | BigDecimal as JSON number, `LocalDate` `YYYY-MM-DD`, `LocalTime` `HH:mm[:ss]` | the app sends `HH:mm`, reads with `slice(0,5)` |

## Cannot work against the live backend (and why)

1. **Deleting a business owner's account** from the app: `DELETE /auth/me` returns 403 for anything but CUSTOMER (`AccountDeletionService`). The app routes owners to a support request. Apple 5.1.1(v) asks for in-app deletion for apps that create accounts; this needs a backend decision (what happens to the salon, its bookings and staff accounts), not a code tweak.
2. **Paid subscription checkout and online card payments**: Stripe is switched off in the MVP (`/public/platform` `stripe.enabled`), and store policy makes subscription purchase a web flow. The app shows status only.
3. **Push notifications on a real device** need the APNs/FCM credentials in the EAS build; the registration call itself is correct.
4. **Team invite deep link**: the emailed link points to the web page (`/invite/<token>`). The app opens it by paste or by `booqibiz://accept-invite?token=`; universal links need an `associatedDomains` entry and a hosted `apple-app-site-association`, which is a release task.
5. **Geocoded address / lat-lon** and the salon map pin are web only (geocoder is called from the hub).
6. **Role gating** relies on `GET /businesses/{id}` returning `isOwner`/`myPermissions` for team members (it does, BusinessService:164-192); a salon list loaded through `GET /businesses/owner/{id}` is the owner's own, so no gating is needed there.
7. **Staff permission regexes** in `TeamPermissions` are written with `\d+` path ids while the public ids are UUID strings; the tenant filter resolves them first, but this is worth one backend test (not changed here).
