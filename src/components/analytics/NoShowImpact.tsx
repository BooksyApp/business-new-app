import { useEffect, useState } from "react";
import { CalendarX, Coins, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currencySymbol } from "@/lib/currency";
import { analysisService, type NoShowImpact as Impact } from "@/services/analysisService";
import { t, fmtDate as formatLocaleDate } from "@/i18n";

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)} ${currencySymbol()}` : "—";
};
const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const day = (value: unknown) => {
  if (!value) return "—";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : formatLocaleDate(d, { year: "numeric", month: "numeric", day: "numeric" });
};

/**
 * What empty chairs cost.
 *
 * Two numbers, and they are not the same: the fee is what you may ask for, the lost
 * revenue is the appointment that did not happen. A salon usually knows it has no-shows
 * and has never seen what a year of them adds up to — which is the number that decides
 * whether a deposit policy is worth the friction.
 */
export function NoShowImpact({
  businessId,
  startDate,
  endDate,
}: {
  businessId: number;
  startDate?: string;
  endDate?: string;
}) {
  const [data, setData] = useState<Impact | null>(null);

  useEffect(() => {
    if (!businessId) return;
    let live = true;
    analysisService
      .getNoShowImpact(businessId, startDate, endDate)
      .then((next) => {
        if (live) setData(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [businessId, startDate, endDate]);

  if (!data) return null;

  const noShows = num(data.totals?.no_shows);
  const cancellations = num(data.totals?.cancellations);
  const bookings = num(data.totals?.bookings);
  const lost = num(data.totals?.lost_revenue);
  const fees = num(data.totals?.fees_recorded);
  const hasPolicy = num(data.policy?.window_hours) > 0;

  if (noShows === 0 && cancellations === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("analytics.noShows2")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("analytics.nobodyMissedAnAppointmentIn")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const worstMonth = Math.max(1, ...data.byMonth.map((m) => num(m.no_shows)));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={UserX}
          tone="bg-rose-50 text-rose-700"
          label={t("analytics.noShows2")}
          value={String(noShows)}
          hint={bookings > 0 ? t("analytics.ofBookings", { value: Math.round((noShows / bookings) * 100) }) : undefined}
        />
        <Tile
          icon={CalendarX}
          tone="bg-amber-50 text-amber-700"
          label={t("common.cancellations")}
          value={String(cancellations)}
          hint={hasPolicy ? t("analytics.hNoticeWindow", { value: num(data.policy?.window_hours) }) : t("analytics.noPolicySet")}
        />
        <Tile
          icon={Coins}
          tone="bg-slate-100 text-slate-700"
          label={t("analytics.emptyChairsCost")}
          value={money(lost)}
          hint={t("analytics.whatThoseAppointmentsWereWorth")}
        />
        <Tile
          icon={Coins}
          tone="bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]"
          label={t("analytics.feesRecorded")}
          value={money(fees)}
          hint={t("analytics.onBookings", { value: num(data.totals?.fees_count) })}
        />
      </div>

      {/* A salon with no policy sees four numbers and no way to act on them. This is the
          action, said once, where the cost is. */}
      {!hasPolicy && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="pt-6">
            <p className="text-sm font-semibold text-amber-900">
              {t("analytics.youHaveNoCancellationPolicy")}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {t("analytics.aNoticeWindowAndA")}
            </p>
          </CardContent>
        </Card>
      )}

      {data.repeatOffenders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("analytics.clientsWhoKeepMissing")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              {t("analytics.twoOrMoreNoShows")}
            </p>
            <div className="space-y-2">
              {data.repeatOffenders.map((row) => (
                <div
                  key={`${row.client}-${row.client_email ?? ""}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.client}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("analytics.last", { value: row.client_email ?? t("analytics.noEmail"), value2: day(row.latest) })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge className="bg-rose-600 hover:bg-rose-600">
                      {t("analytics.noShows3", { value: num(row.no_shows) })}
                    </Badge>
                    {num(row.cancellations) > 0 && (
                      <Badge variant="secondary">{t("analytics.cancelled", { value: num(row.cancellations) })}</Badge>
                    )}
                    {num(row.fees_recorded) > 0 && (
                      <span className="text-sm font-semibold">{money(row.fees_recorded)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.byMonth.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("analytics.byMonth")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.byMonth.map((row) => (
                <li key={row.month}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{row.month}</span>
                    <span className="tabular-nums">
                      {t("analytics.noShowsCancelled", { value: num(row.no_shows), value2: num(row.cancellations) })}
                      {num(row.fees_recorded) > 0 && (
                        <span className="ml-2 font-semibold">{money(row.fees_recorded)}</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${Math.round((num(row.no_shows) / worstMonth) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Tile({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: typeof UserX;
  tone: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-6">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold leading-none">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
