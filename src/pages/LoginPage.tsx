import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import { startSession } from "@/utils/session";
import { publicSiteUrl } from "@/config/api";
import { cn } from "@/lib/utils";
import { AuthShell } from "@/components/auth/AuthShell";
import { authInput, authLabel, authLink, authSubtitle, authTitle, brandCta } from "@/components/auth/authStyles";
import { t } from "@/i18n";
import { getPlatformSettings } from "@/services/platformService";

const LoginPage = () => {
  // The admin can close salon sign-ups; then the "create account" doors go away (registration itself also says so).
  const [signupsOpen, setSignupsOpen] = useState(true);
  useEffect(() => {
    getPlatformSettings().then((p) => setSignupsOpen(p.businessSignupsOpen));
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error(t("login.pleaseFillInAllFields"));
      return;
    }

    setIsLoading(true);
    try {
      const authResponse = await authService.login({
        email,
        password,
      });

      await startSession(authResponse);

      toast.success(t("login.loginSuccessfulWelcomeBack"));
      
      // Back to the page that asked for a sign-in (e.g. an email's "Open in calendar" link —
      // business.getbooqi.tech starts without a session), else the salon picker.
      const from = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
      const back = from?.pathname && from.pathname.startsWith("/") && !from.pathname.startsWith("//") && from.pathname !== "/login"
        ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
        : "/";
      navigate(back, { replace: true });
    } catch (error) {
      console.error("Login error:", error);
      const e = error as { message?: string; response?: { message?: string; error?: string }; status?: number } | null;
      console.error('Error details:', {
        message: e?.message,
        response: e?.response,
        status: e?.status,
        error: error
      });
      
      // Try to extract error message from various sources
      let errorMessage = t("login.loginFailedPleaseCheckYour");
      
      if (e?.message) {
        errorMessage = e.message;
      } else if (e?.response?.message) {
        errorMessage = e.response.message;
      } else if (e?.response?.error) {
        errorMessage = e.response.error;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell headerLink={signupsOpen ? { label: t("login.signUp"), to: "/register" } : undefined}>
      <h1 className={authTitle}>{t("login.logIn")}</h1>
      <p className={authSubtitle}>{t("login.signInToManageYour")}</p>

      {signupsOpen && (
        <>
      {/* Same segmented control as booqi-web's /signin: sign-up is the other half of it. */}
      <div role="tablist" aria-label={t("login.signInOrSignUp")} className="mb-6 flex rounded-full bg-[rgb(var(--reg-ink)/0.05)] p-1">
        <span
          role="tab"
          aria-selected="true"
          className="flex-1 rounded-full bg-white py-2.5 text-center text-sm font-semibold text-[rgb(var(--reg-ink))] shadow-[0_1px_2px_rgb(var(--reg-ink)/0.04),0_8px_24px_-8px_rgb(var(--reg-ink)/0.1)] ring-1 ring-[rgb(var(--reg-ink)/0.04)]"
        >
          {t("login.signIn")}
        </span>
        <Link
          to="/register"
          role="tab"
          aria-selected="false"
          className="flex-1 rounded-full py-2.5 text-center text-sm font-semibold text-[rgb(var(--reg-muted))] transition-colors hover:text-[rgb(var(--reg-ink))]"
        >
          {t("login.signUp")}
        </Link>
      </div>

        </>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className={authLabel}>
            {t("login.emailAddress")}
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInput}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className={authLabel}>
            {t("login.password")}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(authInput, "pr-12")}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-1 my-auto flex h-10 w-10 items-center justify-center rounded-full text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Same account as the booking site, so the same reset page. There was no way back
            into a forgotten salon account at all. */}
        <div className="-mt-1 flex justify-end">
          <a href={`${publicSiteUrl()}/forgot-password`} className={cn(authLink, "py-1 text-sm")}>
            {t("login.forgotPassword")}
          </a>
        </div>

        <button type="submit" disabled={isLoading} aria-busy={isLoading} className={cn(brandCta, "w-full")}>
          {isLoading && (
            <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {isLoading ? t("login.signingIn") : t("login.logIn")}
        </button>

        {signupsOpen && (
          <p className="text-center text-sm text-[rgb(var(--reg-muted))]">
            {t("login.newToBooqi")}{" "}
            <Link to="/register" className={authLink}>
              {t("login.createABusinessAccount")}
            </Link>
          </p>
        )}
      </form>
    </AuthShell>
  );
};

export default LoginPage;





