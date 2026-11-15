import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { DiscountImpact } from "@/components/analytics/DiscountImpact";
import { NoShowImpact } from "@/components/analytics/NoShowImpact";
import { currencySymbol } from "@/lib/currency";
import { cn, money, pct } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader, Card, CardContent, CardDescription, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar, 
  DollarSign, 
  Download, 
  AlertCircle,
  Package,
  UserCheck,
  Activity,
  XCircle,
  Clock,
  Target,
  CreditCard,
  TrendingDown,
  Zap,
  Timer,
  ArrowRight,
  Gift,
  LineChart,
  Repeat
} from "lucide-react";
import { useBusinessId } from "@/hooks/useBusinessId";
import {
  analysisService,
  type AnalyticsOverview,
  type RevenueAnalytics,
  type BookingAnalytics,
  type ClientAnalytics,
  type ServiceAnalytics,
  type PerformanceAnalytics,
  type CancellationAnalytics,
  type PeakHoursAnalytics,
  type CustomerRetentionAnalytics,
  type ProfitabilityAnalytics,
  type PaymentMethodsAnalytics
} from "@/services/analysisService";
import { subDays } from "date-fns";
import { format, monthName } from "@/i18n/dateFns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import OverviewTab from "@/components/analytics/OverviewTab";
import { BarList, Insights, Metric } from "@/components/analytics/AnalyticsBits";
import RevenueTab from "@/components/analytics/RevenueTab";
import BookingsTab from "@/components/analytics/BookingsTab";
import ClientsTab from "@/components/analytics/ClientsTab";
import ServicesTab from "@/components/analytics/ServicesTab";
import StaffTab from "@/components/analytics/StaffTab";
import { t, formatMinutes } from "@/i18n";

interface SeasonalAnalytics {
  bestMonth?: string;
  worstMonth?: string;
  monthlyData?: { month?: string; period?: string; revenue: number }[];
  monthlyRevenue?: { month?: string; period?: string; revenue: number }[];
}

interface ServiceDurationAnalytics {
  durationEfficiency?: number;
  averageActualDuration?: number;
  averageScheduledDuration?: number;
}

interface WaitTimeAnalytics {
  averageWaitTime?: number;
  averageGapTime?: number;
}

interface CustomerAcquisitionAnalytics {
  newCustomers?: number;
  averageFirstVisitValue?: number;
  customerAcquisitionCost?: number;
}

interface ServiceBundleAnalytics {
  totalBundlesSold?: number;
  bundleRevenue?: number;
  averageBundleValue?: number;
  bundleRevenuePercentage?: number;
}

