import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currencySymbol } from "@/lib/currency";
import { money, pct } from "@/lib/utils";
import { UserCheck, DollarSign, Calendar, TrendingUp } from "lucide-react";
import type { StaffPerformance } from "@/services/analysisService";
import { t } from "@/i18n";

interface StaffTabProps {
  data: StaffPerformance;
  loading: boolean;
}

export default function StaffTab({ data }: StaffTabProps) {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-5 md:grid-cols-3">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">{t("analytics.totalStaff")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.staffDetails.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">{t("analytics.totalRevenue")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(data.totalStaffRevenue)} {currencySymbol()}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">{t("analytics.avgRevenueStaff")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(data.averageRevenuePerStaff)} {currencySymbol()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Performance Details */}
      {data.staffDetails && data.staffDetails.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>{t("analytics.staffPerformanceDetails")}</CardTitle>
            <CardDescription>{t("analytics.individualStaffMemberPerformanceMetrics")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.staffDetails
                .sort((a, b) => b.revenue - a.revenue)
                .map((staff, index) => (
                  <div
                    key={staff.staffId}
                    className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/30 to-muted/10 hover:from-muted/50 hover:to-muted/20 transition-all duration-300 border border-border/30 hover:border-accent/30 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/20 to-purple-600/20 text-foreground text-xs flex items-center justify-center font-bold ring-2 ring-background">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{staff.staffName || t("analytics.staff", { staffId: staff.staffId })}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("analytics.bookingsAvgTicket", { bookings: staff.bookings, value: money(staff.averageTicket), value2: currencySymbol() })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-status-completed text-base">{money(staff.revenue)} {currencySymbol()}</div>
                      {staff.utilizationRate !== null && (
                        <div className="text-xs text-muted-foreground">
                          {t("analytics.utilization", { value: pct(staff.utilizationRate) })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">{t("analytics.totalBookings")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totalStaffBookings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("analytics.acrossAllStaffMembers")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">{t("analytics.averagePerformance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{money(data.averageRevenuePerStaff)} {currencySymbol()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("analytics.perStaffMember")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

