import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { DiscountImpact } from "@/components/analytics/DiscountImpact";
import { NoShowImpact } from "@/components/analytics/NoShowImpact";
import { currencySymbol } from "@/lib/currency";
import { money, pct } from "@/lib/utils";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { format, subDays } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import OverviewTab from "@/components/analytics/OverviewTab";
import { BarList, Insights, Metric } from "@/components/analytics/AnalyticsBits";
import RevenueTab from "@/components/analytics/RevenueTab";
import BookingsTab from "@/components/analytics/BookingsTab";
import ClientsTab from "@/components/analytics/ClientsTab";
import ServicesTab from "@/components/analytics/ServicesTab";
import StaffTab from "@/components/analytics/StaffTab";

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
  const [seasonal, setSeasonal] = useState<any>(null);
  const [serviceDuration, setServiceDuration] = useState<any>(null);
  const [waitTimes, setWaitTimes] = useState<any>(null);
  const [leadTime, setLeadTime] = useState<any>(null);
  const [revenuePerHour, setRevenuePerHour] = useState<any>(null);
  const [acquisition, setAcquisition] = useState<any>(null);
  const [bundles, setBundles] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);

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
    toast.success(`Exported ${(revenue.revenueByDay ?? []).length} days`);
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
            need(seasonal, () => analysisService.getSeasonalAnalytics(businessId, sd, ed), setSeasonal),
          ]);
        } else if (activeTab === "diary") {
          await Promise.all([
            need(bookings, () => analysisService.getBookingAnalytics(businessId, sd, ed), setBookings),
            need(peakHours, () => analysisService.getPeakHoursAnalytics(businessId, sd, ed), setPeakHours),
            need(cancellations, () => analysisService.getCancellationAnalytics(businessId, sd, ed), setCancellations),
            need(serviceDuration, () => analysisService.getServiceDurationAnalytics(businessId, sd, ed), setServiceDuration),
            need(waitTimes, () => analysisService.getWaitTimeAnalytics(businessId, sd, ed), setWaitTimes),
          ]);
        } else if (activeTab === "people") {
          await Promise.all([
            need(clients, () => analysisService.getClientAnalytics(businessId, sd, ed), setClients),
            need(customerRetention, () => analysisService.getCustomerRetentionAnalytics(businessId, sd, ed), setCustomerRetention),
            need(acquisition, () => analysisService.getCustomerAcquisitionAnalytics(businessId, sd, ed), setAcquisition),
          ]);
        } else if (activeTab === "team") {
          await Promise.all([
            need(services, () => analysisService.getServiceAnalytics(businessId, sd, ed), setServices),
            need(performance, () => analysisService.getPerformanceAnalytics(businessId, sd, ed), setPerformance),
            need(bundles, () => analysisService.getServiceBundleAnalytics(businessId, sd, ed), setBundles),
          ]);
        }
      } catch (err) {
        if (currentFetchId !== fetchIdRef.current) return; // stale fetch — a newer one is in flight
        console.error("Error fetching analytics:", err);
        setError("Failed to load analytics data");
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setLoading(false);
        }
      }
    };

    fetchData();
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
        <PageHeader title="Analytics" subtitle="Insights and performance metrics" />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <PageHeader title="Analytics" subtitle="Insights and performance metrics" />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
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
      <PageHeader
        title="Analytics"
        subtitle="Comprehensive business insights and performance metrics"
        actions={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px] border-border/60 hover:border-accent/30 hover:bg-accent/5 transition-all">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="365">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="gap-2 border-border/60 hover:border-accent/30 hover:bg-accent/5 transition-all"
              onClick={exportCsv}
              disabled={loading || !revenue}
            >
              <Download size={16} />
              Export
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="overflow-x-auto mb-6">
            {/* Nineteen tabs, several of them one number each, and no order to them:
                nobody reads a nav bar that long. Five groups, each answering a question a
                salon actually asks, with the sections stacked inside. */}
            <TabsList className="inline-flex min-w-full bg-muted/50">
              <TabsTrigger value="overview" className="flex items-center gap-2 whitespace-nowrap">
                <BarChart3 className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="money" className="flex items-center gap-2 whitespace-nowrap">
                <DollarSign className="h-4 w-4" />
                Money
              </TabsTrigger>
              <TabsTrigger value="diary" className="flex items-center gap-2 whitespace-nowrap">
                <Calendar className="h-4 w-4" />
                The diary
              </TabsTrigger>
              <TabsTrigger value="people" className="flex items-center gap-2 whitespace-nowrap">
                <Users className="h-4 w-4" />
                Clients
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-2 whitespace-nowrap">
                <UserCheck className="h-4 w-4" />
                Team &amp; services
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Offers</h2>
                <p className="text-xs text-muted-foreground">
                  What the cut prices cost you, and what they brought back.
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
                  Empty chairs
                </h2>
                <p className="text-xs text-muted-foreground">
                  No-shows, late cancellations, and what your policy recorded for them.
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Revenue</h2>
                <p className="text-xs text-muted-foreground">What came in, and when.</p>
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profitability</h2>
                <p className="text-xs text-muted-foreground">What is left after staff and commission.</p>
              </div>
            {profitability ? (
              <div className="space-y-4">
                <Insights
                  items={[
                    {
                      text: `Of ${money(profitability.totalRevenue)} ${currencySymbol()} taken, roughly ${money(profitability.estimatedProfit)} ${currencySymbol()} is yours after costs — a ${pct(profitability.profitMargin)}% margin.`,
                      tone: (profitability.profitMargin ?? 0) >= 30 ? ("emerald" as const) : ("amber" as const),
                    },
                    {
                      text: "This is an estimate from staff cost and commission. It does not know your rent, stock or bills.",
                      tone: "slate" as const,
                    },
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <Metric icon={DollarSign} label="Revenue" value={`${money(profitability.totalRevenue)} ${currencySymbol()}`} tone="sky" />
                  <Metric icon={TrendingUp} label="Estimated profit" value={`${money(profitability.estimatedProfit)} ${currencySymbol()}`} tone="emerald" />
                  <Metric
                    icon={Target}
                    label="Margin"
                    value={`${pct(profitability.profitMargin)}%`}
                    tone={(profitability.profitMargin ?? 0) >= 30 ? "emerald" : "amber"}
                  />
                </div>
                <BarList
                  title="Where the money goes"
                  tone="emerald"
                  formatValue={(v) => `${money(v)} ${currencySymbol()}`}
                  rows={[
                    { label: "Kept (estimated profit)", value: profitability.estimatedProfit ?? 0 },
                    {
                      label: "Costs (staff and commission)",
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payments</h2>
                <p className="text-xs text-muted-foreground">How the money is being taken.</p>
              </div>
            {paymentMethods ? (
              <div className="space-y-4">
                <Insights
                  items={
                    topPaymentMethod
                      ? [
                          {
                            text: `${topPaymentMethod.paymentMethod} takes ${pct(topPaymentMethod.percentage)}% of your revenue across ${topPaymentMethod.transactions} transactions.`,
                            tone: "sky" as const,
                          },
                        ]
                      : []
                  }
                />
                <BarList
                  title="Revenue by payment method"
                  description="What the till is actually taking."
                  tone="sky"
                  formatValue={(v) => `${money(v)} ${currencySymbol()}`}
                  rows={(paymentMethods.paymentMethods ?? []).map((m) => ({
                    label: m.paymentMethod,
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Across the year</h2>
                <p className="text-xs text-muted-foreground">The shape of your season.</p>
              </div>
            {seasonal ? (
              <div className="space-y-4">
                <Insights
                  items={[
                    ...(seasonal.bestMonth
                      ? [{
                          text: `${seasonal.bestMonth} is your strongest month and ${seasonal.worstMonth ?? "the quietest"} your weakest. Staff and stock for the first; run offers in the second.`,
                          tone: "sky" as const,
                        }]
                      : []),
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Metric icon={TrendingUp} label="Best month" value={seasonal.bestMonth || "—"} tone="emerald" />
                  <Metric icon={TrendingDown} label="Weakest month" value={seasonal.worstMonth || "—"} tone="amber" />
                </div>
                <BarList
                  title="Revenue by month"
                  description="The shape of your year."
                  tone="sky"
                  formatValue={(v) => `${money(v)} ${currencySymbol()}`}
                  rows={(seasonal.monthlyData ?? seasonal.monthlyRevenue ?? []).map((m: { month?: string; period?: string; revenue: number }) => ({
                    label: m.month ?? m.period ?? "",
                    value: m.revenue,
                  }))}
                  emptyText="Not enough history yet — a year of takings is what makes this readable."
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bookings</h2>
                <p className="text-xs text-muted-foreground">How full the diary is.</p>
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Peak hours</h2>
                <p className="text-xs text-muted-foreground">When the chairs are busy, and when they are not.</p>
              </div>
            {peakHours ? (
              <div className="space-y-4">
                <Insights
                  items={
                    busiestHour
                      ? [
                          {
                            text: `${String(busiestHour.hour).padStart(2, "0")}:00 is your busiest hour with ${busiestHour.bookings} bookings. Staff it first.`,
                            tone: "sky" as const,
                          },
                          ...(quietestHour && quietestHour.hour !== busiestHour.hour
                            ? [{
                                text: `${String(quietestHour.hour).padStart(2, "0")}:00 is the quietest with ${quietestHour.bookings}. A promotion belongs here, not at your busiest time.`,
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
                    label="Busiest hour"
                    value={busiestHour ? `${String(busiestHour.hour).padStart(2, "0")}:00` : "—"}
                    hint={busiestHour ? `${busiestHour.bookings} bookings` : undefined}
                    tone="sky"
                  />
                  <Metric
                    icon={Clock}
                    label="Quietest hour"
                    value={quietestHour ? `${String(quietestHour.hour).padStart(2, "0")}:00` : "—"}
                    hint={quietestHour ? `${quietestHour.bookings} bookings` : undefined}
                    tone="amber"
                  />
                </div>
                <BarList
                  title="Bookings by hour"
                  description="When the chairs are actually full."
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cancellations and no-shows</h2>
                <p className="text-xs text-muted-foreground">The chair time nobody paid for.</p>
              </div>
            {cancellations ? (
              <div className="space-y-4">
                <Insights
                  items={[
                    ...(cancellations.totalCancellations > 0 && overview?.totalBookings
                      ? [{
                          text: `${cancellations.totalCancellations} cancellations against ${overview.totalBookings} bookings — roughly ${money(cancellations.totalCancellations * (overview.averageTicket || 0))} ${currencySymbol()} of chair time nobody paid for.`,
                          tone: "rose" as const,
                        }]
                      : []),
                    ...(worstCancelDay
                      ? [{
                          text: `${worstCancelDay.date} lost the most: ${worstCancelDay.cancellations} bookings. Worth checking what was in the diary that day.`,
                          tone: "amber" as const,
                        }]
                      : []),
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <Metric icon={XCircle} label="Cancellations" value={cancellations.totalCancellations} tone="rose" />
                  <Metric
                    icon={TrendingDown}
                    label="Share of bookings"
                    value={overview?.totalBookings ? `${Math.round((cancellations.totalCancellations / overview.totalBookings) * 100)}%` : "—"}
                    tone="amber"
                  />
                  <Metric
                    icon={DollarSign}
                    label="Revenue lost"
                    value={`${money(cancellations.totalCancellations * (overview?.averageTicket || 0))} ${currencySymbol()}`}
                    hint="At your average ticket"
                    tone="slate"
                  />
                </div>
                <BarList
                  title="Cancellations by day"
                  description="The tallest bars are the days to look at."
                  tone="rose"
                  rows={(cancellations.cancellationsByDay ?? []).map((d) => ({ label: d.date, value: d.cancellations }))}
                  emptyText="No cancellations in this period. "
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Running to time</h2>
                <p className="text-xs text-muted-foreground">Whether the diary matches reality.</p>
              </div>
            {serviceDuration ? (
              <div className="space-y-4">
                <Insights
                  items={[
                    {
                      text:
                        (serviceDuration.durationEfficiency ?? 100) < 95
                          ? `Appointments run about ${Math.abs(Math.round((serviceDuration.averageActualDuration ?? 0) - (serviceDuration.averageScheduledDuration ?? 0)))} minutes over what you book them for. Every one of those pushes the next client back.`
                          : "Appointments finish close to the time you book them for, so the diary is realistic.",
                      tone: (serviceDuration.durationEfficiency ?? 100) < 95 ? ("amber" as const) : ("emerald" as const),
                    },
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <Metric icon={Clock} label="Booked for" value={`${Math.round(serviceDuration.averageScheduledDuration ?? 0)} min`} tone="sky" />
                  <Metric icon={Timer} label="Actually takes" value={`${Math.round(serviceDuration.averageActualDuration ?? 0)} min`} tone="violet" />
                  <Metric
                    icon={Target}
                    label="On time"
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
                      text: `Clients wait about ${pct(waitTimes.averageWaitTime)} minutes past their time.`,
                      tone: (waitTimes.averageWaitTime ?? 0) > 10 ? ("rose" as const) : ("emerald" as const),
                    },
                    {
                      text: `Chairs sit empty about ${pct(waitTimes.averageGapTime)} minutes between bookings — that gap is unsold time, not a break unless you meant it to be.`,
                      tone: "amber" as const,
                    },
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Metric
                    icon={Clock}
                    label="Average wait"
                    value={`${pct(waitTimes.averageWaitTime)} min`}
                    hint="Past the booked start"
                    tone={(waitTimes.averageWaitTime ?? 0) > 10 ? "rose" : "emerald"}
                  />
                  <Metric
                    icon={Timer}
                    label="Gap between bookings"
                    value={`${pct(waitTimes.averageGapTime)} min`}
                    hint="Unsold chair time"
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Clients</h2>
                <p className="text-xs text-muted-foreground">Who is coming in.</p>
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Coming back</h2>
                <p className="text-xs text-muted-foreground">Whether they return, which is the whole business.</p>
              </div>
            {customerRetention ? (
              <div className="space-y-4">
                <Insights
                  items={[
                    {
                      text:
                        (customerRetention.retentionRate ?? 0) >= 50
                          ? `${pct(customerRetention.retentionRate)}% of clients came back. Repeat custom is carrying the salon — protect it before chasing new names.`
                          : `Only ${pct(customerRetention.retentionRate)}% came back. Every month starts from nearly zero, which is the most expensive way to run a salon.`,
                      tone: (customerRetention.retentionRate ?? 0) >= 50 ? ("emerald" as const) : ("rose" as const),
                    },
                    {
                      text: `${customerRetention.totalClients - customerRetention.returningClients} clients visited once and have not been back. That is the list worth a message.`,
                      tone: "amber" as const,
                    },
                  ]}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <Metric
                    icon={Repeat}
                    label="Retention rate"
                    value={`${pct(customerRetention.retentionRate)}%`}
                    tone={(customerRetention.retentionRate ?? 0) >= 50 ? "emerald" : "rose"}
                  />
                  <Metric icon={Users} label="Total clients" value={customerRetention.totalClients} tone="violet" />
                  <Metric icon={UserCheck} label="Came back" value={customerRetention.returningClients} tone="emerald" />
                </div>
                <BarList
                  title="Who is coming back"
                  tone="emerald"
                  rows={[
                    { label: "Returning clients", value: customerRetention.returningClients },
                    {
                      label: "One visit only",
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Where they come from</h2>
                <p className="text-xs text-muted-foreground">How new clients found you.</p>
              </div>
            {acquisition ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Acquisition Analytics</CardTitle>
                    <CardDescription>New customer metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">New Customers</p>
                        <p className="text-2xl font-bold">{acquisition.newCustomers || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg First Visit Value</p>
                        <p className="text-2xl font-bold">{acquisition.averageFirstVisitValue?.toFixed(2)} {currencySymbol()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Acquisition Cost</p>
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Staff</h2>
                <p className="text-xs text-muted-foreground">Who is bringing in the work.</p>
              </div>
            {overview?.staffPerformance ? (
              <StaffTab data={overview.staffPerformance} loading={loading} />
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <p className="text-sm text-red-500">Failed to load staff data</p>
                <button onClick={() => { setError(null); setOverview(null); }} className="text-sm text-blue-600 underline">Retry</button>
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
                    <CardTitle>Performance Analytics</CardTitle>
                    <CardDescription>Staff revenue and booking metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Staff Revenue</p>
                        <p className="text-2xl font-bold">{performance.totalStaffRevenue?.toFixed(2)} {currencySymbol()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Staff Bookings</p>
                        <p className="text-2xl font-bold">{performance.totalStaffBookings}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Revenue/Staff</p>
                        <p className="text-2xl font-bold">{performance.averageRevenuePerStaff?.toFixed(2)} {currencySymbol()}</p>
                      </div>
                    </div>
                    {performance.staffDetails && performance.staffDetails.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 font-medium">Staff Name</th>
                              <th className="pb-2 font-medium">Bookings</th>
                              <th className="pb-2 font-medium">Completion Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {performance.staffDetails.map((staff) => (
                              <tr key={staff.staffId} className="border-b hover:bg-muted/50">
                                <td className="py-2">{staff.staffName || `Staff ${staff.staffId}`}</td>
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Services</h2>
                <p className="text-xs text-muted-foreground">What sells, and what does not.</p>
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
                    <CardTitle>Service Bundle Analytics</CardTitle>
                    <CardDescription>Bundle performance metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Bundles Sold</p>
                        <p className="text-2xl font-bold">{bundles.totalBundlesSold || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Bundle Revenue</p>
                        <p className="text-2xl font-bold">{bundles.bundleRevenue?.toFixed(2)} {currencySymbol()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Bundle Value</p>
                        <p className="text-2xl font-bold">{bundles.averageBundleValue?.toFixed(2)} {currencySymbol()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Revenue %</p>
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
    </AppLayout>
  );
}
