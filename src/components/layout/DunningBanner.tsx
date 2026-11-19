import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { useBusinessId } from "@/hooks/useBusinessId";
import { salonPath } from "@/lib/salonKey";
import { billingService } from "@/services/billingService";
import { fmtDate, t } from "@/i18n";
import { myAccess } from "./navigation";

/**
 * A failed subscription payment, shown at the top of every page until it is sorted out.
 * Billing is owner-only on the server, so for anyone else (and on any error) this renders
 * nothing; the query is light and stays fresh for ten minutes.
 */
export function DunningBanner() {
  const businessId = useBusinessId();
  const owner = myAccess().isOwner;
  const { data } = useQuery({
    queryKey: ["billing", businessId],
    queryFn: () => billingService.overview(businessId),
    enabled: Boolean(businessId) && owner,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const sub = data?.subscription;
  if (!sub || sub.status === "NONE" || !sub.pastDue) return null;

  const until = sub.graceUntil ? fmtDate(new Date(sub.graceUntil), { year: "numeric", month: "numeric", day: "numeric" }) : "";
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm ${
        sub.restricted ? "bg-red-600 font-medium text-white" : "bg-amber-100 text-amber-900"
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {sub.restricted ? t("billing.dunning.restricted") : t("billing.dunning.body", { date: until })}
      </span>
      <Link to={salonPath(businessId, "billing")} className="shrink-0 font-semibold underline">
        {t("billing.dunning.cta")}
      </Link>
    </div>
  );
}
