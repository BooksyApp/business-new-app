import { Suspense } from "react";
import { lazyWithReload } from "@/lib/lazyWithReload";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import LoadingView from "@/components/ui/loading-view";
import { I18nProvider } from "@/i18n/I18nProvider";
import { BookingConflictDialog } from "@/components/calendar/BookingConflictDialog";
import { prefetchAuthChecks } from "@/lib/authPrefetch";
import { idForKey, isSalonKey } from "@/lib/salonKey";

// Lazy load pages for code splitting
const HomePage = lazyWithReload(() => import("./pages/HomePage"));
const CreateBusinessPage = lazyWithReload(() => import("./pages/CreateBusinessPage"));
const CalendarPage = lazyWithReload(() => import("./pages/CalendarPage"));
const SalesPage = lazyWithReload(() => import("./pages/SalesPage"));
const MoneyPage = lazyWithReload(() => import("./pages/MoneyPage"));
const PaymentsPage = lazyWithReload(() => import("./pages/PaymentsPage"));
const InvoicesPage = lazyWithReload(() => import("./pages/InvoicesPage"));
const TaxPage = lazyWithReload(() => import("./pages/TaxPage"));
const ProfitPage = lazyWithReload(() => import("./pages/ProfitPage"));
const PromotionPage = lazyWithReload(() => import("./pages/PromotionPage"));
const BillingPage = lazyWithReload(() => import("./pages/BillingPage"));
const ItemsCategoryPage = lazyWithReload(() => import("./pages/ItemsCategoryPage"));
const AddServicePage = lazyWithReload(() => import("./pages/AddServicePage"));
const AddComboServicePage = lazyWithReload(() => import("./pages/AddComboServicePage"));
const AddAddonPage = lazyWithReload(() => import("./pages/AddAddonPage"));
const ClientsPage = lazyWithReload(() => import("./pages/ClientsPage"));
const StaffPage = lazyWithReload(() => import("./pages/StaffPage"));
const RolesPage = lazyWithReload(() => import("./pages/RolesPage"));
const EditStaffPage = lazyWithReload(() => import("./pages/EditStaffPage"));
const AddStaffPage = lazyWithReload(() => import("./pages/AddStaffPage"));
// #26/#44: "Inventory" now opens real product stock. The add-on management that used to
// live behind that label keeps its own route so nothing is lost.
const AddonsPage = lazyWithReload(() => import("./pages/AddonsPage"));
const InventoryPage = lazyWithReload(() => import("./pages/InventoryPage"));
const SuppliersOrdersPage = lazyWithReload(() => import("./pages/SuppliersOrdersPage"));
const StockCountPage = lazyWithReload(() => import("./pages/StockCountPage"));
const PayrollPage = lazyWithReload(() => import("./pages/PayrollPage"));
const SocialImagesPage = lazyWithReload(() => import("./pages/SocialImagesPage"));
const TimesheetPage = lazyWithReload(() => import("./pages/TimesheetPage"));
const AuditLogPage = lazyWithReload(() => import("./pages/AuditLogPage"));
const StaffTargetsPage = lazyWithReload(() => import("./pages/StaffTargetsPage"));
const ReportBuilderPage = lazyWithReload(() => import("./pages/ReportBuilderPage"));
const IntegrationsPage = lazyWithReload(() => import("./pages/IntegrationsPage"));
const ApiDocsPage = lazyWithReload(() => import("./pages/ApiDocsPage"));
const GiftCardsPage = lazyWithReload(() => import("./pages/GiftCardsPage"));
const ShopOrdersPage = lazyWithReload(() => import("./pages/ShopOrdersPage"));
const OnlineSalesSettingsPage = lazyWithReload(() => import("./pages/OnlineSalesSettingsPage"));
const MyDayPage = lazyWithReload(() => import("./pages/MyDayPage"));
const ExpensesPage = lazyWithReload(() => import("./pages/ExpensesPage"));
const AnalyticsPage = lazyWithReload(() => import("./pages/AnalyticsPage"));
const ReportDetailPage = lazyWithReload(() => import("./pages/ReportDetailPage"));
const SetupPage = lazyWithReload(() => import("./pages/SetupPage"));
const MarketingPage = lazyWithReload(() => import("./pages/MarketingPage"));
const OffersPage = lazyWithReload(() => import("./pages/OffersPage"));
const ReferralProgramPage = lazyWithReload(() => import("./pages/ReferralProgramPage"));
const LoyaltyPage = lazyWithReload(() => import("./pages/MembershipsPage"));
const PassesPage = lazyWithReload(() => import("./pages/PassesPage"));
const SectionPage = lazyWithReload(() => import("./pages/SectionPage"));
const ReviewsPage = lazyWithReload(() => import("./pages/ReviewsPage"));
const LocationsPage = lazyWithReload(() => import("./pages/LocationsPage"));
const BranchComparisonPage = lazyWithReload(() => import("./pages/BranchComparisonPage"));
const InboxPage = lazyWithReload(() => import("./pages/InboxPage"));
const CentralPricesPage = lazyWithReload(() => import("./pages/CentralPricesPage"));
const BookingRulesPage = lazyWithReload(() => import("./pages/BookingRulesPage"));
const ConsentFormsPage = lazyWithReload(() => import("./pages/ConsentFormsPage"));
const SecurityPage = lazyWithReload(() => import("./pages/SecurityPage"));
const SupportPage = lazyWithReload(() => import("./pages/SupportPage"));
const HelpPage = lazyWithReload(() => import("./pages/HelpPage"));
const NotificationsPage = lazyWithReload(() => import("./pages/NotificationsPage"));
const BrandingPage = lazyWithReload(() => import("./pages/BrandingPage"));
const PhotosPage = lazyWithReload(() => import("./pages/PhotosPage"));
const BusinessPage = lazyWithReload(() => import("./pages/BusinessPage"));
const BusinessHoursPage = lazyWithReload(() => import("./pages/BusinessHoursPage"));
const RegistrationPage = lazyWithReload(() => import("./pages/RegistrationPage"));
const AcceptInvitePage = lazyWithReload(() => import("./pages/AcceptInvitePage"));
const LoginPage = lazyWithReload(() => import("./pages/LoginPage"));
const PaymentMethodPage = lazyWithReload(() => import("./pages/PaymentMethodPage"));
const NotFound = lazyWithReload(() => import("./pages/NotFound"));
const LegacyPanelRedirect = lazyWithReload(() => import("./components/LegacyPanelRedirect"));
const ProtectedRoute = lazyWithReload(() => import("./components/ProtectedRoute"));

