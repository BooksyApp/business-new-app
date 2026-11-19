import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { Empty, PeriodPicker } from "@/components/reports/ReportsKit";
import { fmtDay, fmtMoney, fmtPeriod, useReportPeriod, type RangeKey } from "@/components/reports/reportsFormat";
import { PaymentSheet, StatusPill } from "@/components/payments/PaymentSheet";
import { LEDGER_METHODS, LEDGER_STATUSES, ledgerService, methodLabel, type Ledger, type LedgerRow } from "@/services/ledgerService";
import { staffService } from "@/services/staffService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { cn } from "@/lib/utils";
import { t, type TKey } from "@/i18n";

const PAY_RANGES: readonly RangeKey[] = ["today", "7d", "30d", "mtd", "lastMonth"];

const selectCls = cn(fieldCls, "h-10 w-full min-w-0 pr-8 text-[14px]");

/**
 * Payments (HUB-V3, 2026-11-19): every payment the salon took in a period — till sales by
 * tender, online gift cards and wallet top-ups, refunds and what is still owed — with the
 * day's totals on top and each payment's detail (lines, tenders, refund, receipt, invoice) in
 * a side sheet. One request: GET /sales/business/{id}/ledger.
 */
export default function PaymentsPage() {
  const businessId = useBusinessId();
  const qc = useQueryClient();
  const { range, setRange, start, end } = useReportPeriod("7d");
  const [day, setDay] = useState<string | null>(null);
  const [method, setMethod] = useState("");
  const [staffId, setStaffId] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<LedgerRow | null>(null);

  const filter = { from: day ?? start, to: day ?? end, method: method || undefined, staffId: staffId || undefined, status: status || undefined, q: query.trim() || undefined };
  const q = useQuery({
    queryKey: ["ledger", businessId, filter],
    queryFn: () => ledgerService.get(businessId, filter),
    enabled: Boolean(businessId),
    placeholderData: (prev) => prev,
  });
  // The strip shows the whole period, whatever day is picked.
  const strip = useQuery({
    queryKey: ["ledger", businessId, { from: start, to: end }],
    queryFn: () => ledgerService.get(businessId, { from: start, to: end }),
    enabled: Boolean(businessId) && Boolean(day || method || staffId || status || query.trim()),
  });
  const staff = useQuery({ queryKey: ["staff-list", businessId], queryFn: () => staffService.getStaffByBusiness(businessId), enabled: Boolean(businessId), staleTime: 300_000 });

  const d = q.data;
  const days = (strip.data ?? d)?.days ?? [];
  const groups = useMemo(() => groupByDay(d?.rows ?? []), [d]);
  const changeRange = (r: RangeKey) => {
    setDay(null);
    setRange(r);
  };

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("ledger.title")} subtitle={t("ledger.subtitle")} actions={<PeriodPicker value={range} onChange={changeRange} ranges={PAY_RANGES} />} />
        <div className={pageBody}>
          {d && <Totals d={d} />}

          {days.length > 1 && <DayStrip days={days} picked={day} onPick={(x) => setDay(x === day ? null : x)} />}

          <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
            <label className="relative col-span-2 md:col-span-1">
              <span className="sr-only">{t("ledger.search")}</span>
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
              <input className={cn(fieldCls, "h-10 w-full pl-10 text-[14px]")} placeholder={t("ledger.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <select aria-label={t("ledger.method")} className={selectCls} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">{t("ledger.allMethods")}</option>
              {LEDGER_METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
            </select>
            <select aria-label={t("ledger.staff")} className={selectCls} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">{t("ledger.allStaff")}</option>
              {(staff.data ?? []).map((s) => <option key={String(s.id)} value={String(s.id)}>{s.name}</option>)}
            </select>
            <select aria-label={t("ledger.status")} className={cn(selectCls, "col-span-2 md:col-span-1")} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("ledger.allStatuses")}</option>
              {LEDGER_STATUSES.map((s) => <option key={s} value={s}>{t(`ledger.s.${s}` as TKey)}</option>)}
            </select>
          </div>

          {q.isError ? (
            <Empty>{t("ledger.loadFailed")}</Empty>
          ) : !d ? (
            <div className="h-[320px] animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)] motion-reduce:animate-none" aria-busy="true" />
          ) : d.rows.length === 0 ? (
            <Empty>{t("ledger.none", { period: fmtPeriod(d.period) })}</Empty>
          ) : (
            <div className="space-y-5">
              {groups.map(([date, rows]) => (
                <section key={date} aria-label={fmtDay(date, { weekday: "long", day: "numeric", month: "long" })}>
                  <h2 className="mb-2 flex items-baseline justify-between px-1 text-[13px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">
                    <span>{fmtDay(date, { weekday: "long", day: "numeric", month: "long" })}</span>
                    <span className="tabular-nums normal-case tracking-normal">{fmtMoney(rows.filter((r) => r.status !== "VOID").reduce((a, r) => a + r.paid - r.refunded, 0))}</span>
                  </h2>
                  <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                    {rows.map((r, i) => (
                      <li key={`${r.id ?? r.ref}-${i}`} className="border-t border-[rgb(var(--reg-line)/0.6)] first:border-t-0">
                        <button type="button" onClick={() => setOpen(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgb(var(--reg-canvas)/0.7)] focus-visible:bg-[rgb(var(--reg-canvas))] focus-visible:outline-none md:px-5">
                          <span className="w-11 shrink-0 text-[13px] tabular-nums text-[rgb(var(--reg-muted))]">{r.time}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold">{r.clientName || t("ledger.walkIn")}</span>
                            <span className="block truncate text-[13px] text-[rgb(var(--reg-muted))]">
                              {r.kind === "SALE" ? r.items || t("ledger.sale") : t(`ledger.k.${r.kind}` as TKey)}
                              {r.staffName ? ` · ${r.staffName}` : ""}
                            </span>
                          </span>
                          <span className="hidden shrink-0 gap-1 md:flex">
                            {r.methods.map((m) => (
                              <span key={m.method} className="rounded-full bg-[rgb(var(--reg-ink)/0.05)] px-2 py-0.5 text-[12px] font-semibold text-[rgb(var(--reg-ink)/0.7)]">{methodLabel(m.method)}</span>
                            ))}
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            <span className={cn("text-[15px] font-bold tabular-nums", r.status === "VOID" && "text-[rgb(var(--reg-muted))] line-through")}>{fmtMoney(r.total)}</span>
                            {r.status !== "PAID" && <StatusPill status={r.status} />}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {d.truncated && <p className="text-center text-[13px] text-[rgb(var(--reg-muted))]">{t("ledger.truncated")}</p>}
            </div>
          )}
        </div>

        <PaymentSheet
          row={open}
          onClose={() => setOpen(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["ledger", businessId] })}
          businessId={businessId}
        />
      </BooqiScope>
    </AppLayout>
  );
}

function groupByDay(rows: LedgerRow[]): [string, LedgerRow[]][] {
  const m = new Map<string, LedgerRow[]>();
  for (const r of rows) m.set(r.date, [...(m.get(r.date) ?? []), r]);
  return [...m.entries()];
}

function Totals({ d }: { d: Ledger }) {
  const t0 = d.totals;
  const methods = Object.entries(t0.byMethod).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...methods.map((m) => m[1]));
  const tile = (label: string, value: string, hint?: string, warn?: boolean) => (
    <div className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
      <p className="text-[13px] font-semibold text-[rgb(var(--reg-muted))]">{label}</p>
      <p className={cn("mt-2 text-[24px] font-extrabold leading-none tracking-[-0.03em] tabular-nums md:text-[26px]", warn && "text-amber-700")}>{value}</p>
      {hint && <p className="mt-2 text-[12px] text-[rgb(var(--reg-muted))]">{hint}</p>}
    </div>
  );
  return (
    <div className="grid gap-3 md:gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {tile(t("ledger.net"), fmtMoney(t0.net), t("ledger.paymentsN", { count: t0.count }))}
        {tile(t("ledger.refunds"), fmtMoney(t0.refunds))}
        {tile(t("ledger.owedTotal"), fmtMoney(t0.owed), t("ledger.owedHint"), t0.owed > 0)}
        {tile(t("ledger.tips"), fmtMoney(t0.tips))}
        {(t0.renterRevenue ?? 0) > 0 && tile(t("ledger.renterRevenue"), fmtMoney(t0.renterRevenue ?? 0), t("ledger.renterRevenueHint"))}
      </div>
      <div className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
        <p className="mb-3 text-[13px] font-semibold text-[rgb(var(--reg-muted))]">{t("ledger.byMethod")}</p>
        {methods.length ? (
          <ul className="space-y-2">
            {methods.map(([m, v]) => (
              <li key={m} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-[13px]">
                <span className="truncate font-semibold">{methodLabel(m)}</span>
                <span className="h-1.5 rounded-full bg-[rgb(var(--rp-track))]" aria-hidden>
                  <span className="block h-1.5 rounded-full bg-[rgb(var(--rp-accent))]" style={{ width: `${(v / max) * 100}%` }} />
                </span>
                <span className="tabular-nums">{fmtMoney(v)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[rgb(var(--reg-muted))]">{t("ledger.noneShort")}</p>
        )}
      </div>
    </div>
  );
}

/** One column per day: the day's net takings; picking a day narrows the list to it. */
function DayStrip({ days, picked, onPick }: { days: Ledger["days"]; picked: string | null; onPick: (d: string) => void }) {
  const max = Math.max(1, ...days.map((x) => x.net));
  return (
    <div className="overflow-x-auto rounded-[20px] bg-white p-3 ring-1 ring-[rgb(var(--reg-line)/0.8)] [scrollbar-width:thin]">
      <ul className="flex min-w-max gap-1.5" aria-label={t("ledger.dailyTotals")}>
        {days.map((x) => {
          const on = picked === x.date;
          return (
            <li key={x.date}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(x.date)}
                className={cn(
                  "flex w-[76px] flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
                  on ? "bg-[rgb(var(--reg-ink))] text-white" : "hover:bg-[rgb(var(--reg-canvas))]",
                )}
              >
                <span className={cn("text-[11.5px] font-semibold", on ? "text-white/75" : "text-[rgb(var(--reg-muted))]")}>{fmtDay(x.date, { weekday: "short", day: "numeric" })}</span>
                <span className="flex h-10 w-3 items-end rounded-full bg-[rgb(var(--rp-track))]" aria-hidden>
                  <span className={cn("block w-3 rounded-full", on ? "bg-white" : "bg-[rgb(var(--rp-accent))]")} style={{ height: `${Math.max(x.net > 0 ? 8 : 0, (x.net / max) * 100)}%` }} />
                </span>
                <span className="text-[12px] font-bold tabular-nums">{fmtMoney(x.net)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
