import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { t as tr } from "@/i18n";
import { marketplacePromotionService, type MarketplacePromotion } from "@/services/marketplacePromotionService";
import type { Id } from "@/types/id";

/** FG-W4-11: the salon opts in to marketplace promotion. Free, no payment; the daily bars are marketplace bookings. */
export function MarketplacePromotionCard({ businessId }: { businessId: Id }) {
  const [state, setState] = useState<MarketplacePromotion | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    marketplacePromotionService.get(businessId).then(setState).catch(() => setState(null));
  }, [businessId]);

  if (state === null) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const next = await marketplacePromotionService.set(businessId, !state.promoted);
      setState(next);
      toast.success(tr(next.promoted ? "marketplacePromotion.on" : "marketplacePromotion.off"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("marketplacePromotion.failed"));
    } finally {
      setBusy(false);
    }
  };

  const max = Math.max(1, ...state.daily.map((d) => d.bookings));
  const total = state.daily.reduce((n, d) => n + d.bookings, 0);

  return (
    <div className="space-y-3 rounded-2xl p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{tr("marketplacePromotion.title")}</p>
          <p className="text-xs text-muted-foreground">{tr("marketplacePromotion.hint")}</p>
        </div>
        <Button variant={state.promoted ? "outline" : "default"} size="sm" disabled={busy} onClick={() => void toggle()}>
          {state.promoted ? tr("marketplacePromotion.turnOff") : tr("marketplacePromotion.turnOn")}
        </Button>
      </div>
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
