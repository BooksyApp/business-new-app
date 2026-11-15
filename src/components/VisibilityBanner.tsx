import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";

import { businessService } from "@/services/businessService";
import { tDynamic } from "@/i18n";

/** Where each missing step is fixed. Keys match the backend's SalonReadiness. */
const FIX: Record<string, string> = {
  category: "business",
  services: "services",
  staff: "staff",
  hours: "business-hours",
  onlineBooking: "booking-rules",
  suspended: "help",
  photos: "photos",
  verification: "business",
};

/**
 * "Your salon is not visible to customers yet", with the exact steps that are missing and a
 * link to each fix. Gone as soon as the salon can take a booking. The rules come from the
 * backend (the same ones admin Activation uses), so the banner can never disagree with it.
 */
export function VisibilityBanner({ businessId }: { businessId: number }) {
  const [state, setState] = useState<{ bookable: boolean; missing: string[]; recommended: string[] } | null>(null);

  useEffect(() => {
    let live = true;
    businessService
      .getReadiness(businessId)
      .then((r) => live && setState(r))
      .catch(() => live && setState(null));
    return () => {
      live = false;
    };
  }, [businessId]);

  if (!state || state.bookable || state.missing.length === 0) return null;

  return (
    <div role="alert" data-testid="visibility-banner" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
      <p className="flex items-center gap-2 text-sm font-bold">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {tDynamic("readiness.title")}
      </p>
      <p className="mt-1 text-sm">{tDynamic("readiness.body")}</p>
      <ul className="mt-3 space-y-1.5">
        {state.missing.map((key) => (
          <li key={key}>
            <Link to={`/${businessId}/${FIX[key] ?? "business"}`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm font-semibold hover:bg-rose-100">
              <span>{tDynamic(`readiness.missing_${key}`)}</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {state.recommended.length > 0 && (
        <p className="mt-3 text-xs text-rose-800">
          {tDynamic("readiness.alsoHelps")} {state.recommended.map((k) => tDynamic(`readiness.rec_${k}`)).join(", ")}
        </p>
      )}
    </div>
  );
}
