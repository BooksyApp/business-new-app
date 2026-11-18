import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fieldCls } from "@/components/page/kitStyles";
import { t } from "@/i18n";
import { slotOfferService, type SlotOffer } from "@/services/slotOfferService";
import type { Id } from "@/types/id";

/** A row as the form edits it: strings, so an empty input is not a zero. */
interface Row {
  weekday: string;
  startTime: string;
  endTime: string;
  percent: string;
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const DAY_KEYS = ["slotOffers.day1", "slotOffers.day2", "slotOffers.day3", "slotOffers.day4", "slotOffers.day5", "slotOffers.day6", "slotOffers.day7"] as const;

const toRow = (o: SlotOffer): Row => ({
  weekday: o.weekday != null ? String(o.weekday) : "1",
  startTime: o.startTime ?? "",
  endTime: o.endTime ?? "",
  percent: String(o.percent),
});

/** FG-W2-09: the salon's quiet-hour offers and its last-minute offer. Saved on its own. */
export function SlotOffersCard({ businessId }: { businessId: Id }) {
  const [quiet, setQuiet] = useState<Row[]>([]);
  const [lastOn, setLastOn] = useState(false);
  const [lastHours, setLastHours] = useState("3");
  const [lastPercent, setLastPercent] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    slotOfferService.list(businessId)
      .then((list) => {
        setQuiet(list.filter((o) => o.kind === "QUIET").map(toRow));
        const last = list.find((o) => o.kind === "LAST_MINUTE");
        if (last) {
          setLastOn(true);
          setLastHours(String(last.hoursAhead ?? 3));
          setLastPercent(String(last.percent));
        }
      })
      .catch(() => toast.error(t("slotOffers.loadFailed")));
  }, [businessId]);

  const setRow = (i: number, patch: Partial<Row>) => setQuiet(quiet.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    const offers: SlotOffer[] = quiet.map((r) => ({
      kind: "QUIET",
      weekday: Number(r.weekday),
      startTime: r.startTime,
      endTime: r.endTime,
      percent: Number(r.percent),
    }));
    if (lastOn) {
      offers.push({ kind: "LAST_MINUTE", hoursAhead: Number(lastHours) || 3, percent: Number(lastPercent) });
    }
    setBusy(true);
    try {
      await slotOfferService.save(businessId, offers);
      toast.success(t("slotOffers.saved"));
    } catch {
      toast.error(t("slotOffers.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-[rgb(var(--reg-line))]">
      <div>
        <h3 className="font-extrabold">{t("slotOffers.title")}</h3>
        <p className="text-sm text-[rgb(var(--reg-muted))]">{t("slotOffers.hint")}</p>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={lastOn} onChange={(e) => setLastOn(e.target.checked)} />
          {t("slotOffers.lastMinute")}
        </label>
        {lastOn && (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              {t("slotOffers.hoursAhead")}
              <input className={fieldCls} type="number" min={1} max={72} value={lastHours} onChange={(e) => setLastHours(e.target.value)} />
            </label>
            <label className="text-sm">
              {t("slotOffers.percent")}
              <input className={fieldCls} type="number" min={1} max={90} value={lastPercent} onChange={(e) => setLastPercent(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">{t("slotOffers.quietTitle")}</p>
        {quiet.map((r, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-5">
            <label className="text-sm">
              {t("slotOffers.weekday")}
              <select className={fieldCls} value={r.weekday} onChange={(e) => setRow(i, { weekday: e.target.value })}>
                {WEEKDAYS.map((d, i) => <option key={d} value={d}>{t(DAY_KEYS[i])}</option>)}
              </select>
            </label>
            <label className="text-sm">
              {t("slotOffers.from")}
              <input className={fieldCls} type="time" value={r.startTime} onChange={(e) => setRow(i, { startTime: e.target.value })} />
            </label>
            <label className="text-sm">
              {t("slotOffers.to")}
              <input className={fieldCls} type="time" value={r.endTime} onChange={(e) => setRow(i, { endTime: e.target.value })} />
            </label>
            <label className="text-sm">
              {t("slotOffers.percent")}
              <input className={fieldCls} type="number" min={1} max={90} value={r.percent} onChange={(e) => setRow(i, { percent: e.target.value })} />
            </label>
            <Button type="button" variant="outline" onClick={() => setQuiet(quiet.filter((_, j) => j !== i))}>
              {t("slotOffers.remove")}
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setQuiet([...quiet, { weekday: "1", startTime: "10:00", endTime: "14:00", percent: "" }])}>
          {t("slotOffers.add")}
        </Button>
      </div>

      <Button type="button" onClick={() => void save()} disabled={busy}>{t("slotOffers.save")}</Button>
    </section>
  );
}
