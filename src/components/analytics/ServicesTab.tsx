import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currencySymbol } from "@/lib/currency";
import { money, pct } from "@/lib/utils";
import { Package, TrendingUp, Award } from "lucide-react";
import type { ServiceAnalytics } from "@/services/analysisService";
import { t } from "@/i18n";

interface ServicesTabProps {
  data: ServiceAnalytics;
  loading: boolean;
}

export default function ServicesTab({ data }: ServicesTabProps) {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-5 md:grid-cols-3">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">{t("analytics.avgServicePrice")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(data.averageServicePrice)} {currencySymbol()}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">{t("analytics.mostPopular")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{data.mostPopularServiceName || t("common.nA")}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">{t("analytics.highestRevenue")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{data.highestRevenueServiceName || t("common.nA")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Service Performance */}
      {data.servicePerformance && data.servicePerformance.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>{t("analytics.servicePerformance")}</CardTitle>
            <CardDescription>{t("analytics.detailedPerformanceMetricsForEach")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.servicePerformance.map((service, index) => (
                <div
                  key={service.serviceId}
                  className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/30 to-muted/10 hover:from-muted/50 hover:to-muted/20 transition-all duration-300 border border-border/30 hover:border-accent/30 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/20 to-purple-600/20 text-foreground text-xs flex items-center justify-center font-bold ring-2 ring-background">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{service.serviceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("analytics.bookingsPopularity", { bookings: service.bookings, value: pct(service.popularityScore) })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-status-completed text-base">{money(service.revenue)} {currencySymbol()}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("analytics.avgOfTotal", { value: money(service.averagePrice), value2: currencySymbol(), value3: pct(service.revenuePercentage) })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Performance */}
      {data.categoryPerformance && data.categoryPerformance.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>{t("analytics.categoryPerformance")}</CardTitle>
            <CardDescription>{t("analytics.revenueAndBookingsByService")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {data.categoryPerformance.map((category, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{category.categoryName}</span>
                    <span className="text-sm text-muted-foreground">{pct(category.revenuePercentage)}%</span>
                  </div>
                  <div className="text-xl font-bold mb-1">{money(category.totalRevenue)} {currencySymbol()}</div>
                  <div className="text-sm text-muted-foreground">
                    {t("analytics.bookingsServices", { totalBookings: category.totalBookings, serviceCount: category.serviceCount })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("analytics.avgPrice", { value: money(category.averageServicePrice), value2: currencySymbol() })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

