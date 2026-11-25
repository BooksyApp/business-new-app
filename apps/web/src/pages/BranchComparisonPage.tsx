import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { formatPrice } from "@/lib/currency";
import { branchReportService, type SalonComparisonRow } from "@/services/branchReportService";
import { t } from "@/i18n";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * FG-W5-09: the owner's salons side by side for one period. Totals are summed over the
 * salons ticked here, so the owner can compare any subset. Owner-only on the server; a
 * team member gets an empty list.
 */
export default function BranchComparisonPage() {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const [from, setFrom] = useState(isoDay(monthAgo));
  const [to, setTo] = useState(isoDay(today));
  const [rows, setRows] = useState<SalonComparisonRow[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    branchReportService
      .compare(from, to)
      .then((list) => {
        setRows(list);
        setPicked(new Set(list.map((r) => String(r.id))));
      })
      .catch(() => {
        setError(true);
        toast.error(t("cmp.couldNotLoad"));
      });
  }, [from, to]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totals = useMemo(() => {
    const sel = (rows ?? []).filter((r) => picked.has(String(r.id)));
    const sum = (f: (r: SalonComparisonRow) => number | string | null | undefined) =>
      sel.reduce((acc, r) => acc + Number(f(r) ?? 0), 0);
    const revenue = sum((r) => r.revenue);
    const bookings = sum((r) => r.bookings);
    return {
      revenue,
      bookings,
      cancellations: sum((r) => r.cancellations),
      noShows: sum((r) => r.noShows),
      newClients: sum((r) => r.newClients),
      // Revenue over bookings across the ticked salons; the per-salon average ticket is the
      // server's figure, so this total is an approximation when salons differ in mix.
      averageTicket: bookings > 0 ? revenue / bookings : 0,
    };
  }, [rows, picked]);

  const cell = "px-3 py-2 text-right tabular-nums";

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("cmp.compareSalons")} subtitle={t("cmp.compareHint")} />
        <div className={pageBody}>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {t("cmp.from")}
              <input type="date" className={fieldCls} value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("cmp.to")}
              <input type="date" className={fieldCls} value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>

          {error ? (
            <div className="rounded-[20px] bg-rose-50 p-4 text-sm text-rose-900 ring-1 ring-inset ring-rose-200">{t("cmp.couldNotLoad")}</div>
          ) : rows === null ? (
            <div className="h-32 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : rows.length === 0 ? (
            <div className="rounded-[20px] border-2 border-dashed border-[rgb(var(--reg-line))] p-5 text-sm text-[rgb(var(--reg-muted))]">{t("cmp.noSalons")}</div>
          ) : (
            <div className="overflow-x-auto rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-[12px] text-[rgb(var(--reg-muted))]">
                    <th className="px-3 py-2">{t("cmp.salon")}</th>
                    <th className={cell}>{t("cmp.revenue")}</th>
                    <th className={cell}>{t("cmp.bookings")}</th>
                    <th className={cell}>{t("cmp.cancellations")}</th>
                    <th className={cell}>{t("cmp.noShows")}</th>
                    <th className={cell}>{t("cmp.newClients")}</th>
                    <th className={cell}>{t("cmp.averageTicket")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const id = String(r.id);
                    return (
                      <tr key={id} className="border-t border-[rgb(var(--reg-line)/0.6)]">
                        <td className="px-3 py-2">
                          <label className="flex items-center gap-2 font-semibold">
                            <input type="checkbox" checked={picked.has(id)} onChange={() => toggle(id)} aria-label={r.name} />
                            {r.name}
                          </label>
                        </td>
                        <td className={cell}>{formatPrice(r.revenue)}</td>
                        <td className={cell}>{r.bookings ?? 0}</td>
                        <td className={cell}>{r.cancellations ?? 0}</td>
                        <td className={cell}>{r.noShows ?? 0}</td>
                        <td className={cell}>{r.newClients ?? 0}</td>
                        <td className={cell}>{formatPrice(r.averageTicket)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[rgb(var(--reg-line))] font-bold">
                    <td className="px-3 py-2">{t("cmp.totalOfTicked")}</td>
                    <td className={cell}>{formatPrice(totals.revenue)}</td>
                    <td className={cell}>{totals.bookings}</td>
                    <td className={cell}>{totals.cancellations}</td>
                    <td className={cell}>{totals.noShows}</td>
                    <td className={cell}>{totals.newClients}</td>
                    <td className={cell}>{formatPrice(totals.averageTicket)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
