import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BarRows, CohortTable, Delta, Heatmap, TrendChart } from "@/components/reports/ReportsKit";
import { fmtBy, fmtInt, fmtMoney, fmtPct, fmtPeriod, useReportPeriod, type Unit } from "@/components/reports/reportsFormat";
import { NoShowImpact } from "@/components/analytics/NoShowImpact";
import { DiscountImpact } from "@/components/analytics/DiscountImpact";
import RevenuePlanCard from "@/components/analytics/RevenuePlanCard";
import { SOURCE_KEYS, dashboardService, type Dashboard, type KpiKey } from "@/services/dashboardService";
import { analysisService } from "@/services/analysisService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useNavigation } from "@/utils/navigationUtils";
import { t, type TKey } from "@/i18n";
import { BRAND_FONT } from "@/components/auth/useBrandFont";
import { BooqiScope, Empty, PageHeader, Panel, PeriodPicker, pageBody } from "@/components/bz/p4-compat";

/** One report behind a dashboard tile: its headline against the previous period, then the detail. */
type KpiMetric = { key: KpiKey; unit: Unit; title: TKey; hint: TKey; goodWhen?: "up" | "down" };
const METRICS: Record<string, KpiMetric | { key: null; title: TKey; hint: TKey }> = {
  revenue: { key: "revenue", unit: "money", title: "reports.m.revenue", hint: "reports.h.revenue" },
  bookings: { key: "bookings", unit: "int", title: "reports.m.bookings", hint: "reports.h.bookings" },
  ticket: { key: "averageTicket", unit: "money", title: "reports.m.ticket", hint: "reports.h.ticket" },
  clients: { key: "clients", unit: "int", title: "reports.m.clients", hint: "reports.h.clients" },
  rebooking: { key: "rebookingRate", unit: "pct", title: "reports.m.rebooking", hint: "reports.h.rebooking" },
  "no-shows": { key: "noShowRate", unit: "pct", title: "reports.m.noShows", hint: "reports.h.noShows", goodWhen: "down" },
  occupancy: { key: "utilization", unit: "pct", title: "reports.m.occupancy", hint: "reports.h.occupancy" },
  online: { key: "onlineShare", unit: "pct", title: "reports.m.online", hint: "reports.h.online" },
  discounts: { key: null, title: "reports.m.discounts", hint: "reports.h.discounts" },
};

