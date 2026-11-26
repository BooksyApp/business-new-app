# Reference frames index

Frames: `_ref/frames/<BFid>.html` = markup of each artifact block (frames only, no page chrome). Not imported anywhere; excluded from the build (outside `src`).
Class names in the frames are the same as in `src/styles/biz-ui.css` (scoped under `.bz`); `src/components/bz/*` emits that markup. Source of mapping: `artifacts/business-final/_spec/audit.md` (section A). Images in frames point to `/_ref/img/*` and do not resolve (reference only).

| Route (under `/:salonKey/`) | Page | Component file to edit | Artifact blocks |
|---|---|---|---|
| `/login` | LoginPage | `src/pages/LoginPage.tsx` | BF13, BF14, BF69 |
| `/register` | RegistrationPage | `src/pages/RegistrationPage.tsx` | BF14, BF77 |
| `/accept-invite` | AcceptInvitePage | `src/pages/AcceptInvitePage.tsx` | BF14, BF55 |
| `/create-business` | CreateBusinessPage | `src/pages/CreateBusinessPage.tsx` | BF56 |
| `/legacy/*, /impersonate, /dashboard` | yönləndirmə | `yönləndirmə` | n/a |
| `*` | NotFound | `NotFound` | BF75 |
| `calendar` | CalendarPage | `src/pages/CalendarPage.tsx` | BF02, BF40 |
| `tasks` | HomePage | `src/pages/HomePage.tsx` | BF69 |
| `my-day` | MyDayPage | `src/pages/MyDayPage.tsx` | BF74 |
| `inbox` | InboxPage | `src/pages/InboxPage.tsx` | BF45, BF68 |
| `sales` | SalesPage | `src/pages/SalesPage.tsx` | BF46, BF47 |
| `payment-method` | PaymentMethodPage | `src/pages/PaymentMethodPage.tsx` | BF46 |
| `clients` | ClientsPage | `src/pages/ClientsPage.tsx` | BF48, BF49 |
| `setup/consent-forms (+/forms, /consent-forms)` | ConsentFormsPage | `src/pages/ConsentFormsPage.tsx` | BF49, BF71 |
| `money` | PaymentsPage | `src/pages/PaymentsPage.tsx` | BF63 |
| `money/tips, /cash, /more` | MoneyPage | `src/pages/MoneyPage.tsx` | BF64 |
| `money/invoices` | InvoicesPage | `src/pages/InvoicesPage.tsx` | BF63 |
| `money/tax` | TaxPage | `src/pages/TaxPage.tsx` | BF65 |
| `money/profit` | ProfitPage | `src/pages/ProfitPage.tsx` | BF65 |
| `money/booqi` | BooqiPayoutsPage | `src/pages/BooqiPayoutsPage.tsx` | BF64 |
| `expenses` | ExpensesPage | `src/pages/ExpensesPage.tsx` | BF65 |
| `shop-orders` | ShopOrdersPage | `src/pages/ShopOrdersPage.tsx` | BF76 |
| `gift-cards` | GiftCardsPage | `src/pages/GiftCardsPage.tsx` | BF62 |
| `setup/online-sales` | OnlineSalesSettingsPage | `src/pages/OnlineSalesSettingsPage.tsx` | BF59, BF76 |
| `marketing` | MarketingPage | `src/pages/MarketingPage.tsx` | BF60 |
| `offers` | OffersPage | `src/pages/OffersPage.tsx` | BF61 |
| `loyalty` | MembershipsPage | `src/pages/MembershipsPage.tsx` | BF61 |
| `passes` | PassesPage | `src/pages/PassesPage.tsx` | BF62 |
| `referral-program` | ReferralProgramPage | `src/pages/ReferralProgramPage.tsx` | BF61 |
| `reviews` | ReviewsPage | `src/pages/ReviewsPage.tsx` | BF11, BF67 |
| `promotion` | PromotionPage | `src/pages/PromotionPage.tsx` | BF62 |
| `social-images` | SocialImagesPage | `src/pages/SocialImagesPage.tsx` | BF67 |
| `staff` | StaffPage | `src/pages/StaffPage.tsx` | BF53, BF55 |
| `add-staff, edit-staff/:id` | AddStaffPage, EditStaffPage | `src/pages/AddStaffPage.tsx, src/pages/EditStaffPage.tsx` | BF55 |
| `timesheet` | TimesheetPage | `src/pages/TimesheetPage.tsx` | BF74 |
| `payroll` | PayrollPage | `src/pages/PayrollPage.tsx` | BF74 |
| `staff-targets` | StaffTargetsPage | `src/pages/StaffTargetsPage.tsx` | BF54 |
| `roles` | RolesPage | `src/pages/RolesPage.tsx` | BF54 |
| `inventory, inventory/suppliers, inventory/count` | InventoryPage, SuppliersOrdersPage, StockCountPage | `src/pages/InventoryPage.tsx, src/pages/SuppliersOrdersPage.tsx, src/pages/StockCountPage.tsx` | BF57 |
| `analytics, analytics/:metric` | AnalyticsPage, ReportDetailPage | `src/pages/AnalyticsPage.tsx, src/pages/ReportDetailPage.tsx` | BF66 |
| `report-builder` | ReportBuilderPage | `src/pages/ReportBuilderPage.tsx` | BF66 |
| `locations` | LocationsPage | `src/pages/LocationsPage.tsx` | BF56 |
| `branch-comparison` | BranchComparisonPage | `src/pages/BranchComparisonPage.tsx` | BF56, BF70 |
| `central-prices` | CentralPricesPage | `src/pages/CentralPricesPage.tsx` | BF56, BF70 |
| `items-category, add-service, edit-service/:id` | ItemsCategoryPage, AddServicePage | `src/pages/ItemsCategoryPage.tsx, src/pages/AddServicePage.tsx` | BF50, BF51 |
| `add-combo-service, edit-combo-service/:id, add-addon, addons` | AddComboServicePage, AddAddonPage, AddonsPage | `src/pages/AddComboServicePage.tsx, src/pages/AddAddonPage.tsx, src/pages/AddonsPage.tsx` | BF52 |
| `business` | BusinessPage | `src/pages/BusinessPage.tsx` | BF58 |
| `photos` | PhotosPage | `src/pages/PhotosPage.tsx` | BF72 |
| `looks` | LooksPage | `src/pages/LooksPage.tsx` | BF07, BF67 |
| `business-hours` | BusinessHoursPage | `src/pages/BusinessHoursPage.tsx` | BF56 |
| `branding` | BrandingPage | `src/pages/BrandingPage.tsx` | BF59 |
| `setup` | SetupPage | `src/pages/SetupPage.tsx` | BF58 |
| `setup/online-booking, /cancellation, /payment-methods, /currency-tax` | BookingRulesPage | `src/pages/BookingRulesPage.tsx` | BF58 |
| `setup/email, setup/sms-push` | NotificationsPage | `src/pages/NotificationsPage.tsx` | BF58, BF68 |
| `billing` | BillingPage | `src/pages/BillingPage.tsx` | BF59, BF69 |
| `integrations` | IntegrationsPage | `src/pages/IntegrationsPage.tsx` | BF59 |
| `api-docs` | ApiDocsPage | `src/pages/ApiDocsPage.tsx` | BF73 |
| `security` | SecurityPage | `src/pages/SecurityPage.tsx` | BF59, BF69 |
| `audit-log` | AuditLogPage | `src/pages/AuditLogPage.tsx` | BF73 |
| `support` | SupportPage | `src/pages/SupportPage.tsx` | BF68 |
| `help, help/:slug` | HelpPage | `src/pages/HelpPage.tsx` | BF75 |
| `section/:section` | SectionPage | `src/pages/SectionPage.tsx` | BF75 |
