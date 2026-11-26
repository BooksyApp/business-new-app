import { P4Loading, P4Error } from "@/components/bz/p4-kit";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { BarRows, PanelLink } from "@/components/reports/ReportsKit";
import { fmtMoney, loc } from "@/components/reports/reportsFormat";
import { accountsService, n, type ProfitMonth } from "@/services/accountsService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useNavigation } from "@/utils/navigationUtils";
import { formatDate, formatNumber } from "@/i18n/format";
import { t, type TKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { BooqiScope, Empty, PageHeader, Panel, pageBody } from "@/components/bz/p4-compat";

const monthShort = (m: string) => formatDate(loc(), `${m}-15T12:00:00`, { month: "short" });
const monthLong = (m: string) => formatDate(loc(), `${m}-15T12:00:00`, { month: "long", year: "numeric" });
const catLabel = (c: string) => {
  const k = `expenses.cat.${c}` as TKey;
  const v = t(k);
  return v === k ? c : v;
};

/**
 * Profit (HUB-V3): month by month, what came in (sales less refunds) and what went out
 * (expenses, approved wages, booqi's marketplace commission), with the profit as one bar per
 * month and the breakdown beneath. GET /businesses/{id}/profit-and-loss/monthly.
 */
export default function ProfitPage() {
  const businessId = useBusinessId();
  const { getPath } = useNavigation();
  const [months, setMonths] = useState(6);
  const q = useQuery({ queryKey: ["profit-monthly", businessId, months], queryFn: () => accountsService.profitByMonth(businessId, months), enabled: Boolean(businessId) });
  const d = q.data;
  const rows = (d?.months ?? []).map((m) => ({ ...m, p: n(m.profit) }));

  const picker = (
    <div role="radiogroup" aria-label={t("reports.period")} className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
      {[3, 6, 12].map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={months === m}
          onClick={() => setMonths(m)}
          className={cn("h-8 rounded-full px-3 text-[13px] font-semibold", months === m ? "bg-[rgb(var(--reg-ink))] text-white" : "text-[rgb(var(--reg-ink)/0.65)] hover:text-[rgb(var(--reg-ink))]")}
        >
          {t("ledger.lastMonths", { count: m })}
        </button>
      ))}
    </div>
  );

  const tile = (label: string, value: number, strong?: boolean) => (
    <div className={cn("rounded-[20px] p-4 ring-1 md:p-5", strong ? "bg-[rgb(var(--reg-ink))] text-white ring-transparent" : "bg-white ring-[rgb(var(--reg-line)/0.8)]")}>
      <p className={cn("text-[13px] font-semibold", strong ? "text-white/70" : "text-[rgb(var(--reg-muted))]")}>{label}</p>
      <p className="mt-2 text-[24px] font-extrabold leading-none tracking-[-0.03em] tabular-nums md:text-[26px]">{fmtMoney(value)}</p>
    </div>
  );

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("ledger.profitTitle")} subtitle={t("ledger.profitHint")} actions={picker} />
        <div className={pageBody}>
          {q.isError ? (
            <P4Error title={t("ledger.loadFailed")} />
          ) : !d ? (
            <P4Loading />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
                {tile(t("ledger.revenueNet"), n(d.totals.revenue))}
                {tile(t("ledger.costs"), n(d.totals.expenses) + n(d.totals.wages))}
                {tile(t("ledger.commission"), n(d.totals.commission))}
                {tile(t("ledger.profit"), n(d.totals.profit), true)}
              </div>
              {n(d.totals.renterRevenue) > 0 && (
                <p className="text-sm text-[rgb(var(--reg-muted))]">
                  <span className="font-semibold text-[rgb(var(--reg-ink))]">{t("ledger.renterRevenue")}: {fmtMoney(n(d.totals.renterRevenue))}</span>{" · "}{t("ledger.renterRevenueHint")}
                </p>
              )}

              <Panel title={t("ledger.profitByMonth")} hint={t("ledger.profitByMonthHint")}>
                <div style={{ height: 260 }} role="img" aria-label={t("ledger.profitByMonth")}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke="rgb(var(--rp-grid))" />
                      <XAxis dataKey="month" tickFormatter={monthShort} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "rgb(var(--reg-muted))" }} />
                      <YAxis width={56} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "rgb(var(--reg-muted))" }} tickFormatter={(v: number) => formatNumber(loc(), v, { notation: "compact" })} />
                      <ReferenceLine y={0} stroke="rgb(var(--reg-ink) / 0.3)" />
                      <Tooltip
                        cursor={{ fill: "rgb(var(--reg-ink) / 0.04)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const m = payload[0].payload as ProfitMonth;
                          return (
                            <div className="rounded-xl bg-[rgb(var(--reg-ink))] px-3 py-2 text-[12.5px] text-white shadow-lg">
                              <p className="font-semibold">{monthLong(m.month)}</p>
                              <p className="tabular-nums">{t("ledger.profit")}: {fmtMoney(n(m.profit))}</p>
                              <p className="tabular-nums text-white/65">{t("ledger.revenueNet")}: {fmtMoney(n(m.revenue))}</p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="p" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                        {rows.map((r) => (
                          <Cell key={r.month} fill={r.p < 0 ? "rgb(var(--rp-bad))" : "rgb(var(--rp-accent))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                <Panel title={t("ledger.breakdown")}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-[14px]">
                      <thead>
                        <tr className="text-right text-[12px] text-[rgb(var(--reg-muted))]">
                          <th scope="col" className="pb-2 text-left font-medium">{t("ledger.taxMonth")}</th>
                          <th scope="col" className="pb-2 font-medium">{t("ledger.takings")}</th>
                          <th scope="col" className="pb-2 font-medium">{t("ledger.refunds")}</th>
                          <th scope="col" className="pb-2 font-medium">{t("ledger.expenses")}</th>
                          <th scope="col" className="pb-2 font-medium">{t("ledger.wages")}</th>
                          <th scope="col" className="pb-2 font-medium">{t("ledger.commission")}</th>
                          <th scope="col" className="pb-2 font-medium">{t("ledger.profit")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...d.months].reverse().map((m) => (
                          <tr key={m.month} className="border-t border-[rgb(var(--reg-line)/0.6)] text-right tabular-nums">
                            <th scope="row" className="py-2.5 text-left font-semibold">{monthLong(m.month)}</th>
                            <td className="py-2.5">{fmtMoney(n(m.takings))}</td>
                            <td className="py-2.5 text-[rgb(var(--reg-muted))]">{n(m.refunds) ? `−${fmtMoney(n(m.refunds))}` : "–"}</td>
                            <td className="py-2.5 text-[rgb(var(--reg-muted))]">{n(m.expenses) ? `−${fmtMoney(n(m.expenses))}` : "–"}</td>
                            <td className="py-2.5 text-[rgb(var(--reg-muted))]">{n(m.wages) ? `−${fmtMoney(n(m.wages))}` : "–"}</td>
                            <td className="py-2.5 text-[rgb(var(--reg-muted))]">{n(m.commission) ? `−${fmtMoney(n(m.commission))}` : "–"}</td>
                            <td className={cn("py-2.5 font-bold", n(m.profit) < 0 && "text-[rgb(var(--rp-bad))]")}>{fmtMoney(n(m.profit))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!d.commissionTracked && <p className="mt-3 text-[12.5px] text-[rgb(var(--reg-muted))]">{t("ledger.commissionPending")}</p>}
                  {d.commissionTracked && <div className="mt-3"><PanelLink to={getPath("/billing")}>{t("ledger.commissionStatement")}</PanelLink></div>}
                </Panel>
                <Panel title={t("ledger.expensesByCategory")} action={<PanelLink to={getPath("/expenses")}>{t("reports.open")}</PanelLink>}>
                  {d.byCategory.length ? (
                    <BarRows rows={d.byCategory.map((c) => ({ label: catLabel(c.category), value: n(c.amount) }))} unit="money" />
                  ) : (
                    <Empty>{t("ledger.noExpenses")}</Empty>
                  )}
                </Panel>
              </div>
            </>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