/*
 * Opening the panel straight on a business page used to be a chain: main bundle → route
 * guards → token check → ownership check → only then the page's own chunk → its data. On
 * a phone each step is a round trip. Start the guards' and the first page's chunks now, in
 * parallel with the checks; lazy() reuses the same in-flight import, so nothing loads twice.
 */
const FIRST_PAGE: Record<string, () => Promise<unknown>> = {
  "": () => import("./pages/CalendarPage"),
  calendar: () => import("./pages/CalendarPage"),
  clients: () => import("./pages/ClientsPage"),
  sales: () => import("./pages/SalesPage"),
};
if (typeof window !== "undefined") {
  // business.getbooqi.tech/<slug>_<publicId>/<page>: the API wants the numeric id, which
  // only the pairs the server gave us before know (lib/salonKey); unknown → guards only.
  const [first = "", second = ""] = window.location.pathname.replace(/^\/+/, "").split("/");
  if (isSalonKey(first)) {
    const known = idForKey(first);
    prefetchAuthChecks(known ? String(known) : undefined, second);
    // The platform flags (one cached request per tab) gate parts of every screen.
    void import("./services/platformService").then((m) => m.platformSettings()).catch(() => undefined);
    void import("./components/ProtectedRoute");
    void import("./components/BusinessOwnerRoute");
    void FIRST_PAGE[second]?.().catch(() => undefined);
  }
}
const PublicRoute = lazyWithReload(() => import("./components/PublicRoute"));
const BusinessOwnerRoute = lazyWithReload(() => import("./components/BusinessOwnerRoute"));

