import { lazy, Suspense } from "react";
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
const HomePage = lazy(() => import("./pages/HomePage"));
const CreateBusinessPage = lazy(() => import("./pages/CreateBusinessPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const SalesPage = lazy(() => import("./pages/SalesPage"));
const MoneyPage = lazy(() => import("./pages/MoneyPage"));
const PromotionPage = lazy(() => import("./pages/PromotionPage"));
const ItemsCategoryPage = lazy(() => import("./pages/ItemsCategoryPage"));
const AddServicePage = lazy(() => import("./pages/AddServicePage"));
const AddComboServicePage = lazy(() => import("./pages/AddComboServicePage"));
const AddAddonPage = lazy(() => import("./pages/AddAddonPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const StaffPage = lazy(() => import("./pages/StaffPage"));
const RolesPage = lazy(() => import("./pages/RolesPage"));
const EditStaffPage = lazy(() => import("./pages/EditStaffPage"));
const AddStaffPage = lazy(() => import("./pages/AddStaffPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
// #26/#44: "Inventory" now opens real product stock. The add-on management that used to
// live behind that label keeps its own route so nothing is lost.
const AddonsPage = lazy(() => import("./pages/AddonsPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const PayrollPage = lazy(() => import("./pages/PayrollPage"));
const TimesheetPage = lazy(() => import("./pages/TimesheetPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const SetupPage = lazy(() => import("./pages/SetupPage"));
const MarketingPage = lazy(() => import("./pages/MarketingPage"));
const OffersPage = lazy(() => import("./pages/OffersPage"));
const ReferralProgramPage = lazy(() => import("./pages/ReferralProgramPage"));
const LoyaltyPage = lazy(() => import("./pages/MembershipsPage"));
const SectionPage = lazy(() => import("./pages/SectionPage"));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage"));
const LocationsPage = lazy(() => import("./pages/LocationsPage"));
const BookingRulesPage = lazy(() => import("./pages/BookingRulesPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const BrandingPage = lazy(() => import("./pages/BrandingPage"));
const PhotosPage = lazy(() => import("./pages/PhotosPage"));
const BusinessPage = lazy(() => import("./pages/BusinessPage"));
const BusinessHoursPage = lazy(() => import("./pages/BusinessHoursPage"));
const RegistrationPage = lazy(() => import("./pages/RegistrationPage"));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvitePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const PaymentMethodPage = lazy(() => import("./pages/PaymentMethodPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LegacyPanelRedirect = lazy(() => import("./components/LegacyPanelRedirect"));
const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));

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
  contacts: () => import("./pages/ClientsPage"),
  sales: () => import("./pages/SalesPage"),
  shopping: () => import("./pages/SalesPage"),
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
const PublicRoute = lazy(() => import("./components/PublicRoute"));
const BusinessOwnerRoute = lazy(() => import("./components/BusinessOwnerRoute"));

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
              <Route path="addons" element={<Suspense fallback={<PageLoader />}><AddonsPage /></Suspense>} />
              <Route path="shopping" element={<Suspense fallback={<PageLoader />}><SalesPage /></Suspense>} />
              <Route path="sales" element={<Suspense fallback={<PageLoader />}><SalesPage /></Suspense>} />
              <Route path="items-category" element={<Suspense fallback={<PageLoader />}><ItemsCategoryPage /></Suspense>} />
              <Route path="services" element={<Suspense fallback={<PageLoader />}><ServicesPage /></Suspense>} />
              <Route path="add-service" element={<Suspense fallback={<PageLoader />}><AddServicePage /></Suspense>} />
              <Route path="edit-service/:id" element={<Suspense fallback={<PageLoader />}><AddServicePage /></Suspense>} />
              <Route path="add-combo-service" element={<Suspense fallback={<PageLoader />}><AddComboServicePage /></Suspense>} />
              <Route path="edit-combo-service/:id" element={<Suspense fallback={<PageLoader />}><AddComboServicePage /></Suspense>} />
              <Route path="add-addon" element={<Suspense fallback={<PageLoader />}><AddAddonPage /></Suspense>} />
              <Route path="marketing" element={<Suspense fallback={<PageLoader />}><MarketingPage /></Suspense>} />
              <Route path="offers" element={<Suspense fallback={<PageLoader />}><OffersPage /></Suspense>} />
              <Route path="referral-program" element={<Suspense fallback={<PageLoader />}><ReferralProgramPage /></Suspense>} />
              <Route path="loyalty" element={<Suspense fallback={<PageLoader />}><LoyaltyPage /></Suspense>} />
              <Route path="section/:section" element={<Suspense fallback={<PageLoader />}><SectionPage /></Suspense>} />
              <Route path="contacts" element={<Suspense fallback={<PageLoader />}><ClientsPage /></Suspense>} />
              <Route path="analytics" element={<Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>} />
              <Route path="money" element={<Suspense fallback={<PageLoader />}><MoneyPage /></Suspense>} />
              <Route path="payroll" element={<Suspense fallback={<PageLoader />}><PayrollPage /></Suspense>} />
              <Route path="timesheet" element={<Suspense fallback={<PageLoader />}><TimesheetPage /></Suspense>} />
              <Route path="expenses" element={<Suspense fallback={<PageLoader />}><ExpensesPage /></Suspense>} />
              <Route path="promotion" element={<Suspense fallback={<PageLoader />}><PromotionPage /></Suspense>} />
              <Route path="staff" element={<Suspense fallback={<PageLoader />}><StaffPage /></Suspense>} />
              <Route path="roles" element={<Suspense fallback={<PageLoader />}><RolesPage /></Suspense>} />
              <Route path="edit-staff/:id" element={<Suspense fallback={<PageLoader />}><EditStaffPage /></Suspense>} />
              <Route path="add-staff" element={<Suspense fallback={<PageLoader />}><AddStaffPage /></Suspense>} />
              <Route path="business" element={<Suspense fallback={<PageLoader />}><BusinessPage /></Suspense>} />
              <Route path="business-hours" element={<Suspense fallback={<PageLoader />}><BusinessHoursPage /></Suspense>} />
              <Route path="setup" element={<Suspense fallback={<PageLoader />}><SetupPage /></Suspense>} />
              <Route path="locations" element={<Suspense fallback={<PageLoader />}><LocationsPage /></Suspense>} />
              <Route path="booking-rules" element={<Suspense fallback={<PageLoader />}><BookingRulesPage /></Suspense>} />
              {/* One Setup row, one page: each shows only its own section. */}
              <Route path="setup/online-booking" element={<Suspense fallback={<PageLoader />}><BookingRulesPage key="online" section="online" /></Suspense>} />
              <Route path="setup/cancellation" element={<Suspense fallback={<PageLoader />}><BookingRulesPage key="cancellation" section="cancellation" /></Suspense>} />
              <Route path="setup/payment-methods" element={<Suspense fallback={<PageLoader />}><BookingRulesPage key="payment-methods" section="payment-methods" /></Suspense>} />
              <Route path="setup/currency-tax" element={<Suspense fallback={<PageLoader />}><BookingRulesPage key="currency-tax" section="currency-tax" /></Suspense>} />
              <Route path="setup/email" element={<Suspense fallback={<PageLoader />}><NotificationsPage key="email" section="email" /></Suspense>} />
              <Route path="setup/sms-push" element={<Suspense fallback={<PageLoader />}><NotificationsPage key="sms-push" section="sms-push" /></Suspense>} />
              <Route path="security" element={<Suspense fallback={<PageLoader />}><SecurityPage /></Suspense>} />
              <Route path="notifications" element={<Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense>} />
              <Route path="branding" element={<Suspense fallback={<PageLoader />}><BrandingPage /></Suspense>} />
              <Route path="photos" element={<Suspense fallback={<PageLoader />}><PhotosPage /></Suspense>} />
              <Route path="support" element={<Suspense fallback={<PageLoader />}><SupportPage /></Suspense>} />
              <Route path="help" element={<Suspense fallback={<PageLoader />}><HelpPage /></Suspense>} />
              <Route path="reviews" element={<Suspense fallback={<PageLoader />}><ReviewsPage /></Suspense>} />
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
