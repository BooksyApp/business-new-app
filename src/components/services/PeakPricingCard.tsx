import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fieldCls } from "@/components/page/kitStyles";
import { t } from "@/i18n";
import { peakPricingService, type PeakRule } from "@/services/peakPricingService";
import type { Id } from "@/types/id";

/** A row as the form edits it: strings, so an empty input is not a zero. */
interface Row {
  weekday: string;
  startTime: string;
  endTime: string;
  percent: string;
}

const MAX_RULES = 14;
const DAY_KEYS = ["slotOffers.day1", "slotOffers.day2", "slotOffers.day3", "slotOffers.day4", "slotOffers.day5", "slotOffers.day6", "slotOffers.day7"] as const;

const toRow = (r: PeakRule): Row => ({
  weekday: String(r.weekday),
  startTime: r.startTime,
  endTime: r.endTime,
  percent: String(r.percent),
});

/**
 * FG-W4-06: the service's peak-hour surcharge. Applies only to online customer bookings; the salon's
 * own bookings and till sales keep the base price. Saved on its own, from the service form.
 */
export function PeakPricingCard({ businessId, serviceId }: { businessId: Id; serviceId: Id }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    peakPricingService.list(businessId, serviceId)
      .then((list) => setRows(list.map(toRow)))
      .catch(() => toast.error(t("peakPricing.loadFailed")));
  }, [businessId, serviceId]);

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    const rules: PeakRule[] = rows.map((r) => ({
      weekday: Number(r.weekday),
      startTime: r.startTime,
      endTime: r.endTime,
      percent: Number(r.percent),
    }));
    setBusy(true);
    try {
      const saved = await peakPricingService.save(businessId, serviceId, rules);
      setRows(saved.map(toRow));
      toast.success(t("peakPricing.saved"));
    } catch {
      toast.error(t("peakPricing.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-semibold text-[rgb(var(--reg-ink))]">{t("peakPricing.title")}</h3>
        <p className="text-sm text-[rgb(var(--reg-muted))]">{t("peakPricing.hint")}</p>
      </div>

      {rows.map((r, i) => (
        <div key={i} className="grid items-end gap-2 sm:grid-cols-5">
          <label className="text-sm">
            {t("peakPricing.weekday")}
            <select className={fieldCls} value={r.weekday} onChange={(e) => setRow(i, { weekday: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7].map((d, k) => <option key={d} value={d}>{t(DAY_KEYS[k])}</option>)}
            </select>
          </label>
          <label className="text-sm">
            {t("peakPricing.from")}
            <input className={fieldCls} type="time" value={r.startTime} onChange={(e) => setRow(i, { startTime: e.target.value })} />
          </label>
          <label className="text-sm">
            {t("peakPricing.to")}
            <input className={fieldCls} type="time" value={r.endTime} onChange={(e) => setRow(i, { endTime: e.target.value })} />
          </label>
          <label className="text-sm">
            {t("peakPricing.percent")}
            <input className={fieldCls} type="number" min={1} max={30} value={r.percent} onChange={(e) => setRow(i, { percent: e.target.value })} />
          </label>
          <Button type="button" variant="outline" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            {t("peakPricing.remove")}
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={rows.length >= MAX_RULES}
          onClick={() => setRows([...rows, { weekday: "5", startTime: "18:00", endTime: "21:00", percent: "" }])}
        >
          {t("peakPricing.add")}
        </Button>
        <Button type="button" onClick={() => void save()} disabled={busy}>{t("peakPricing.save")}</Button>
      </div>
    </section>
  );
}
