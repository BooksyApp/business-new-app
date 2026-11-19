import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { primaryBtn } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { t as tr } from "@/i18n";
import { loyaltySettingsService, type LoyaltyTier } from "@/services/membershipService";
import type { Id } from "@/types/id";

/** FG-W4-07: the salon's levels. A client's lifetime points pick the level, and its bonus adds to every purchase. */
export function LoyaltyTiersCard({ businessId }: { businessId: Id }) {
  const [tiers, setTiers] = useState<LoyaltyTier[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loyaltySettingsService.tiers(businessId).then(setTiers).catch(() => setTiers([]));
  }, [businessId]);

  if (tiers === null) return null;

  const update = (i: number, patch: Partial<LoyaltyTier>) =>
    setTiers((list) => (list ?? []).map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const save = async () => {
    setBusy(true);
    try {
      setTiers(await loyaltySettingsService.setTiers(businessId, tiers));
      toast.success(tr("loyaltyTiers.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("loyaltyTiers.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
      <div>
        <p className="text-sm font-semibold">{tr("loyaltyTiers.title")}</p>
        <p className="text-xs text-muted-foreground">{tr("loyaltyTiers.hint")}</p>
      </div>
      {tiers.map((t, i) => (
        <div key={i} className="grid grid-cols-[1fr_6rem_6rem_auto] items-end gap-2">
          <label className="block text-xs text-muted-foreground">
            {tr("loyaltyTiers.name")}
            <input value={t.name} maxLength={40} className={fieldCls} onChange={(e) => update(i, { name: e.target.value })} />
          </label>
          <label className="block text-xs text-muted-foreground">
            {tr("loyaltyTiers.fromPoints")}
            <input type="number" min={0} value={t.minPoints} className={fieldCls}
              onChange={(e) => update(i, { minPoints: Math.max(0, Number(e.target.value) || 0) })} />
          </label>
          <label className="block text-xs text-muted-foreground">
            {tr("loyaltyTiers.bonus")}
            <input type="number" min={0} max={100} value={t.bonusPercent} className={fieldCls}
              onChange={(e) => update(i, { bonusPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
          </label>
          <Button variant="ghost" size="sm" onClick={() => setTiers((list) => (list ?? []).filter((_, idx) => idx !== i))}>
            {tr("loyaltyTiers.remove")}
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={tiers.length >= 10}
          onClick={() => setTiers((list) => [...(list ?? []), { name: "", minPoints: 0, bonusPercent: 0 }])}>
          {tr("loyaltyTiers.add")}
        </Button>
        <Button className={primaryBtn} size="sm" disabled={busy} onClick={() => void save()}>{tr("common.save")}</Button>
      </div>
    </div>
  );
}
