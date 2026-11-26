import { Skeleton as KitSkeleton } from "@/components/bz";
import { useQuery } from "@tanstack/react-query";
import { Percent, RefreshCw, Table2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { NavCard, NavCardGrid } from "@/components/layout/NavCards";
import { secondaryBtn } from "@/components/page/booqiStyles";
import { BarRows, CohortTable, Heatmap, PanelLink, TrendChart } from "@/components/reports/ReportsKit";
import { fmtInt, fmtMoney, fmtPct, fmtPeriod, useReportPeriod } from "@/components/reports/reportsFormat";
import { SOURCE_KEYS, dashboardService, type Dashboard } from "@/services/dashboardService";
import { pageAllowed, myAccess } from "@/components/layout/navigation";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useNavigation } from "@/utils/navigationUtils";
import { t, type TKey } from "@/i18n";
import { BooqiScope, Empty, KpiTile, PageHeader, Panel, PeriodPicker, pageBody } from "@/components/bz/p4-compat";

/**
 * Reports (HUB-V3, 2026-11-19): what a salon owner reads first, for the chosen period and
 * against the period before it. Every tile opens its own report (/analytics/<metric>); the
 * report builder stays one card at the end. One request: GET /analytics/.../dashboard.
 */
export default function AnalyticsPage() {
  const businessId = useBusinessId();
  const { getPath } = useNavigation();
  const { range, setRange, start, end, query } = useReportPeriod();
  const q = useQuery({
    queryKey: ["reports-dashboard", businessId, start, end],
    queryFn: () => dashboardService.get(businessId, start, end),
    enabled: Boolean(businessId),
    staleTime: 60_000,
  });
  const d = q.data;
  const to = (metric: string) => `${getPath(`/analytics/${metric}`)}${query}`;
  const canBuild = pageAllowed(myAccess(), "/report-builder");

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("nav.reports")}
          subtitle={d ? t("reports.comparedWith", { period: fmtPeriod(d.period), previous: fmtPeriod(d.previousPeriod) }) : t("nav.cat.reports")}
          actions={<PeriodPicker value={range} onChange={setRange} />}
        />
        <div className={pageBody}>
          {q.isError ? (
            <div className="space-y-3">
              <Empty>{t("reports.loadFailed")}</Empty>
              <div className="text-center">
                <button type="button" className={secondaryBtn} onClick={() => q.refetch()}>
                  <RefreshCw size={16} aria-hidden /> {t("reports.retry")}
                </button>
              </div>
            </div>
          ) : !d ? (
            <Skeleton />
          ) : (
            <DashboardBody d={d} to={to} />
          )}

          <div className="pt-2">
            <h2 className="mb-3 text-[17px] font-extrabold tracking-[-0.01em]">{t("reports.moreReports")}</h2>
            <NavCardGrid>
              {canBuild && <NavCard to={getPath("/report-builder")} icon={Table2} title={t("nav.reportBuilder")} description={t("nav.hint.reportBuilder")} />}
              <NavCard to={to("discounts")} icon={Percent} title={t("reports.m.discounts")} description={t("reports.h.discounts")} />
            </NavCardGrid>
          </div>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}

