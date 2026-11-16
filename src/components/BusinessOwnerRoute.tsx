import { Navigate, useLocation, useParams } from "react-router-dom";
import { myAccess, pageClosedToRole } from "@/components/layout/navigation";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/utils/authUtils";
import { businessService } from "@/services/businessService";
import { toast } from "sonner";
import { t } from "@/i18n";
import { takeOwnedBusinesses } from "@/lib/authPrefetch";
import { isSalonKey } from "@/lib/salonKey";
import NotFound from "@/pages/NotFound";

interface BusinessOwnerRouteProps {
  children: React.ReactNode;
}

/**
 * Protected route that ensures:
 * 1. User is authenticated
 * 2. User is a BUSINESS_OWNER
 * 3. User owns or works at the salon in the URL (/<slug>_<publicId>/…); else a 404 page
 */
const BusinessOwnerRoute = ({ children }: BusinessOwnerRouteProps) => {
  const { salonKey } = useParams<{ salonKey: string }>();
  const location = useLocation();
  // "ok" | "notFound" | "denied" | a canonical path to move to (stale name part)
  const [state, setState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const done = (s: string) => !cancelled && setState(s);
    setState(null);
    const validate = async () => {
      try {
        if (!salonKey || !isSalonKey(salonKey)) return done("notFound");
        const user = JSON.parse(localStorage.getItem("user") ?? "null") as { id?: number } | null;
        const accessToken = getAccessToken();
        if (!user?.id || !accessToken) return done("denied");

        // The salon behind the key — answered only for its owner and team, 404 for anyone
        // else (never 403: a guessed key does not learn that a salon exists). In parallel,
        // the person's salons (prefetched at startup by lib/authPrefetch) for role + switcher.
        const [resolved, businesses] = await Promise.all([
          businessService.resolvePanelKey(salonKey).catch((e: { response?: { status?: number } }) => {
            const status = e?.response?.status;
            if (status === 404 || status === 403) return null;
            throw e;
          }),
          (async () =>
            (await takeOwnedBusinesses(user.id!, accessToken)) ??
            (await businessService.getBusinessesByOwner(user.id!, accessToken)))(),
        ]);
        if (!resolved) return done("notFound");

        const business = businesses.find((b) => b.id === resolved.id);
        if (!business) return done("notFound");
        localStorage.setItem("currentBusinessId", business.id.toString());
        localStorage.setItem("currentBusiness", JSON.stringify(business));

        if (!resolved.canonical) {
          // Same page, the salon's current name in the address.
          const rest = location.pathname.split("/").slice(2).join("/");
          return done(`/${resolved.panelKey}${rest ? `/${rest}` : ""}${location.search}${location.hash}`);
        }
        done("ok");
      } catch (error) {
        console.error("BusinessOwnerRoute: Error validating business access", error);
        toast.error(t("businessOwnerRoute.failedToVerifyBusinessAccess"));
        done("denied");
      }
    };
    validate();
    return () => {
      cancelled = true;
    };
    // location is read only for a stale-slug redirect; re-checking on every page change is not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonKey]);

  if (state === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">{t("businessOwnerRoute.verifyingAccess")}</div>
      </div>
    );
  }
  if (state === "notFound") return <NotFound />;
  if (state === "denied") return <Navigate to="/" replace />;
  if (state !== "ok") return <Navigate to={state} replace />;

  // A team member's role leaves some pages out of the menu; opening one by its address
  // used to show "Failed to load" (the server refuses it). Go to their calendar instead.
  if (pageClosedToRole(myAccess(), location.pathname)) {
    return <Navigate to={`/${salonKey}/calendar`} replace />;
  }

  return <>{children}</>;
};

export default BusinessOwnerRoute;


