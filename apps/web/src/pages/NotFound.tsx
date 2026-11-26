import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { authSubtitle, authTitle, brandCta } from "@/components/auth/authStyles";
import { t } from "@/i18n";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <AuthShell>
      <p className="text-6xl font-extrabold tracking-[-0.04em] text-[rgb(var(--reg-brand))]">404</p>
      <h1 className={authTitle}>{t("notFound.oopsPageNotFound")}</h1>
      <p className={authSubtitle}>{location.pathname}</p>
      <Link to="/" className={`${brandCta} inline-flex`}>
        {t("notFound.returnToHome")}
      </Link>
    </AuthShell>
  );
};

export default NotFound;
