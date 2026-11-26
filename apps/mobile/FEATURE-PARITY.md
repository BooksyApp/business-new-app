# Feature parity: business mobile vs old web hub

Source: old web pages and services at tag `old-web-before-reset` (`apps/web/src/services/*.ts`).
Endpoints are the same paths the web hub called. Backend change: `vip` flag added to `GET /bookings/business/{id}/clients`.

| Area | Feature | Endpoint | Mobile |
|---|---|---|---|
| Calendar | Day view, staff columns, now line | `GET /bookings/business/{id}` | done |
| Calendar | Week view | `GET /bookings/business/{id}?startDate&endDate` | done |
| Calendar | Booking card (view, confirm, arrived, complete) | `GET/PUT /bookings/{id}[/confirm|/complete]` | done |
| Calendar | Reschedule / move booking | `PUT /bookings/{id}` | done |
| Calendar | Cancel booking with reason, no-show | `PUT /bookings/{id}/cancel, /no-show` | done |
| Calendar | Create booking (client, multi-service, conflicts override) | `POST /bookings` | done |
| Calendar | Repeat bookings (weekly/biweekly/monthly) | `POST /bookings x N` | done |
| Calendar | Block time / time off on calendar | `POST/DELETE /time-off` | done |
| Calendar | Markers: online, chosen master, group, note, paid, late | `booking fields` | done |
| Calendar | Markers: VIP, new, returning | `GET /bookings/business/{id}/clients (+vip, new backend field)` | done |
| Calendar | Group / class bookings, package booking | `POST /bookings/package, /bookings/series-preview` | missing |
| Calendar | Booking audit log, WhatsApp reminder | `GET /businesses/{id}/audit-log, /whatsapp-reminders` | missing |
| Waitlist | List | `GET /waitlist/business/{id}` | done |
| Waitlist | Add by hand, remove | `POST/DELETE /waitlist/business/{id}[/{id}]` | done |
| Waitlist | Offer slots to a waiting client | `POST /waitlist/business/{id}/{id}/offer` | partial |
| Clients | List, segments, stats, search | `GET /bookings/business/{id}/clients` | done |
| Clients | Create | `POST /clients/business/{id}` | done |
| Clients | Edit (name, contact, consents) | `PUT /clients/{id}` | done |
| Clients | Notes and visit history | `GET/POST /businesses/{id}/clients/{c}/record|notes` | done |
| Clients | Consent forms submitted | `GET /clients/{id}/consent-submissions` | done |
| Clients | Delete / block, import, balance, loyalty | `DELETE /clients, /clients/{id}/balance, /loyalty` | missing |
| Services | List, on/off, price, duration | `GET/PUT /services/business/{id}` | done |
| Services | Create/edit all fields (5 tabs) | `POST/PUT /services/business/{id}` | done |
| Services | Categories CRUD | `/categories/business/{id}` | done |
| Services | Archive / restore | `DELETE /services/{id}, PUT .../restore` | done |
| Services | Packages (list) | `GET /packages/business/{id}` | partial |
| Services | Package create/edit, add-ons, combo, peak pricing, discounts | `/packages, /addons, /combo-items, peak-pricing` | missing |
| Team | List and contact | `GET /staff/business/{id}` | done |
| Team | Add / edit specialist, services, weekly schedule | `POST/PUT /staff/business/{id}` | done |
| Team | Role change, invitation | `PUT /staff/{id}/role, POST /staff/{id}/invite` | done |
| Team | Time off per specialist | `GET/POST/DELETE /time-off` | done |
| Team | Photo upload, commissions, payroll, targets, timesheet | `/uploads, /commission-rules, /staff-targets` | missing |
| Sales | List by day | `GET /sales/business/{id}?date` | done |
| Sales | Create sale (cash/card/gift card/membership/package), discount, tip | `POST /sales` | done |
| Sales | Refund (amount) | `POST /sales/{id}/refunds` | done |
| Sales | Receipt/invoice, cash drawer, quick-sale items, tips report | `/invoices, /cash-drawer, /quick-sale, /tip` | missing |
| Sales | Gift cards sell / lookup, memberships | `POST /gift-cards, /memberships` | partial |
| Alerts | Pending bookings, confirm, waitlist | `GET /bookings, /waitlist` | done |
| Alerts | Push registration, tap opens booking | `POST /notifications/device-tokens` | done |
| Alerts | Server inbox / hub events (recent activity, mark read) | `GET/POST /businesses/{id}/hub-events` | done |
| Reviews | List, summary, public reply | `GET /reviews/business/{id}, PUT /businesses/{id}/reviews/{r}/reply` | done |
| Reviews | Open a case (salon cannot edit/hide/delete) | `POST /businesses/{id}/reviews/{r}/report` | done |
| Looks | View photos and stories, delete | `GET/DELETE /businesses/{id}/looks|stories` | done |
| Looks | Upload photos/stories | `POST multipart (needs image picker dependency)` | missing |
| Reports | KPI dashboard (revenue, bookings, ticket, clients, no-show...) | `GET /analytics/business/{id}/dashboard` | done |
| Reports | Top services, team, sources | `same dashboard` | done |
| Reports | Custom reports, profit, tax, branch comparison | `/custom-reports, /profit-and-loss` | missing |
| Messages | Inbox and replies | `GET/POST /businesses/{id}/messages/conversations` | done |
| Settings | Salon profile (read), language, theme, sign out | `GET /businesses/{id}` | done |
| Settings | Working hours | `GET/PUT /business-hours/business/{id}` | done |
| Settings | Hours exceptions (holidays) | `/business-hours-exceptions` | done |
| Settings | Notification options (email/SMS/push/WhatsApp) | `GET/PUT /businesses/{id}/notification-settings` | done |
| Settings | Subscription status | `GET /businesses/{id}/subscription` | done |
| Settings | Edit salon profile, online sales, booking rules, branding | `PUT /businesses/{id}, /online-sales` | missing |
| Marketing | Campaigns, promo codes, offers, loyalty, referrals | `/marketing, /promo-codes, /loyalty, /referral` | missing |
| Inventory | Products, stock, suppliers, expenses | `/products, /expenses` | missing |
| Admin | Integrations, API keys, webhooks, audit log, roles editor | `/api-keys, /webhooks, /roles` | missing |

Totals: 42 done, 3 partial, 12 missing of 57 rows. Weighted parity (partial = 0.5): 76%. Core salon operations only (without marketing, inventory, admin rows): 81%.

Core salon operations (calendar, clients, services, team, till, reviews, reports, settings) are covered; the missing rows are the long tail of the old hub (marketing, inventory, integrations, payroll) and uploads that need a new native dependency.