function DashboardBody({ d, to }: { d: Dashboard; to: (m: string) => string }) {
  const k = d.kpis;
  const sources = SOURCE_KEYS.map((s) => ({ label: t(`reports.src.${s}` as TKey), value: d.sources.find((x) => x.source === s)?.bookings ?? 0 })).filter(
    (r, i) => r.value > 0 || i < 4,
  );
  const staffRows = d.staff
    .filter((s) => s.utilization !== null)
    .slice(0, 6)
    .map((s) => ({ label: s.name, value: s.utilization ?? 0, sub: fmtMoney(s.revenue) }));
  const trend = d.revenueTrend.map((r) => ({ date: r.date, value: r.revenue, previous: r.previous }));
  const hasVisits = k.bookings.value > 0;

  return (
    <>
      {(d.renterRevenue ?? 0) > 0 && (
        <p className="mb-3 text-sm text-[rgb(var(--reg-muted))]">
          <span className="font-semibold text-[rgb(var(--reg-ink))]">{t("ledger.renterRevenue")}: {fmtMoney(d.renterRevenue ?? 0)}</span>{" · "}{t("ledger.renterRevenueHint")}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KpiTile to={to("revenue")} label={t("reports.m.revenue")} value={k.revenue.value} previous={k.revenue.previous} unit="money" />
        <KpiTile to={to("bookings")} label={t("reports.m.bookings")} value={k.bookings.value} previous={k.bookings.previous} unit="int" />
        <KpiTile to={to("ticket")} label={t("reports.m.ticket")} value={k.averageTicket.value} previous={k.averageTicket.previous} unit="money" />
        <KpiTile
          to={to("clients")}
          label={t("reports.m.clients")}
          value={k.clients.value}
          previous={k.clients.previous}
          unit="int"
          foot={<span className="text-[12px] text-[rgb(var(--reg-muted))]">{t("reports.newReturning", { n: fmtInt(k.newClients.value), r: fmtInt(k.returningClients.value) })}</span>}
        />
        <KpiTile to={to("rebooking")} label={t("reports.m.rebooking")} value={k.rebookingRate.value} previous={k.rebookingRate.previous} unit="pct" />
        <KpiTile
          to={to("no-shows")}
          label={t("reports.m.noShows")}
          value={k.noShowRate.value}
          previous={k.noShowRate.previous}
          unit="pct"
          goodWhen="down"
          foot={<span className="text-[12px] text-[rgb(var(--reg-muted))]">{t("reports.cancelledPct", { value: fmtPct(k.cancellationRate.value) })}</span>}
        />
        <KpiTile to={to("occupancy")} label={t("reports.m.occupancy")} value={k.utilization.value} previous={k.utilization.previous} unit="pct" />
        <KpiTile to={to("online")} label={t("reports.m.online")} value={k.onlineShare.value} previous={k.onlineShare.previous} unit="pct" />
      </div>

      <Panel title={t("reports.revenueTrend")} hint={t("reports.revenueTrendHint")} action={<PanelLink to={to("revenue")}>{t("reports.open")}</PanelLink>}>
        {k.revenue.value > 0 || k.revenue.previous > 0 ? <TrendChart data={trend} unit="money" /> : <Empty>{t("reports.noSales")}</Empty>}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={t("reports.topServices")} hint={t("reports.topServicesHint")} action={<PanelLink to={to("ticket")}>{t("reports.open")}</PanelLink>}>
          {d.topServices.length ? (
            <BarRows rows={d.topServices.slice(0, 6).map((s) => ({ label: s.name, value: Number(s.revenue), sub: t("reports.visitsN", { count: Number(s.bookings) }) }))} unit="money" />
          ) : (
            <Empty>{t("reports.noVisits")}</Empty>
          )}
        </Panel>
        <Panel title={t("reports.team")} hint={t("reports.teamHint")} action={<PanelLink to={to("occupancy")}>{t("reports.open")}</PanelLink>}>
          {staffRows.length ? <BarRows rows={staffRows} unit="pct" max={100} /> : <Empty>{t("reports.noHours")}</Empty>}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title={t("reports.busiestHours")} hint={t("reports.busiestHoursHint")}>
          {hasVisits ? <Heatmap cells={d.heatmap} /> : <Empty>{t("reports.noVisits")}</Empty>}
        </Panel>
        <Panel title={t("reports.sources")} hint={t("reports.sourcesHint")} action={<PanelLink to={to("online")}>{t("reports.open")}</PanelLink>}>
          {hasVisits ? <BarRows rows={sources} unit="int" /> : <Empty>{t("reports.noVisits")}</Empty>}
        </Panel>
      </div>

      <Panel title={t("reports.cohorts")} hint={t("reports.cohortsHint")} action={<PanelLink to={to("clients")}>{t("reports.open")}</PanelLink>}>
        {d.cohorts.some((c) => c.clients > 0) ? <CohortTable cohorts={d.cohorts} /> : <Empty>{t("reports.noClients")}</Empty>}
      </Panel>
    </>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label={t("common.loading2")}>
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <KitSkeleton key={i} lines={[100, 80, 60]} />
        ))}
      </div>
      <KitSkeleton lines={[100, 90, 80, 70, 85, 60]} />
    </div>
  );
}
