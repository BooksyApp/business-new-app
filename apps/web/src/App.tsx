import { Suspense } from "react";
import { lazyWithReload } from "@/lib/lazyWithReload";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import LoadingView from "@/components/ui/loading-view";
import { I18nProvider } from "@/i18n/I18nProvider";
import FrameShell from "@/bz-web/FrameShell";
import Landing from "@/bz-web/Landing";

const CreateBusinessPage = lazyWithReload(() => import("./pages/CreateBusinessPage"));
const RegistrationPage = lazyWithReload(() => import("./pages/RegistrationPage"));
const AcceptInvitePage = lazyWithReload(() => import("./pages/AcceptInvitePage"));
const LoginPage = lazyWithReload(() => import("./pages/LoginPage"));
const NotFound = lazyWithReload(() => import("./pages/NotFound"));
const LegacyPanelRedirect = lazyWithReload(() => import("./components/LegacyPanelRedirect"));
const ProtectedRoute = lazyWithReload(() => import("./components/ProtectedRoute"));
const PublicRoute = lazyWithReload(() => import("./components/PublicRoute"));
const BusinessOwnerRoute = lazyWithReload(() => import("./components/BusinessOwnerRoute"));

// Pages are artifact frames (src/bz-web); data is reconnected page by page later.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 0, gcTime: 5 * 60 * 1000, retry: 2, refetchOnWindowFocus: true, refetchOnMount: "always", refetchOnReconnect: true }, mutations: { retry: 1 } },
});

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
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/register" element={<PublicRoute><RegistrationPage /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><Landing /></ProtectedRoute>} />
            <Route path="/create-business" element={<ProtectedRoute><CreateBusinessPage /></ProtectedRoute>} />
            <Route path="/legacy/*" element={<ProtectedRoute><LegacyPanelRedirect /></ProtectedRoute>} />
            <Route path="/impersonate" element={<Navigate to="/login" replace />} />
            <Route
              path="/:salonKey"
              element={<ProtectedRoute><BusinessOwnerRoute><Outlet /></BusinessOwnerRoute></ProtectedRoute>}
            >
              <Route index element={<Navigate to="calendar" replace />} />
              <Route path="login" element={<Navigate to="../calendar" replace />} />
              <Route path="calendar" element={<FrameShell route="calendar" />} />
              <Route path="tasks" element={<FrameShell route="tasks" />} />
              <Route path="my-day" element={<FrameShell route="my-day" />} />
              <Route path="inbox" element={<FrameShell route="inbox" />} />
              <Route path="sales" element={<FrameShell route="sales" />} />
              <Route path="payment-method" element={<FrameShell route="payment-method" />} />
              <Route path="clients" element={<FrameShell route="clients" />} />
              <Route path="setup/consent-forms" element={<FrameShell route="setup/consent-forms" />} />
              <Route path="money" element={<FrameShell route="money" />} />
              <Route path="money/tips" element={<FrameShell route="money/tips" />} />
              <Route path="money/cash" element={<FrameShell route="money/cash" />} />
              <Route path="money/more" element={<FrameShell route="money/more" />} />
              <Route path="money/invoices" element={<FrameShell route="money/invoices" />} />
              <Route path="money/tax" element={<FrameShell route="money/tax" />} />
              <Route path="money/profit" element={<FrameShell route="money/profit" />} />
              <Route path="money/booqi" element={<FrameShell route="money/booqi" />} />
              <Route path="expenses" element={<FrameShell route="expenses" />} />
              <Route path="shop-orders" element={<FrameShell route="shop-orders" />} />
              <Route path="gift-cards" element={<FrameShell route="gift-cards" />} />
              <Route path="setup/online-sales" element={<FrameShell route="setup/online-sales" />} />
              <Route path="marketing" element={<FrameShell route="marketing" />} />
              <Route path="offers" element={<FrameShell route="offers" />} />
              <Route path="loyalty" element={<FrameShell route="loyalty" />} />
              <Route path="passes" element={<FrameShell route="passes" />} />
              <Route path="referral-program" element={<FrameShell route="referral-program" />} />
              <Route path="reviews" element={<FrameShell route="reviews" />} />
              <Route path="promotion" element={<FrameShell route="promotion" />} />
              <Route path="social-images" element={<FrameShell route="social-images" />} />
              <Route path="staff" element={<FrameShell route="staff" />} />
              <Route path="add-staff" element={<FrameShell route="add-staff" />} />
              <Route path="edit-staff/:id" element={<FrameShell route="edit-staff/:id" />} />
              <Route path="timesheet" element={<FrameShell route="timesheet" />} />
              <Route path="payroll" element={<FrameShell route="payroll" />} />
              <Route path="staff-targets" element={<FrameShell route="staff-targets" />} />
              <Route path="roles" element={<FrameShell route="roles" />} />
              <Route path="inventory" element={<FrameShell route="inventory" />} />
              <Route path="inventory/suppliers" element={<FrameShell route="inventory/suppliers" />} />
              <Route path="inventory/count" element={<FrameShell route="inventory/count" />} />
              <Route path="analytics" element={<FrameShell route="analytics" />} />
              <Route path="analytics/:metric" element={<FrameShell route="analytics/:metric" />} />
              <Route path="report-builder" element={<FrameShell route="report-builder" />} />
              <Route path="locations" element={<FrameShell route="locations" />} />
              <Route path="branch-comparison" element={<FrameShell route="branch-comparison" />} />
              <Route path="central-prices" element={<FrameShell route="central-prices" />} />
              <Route path="items-category" element={<FrameShell route="items-category" />} />
              <Route path="add-service" element={<FrameShell route="add-service" />} />
              <Route path="edit-service/:id" element={<FrameShell route="edit-service/:id" />} />
              <Route path="add-combo-service" element={<FrameShell route="add-combo-service" />} />
              <Route path="edit-combo-service/:id" element={<FrameShell route="edit-combo-service/:id" />} />
              <Route path="add-addon" element={<FrameShell route="add-addon" />} />
              <Route path="addons" element={<FrameShell route="addons" />} />
              <Route path="business" element={<FrameShell route="business" />} />
              <Route path="photos" element={<FrameShell route="photos" />} />
              <Route path="looks" element={<FrameShell route="looks" />} />
              <Route path="business-hours" element={<FrameShell route="business-hours" />} />
              <Route path="branding" element={<FrameShell route="branding" />} />
              <Route path="setup" element={<FrameShell route="setup" />} />
              <Route path="setup/online-booking" element={<FrameShell route="setup/online-booking" />} />
              <Route path="setup/cancellation" element={<FrameShell route="setup/cancellation" />} />
              <Route path="setup/payment-methods" element={<FrameShell route="setup/payment-methods" />} />
              <Route path="setup/currency-tax" element={<FrameShell route="setup/currency-tax" />} />
              <Route path="setup/email" element={<FrameShell route="setup/email" />} />
              <Route path="setup/sms-push" element={<FrameShell route="setup/sms-push" />} />
              <Route path="billing" element={<FrameShell route="billing" />} />
              <Route path="integrations" element={<FrameShell route="integrations" />} />
              <Route path="api-docs" element={<FrameShell route="api-docs" />} />
              <Route path="security" element={<FrameShell route="security" />} />
              <Route path="audit-log" element={<FrameShell route="audit-log" />} />
              <Route path="support" element={<FrameShell route="support" />} />
              <Route path="help" element={<FrameShell route="help" />} />
              <Route path="help/:articleSlug" element={<FrameShell route="help/:articleSlug" />} />
              <Route path="section/:section" element={<FrameShell route="section/:section" />} />
              <Route path="shopping" element={<Navigate to="../sales" replace />} />
              <Route path="services" element={<Navigate to="../items-category" replace />} />
              <Route path="contacts" element={<Navigate to="../clients" replace />} />
              <Route path="consent-forms" element={<Navigate to="../setup/consent-forms" replace />} />
              <Route path="forms" element={<Navigate to="../setup/consent-forms" replace />} />
              <Route path="settings" element={<Navigate to="../setup" replace />} />
              <Route path="reports" element={<Navigate to="../analytics" replace />} />
              <Route path="booking-rules" element={<Navigate to="../setup/online-booking" replace />} />
              <Route path="notifications" element={<Navigate to="../setup/email" replace />} />
            </Route>
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
