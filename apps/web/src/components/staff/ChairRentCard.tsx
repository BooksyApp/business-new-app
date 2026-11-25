import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fieldCls } from "@/components/page/kitStyles";
import { currencySymbol } from "@/lib/currency";
import { t } from "@/i18n";
import {
  chairRentService,
  type ChairRentLedger,
  type ChairRentPayment,
  type ChairRentRow,
} from "@/services/chairRentService";
import type { Id } from "@/types/id";

const WEEKDAY_KEYS = ["slotOffers.day1", "slotOffers.day2", "slotOffers.day3", "slotOffers.day4", "slotOffers.day5", "slotOffers.day6", "slotOffers.day7"] as const;
const METHODS: ChairRentPayment["method"][] = ["CASH", "CARD", "TRANSFER"];
const today = () => new Date().toISOString().slice(0, 10);

/** The terms as the form edits them: strings, so an empty input is not a zero. */
interface Terms {
  period: "WEEKLY" | "MONTHLY";
  amount: string;
  dueDay: string;
}

const EMPTY_TERMS: Terms = { period: "MONTHLY", amount: "", dueDay: "1" };

function methodLabel(m: ChairRentPayment["method"]) {
  return m === "CASH" ? t("chairRent.method.CASH") : m === "CARD" ? t("chairRent.method.CARD") : t("chairRent.method.TRANSFER");
}

function statusLabel(status: ChairRentRow["status"]) {
  return t(status === "PAID" ? "chairRent.paid" : status === "OVERDUE" ? "chairRent.overdue" : "chairRent.due");
}

/**
 * FG-W5-02: a chair renter's rent. The salon's income from a renter is not salon revenue, and the rent is
 * a salon expense once paid. Nothing is charged online. Saved on its own, from the staff edit page.
 */