export default function AnalyticsPage() {
  const businessId = useBusinessId();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const fetchIdRef = useRef(0);

  // Analytics data states
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const [bookings, setBookings] = useState<BookingAnalytics | null>(null);
  const [clients, setClients] = useState<ClientAnalytics | null>(null);
  const [services, setServices] = useState<ServiceAnalytics | null>(null);
  const [performance, setPerformance] = useState<PerformanceAnalytics | null>(null);
  const [cancellations, setCancellations] = useState<CancellationAnalytics | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHoursAnalytics | null>(null);
  const [customerRetention, setCustomerRetention] = useState<CustomerRetentionAnalytics | null>(null);
  const [profitability, setProfitability] = useState<ProfitabilityAnalytics | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsAnalytics | null>(null);
  const [seasonal, setSeasonal] = useState<SeasonalAnalytics | null>(null);
  const [serviceDuration, setServiceDuration] = useState<ServiceDurationAnalytics | null>(null);
  const [waitTimes, setWaitTimes] = useState<WaitTimeAnalytics | null>(null);
  const [leadTime, setLeadTime] = useState<unknown>(null);
  const [revenuePerHour, setRevenuePerHour] = useState<unknown>(null);
  const [acquisition, setAcquisition] = useState<CustomerAcquisitionAnalytics | null>(null);
  const [bundles, setBundles] = useState<ServiceBundleAnalytics | null>(null);
  const [forecast, setForecast] = useState<unknown>(null);

  const getDateRange = () => {
    const endDate = format(new Date(), "yyyy-MM-dd");
    const startDate = format(subDays(new Date(), parseInt(period)), "yyyy-MM-dd");
    return { startDate, endDate };
  };

  // Reset all cached data when period changes so guards allow re-fetching
  /**
   * Day-by-day revenue and bookings as CSV. The button did nothing at all, on the one
   * screen an owner opens when they need these numbers somewhere else — a spreadsheet,
   * an accountant, a bank. Built from what is already loaded, so it needs no new endpoint
   * and always matches what is on screen.
   */
  const exportCsv = () => {
    if (!revenue) return;
    const rows = [
      ["Date", "Revenue", "Bookings"],
      ...(revenue.revenueByDay ?? []).map(d => [d.date, String(d.revenue ?? 0), String(d.bookings ?? 0)]),
    ];
    // Quote every field: a salon name or a date format with a comma in it would otherwise
    // shift every later column by one.
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics-${period}-days-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("analytics.exportedDays", { count: (revenue.revenueByDay ?? []).length }));
  };

  useEffect(() => {
    setOverview(null);
    setRevenue(null);
    setBookings(null);
    setClients(null);
    setServices(null);
    setPerformance(null);
    setCancellations(null);
    setPeakHours(null);
    setCustomerRetention(null);
    setProfitability(null);
    setPaymentMethods(null);
    setSeasonal(null);
    setServiceDuration(null);
    setWaitTimes(null);
    setLeadTime(null);
    setRevenuePerHour(null);
    setAcquisition(null);
    setBundles(null);
    setForecast(null);
  }, [period]);

  useEffect(() => {
    if (!businessId) return;

    const fetchData = async () => {
      const currentFetchId = ++fetchIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const { startDate, endDate } = getDateRange();
        
        // Fetch overview data
        if (activeTab === "overview" || !overview) {
          const overviewData = await analysisService.getAnalyticsOverview(businessId, startDate, endDate);
          setOverview(overviewData);
        }
        
        // Fetch tab-specific data
        const { startDate: sd, endDate: ed } = getDateRange();
        
        // A group loads everything it shows. The old chain fetched one endpoint per
        // tab, which is why half the sections rendered a spinner for ever once several
        // of them lived on the same page.
        const need = async <T,>(current: T | null, fetcher: () => Promise<T>, set: (v: T) => void) => {
          if (current) return;
          try {
            set(await fetcher());
          } catch {
            // One failing section must not blank the rest of the group.
          }
        };

        if (activeTab === "money") {
          await Promise.all([
            need(revenue, () => analysisService.getRevenueAnalytics(businessId, sd, ed), setRevenue),
            need(profitability, () => analysisService.getProfitabilityAnalytics(businessId, sd, ed), setProfitability),
            need(paymentMethods, () => analysisService.getPaymentMethodAnalytics(businessId, sd, ed), setPaymentMethods),
            need(seasonal, () => analysisService.getSeasonalAnalytics(businessId, sd, ed) as Promise<SeasonalAnalytics>, setSeasonal),
          ]);
        } else if (activeTab === "diary") {
          await Promise.all([
            need(bookings, () => analysisService.getBookingAnalytics(businessId, sd, ed), setBookings),
            need(peakHours, () => analysisService.getPeakHoursAnalytics(businessId, sd, ed), setPeakHours),
            need(cancellations, () => analysisService.getCancellationAnalytics(businessId, sd, ed), setCancellations),
            need(serviceDuration, () => analysisService.getServiceDurationAnalytics(businessId, sd, ed) as Promise<ServiceDurationAnalytics>, setServiceDuration),
            need(waitTimes, () => analysisService.getWaitTimeAnalytics(businessId, sd, ed) as Promise<WaitTimeAnalytics>, setWaitTimes),
          ]);
        } else if (activeTab === "people") {
          await Promise.all([
            need(clients, () => analysisService.getClientAnalytics(businessId, sd, ed), setClients),
            need(customerRetention, () => analysisService.getCustomerRetentionAnalytics(businessId, sd, ed), setCustomerRetention),
            need(acquisition, () => analysisService.getCustomerAcquisitionAnalytics(businessId, sd, ed) as Promise<CustomerAcquisitionAnalytics>, setAcquisition),
          ]);
        } else if (activeTab === "team") {
          await Promise.all([
            need(services, () => analysisService.getServiceAnalytics(businessId, sd, ed), setServices),
            need(performance, () => analysisService.getPerformanceAnalytics(businessId, sd, ed), setPerformance),
            need(bundles, () => analysisService.getServiceBundleAnalytics(businessId, sd, ed) as Promise<ServiceBundleAnalytics>, setBundles),
          ]);
        }
      } catch (err) {
        if (currentFetchId !== fetchIdRef.current) return; // stale fetch — a newer one is in flight
        console.error("Error fetching analytics:", err);
        setError(t("analytics.failedToLoadAnalyticsData"));
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setLoading(false);
        }
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the loaded groups are a cache read inside; depending on them would refetch in a loop
  }, [businessId, period, activeTab]);

  /** Whether a group already has its data, so switching to it does not flash a spinner. */
  const tabDataMap: Record<string, unknown> = {
    overview,
    money: revenue && profitability && paymentMethods,
    diary: bookings && peakHours && cancellations,
    people: clients && customerRetention,
    team: services && performance,
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Only show loading spinner if this tab's data is not yet cached
    if (!tabDataMap[value]) {
      setLoading(true);
    }
  };

  if (loading && !overview && !revenue && !bookings && !clients && !services) {
    return (
      <AppLayout>
      <BooqiScope>
        <PageHeader title={t("analytics.analytics")} subtitle={t("analytics.insightsAndPerformanceMetrics")} />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </BooqiScope>
    </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
      <BooqiScope>
        <PageHeader title={t("analytics.analytics")} subtitle={t("analytics.insightsAndPerformanceMetrics")} />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </BooqiScope>
    </AppLayout>
    );
  }

  // Worked out once, so a tab can say which day or hour is the one to act on rather than
  // handing the owner a table and letting them find it.
  const worstCancelDay = (cancellations?.cancellationsByDay ?? []).reduce(
    (a: { date: string; cancellations: number } | null, b: { date: string; cancellations: number }) =>
      !a || b.cancellations > a.cancellations ? b : a,
    null
  );
  const hours = peakHours?.peakHours ?? [];
  const busiestHour = hours.length ? hours.reduce((a, b) => (b.bookings > a.bookings ? b : a)) : null;
  const quietestHour = hours.length ? hours.reduce((a, b) => (b.bookings < a.bookings ? b : a)) : null;
  const methods = paymentMethods?.paymentMethods ?? [];
  const topPaymentMethod = methods.length ? methods.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null;

  return (
    <AppLayout>
      <BooqiScope>
      <PageHeader
        title={t("analytics.analytics")}
        subtitle={t("analytics.revenueBookingsClientsAndTeam")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label={t("common.period")} className="flex rounded-full bg-[rgb(var(--reg-ink)/0.05)] p-1">
              {([["7", t("analytics.range7")], ["30", t("analytics.range30")], ["90", t("analytics.range90")], ["365", t("analytics.rangeYear")]] as const).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={period === v}
                  onClick={() => setPeriod(v)}
                  className={cn("h-9 rounded-full px-3.5 text-sm font-semibold", period === v ? "bg-white shadow-[0_1px_2px_rgb(var(--reg-ink)/0.06)]" : "text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]")}
                >
                  {l}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              className={secondaryBtn}
              onClick={exportCsv}
              disabled={loading || !revenue}
            >
              <Download size={16} />
              {t("analytics.export")}
            </Button>
          </div>
        }
      />

      <div className={pageBody}>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="overflow-x-auto mb-6">
            {/* Nineteen tabs, several of them one number each, and no order to them:
                nobody reads a nav bar that long. Five groups, each answering a question a
                salon actually asks, with the sections stacked inside. */}
            <TabsList>
              <TabsTrigger value="overview" className="flex items-center gap-2 whitespace-nowrap">
                <BarChart3 className="h-4 w-4" />
                {t("analytics.overview")}
              </TabsTrigger>
              <TabsTrigger value="money" className="flex items-center gap-2 whitespace-nowrap">
                <DollarSign className="h-4 w-4" />
                {t("common.money")}
              </TabsTrigger>
              <TabsTrigger value="diary" className="flex items-center gap-2 whitespace-nowrap">
                <Calendar className="h-4 w-4" />
                {t("analytics.theDiary")}
              </TabsTrigger>
              <TabsTrigger value="people" className="flex items-center gap-2 whitespace-nowrap">
                <Users className="h-4 w-4" />
                {t("common.clients")}
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-2 whitespace-nowrap">
                <UserCheck className="h-4 w-4" />
                {t("analytics.teamServices")}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0">
            {overview ? (
              <OverviewTab data={overview} loading={loading} />
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
          </TabsContent>

          <TabsContent value="money" className="mt-0 space-y-8">
            {/* Before revenue, because a revenue figure means something different once you
                know how much of it was bought with a discount. */}
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("common.offers")}</h2>
                <p className="text-xs text-muted-foreground">
                  {t("analytics.whatTheCutPricesCost")}
                </p>
              </div>
              <DiscountImpact
                businessId={businessId}
                startDate={getDateRange().startDate}
                endDate={getDateRange().endDate}
              />
            </section>

            {/* After offers, before revenue: both are money the salon did not take, and a
                revenue figure means something different once you know what was missed. */}
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("analytics.emptyChairs")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("analytics.noShowsLateCancellationsAnd")}
                </p>
              </div>
              <NoShowImpact
                businessId={businessId}
                startDate={getDateRange().startDate}
                endDate={getDateRange().endDate}
              />
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("common.revenue")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.whatCameInAndWhen")}</p>
              </div>
            {revenue ? (
              <RevenueTab data={revenue} loading={loading} />
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("analytics.profitability")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.whatIsLeftAfterStaff")}</p>
              </div>
            {profitability ? (
              <div className="space-y-4">
                <Insights
                  items={[
                    {
                      text: t("analytics.ofTakenRoughlyIsYours", { value: money(profitability.totalRevenue), value2: currencySymbol(), value3: money(profitability.estimatedProfit), value4: currencySymbol(), value5: pct(profitability.profitMargin) }),
                      tone: (profitability.profitMargin ?? 0) >= 30 ? ("emerald" as const) : ("amber" as const),
                    },
                    {
                      text: t("analytics.thisIsAnEstimateFrom"),
                      tone: "slate" as const,
                    },
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <Metric icon={DollarSign} label={t("common.revenue")} value={`${money(profitability.totalRevenue)} ${currencySymbol()}`} tone="sky" />
                  <Metric icon={TrendingUp} label={t("analytics.estimatedProfit")} value={`${money(profitability.estimatedProfit)} ${currencySymbol()}`} tone="emerald" />
                  <Metric
                    icon={Target}
                    label={t("analytics.margin")}
                    value={`${pct(profitability.profitMargin)}%`}
                    tone={(profitability.profitMargin ?? 0) >= 30 ? "emerald" : "amber"}
                  />
                </div>
                <BarList
                  title={t("analytics.whereTheMoneyGoes")}
                  tone="emerald"
                  formatValue={(v) => `${money(v)} ${currencySymbol()}`}
                  rows={[
                    { label: t("analytics.keptEstimatedProfit"), value: profitability.estimatedProfit ?? 0 },
                    {
                      label: t("analytics.costsStaffAndCommission"),
                      value: Math.max(0, (profitability.totalRevenue ?? 0) - (profitability.estimatedProfit ?? 0)),
                    },
                  ]}
                />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("analytics.payments")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.howTheMoneyIsBeing")}</p>
              </div>
            {paymentMethods ? (
              <div className="space-y-4">
                <Insights
                  items={
                    topPaymentMethod
                      ? [
                          {
                            text: t("analytics.takesOfYourRevenueAcross", { method: topPaymentMethod.method, value: pct(topPaymentMethod.percentage), transactions: topPaymentMethod.transactions }),
                            tone: "sky" as const,
                          },
                        ]
                      : []
                  }
                />
                <BarList
                  title={t("analytics.revenueByPaymentMethod2")}
                  description={t("analytics.whatTheTillIsActually")}
                  tone="sky"
                  formatValue={(v) => `${money(v)} ${currencySymbol()}`}
                  rows={(paymentMethods.paymentMethods ?? []).map((m) => ({
                    // The API calls it `method`; reading `paymentMethod` left every bar unlabelled
                    // and the insight read "undefined takes 100% of your revenue".
                    label: m.method,
                    value: m.revenue,
                    detail: `${m.transactions} · ${pct(m.percentage)}%`,
                  }))}
                />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("analytics.acrossTheYear")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.theShapeOfYourSeason")}</p>
              </div>
            {seasonal ? (
              <div className="space-y-4">
                <Insights
                  items={[
                    ...(seasonal.bestMonth
                      ? [{
                          text: seasonal.worstMonth ? t("analytics.isYourStrongestMonthAnd", { bestMonth: monthName(seasonal.bestMonth), value: monthName(seasonal.worstMonth) }) : t("analytics.strongestMonthOnly", { bestMonth: monthName(seasonal.bestMonth) }),
                          tone: "sky" as const,
                        }]
                      : []),
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Metric icon={TrendingUp} label={t("analytics.bestMonth")} value={monthName(seasonal.bestMonth) || "—"} tone="emerald" />
                  <Metric icon={TrendingDown} label={t("analytics.weakestMonth")} value={monthName(seasonal.worstMonth) || "—"} tone="amber" />
                </div>
                <BarList
                  title={t("analytics.revenueByMonth")}
                  description={t("analytics.theShapeOfYourYear")}
                  tone="sky"
                  formatValue={(v) => `${money(v)} ${currencySymbol()}`}
                  rows={(seasonal.monthlyData ?? seasonal.monthlyRevenue ?? []).map((m: { month?: string; period?: string; revenue: number }) => ({
                    label: m.month ?? m.period ?? "",
                    value: m.revenue,
                  }))}
                  emptyText={t("analytics.notEnoughHistoryYetA")}
                />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
          </TabsContent>

          <TabsContent value="diary" className="mt-0 space-y-8">
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("analytics.bookings3")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.howFullTheDiaryIs")}</p>
              </div>
            {bookings ? (
              <BookingsTab data={bookings} loading={loading} />
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("analytics.peakHours")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.whenTheChairsAreBusy")}</p>
              </div>
            {peakHours ? (
              <div className="space-y-4">
                <Insights
                  items={
                    busiestHour
                      ? [
                          {
                            text: t("analytics.isYourBusiestHourWith", { value: String(busiestHour.hour).padStart(2, "0"), bookings: busiestHour.bookings }),
                            tone: "sky" as const,
                          },
                          ...(quietestHour && quietestHour.hour !== busiestHour.hour
                            ? [{
                                text: t("analytics.isTheQuietestWithA", { value: String(quietestHour.hour).padStart(2, "0"), bookings: quietestHour.bookings }),
                                tone: "amber" as const,
                              }]
                            : []),
                        ]
                      : []
                  }
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Metric
                    icon={Clock}
                    label={t("analytics.busiestHour")}
                    value={busiestHour ? `${String(busiestHour.hour).padStart(2, "0")}:00` : "—"}
                    hint={busiestHour ? t("common.bookingCount", { count: busiestHour.bookings }) : undefined}
                    tone="sky"
                  />
                  <Metric
                    icon={Clock}
                    label={t("analytics.quietestHour")}
                    value={quietestHour ? `${String(quietestHour.hour).padStart(2, "0")}:00` : "—"}
                    hint={quietestHour ? t("common.bookingCount", { count: quietestHour.bookings }) : undefined}
                    tone="amber"
                  />
                </div>
                <BarList
                  title={t("analytics.bookingsByHour2")}
                  description={t("analytics.whenTheChairsAreActually")}
                  tone="sky"
                  rows={(peakHours.peakHours ?? []).map((h) => ({
                    label: `${String(h.hour).padStart(2, "0")}:00`,
                    value: h.bookings,
                  }))}
                />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("analytics.cancellationsAndNoShows")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.theChairTimeNobodyPaid")}</p>
              </div>
            {cancellations ? (
              <div className="space-y-4">
                <Insights
                  items={[
                    ...(cancellations.totalCancellations > 0 && overview?.totalBookings
                      ? [{
                          text: t("analytics.cancellationsAgainstBookingsRoughlyOf", { totalCancellations: cancellations.totalCancellations, totalBookings: overview.totalBookings, value: money(cancellations.totalCancellations * (overview.averageTicket || 0)), value2: currencySymbol() }),
                          tone: "rose" as const,
                        }]
                      : []),
                    ...(worstCancelDay
                      ? [{
                          text: t("analytics.lostTheMostBookingsWorth", { date: worstCancelDay.date, cancellations: worstCancelDay.cancellations }),
                          tone: "amber" as const,
                        }]
                      : []),
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <Metric icon={XCircle} label={t("common.cancellations")} value={cancellations.totalCancellations} tone="rose" />
                  <Metric
                    icon={TrendingDown}
                    label={t("analytics.shareOfBookings")}
                    value={overview?.totalBookings ? `${Math.round((cancellations.totalCancellations / overview.totalBookings) * 100)}%` : "—"}
                    tone="amber"
                  />
                  <Metric
                    icon={DollarSign}
                    label={t("analytics.revenueLost")}
                    value={`${money(cancellations.totalCancellations * (overview?.averageTicket || 0))} ${currencySymbol()}`}
                    hint={t("analytics.atYourAverageTicket")}
                    tone="slate"
                  />
                </div>
                <BarList
                  title={t("analytics.cancellationsByDay")}
                  description={t("analytics.theTallestBarsAreThe")}
                  tone="rose"
                  rows={(cancellations.cancellationsByDay ?? []).map((d) => ({ label: d.date, value: d.cancellations }))}
                  emptyText={t("analytics.noCancellationsInThisPeriod")}
                />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("analytics.runningToTime")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.whetherTheDiaryMatchesReality")}</p>
              </div>
            {serviceDuration ? (
              <div className="space-y-4">
                <Insights
                  items={[
                    {
                      text:
                        (serviceDuration.durationEfficiency ?? 100) < 95
                          ? t("analytics.appointmentsRunAboutMinutesOver", { value: Math.abs(Math.round((serviceDuration.averageActualDuration ?? 0) - (serviceDuration.averageScheduledDuration ?? 0))) })
                          : t("analytics.appointmentsFinishCloseToThe"),
                      tone: (serviceDuration.durationEfficiency ?? 100) < 95 ? ("amber" as const) : ("emerald" as const),
                    },
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <Metric icon={Clock} label={t("analytics.bookedFor")} value={formatMinutes(serviceDuration.averageScheduledDuration ?? 0)} tone="sky" />
                  <Metric icon={Timer} label={t("analytics.actuallyTakes")} value={formatMinutes(serviceDuration.averageActualDuration ?? 0)} tone="violet" />
                  <Metric
                    icon={Target}
                    label={t("analytics.onTime")}
                    value={`${pct(serviceDuration.durationEfficiency)}%`}
                    tone={(serviceDuration.durationEfficiency ?? 100) >= 95 ? "emerald" : "amber"}
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            {waitTimes ? (
              <div className="space-y-4">
                <Insights
                  items={[
                    {
                      text: t("analytics.clientsWaitAboutMinutesPast", { value: pct(waitTimes.averageWaitTime) }),
                      tone: (waitTimes.averageWaitTime ?? 0) > 10 ? ("rose" as const) : ("emerald" as const),
                    },
                    {
                      text: t("analytics.chairsSitEmptyAboutMinutes", { value: pct(waitTimes.averageGapTime) }),
                      tone: "amber" as const,
                    },
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Metric
                    icon={Clock}
                    label={t("analytics.averageWait")}
                    value={formatMinutes(Number(pct(waitTimes.averageWaitTime)))}
                    hint={t("analytics.pastTheBookedStart")}
                    tone={(waitTimes.averageWaitTime ?? 0) > 10 ? "rose" : "emerald"}
                  />
                  <Metric
                    icon={Timer}
                    label={t("analytics.gapBetweenBookings")}
                    value={formatMinutes(Number(pct(waitTimes.averageGapTime)))}
                    hint={t("analytics.unsoldChairTime")}
                    tone="amber"
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
          </TabsContent>

          <TabsContent value="people" className="mt-0 space-y-8">
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("common.clients")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.whoIsComingIn")}</p>
              </div>
            {clients ? (
              <ClientsTab data={clients} loading={loading} />
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("analytics.comingBack")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.whetherTheyReturnWhichIs")}</p>
              </div>
            {customerRetention ? (
              <div className="space-y-4">
                <Insights
                  items={[
                    {
                      text:
                        (customerRetention.retentionRate ?? 0) >= 50
                          ? t("analytics.ofClientsCameBackRepeat", { value: pct(customerRetention.retentionRate) })
                          : t("analytics.onlyCameBackEveryMonth", { value: pct(customerRetention.retentionRate) }),
                      tone: (customerRetention.retentionRate ?? 0) >= 50 ? ("emerald" as const) : ("rose" as const),
                    },
                    {
                      text: t("analytics.clientsVisitedOnceAndHave", { value: customerRetention.totalClients - customerRetention.returningClients }),
                      tone: "amber" as const,
                    },
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <Metric
                    icon={Repeat}
                    label={t("analytics.retentionRate")}
                    value={`${pct(customerRetention.retentionRate)}%`}
                    tone={(customerRetention.retentionRate ?? 0) >= 50 ? "emerald" : "rose"}
                  />
                  <Metric icon={Users} label={t("analytics.totalClients2")} value={customerRetention.totalClients} tone="violet" />
                  <Metric icon={UserCheck} label={t("analytics.cameBack")} value={customerRetention.returningClients} tone="emerald" />
                </div>
                <BarList
                  title={t("analytics.whoIsComingBack")}
                  tone="emerald"
                  rows={[
                    { label: t("analytics.returningClients"), value: customerRetention.returningClients },
                    {
                      label: t("analytics.oneVisitOnly"),
                      value: Math.max(0, customerRetention.totalClients - customerRetention.returningClients),
                    },
                  ]}
                />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("analytics.whereTheyComeFrom")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.howNewClientsFoundYou")}</p>
              </div>
            {acquisition ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("analytics.customerAcquisitionAnalytics")}</CardTitle>
                    <CardDescription>{t("analytics.newCustomerMetrics")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{t("analytics.newCustomers")}</p>
                        <p className="text-2xl font-bold">{acquisition.newCustomers || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("analytics.avgFirstVisitValue")}</p>
                        <p className="text-2xl font-bold">{acquisition.averageFirstVisitValue?.toFixed(2)} {currencySymbol()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("analytics.acquisitionCost")}</p>
                        <p className="text-2xl font-bold">{acquisition.customerAcquisitionCost?.toFixed(2)} {currencySymbol()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
          </TabsContent>

          <TabsContent value="team" className="mt-0 space-y-8">
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("common.staff")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.whoIsBringingInThe")}</p>
              </div>
            {overview?.staffPerformance ? (
              <StaffTab data={overview.staffPerformance} loading={loading} />
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <p className="text-sm text-red-500">{t("analytics.failedToLoadStaffData")}</p>
                <button onClick={() => { setError(null); setOverview(null); }} className="text-sm text-blue-600 underline">{t("analytics.retry")}</button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            {performance ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("analytics.performanceAnalytics")}</CardTitle>
                    <CardDescription>{t("analytics.staffRevenueAndBookingMetrics")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div>
                        <p className="text-sm text-muted-foreground">{t("analytics.totalStaffRevenue")}</p>
                        <p className="text-2xl font-bold">{performance.totalStaffRevenue?.toFixed(2)} {currencySymbol()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("analytics.totalStaffBookings")}</p>
                        <p className="text-2xl font-bold">{performance.totalStaffBookings}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("analytics.avgRevenueStaff")}</p>
                        <p className="text-2xl font-bold">{performance.averageRevenuePerStaff?.toFixed(2)} {currencySymbol()}</p>
                      </div>
                    </div>
                    {performance.staffDetails && performance.staffDetails.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 font-medium">{t("analytics.staffName")}</th>
                              <th className="pb-2 font-medium">{t("analytics.bookings3")}</th>
                              <th className="pb-2 font-medium">{t("analytics.completionRate")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {performance.staffDetails.map((staff) => (
                              <tr key={staff.staffId} className="border-b hover:bg-muted/50">
                                <td className="py-2">{staff.staffName || t("analytics.staff", { staffId: staff.staffId })}</td>
                                <td className="py-2">{staff.bookings}</td>
                                <td className="py-2">{staff.completionRate?.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("common.services")}</h2>
                <p className="text-xs text-muted-foreground">{t("analytics.whatSellsAndWhatDoes")}</p>
              </div>
            {services ? (
              <ServicesTab data={services} loading={loading} />
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            {bundles ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("analytics.serviceBundleAnalytics")}</CardTitle>
                    <CardDescription>{t("analytics.bundlePerformanceMetrics")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{t("analytics.totalBundlesSold")}</p>
                        <p className="text-2xl font-bold">{bundles.totalBundlesSold || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("analytics.bundleRevenue")}</p>
                        <p className="text-2xl font-bold">{bundles.bundleRevenue?.toFixed(2)} {currencySymbol()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("analytics.avgBundleValue")}</p>
                        <p className="text-2xl font-bold">{bundles.averageBundleValue?.toFixed(2)} {currencySymbol()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("analytics.revenue2")}</p>
                        <p className="text-2xl font-bold">{bundles.bundleRevenuePercentage?.toFixed(1)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
            </section>
          </TabsContent>

        </Tabs>
      </div>
    </BooqiScope>
    </AppLayout>
  );
}
