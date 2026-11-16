import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, ChevronRight, Copy, X } from "lucide-react";

import { businessService } from "@/services/businessService";
import { publicSiteUrl } from "@/config/api";
import { cn } from "@/lib/utils";
import { t, tDynamic } from "@/i18n";

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
const liveKey = (businessId: number) => `live-card-dismissed:${businessId}`;

function liveCardDismissed(businessId: number): boolean {
  try {
    return localStorage.getItem(liveKey(businessId)) === "1";
  } catch {
    return false;
  }
}

/**
 * Once the salon can take bookings: a small green "you're live" card with the booking link and
 * a Copy button, until the owner closes it (remembered per salon in this browser).
 * `showLive={false}` (the calendar) shows only the missing-steps banner.
 */
export function VisibilityBanner({ businessId, showLive = true, className }: { businessId: number; showLive?: boolean; className?: string }) {
  const [state, setState] = useState<{ bookable: boolean; missing: string[]; recommended: string[] } | null>(null);
  const [liveDismissed, setLiveDismissed] = useState(() => liveCardDismissed(businessId));
  const [bookingUrl, setBookingUrl] = useState("");
  const [copied, setCopied] = useState(false);

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

  const wantLive = showLive && !liveDismissed && !!state?.bookable;
  useEffect(() => {
    if (!wantLive) return;
    let live = true;
    // Same link as Business profile: the public site's /salon/<slug>.
    businessService
      .getBusiness(businessId)
      .then((b) => live && setBookingUrl(`${publicSiteUrl()}/salon/${b.slug ?? b.id}`))
      .catch(() => live && setBookingUrl(`${publicSiteUrl()}/salon/${businessId}`));
    return () => {
      live = false;
    };
  }, [wantLive, businessId]);

  if (wantLive) {
    const copy = async () => {
      if (!bookingUrl) return;
      try {
        await navigator.clipboard.writeText(bookingUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard blocked: the link is on screen to copy by hand.
      }
    };
    const dismiss = () => {
      try {
        localStorage.setItem(liveKey(businessId), "1");
      } catch {
        // Private mode: the card simply comes back next time.
      }
      setLiveDismissed(true);
    };
    return (
      <div role="status" data-testid="live-card" className={cn(className, "rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900")}>
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Check className="h-4 w-4" aria-hidden />
            {t("readiness.liveTitle")}
          </p>
          <button type="button" onClick={dismiss} aria-label={t("common.close")} className="-m-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-emerald-100">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="mt-1 text-sm">{t("readiness.liveBody")}</p>
        {bookingUrl && (
          <div className="mt-3 flex items-center gap-2">
            <a href={bookingUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2 text-sm font-semibold underline-offset-2 hover:underline">
              {bookingUrl.replace(/^https?:\/\//, "")}
            </a>
            <button type="button" onClick={() => void copy()} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold hover:bg-emerald-100">
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? t("business.copied") : t("common.copy")}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!state || state.bookable || state.missing.length === 0) return null;

  return (
    <div role="alert" data-testid="visibility-banner" className={cn(className, "rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900")}>
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