export function ChairRentCard({ businessId, staffId }: { businessId: Id; staffId: Id }) {
  const [ledger, setLedger] = useState<ChairRentLedger | null>(null);
  const [editing, setEditing] = useState(false);
  const [terms, setTerms] = useState<Terms>(EMPTY_TERMS);
  const [payingFor, setPayingFor] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ paidOn: string; method: ChairRentPayment["method"] }>({
    paidOn: today(),
    method: "CASH",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    chairRentService.get(businessId, staffId)
      .then(setLedger)
      .catch(() => toast.error(t("chairRent.loadFailed")));
  }, [businessId, staffId]);

  const rental = ledger?.rental;
  const renting = !!rental?.active;

  const startEditing = () => {
    setTerms(rental
      ? { period: rental.period, amount: String(rental.amount), dueDay: String(rental.dueDay) }
      : EMPTY_TERMS);
    setEditing(true);
  };

  const run = async (
    action: () => Promise<ChairRentLedger>,
    okKey: "chairRent.saved" | "chairRent.stopped" | "chairRent.paidSaved",
    failKey: "chairRent.saveFailed" | "chairRent.payFailed",
  ) => {
    setBusy(true);
    try {
      setLedger(await action());
      toast.success(t(okKey));
      return true;
    } catch (e) {
      const message = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message;
      toast.error(message || t(failKey));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveTerms = async () => {
    const ok = await run(
      () => chairRentService.save(businessId, staffId, {
        renter: true,
        period: terms.period,
        amount: Number(terms.amount),
        dueDay: Number(terms.dueDay),
      }),
      "chairRent.saved",
      "chairRent.saveFailed",
    );
    if (ok) setEditing(false);
  };

  const stopRenting = () =>
    run(() => chairRentService.save(businessId, staffId, { renter: false }), "chairRent.stopped", "chairRent.saveFailed");

  const markPaid = async (dueOn: string) => {
    const ok = await run(
      () => chairRentService.markPaid(businessId, staffId, { dueOn, paidOn: payment.paidOn, method: payment.method }),
      "chairRent.paidSaved",
      "chairRent.payFailed",
    );
    if (ok) setPayingFor(null);
  };

  const dueDayLabel = (r: NonNullable<typeof rental>) =>
    r.period === "WEEKLY" ? t(WEEKDAY_KEYS[r.dueDay - 1]) : String(r.dueDay);

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-[rgb(var(--reg-line))]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-extrabold">{t("chairRent.title")}</h3>
          <p className="text-sm text-[rgb(var(--reg-muted))]">{t("chairRent.hint")}</p>
        </div>
        {renting && (ledger?.overdueCount ?? 0) > 0 && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            {t("chairRent.overdueBadge", { n: ledger?.overdueCount ?? 0 })}
          </span>
        )}
      </div>

      {renting && rental && !editing && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>
            {t(rental.period === "WEEKLY" ? "chairRent.weekly" : "chairRent.monthly")} · {rental.amount} {currencySymbol()}
            {" · "}{t("chairRent.dueDay", { day: dueDayLabel(rental) })}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={startEditing} disabled={busy}>{t("chairRent.edit")}</Button>
            <Button type="button" variant="outline" onClick={() => void stopRenting()} disabled={busy}>{t("chairRent.stop")}</Button>
          </div>
        </div>
      )}

      {(!renting || editing) && (
        <div className="space-y-3">
          {!renting && !editing && (
            <Button type="button" variant="outline" onClick={startEditing}>{t("chairRent.makeRenter")}</Button>
          )}
          {editing && (
            <div className="grid items-end gap-2 sm:grid-cols-4">
              <label className="text-sm">
                {t("chairRent.period")}
                <select className={fieldCls} value={terms.period} onChange={(e) => setTerms({ ...terms, period: e.target.value as Terms["period"], dueDay: "1" })}>
                  <option value="WEEKLY">{t("chairRent.weekly")}</option>
                  <option value="MONTHLY">{t("chairRent.monthly")}</option>
                </select>
              </label>
              <label className="text-sm">
                {t("chairRent.amount")}
                <input className={fieldCls} type="number" min={0} step="0.01" value={terms.amount} onChange={(e) => setTerms({ ...terms, amount: e.target.value })} />
              </label>
              <label className="text-sm">
                {terms.period === "WEEKLY" ? t("chairRent.dueWeekday") : t("chairRent.dueDayOfMonth")}
                {terms.period === "WEEKLY" ? (
                  <select className={fieldCls} value={terms.dueDay} onChange={(e) => setTerms({ ...terms, dueDay: e.target.value })}>
                    {[1, 2, 3, 4, 5, 6, 7].map((d, k) => <option key={d} value={d}>{t(WEEKDAY_KEYS[k])}</option>)}
                  </select>
                ) : (
                  <input className={fieldCls} type="number" min={1} max={28} value={terms.dueDay} onChange={(e) => setTerms({ ...terms, dueDay: e.target.value })} />
                )}
              </label>
              <div className="flex gap-2">
                <Button type="button" onClick={() => void saveTerms()} disabled={busy}>{t("chairRent.save")}</Button>
                {renting && <Button type="button" variant="outline" onClick={() => setEditing(false)}>{t("chairRent.cancel")}</Button>}
              </div>
            </div>
          )}
        </div>
      )}

      {renting && ledger && ledger.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-[rgb(var(--reg-muted))]">
              <tr>
                <th className="py-2 pr-3">{t("chairRent.dueOn")}</th>
                <th className="py-2 pr-3">{t("chairRent.amount")}</th>
                <th className="py-2 pr-3">{t("chairRent.status")}</th>
                <th className="py-2 pr-3">{t("chairRent.paidOn")}</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {[...ledger.rows].reverse().map((row) => (
                <tr key={row.dueOn} className="border-t border-[rgb(var(--reg-line))]">
                  <td className="py-2 pr-3 tabular-nums">{row.dueOn}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.amount} {currencySymbol()}</td>
                  <td className="py-2 pr-3">
                    <span className={row.status === "OVERDUE" ? "font-semibold text-red-700" : row.status === "PAID" ? "text-emerald-700" : ""}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {row.paidOn ? `${row.paidOn}${row.method ? ` · ${methodLabel(row.method as ChairRentPayment["method"])}` : ""}` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {row.status === "PAID" ? null : payingFor === row.dueOn ? (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <input className={fieldCls} type="date" value={payment.paidOn} onChange={(e) => setPayment({ ...payment, paidOn: e.target.value })} />
                        <select className={fieldCls} value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value as ChairRentPayment["method"] })}>
                          {METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
                        </select>
                        <Button type="button" onClick={() => void markPaid(row.dueOn)} disabled={busy}>{t("chairRent.confirmPaid")}</Button>
                        <Button type="button" variant="outline" onClick={() => setPayingFor(null)}>{t("chairRent.cancel")}</Button>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" onClick={() => { setPayingFor(row.dueOn); setPayment({ paidOn: today(), method: "CASH" }); }}>
                        {t("chairRent.markPaid")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
