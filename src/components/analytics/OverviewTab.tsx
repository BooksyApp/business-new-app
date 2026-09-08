import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currencySymbol } from "@/lib/currency";
import { money, pct } from "@/lib/utils";
import type { AnalyticsOverview } from "@/services/analysisService";
import { format } from "date-fns";
import {
  Award,
  BarChart3,
  Calendar,
  DollarSign,
  Lightbulb,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

interface OverviewTabProps {
  data: AnalyticsOverview;
  loading: boolean;
}

const TONES = {
  emerald: { chip: "bg-emerald-50 text-emerald-600", value: "text-emerald-700", bar: "bg-emerald-500" },
  sky: { chip: "bg-sky-50 text-sky-600", value: "text-sky-700", bar: "bg-sky-500" },
  violet: { chip: "bg-violet-50 text-violet-600", value: "text-violet-700", bar: "bg-violet-500" },
  amber: { chip: "bg-amber-50 text-amber-600", value: "text-amber-700", bar: "bg-amber-500" },
  rose: { chip: "bg-rose-50 text-rose-600", value: "text-rose-700", bar: "bg-rose-500" },
} as const;

/**
 * The overview, read rather than displayed.
 *
 * It was eight identical grey-gradient cards and a bar chart with no scale: every number
 * at the same weight, nothing said whether any of them was good, and the two figures a
 * salon actually acts on — how much of the diary turned into money, and who is not coming
 * back — were not there at all. Colour carries meaning here (green is money coming in,
 * rose is money lost), and the strip at the top says what the numbers add up to.
 */
export default function OverviewTab({ data }: OverviewTabProps) {
  const metrics = [
    {
      title: "Revenue",
      value: `${money(data.totalRevenue)} ${currencySymbol()}`,
      change: data.revenueChange,
      icon: DollarSign,
      tone: "emerald" as const,
    },
    {
      title: "Bookings",
      value: data.totalBookings.toString(),
      change: data.bookingsChange,
      icon: Calendar,
      tone: "sky" as const,
    },
    {
      title: "New clients",
      value: data.newClients.toString(),
      change: data.newClientsChange,
      icon: Users,
      tone: "violet" as const,
    },
    {
      title: "Average ticket",
      value: `${money(data.averageTicket)} ${currencySymbol()}`,
      change: data.averageTicketChange,
      icon: TrendingUp,
      tone: "amber" as const,
    },
  ];

  const days = data.dailyRevenue ?? [];
  const maxRevenue = days.length ? Math.max(...days.map((d) => d.revenue)) : 0;
  const avgRevenue = days.length ? days.reduce((n, d) => n + d.revenue, 0) / days.length : 0;
  const bestDay = days.length ? days.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null;

  const trends = data.bookingTrends;
  const growth = data.clientGrowth;
  const lostBookings = (trends?.cancelledBookings ?? 0) + (trends?.noShowBookings ?? 0);
  const retention =
    growth && growth.totalClients > 0
      ? Math.round((growth.returningClients / growth.totalClients) * 100)
      : null;

  const serviceRevenue = (data.topServices ?? []).reduce((n, s) => n + s.revenue, 0);
  const staffRevenue = (data.topStaff ?? []).reduce((n, s) => n + s.revenue, 0);

  /** What the numbers add up to, in sentences. A salon owner is not a chart reader. */
  const insights: { text: string; tone: keyof typeof TONES }[] = [];
  if (bestDay && bestDay.revenue > 0) {
    insights.push({
      text: `${format(new Date(bestDay.date), "EEEE d MMM")} was your best day — ${money(
        bestDay.revenue
      )} ${currencySymbol()}, ${Math.round((bestDay.revenue / Math.max(avgRevenue, 1) - 1) * 100)}% above your daily average.`,
      tone: "emerald",
    });
  }
  if (data.topServices?.length) {
    const top = data.topServices[0];
    const share = serviceRevenue > 0 ? Math.round((top.revenue / serviceRevenue) * 100) : 0;
    insights.push({
      text: `${top.serviceName} brings ${share}% of your service revenue across ${top.bookings} bookings.`,
      tone: "sky",
    });
  }
  if (trends && trends.totalBookings > 0 && lostBookings > 0) {
    insights.push({
      text: `${lostBookings} of ${trends.totalBookings} bookings were cancelled or no-shows — ${pct(
        trends.cancellationRate + trends.noShowRate
      )}% of the diary, worth roughly ${money(lostBookings * data.averageTicket)} ${currencySymbol()}.`,
      tone: "rose",
    });
  }
  if (retention != null) {
    insights.push({
      text:
        retention >= 50
          ? `${retention}% of your clients came back this period. Repeat custom is carrying the business.`
          : `Only ${retention}% of your clients came back. Most of your revenue is coming from people you have to find again.`,
      tone: retention >= 50 ? "emerald" : "amber",
    });
  }

  return (
    <div className="space-y-6">
      {/* What the numbers mean, before the numbers themselves. */}
      {insights.length > 0 && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb size={16} className="text-violet-600" />
            <p className="text-sm font-semibold text-violet-900">What this period is telling you</p>
          </div>
          <ul className="space-y-1.5">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-violet-950/80">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONES[insight.tone].bar}`} />
                {insight.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const up = metric.change >= 0;
          const tone = TONES[metric.tone];
          return (
            <Card key={metric.title} className="bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.title}</p>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone.chip}`}>
                    <Icon size={16} />
                  </span>
                </div>
                <p className={`mt-2 text-2xl font-semibold ${tone.value}`}>{metric.value}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {up ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                  )}
                  <span className={`text-xs font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
                    {up ? "+" : ""}
                    {pct(metric.change)}%
                  </span>
                  <span className="text-xs text-muted-foreground">vs previous period</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Two facts the diary answers and the money cards cannot. */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-rose-500 bg-white">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50">
              <XCircle size={18} className="text-rose-600" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Cancelled or no-show</p>
              <p className="text-xl font-semibold text-rose-700">
                {lostBookings}
                {trends?.totalBookings ? (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    of {trends.totalBookings}
                  </span>
                ) : null}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 bg-white">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <UserCheck size={18} className="text-emerald-600" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Clients who came back</p>
              <p className="text-xl font-semibold text-emerald-700">
                {growth?.returningClients ?? 0}
                {retention != null ? (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">{retention}%</span>
                ) : null}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-sky-500 bg-white">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50">
              <BarChart3 size={18} className="text-sky-600" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Average day</p>
              <p className="text-xl font-semibold text-sky-700">
                {money(avgRevenue)} {currencySymbol()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Revenue by day</CardTitle>
              <CardDescription className="mt-0.5">
                The dashed line is your daily average. Bars above it are the days worth repeating.
              </CardDescription>
            </div>
            {bestDay && bestDay.revenue > 0 && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Best day</p>
                <p className="text-sm font-semibold text-emerald-700">
                  {format(new Date(bestDay.date), "d MMM")} · {money(bestDay.revenue)} {currencySymbol()}
                </p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {days.length > 0 ? (
            <div className="relative h-64 rounded-xl border bg-muted/20 p-4">
              {/* The average, drawn. A bar chart with no reference line only says which bar
                  is tallest, which is the one thing you can already see. */}
              {maxRevenue > 0 && (
                <div
                  className="pointer-events-none absolute left-4 right-4 border-t-2 border-dashed border-violet-400/70"
                  style={{ bottom: `${(avgRevenue / maxRevenue) * 82 + 26}px` }}
                >
                  <span className="absolute -top-4 right-0 rounded bg-violet-100 px-1.5 text-[10px] font-medium text-violet-700">
                    avg {money(avgRevenue)}
                  </span>
                </div>
              )}
              <div className="flex h-full items-end justify-between gap-1">
                {days.map((day, index) => {
                  const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                  const best = bestDay && day.date === bestDay.date && day.revenue > 0;
                  return (
                    <div key={index} className="group flex flex-1 flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t transition-all ${
                          best
                            ? "bg-emerald-500"
                            : day.revenue >= avgRevenue
                              ? "bg-sky-500"
                              : "bg-slate-300"
                        } group-hover:opacity-80`}
                        style={{ height: `${height}%`, minHeight: day.revenue > 0 ? "4px" : "0" }}
                        title={`${format(new Date(day.date), "EEE d MMM")}: ${money(day.revenue)} ${currencySymbol()}`}
                      />
                      <span className="hidden text-[10px] text-muted-foreground md:block">
                        {format(new Date(day.date), "d")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed">
              <BarChart3 className="mb-2 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No takings in this period</p>
              <p className="text-sm text-muted-foreground">
                Revenue appears here once sales are rung up at the till.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Top services</CardTitle>
                <CardDescription className="mt-0.5">Share of service revenue</CardDescription>
              </div>
              <Award className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topServices?.length ? (
              data.topServices.map((service, index) => {
                const share = serviceRevenue > 0 ? (service.revenue / serviceRevenue) * 100 : 0;
                return (
                  <div key={service.serviceId}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium">{service.serviceName}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-emerald-700">
                        {money(service.revenue)} {currencySymbol()}
                      </span>
                    </div>
                    {/* The bar is the point: which one service is carrying the salon. */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${share}%` }} />
                      </div>
                      <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                        {Math.round(share)}% · {service.bookings} booked
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No services sold in this period.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Top staff</CardTitle>
                <CardDescription className="mt-0.5">Share of revenue taken</CardDescription>
              </div>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topStaff?.length ? (
              data.topStaff.map((member, index) => {
                const share = staffRevenue > 0 ? (member.revenue / staffRevenue) * 100 : 0;
                return (
                  <div key={member.staffId}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-700">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium">{member.staffName}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-emerald-700">
                        {money(member.revenue)} {currencySymbol()}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${share}%` }} />
                      </div>
                      <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">
                        {member.bookings} booked · {money(member.averageTicket)} avg
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No staff revenue in this period.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