export default function ReportDetailPage() {
  const { metric = "" } = useParams<{ metric: string }>();
  const businessId = useBusinessId();
  const { getPath } = useNavigation();
  const { range, setRange, start, end, query } = useReportPeriod();
  const m = METRICS[metric];
  const q = useQuery({
    queryKey: ["reports-dashboard", businessId, start, end],
    queryFn: () => dashboardService.get(businessId, start, end),
    enabled: Boolean(businessId) && Boolean(m),
    staleTime: 60_000,
  });
  const needRevenue = metric === "revenue";
  const needBookings = metric === "bookings";
  const needClients = metric === "clients";
  const rev = useQuery({ queryKey: ["reports-rev", businessId, start, end], queryFn: () => analysisService.getRevenueAnalytics(businessId, start, end), enabled: Boolean(businessId) && needRevenue, staleTime: 60_000 });
  const bk = useQuery({ queryKey: ["reports-bk", businessId, start, end], queryFn: () => analysisService.getBookingAnalytics(businessId, start, end), enabled: Boolean(businessId) && needBookings, staleTime: 60_000 });
  const cl = useQuery({ queryKey: ["reports-cl", businessId, start, end], queryFn: () => analysisService.getClientAnalytics(businessId, start, end), enabled: Boolean(businessId) && needClients, staleTime: 60_000 });

  if (!m) return <Navigate to={getPath("/analytics")} replace />;
  const back = `${getPath("/analytics")}${query}`;
  const km: KpiMetric | null = m.key === null ? null : (m as KpiMetric);
  const d = q.data;

  return (
    <AppLayout>
      <BooqiScope>
        <nav aria-label={t("nav.trail")} style={{ fontFamily: BRAND_FONT }} className="border-b border-[rgb(var(--reg-line)/0.6)] px-2 text-[13px] md:px-8">
          <Link to={back} className="flex h-10 items-center gap-0.5 px-2 font-semibold text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))] md:hidden">
            <ChevronLeft size={16} aria-hidden />
            {t("nav.reports")}
          </Link>
          <ol className="hidden h-10 items-center gap-1.5 md:flex">
            <li>
              <Link to={back} className="font-semibold text-[rgb(var(--reg-muted))] underline-offset-4 hover:text-[rgb(var(--reg-ink))] hover:underline">{t("nav.reports")}</Link>
            </li>
            <li aria-hidden className="text-[rgb(var(--reg-ink)/0.3)]"><ChevronRight size={14} /></li>
            <li aria-current="page" className="font-semibold">{t(m.title)}</li>
          </ol>
        </nav>
        <PageHeader title={t(m.title)} subtitle={t(m.hint)} actions={<PeriodPicker value={range} onChange={setRange} />} />
        <div className={pageBody}>
          {km === null ? (
            <DiscountImpact businessId={businessId} startDate={start} endDate={end} />
          ) : !d ? (
            q.isError ? <Empty>{t("reports.loadFailed")}</Empty> : <div className="h-[300px] animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)] motion-reduce:animate-none" aria-busy="true" />
          ) : (
            <>
              <Headline d={d} k={km.key} unit={km.unit} goodWhen={km.goodWhen} />
              <Detail metric={metric} d={d} rev={rev.data} bk={bk.data} cl={cl.data} businessId={businessId} start={start} end={end} />
            </>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}

function Headline({ d, k, unit, goodWhen }: { d: Dashboard; k: KpiKey; unit: Unit; goodWhen?: "up" | "down" }) {
  const p = d.kpis[k];
  return (
    <section className="flex flex-wrap items-end gap-x-6 gap-y-2 rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6">
      <div>
        <p className="text-[13px] font-semibold text-[rgb(var(--reg-muted))]">{fmtPeriod(d.period)}</p>
        <p className="mt-1 text-[40px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{fmtBy(unit, p.value)}</p>
      </div>
      <div className="pb-1">
        <Delta value={p.value} previous={p.previous} unit={unit} goodWhen={goodWhen} />
        <p className="mt-1 text-[12.5px] text-[rgb(var(--reg-muted))]">{t("reports.previousWas", { period: fmtPeriod(d.previousPeriod), value: fmtBy(unit, p.previous) })}</p>
      </div>
    </section>
  );
}

type Rev = Awaited<ReturnType<typeof analysisService.getRevenueAnalytics>>;
type Bk = Awaited<ReturnType<typeof analysisService.getBookingAnalytics>>;
type Cl = Awaited<ReturnType<typeof analysisService.getClientAnalytics>>;

const methodLabel = (m: string) => {
  const k = `opt.payStatus.${m.toLowerCase()}` as TKey;
  const v = t(k);
  return v === k ? m : v;
};

function Detail({ metric, d, rev, bk, cl, businessId, start, end }: { metric: string; d: Dashboard; rev?: Rev; bk?: Bk; cl?: Cl; businessId: ReturnType<typeof useBusinessId>; start: string; end: string }) {
  const trend = d.revenueTrend.map((r) => ({ date: r.date, value: r.revenue, previous: r.previous }));
  switch (metric) {
    case "revenue":
      return (
        <>
          <Panel title={t("reports.revenueTrend")} hint={t("reports.revenueTrendHint")}>
            <TrendChart data={trend} unit="money" height={300} />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("reports.byMethod")} hint={t("reports.byMethodHint")}>
              {rev?.revenueByPaymentMethod?.length ? (
                <BarRows rows={rev.revenueByPaymentMethod.map((r) => ({ label: methodLabel(r.paymentMethod), value: Number(r.revenue), sub: t("reports.salesN", { count: Number(r.transactions) }) }))} unit="money" />
              ) : (
                <Empty>{t("reports.noSales")}</Empty>
              )}
            </Panel>
            <Panel title={t("reports.topServices")} hint={t("reports.topServicesHint")}>
              {d.topServices.length ? <BarRows rows={d.topServices.map((s) => ({ label: s.name, value: Number(s.revenue) }))} unit="money" /> : <Empty>{t("reports.noVisits")}</Empty>}
            </Panel>
          </div>
          <RevenuePlanCard />
        </>
      );
    case "bookings": {
      const days = (bk?.bookingTrends ?? []).map((r) => ({ date: String(r.period).slice(0, 10), value: Math.max(0, Number(r.bookings) - Number(r.cancelled)), previous: null }));
      return (
        <>
          <Panel title={t("reports.visitsPerDay")} hint={t("reports.visitsOnce")}>
            {days.length ? <TrendChart data={days} unit="int" /> : <Empty>{t("reports.noVisits")}</Empty>}
          </Panel>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel title={t("reports.busiestHours")} hint={t("reports.busiestHoursHint")}>
              <Heatmap cells={d.heatmap} />
            </Panel>
            <Panel title={t("reports.byStatus")}>
              <BarRows
                rows={[
                  { label: t("reports.st.done"), value: Number(bk?.confirmedBookings ?? 0) },
                  { label: t("reports.st.cancelled"), value: Number(bk?.cancelledBookings ?? 0) },
                  { label: t("reports.st.noShow"), value: Number(bk?.noShowBookings ?? 0) },
                ]}
                unit="int"
              />
            </Panel>
          </div>
        </>
      );
    }
    case "ticket":
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={t("reports.ticketByService")} hint={t("reports.ticketByServiceHint")}>
            {d.topServices.length ? (
              <BarRows rows={d.topServices.map((s) => ({ label: s.name, value: Number(s.bookings) ? Number(s.revenue) / Number(s.bookings) : 0, sub: t("reports.visitsN", { count: Number(s.bookings) }) }))} unit="money" />
            ) : (
              <Empty>{t("reports.noVisits")}</Empty>
            )}
          </Panel>
          <Panel title={t("reports.ticketByStaff")}>
            {d.staff.some((s) => s.visits) ? (
              <BarRows rows={d.staff.filter((s) => s.visits).map((s) => ({ label: s.name, value: s.revenue / s.visits, sub: t("reports.visitsN", { count: s.visits }) }))} unit="money" />
            ) : (
              <Empty>{t("reports.noVisits")}</Empty>
            )}
          </Panel>
        </div>
      );
    case "clients":
    case "rebooking": {
      const k = d.kpis;
      return (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("reports.newVsReturning")} hint={t("reports.newVsReturningHint")}>
              <BarRows rows={[{ label: t("reports.newClients"), value: k.newClients.value }, { label: t("reports.returningClients"), value: k.returningClients.value }]} unit="int" />
            </Panel>
            <Panel title={t("reports.m.rebooking")} hint={t("reports.h.rebooking")}>
              <p className="text-[32px] font-extrabold tabular-nums">{fmtPct(k.rebookingRate.value)}</p>
              <p className="mt-2 text-[13px] text-[rgb(var(--reg-muted))]">{t("reports.rebookingHow")}</p>
            </Panel>
          </div>
          <Panel title={t("reports.cohorts")} hint={t("reports.cohortsHint")}>
            <CohortTable cohorts={d.cohorts} />
          </Panel>
          {metric === "clients" && (
            <Panel title={t("reports.topClients")}>
              {cl?.topClients?.length ? (
                <BarRows rows={cl.topClients.map((c) => ({ label: c.clientName, value: Number(c.totalSpent), sub: t("reports.visitsN", { count: Number(c.totalBookings) }) }))} unit="money" />
              ) : (
                <Empty>{t("reports.noClients")}</Empty>
              )}
            </Panel>
          )}
        </>
      );
    }
    case "no-shows":
      return (
        <>
          <Panel title={t("reports.cancelRate")}>
            <p className="text-[28px] font-extrabold tabular-nums">{fmtPct(d.kpis.cancellationRate.value)}</p>
            <Delta value={d.kpis.cancellationRate.value} previous={d.kpis.cancellationRate.previous} unit="pct" goodWhen="down" />
          </Panel>
          <NoShowImpact businessId={businessId} startDate={start} endDate={end} />
        </>
      );
    case "occupancy":
      return (
        <Panel title={t("reports.team")} hint={t("reports.occupancyHow")}>
          {d.staff.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] text-[rgb(var(--reg-muted))]">
                    <th scope="col" className="pb-2 font-medium">{t("reports.member")}</th>
                    <th scope="col" className="pb-2 text-right font-medium">{t("reports.m.bookings")}</th>
                    <th scope="col" className="pb-2 text-right font-medium">{t("reports.bookedHours")}</th>
                    <th scope="col" className="pb-2 text-right font-medium">{t("reports.workingHours")}</th>
                    <th scope="col" className="w-[30%] pb-2 pl-4 font-medium">{t("reports.m.occupancy")}</th>
                    <th scope="col" className="pb-2 text-right font-medium">{t("reports.m.revenue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.staff.map((s) => (
                    <tr key={s.name} className="border-t border-[rgb(var(--reg-line)/0.6)]">
                      <th scope="row" className="py-2.5 text-left font-semibold">{s.name}</th>
                      <td className="py-2.5 text-right tabular-nums">{fmtInt(s.visits)}</td>
                      <td className="py-2.5 text-right tabular-nums">{fmtInt(s.bookedMinutes / 60)}</td>
                      <td className="py-2.5 text-right tabular-nums">{s.availableMinutes ? fmtInt(s.availableMinutes / 60) : "–"}</td>
                      <td className="py-2.5 pl-4">
                        {s.utilization === null ? (
                          <span className="text-[12.5px] text-[rgb(var(--reg-muted))]">{t("reports.noHoursSet")}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-[rgb(var(--rp-track))]" aria-hidden>
                              <div className="h-2 rounded-full bg-[rgb(var(--rp-accent))]" style={{ width: `${s.utilization}%` }} />
                            </div>
                            <span className="w-12 text-right tabular-nums">{fmtPct(s.utilization)}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{fmtMoney(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>{t("reports.noHours")}</Empty>
          )}
        </Panel>
      );
    case "online": {
      const row = (s: (typeof SOURCE_KEYS)[number]) => ({
        label: t(`reports.src.${s}` as TKey),
        value: d.sources.find((x) => x.source === s)?.bookings ?? 0,
        sub: t("reports.wasValue", { value: fmtInt(d.previousSources.find((x) => x.source === s)?.bookings ?? 0) }),
      });
      return (
        <Panel title={t("reports.sources")} hint={t("reports.sourcesHint")}>
          <BarRows rows={SOURCE_KEYS.map(row)} unit="int" />
          <p className="mt-4 text-[12.5px] text-[rgb(var(--reg-muted))]">{t("reports.sourcesLegend")}</p>
        </Panel>
      );
    }
    default:
      return null;
  }
}