// Optimized QueryClient with better caching and performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * Never cached as fresh: every screen asks the server.
       *
       * This is a panel two people use at once — one on the till, one on the calendar,
       * a third on their phone — so anything held locally is a guess about what somebody
       * else has done since. It was five minutes, which meant an edit needed a hard
       * refresh to believe, and that teaches a salon to distrust the whole app.
       *
       * The cache still exists: a cached answer paints instantly while the refetch runs,
       * so screens do not flash empty. It just is never trusted as current.
       */
      staleTime: 0,
      // Kept for that instant paint, not to avoid asking.
      gcTime: 5 * 60 * 1000,
      // Retry failed requests
      retry: 2,
      /**
       * Coming back to the tab is the clearest signal that somebody has been away —
       * often in another tab of this same panel, or on their phone. It was off "for
       * performance", which bought a few requests and cost the salon its trust in what
       * it was looking at.
       */
      refetchOnWindowFocus: true,
      // Landing on a screen asks, every time.
      refetchOnMount: "always",
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <LoadingView />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BookingConflictDialog />
      {/* business.getbooqi.tech serves the panel at the root (it was getbooqi.tech/manage;
          Caddy 301s those old links to /legacy/<id>/<page> here). */}
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes - Login and Registration */}
            <Route
              path="/login"
              element={
                <Suspense fallback={<PageLoader />}>
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                </Suspense>
              }
            />
            {/* The link in a team invitation. Not behind PublicRoute: an owner who is
                signed in on this browser can still open a colleague's invitation. */}
            <Route
              path="/accept-invite"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AcceptInvitePage />
                </Suspense>
              }
            />
            <Route
              path="/register"
              element={
                <Suspense fallback={<PageLoader />}>
                  <PublicRoute>
                    <RegistrationPage />
                  </PublicRoute>
                </Suspense>
              }
            />
            
            {/* Protected routes - Business selection/home page */}
            <Route
              path="/"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                </Suspense>
              }
            />
            <Route
              path="/create-business"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ProtectedRoute>
                    <CreateBusinessPage />
                  </ProtectedRoute>
                </Suspense>
              }
            />

            {/* Old getbooqi.tech/manage/<id>/<page> links (Caddy 301 → /legacy/<id>/<page>):
                the id is looked up among the signed-in person's own salons only. */}
            <Route
              path="/legacy/*"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ProtectedRoute>
                    <LegacyPanelRedirect />
                  </ProtectedRoute>
                </Suspense>
              }
            />
            {/* A-01 slot: admin "open as owner" lands on /impersonate?code=… — built by the
                A-01 engineer (exchange the code, then go to the salon). Not implemented here;
                the route only keeps the address from being read as a salon key. */}
            <Route path="/impersonate" element={<Navigate to="/login" replace />} />

            {/* Business-specific routes: /<slug>_<publicId>/<page> (lib/salonKey) */}
            <Route
              path="/:salonKey"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ProtectedRoute>
                    <BusinessOwnerRoute>
                      <Outlet />
                    </BusinessOwnerRoute>
                  </ProtectedRoute>
                </Suspense>
              }
            >
              <Route index element={<Navigate to="calendar" replace />} />
              <Route path="calendar" element={<Suspense fallback={<PageLoader />}><CalendarPage /></Suspense>} />
              <Route path="tasks" element={<Suspense fallback={<PageLoader />}><HomePage /></Suspense>} />
              <Route path="clients" element={<Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>} />
              <Route path="inventory" element={<Suspense fallback={<PageLoader />}><InventoryPage /></Suspense>} />
              <Route path="inventory/suppliers" element={<Suspense fallback={<PageLoader />}><SuppliersOrdersPage /></Suspense>} />
              <Route path="inventory/count" element={<Suspense fallback={<PageLoader />}><StockCountPage /></Suspense>} />
              <Route path="addons" element={<Suspense fallback={<PageLoader />}><AddonsPage /></Suspense>} />
              {/* Old addresses kept working (hub IA 2026-11-19): each now has one home. */}
              <Route path="shopping" element={<Navigate to="../sales" replace />} />
              <Route path="sales" element={<Suspense fallback={<PageLoader />}><SalesPage /></Suspense>} />
              <Route path="items-category" element={<Suspense fallback={<PageLoader />}><ItemsCategoryPage /></Suspense>} />
              <Route path="services" element={<Navigate to="../items-category" replace />} />
              <Route path="add-service" element={<Suspense fallback={<PageLoader />}><AddServicePage /></Suspense>} />
              <Route path="edit-service/:id" element={<Suspense fallback={<PageLoader />}><AddServicePage /></Suspense>} />
              <Route path="add-combo-service" element={<Suspense fallback={<PageLoader />}><AddComboServicePage /></Suspense>} />
              <Route path="edit-combo-service/:id" element={<Suspense fallback={<PageLoader />}><AddComboServicePage /></Suspense>} />
              <Route path="add-addon" element={<Suspense fallback={<PageLoader />}><AddAddonPage /></Suspense>} />
              <Route path="marketing" element={<Suspense fallback={<PageLoader />}><MarketingPage /></Suspense>} />
              <Route path="offers" element={<Suspense fallback={<PageLoader />}><OffersPage /></Suspense>} />
              <Route path="referral-program" element={<Suspense fallback={<PageLoader />}><ReferralProgramPage /></Suspense>} />
              <Route path="loyalty" element={<Suspense fallback={<PageLoader />}><LoyaltyPage /></Suspense>} />
              <Route path="passes" element={<Suspense fallback={<PageLoader />}><PassesPage /></Suspense>} />
              <Route path="section/:section" element={<Suspense fallback={<PageLoader />}><SectionPage /></Suspense>} />
              <Route path="contacts" element={<Navigate to="../clients" replace />} />
              <Route path="consent-forms" element={<Navigate to="../setup/consent-forms" replace />} />
              <Route path="forms" element={<Navigate to="../setup/consent-forms" replace />} />
              <Route path="settings" element={<Navigate to="../setup" replace />} />
              <Route path="reports" element={<Navigate to="../analytics" replace />} />
              <Route path="analytics" element={<Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>} />
              <Route path="analytics/:metric" element={<Suspense fallback={<PageLoader />}><ReportDetailPage /></Suspense>} />
              <Route path="report-builder" element={<Suspense fallback={<PageLoader />}><ReportBuilderPage /></Suspense>} />
              <Route path="integrations" element={<Suspense fallback={<PageLoader />}><IntegrationsPage /></Suspense>} />
              <Route path="api-docs" element={<Suspense fallback={<PageLoader />}><ApiDocsPage /></Suspense>} />
              <Route path="money" element={<Suspense fallback={<PageLoader />}><PaymentsPage /></Suspense>} />
              <Route path="money/tips" element={<Suspense fallback={<PageLoader />}><MoneyPage key="tips" section="tips" /></Suspense>} />
              <Route path="money/cash" element={<Suspense fallback={<PageLoader />}><MoneyPage key="cash" section="cash" /></Suspense>} />
              <Route path="money/more" element={<Suspense fallback={<PageLoader />}><MoneyPage key="more" section="more" /></Suspense>} />
              <Route path="money/invoices" element={<Suspense fallback={<PageLoader />}><InvoicesPage /></Suspense>} />
              <Route path="money/tax" element={<Suspense fallback={<PageLoader />}><TaxPage /></Suspense>} />
              <Route path="money/profit" element={<Suspense fallback={<PageLoader />}><ProfitPage /></Suspense>} />
              <Route path="payroll" element={<Suspense fallback={<PageLoader />}><PayrollPage /></Suspense>} />
              <Route path="social-images" element={<Suspense fallback={<PageLoader />}><SocialImagesPage /></Suspense>} />
              <Route path="timesheet" element={<Suspense fallback={<PageLoader />}><TimesheetPage /></Suspense>} />
              <Route path="my-day" element={<Suspense fallback={<PageLoader />}><MyDayPage /></Suspense>} />
              <Route path="expenses" element={<Suspense fallback={<PageLoader />}><ExpensesPage /></Suspense>} />
              <Route path="promotion" element={<Suspense fallback={<PageLoader />}><PromotionPage /></Suspense>} />
              <Route path="billing" element={<Suspense fallback={<PageLoader />}><BillingPage /></Suspense>} />
              <Route path="staff" element={<Suspense fallback={<PageLoader />}><StaffPage /></Suspense>} />
              <Route path="staff-targets" element={<Suspense fallback={<PageLoader />}><StaffTargetsPage /></Suspense>} />
              <Route path="gift-cards" element={<Suspense fallback={<PageLoader />}><GiftCardsPage /></Suspense>} />
              <Route path="shop-orders" element={<Suspense fallback={<PageLoader />}><ShopOrdersPage /></Suspense>} />
              <Route path="setup/online-sales" element={<Suspense fallback={<PageLoader />}><OnlineSalesSettingsPage /></Suspense>} />
              <Route path="roles" element={<Suspense fallback={<PageLoader />}><RolesPage /></Suspense>} />
              <Route path="edit-staff/:id" element={<Suspense fallback={<PageLoader />}><EditStaffPage /></Suspense>} />
              <Route path="add-staff" element={<Suspense fallback={<PageLoader />}><AddStaffPage /></Suspense>} />
              <Route path="business" element={<Suspense fallback={<PageLoader />}><BusinessPage /></Suspense>} />
              <Route path="business-hours" element={<Suspense fallback={<PageLoader />}><BusinessHoursPage /></Suspense>} />
              <Route path="setup" element={<Suspense fallback={<PageLoader />}><SetupPage /></Suspense>} />
              <Route path="locations" element={<Suspense fallback={<PageLoader />}><LocationsPage /></Suspense>} />
              <Route path="branch-comparison" element={<Suspense fallback={<PageLoader />}><BranchComparisonPage /></Suspense>} />
              <Route path="central-prices" element={<Suspense fallback={<PageLoader />}><CentralPricesPage /></Suspense>} />
              {/* The all-in-one pages duplicated the settings sub-pages: one home each now. */}
              <Route path="booking-rules" element={<Navigate to="../setup/online-booking" replace />} />
              {/* One Setup row, one page: each shows only its own section. */}
              <Route path="setup/online-booking" element={<Suspense fallback={<PageLoader />}><BookingRulesPage key="online" section="online" /></Suspense>} />
              <Route path="setup/consent-forms" element={<Suspense fallback={<PageLoader />}><ConsentFormsPage /></Suspense>} />
              <Route path="setup/cancellation" element={<Suspense fallback={<PageLoader />}><BookingRulesPage key="cancellation" section="cancellation" /></Suspense>} />
              <Route path="setup/payment-methods" element={<Suspense fallback={<PageLoader />}><BookingRulesPage key="payment-methods" section="payment-methods" /></Suspense>} />
              <Route path="setup/currency-tax" element={<Suspense fallback={<PageLoader />}><BookingRulesPage key="currency-tax" section="currency-tax" /></Suspense>} />
              <Route path="setup/email" element={<Suspense fallback={<PageLoader />}><NotificationsPage key="email" section="email" /></Suspense>} />
              <Route path="setup/sms-push" element={<Suspense fallback={<PageLoader />}><NotificationsPage key="sms-push" section="sms-push" /></Suspense>} />
              <Route path="security" element={<Suspense fallback={<PageLoader />}><SecurityPage /></Suspense>} />
              <Route path="audit-log" element={<Suspense fallback={<PageLoader />}><AuditLogPage /></Suspense>} />
              <Route path="notifications" element={<Navigate to="../setup/email" replace />} />
              <Route path="branding" element={<Suspense fallback={<PageLoader />}><BrandingPage /></Suspense>} />
              <Route path="photos" element={<Suspense fallback={<PageLoader />}><PhotosPage /></Suspense>} />
              <Route path="support" element={<Suspense fallback={<PageLoader />}><SupportPage /></Suspense>} />
              <Route path="help" element={<Suspense fallback={<PageLoader />}><HelpPage /></Suspense>} />
              <Route path="help/:articleSlug" element={<Suspense fallback={<PageLoader />}><HelpPage /></Suspense>} />
              <Route path="reviews" element={<Suspense fallback={<PageLoader />}><ReviewsPage /></Suspense>} />
              <Route path="inbox" element={<Suspense fallback={<PageLoader />}><InboxPage /></Suspense>} />
              <Route path="payment-method" element={<Suspense fallback={<PageLoader />}><PaymentMethodPage /></Suspense>} />
            </Route>
            
            {/* Legacy routes */}
            <Route
              path="/dashboard"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ProtectedRoute>
                    <Navigate to="/" replace />
                  </ProtectedRoute>
                </Suspense>
              }
            />
            <Route
              path="*"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ProtectedRoute>
                    <NotFound />
                  </ProtectedRoute>
                </Suspense>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
