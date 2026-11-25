import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { t as tr } from "@/i18n";
import { marketplacePromotionService, type MarketplacePromotion } from "@/services/marketplacePromotionService";
import { salonPath } from "@/lib/salonKey";
import type { Id } from "@/types/id";

/** FG-W4-11: read-only marketplace promotion status. It is on while a promotion package is active; buying one happens on the promotion page. The daily bars are marketplace bookings. */
export function MarketplacePromotionCard({ businessId }: { businessId: Id }) {
  const [state, setState] = useState<MarketplacePromotion | null>(null);

  useEffect(() => {
    marketplacePromotionService.get(businessId).then(setState).catch(() => setState(null));
  }, [businessId]);

  if (state === null) return null;

  const max = Math.max(1, ...state.daily.map((d) => d.bookings));
  const total = state.daily.reduce((n, d) => n + d.bookings, 0);

  return (
    <div className="space-y-3 rounded-2xl p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{tr("marketplacePromotion.title")}</p>
          <p className="text-xs text-muted-foreground">{tr("marketplacePromotion.hint")}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${state.promoted ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}
        >
          {state.promoted ? tr("marketplacePromotion.statusOn") : tr("marketplacePromotion.statusOff")}
        </span>
      </div>
      {!state.promoted && (
        <Button asChild size="sm">
          <Link to={salonPath(businessId, "promotion")}>{tr("marketplacePromotion.buy")}</Link>
        </Button>
      )}
      {state.promoted && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{tr("marketplacePromotion.daily")}</p>
          <div className="flex h-16 items-end gap-1">
            {state.daily.map((d) => (
              <div
                key={d.date}
                className="flex-1 rounded-sm bg-[rgb(var(--reg-brand))]"
                style={{ height: `${Math.max(4, (d.bookings / max) * 100)}%` }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{tr("marketplacePromotion.total", { count: total })}</p>
        </div>
      )}
    </div>
  );
}
