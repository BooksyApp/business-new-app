# Feature parity: business mobile vs old web hub

Source: old web pages and services at tag `old-web-before-reset` (`apps/web/src/services/*.ts`). Paths and bodies are the ones the web hub called.
Backend change (local, staging/2026-11-15): `vip` flag added to `GET /bookings/business/{id}/clients`.

| Area | Feature | Endpoint | Mobile |
|---|---|---|---|
| Calendar | Day view, staff columns, now line | `GET /bookings/business/{id}` | done |
| Calendar | Week view | `GET /bookings/business/{id}?startDate&endDate` | done |
| Calendar | Booking card (view, confirm, arrived, complete) | `GET/PUT /bookings/{id}[/confirm|/complete]` | done |
| Calendar | Reschedule / move booking | `PUT /bookings/{id}` | done |
| Calendar | Cancel with reason, no-show | `PUT /bookings/{id}/cancel, /no-show` | done |
| Calendar | Create booking (client, multi-service, conflict override) | `POST /bookings` | done |
| Calendar | Repeat bookings | `POST /bookings x N` | done |
| Calendar | Block time / time off | `POST/DELETE /time-off` | done |
| Calendar | Markers: online, chosen master, group, note, paid, late | `booking fields` | done |
| Calendar | Markers: VIP, new, returning | `GET /bookings/business/{id}/clients (+vip, backend)` | done |
| Calendar | Group / class bookings | `POST /bookings (class)` | missing |
| Calendar | Package booking (multi-step party) | `POST /bookings/package` | missing |
| Calendar | Business activity (audit) log | `GET /businesses/{id}/audit-log` | done |
| Calendar | WhatsApp reminder per booking | `PUT /businesses/{id}/whatsapp-reminders/{a}` | missing |
| Waitlist | List | `GET /waitlist/business/{id}` | done |
| Waitlist | Add by hand, remove | `POST/DELETE /waitlist/business/{id}` | done |
| Waitlist | Offer a time to a waiting client | `POST /waitlist/business/{id}/{id}/offer` | done |
| Waitlist | Book now preselects the client | `client cache` | done |
| Clients | List, segments, stats, search | `GET /bookings/business/{id}/clients` | done |
| Clients | Create, edit (cache refreshed) | `POST/PUT /clients` | done |
| Clients | Notes, history, consent forms | `/businesses/{id}/clients/{c}/record, /clients/{id}/consent-submissions` | done |
| Clients | Block / unblock, VIP | `PUT/DELETE /businesses/{id}/clients/{c}/block, PUT /clients/{id}` | done |
| Clients | Balance and settle debt, loyalty points | `/clients/{id}/balance, /loyalty/business/{b}/client/{c}` | done |
| Clients | Delete client, CSV import | `DELETE /clients, POST /clients/business/{id}/import` | missing |
| Services | List, on/off, quick-sale star | `GET/PUT /services/business/{id}, /quick-sale` | done |
| Services | Create/edit all fields (5 tabs) | `POST/PUT /services/business/{id}` | done |
| Services | Categories CRUD | `/categories/business/{id}` | done |
| Services | Archive / restore | `DELETE /services/{id}, PUT .../restore` | done |
| Services | Packages list, create, on/off | `/packages/business/{id}` | done |
| Services | Add-ons list, create, delete | `/addons/business/{id}` | done |
| Services | Peak pricing rules | `/bookings/business/{id}/services/{s}/peak-pricing` | done |
| Services | Combo services, per-staff price overrides | `/services/{id}/combo-items` | missing |
| Team | List and contact | `GET /staff/business/{id}` | done |
| Team | Add / edit specialist, services, weekly schedule, photo | `POST/PUT /staff, POST /uploads` | done |
| Team | Role change, invitation | `PUT /staff/{id}/role, POST /staff/{id}/invite` | done |
| Team | Time off per specialist | `/time-off` | done |
| Team | Commission rules | `/commission-rules` | done |
| Team | Monthly targets | `/businesses/{id}/staff-targets` | done |
| Team | Payroll runs (build, approve, paid), timesheet clock in/out | `/businesses/{id}/payroll, /timesheets` | done |
| Team | Weekly rota view (shifts, time off, days off) | `GET /businesses/{id}/rota` | done |
| Team | Edit rota shifts, copy last week | `/businesses/{id}/rota/shifts|copy` | done |
| Team | Recurring shift blocks | `/businesses/{id}/rota/blocks` | missing |
| Sales | List by day | `GET /sales/business/{id}?date` | done |
| Sales | Create sale (cash, card, gift card, membership, package), discount, tip, quick-sale | `POST /sales` | done |
| Sales | Refund (amount) | `POST /sales/{id}/refunds` | done |
| Sales | Invoices (list, void), cash drawer (open, close), tips report and pay-out | `/businesses/{id}/invoices|cash-drawer|tips` | done |
| Sales | Gift cards sell and look up | `POST /gift-cards, GET /gift-cards/{code}` | done |
| Sales | Memberships (list, create, on/off) | `/businesses/{id}/memberships` | done |
| Sales | Loyalty points settings | `/businesses/{id}/loyalty-settings` | done |
| Sales | Loyalty tiers (name, points, bonus %); card colour styles not included | `/businesses/{id}/loyalty-tiers` | done |
| Alerts | Pending bookings, confirm, waitlist | `GET /bookings, /waitlist` | done |
| Alerts | Push registration, tap opens booking | `POST /notifications/device-tokens` | done |
| Alerts | Recent activity inbox, mark read | `/businesses/{id}/hub-events` | done |
| Reviews | List, summary, public reply | `/reviews/business/{id}, PUT .../reply` | done |
| Reviews | Open a case (salon cannot edit/hide/delete) | `POST .../reviews/{r}/report` | done |
| Looks | View, delete photos and stories | `/businesses/{id}/looks|stories` | done |
| Looks | Upload photo / story (expo-image-picker) | `POST /uploads, /looks, multipart /stories` | done |
| Reports | KPI dashboard, top services, team, sources | `GET /analytics/business/{id}/dashboard` | done |
| Reports | Profit and loss by month, tax summary | `/profit-and-loss/monthly, /tax-summary` | done |
| Reports | Custom reports (dataset, columns, run) | `/custom-reports/catalog|run` | done |
| Reports | Branch comparison | `/analytics/owner/branch-comparison` | done |
| Messages | Inbox and replies | `/businesses/{id}/messages/conversations` | done |
| Settings | Salon profile edit, online booking rules, logo | `PUT /businesses/{id}, POST /uploads` | done |
| Settings | Working hours, holiday exceptions | `/business-hours, /business-hours-exceptions` | done |
| Settings | Notification options, language, theme, subscription | `/notification-settings, /subscription` | done |
| Settings | Online sales (gift cards, wallet) switches and limits | `/businesses/{id}/online-sales` | done |
| Settings | Tracking pixels (Meta, Google Analytics) | `PUT /businesses/{id}/integrations/tracking` | done |
| Settings | Brand colour, custom domain (set, verify, remove) | `/businesses/{id}/custom-domain` | done |
| Marketing | Campaigns (draft, audience, send) | `/marketing/campaigns/business/{id}` | done |
| Marketing | Promo codes | `/promo-codes/business/{id}` | done |
| Marketing | Birthday and win-back automation | `/businesses/{id}/marketing-automation` | done |
| Marketing | Quiet-hour and last-minute offers | `/bookings/business/{id}/slot-discounts` | done |
| Marketing | Referral codes and analytics (read) | `/referral-codes/business/{id}` | done |
| Marketing | Marketplace promotion | `/marketplace-promotion` | missing |
| Inventory | Products CRUD, low stock | `/products/business/{id}` | done |
| Inventory | Suppliers, purchase orders, stock count | `/suppliers` | missing |
| Expenses | Expenses by month (add, delete) | `/businesses/{id}/expenses` | done |
| Admin | API keys, webhooks | `/businesses/{id}/api-keys|webhooks` | done |
| Admin | Roles and permissions editor | `/businesses/{id}/roles, /team-permissions` | done |
| Admin | Support tickets (list, new, reply) | `/support/tickets` | done |

Totals: 72 done, 0 partial, 8 missing of 80 rows. Parity (partial = 0.5): 90.0%.
