import { useEffect, useState } from "react";
import { CalendarX, Coins, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currencySymbol } from "@/lib/currency";
import { analysisService, type NoShowImpact as Impact } from "@/services/analysisService";

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
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
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
          <CardTitle className="text-base">No-shows</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nobody missed an appointment in this period.
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
          label="No-shows"
          value={String(noShows)}
          hint={bookings > 0 ? `${Math.round((noShows / bookings) * 100)}% of bookings` : undefined}
        />
        <Tile
          icon={CalendarX}
          tone="bg-amber-50 text-amber-700"
          label="Cancellations"
          value={String(cancellations)}
          hint={hasPolicy ? `${num(data.policy?.window_hours)}h notice window` : "no policy set"}
        />
        <Tile
          icon={Coins}
          tone="bg-slate-100 text-slate-700"
          label="Empty chairs cost"
          value={money(lost)}
          hint="what those appointments were worth"
        />
        <Tile
          icon={Coins}
          tone="bg-emerald-50 text-emerald-700"
          label="Fees recorded"
          value={money(fees)}
          hint={`on ${num(data.totals?.fees_count)} bookings`}
        />
      </div>

      {/* A salon with no policy sees four numbers and no way to act on them. This is the
          action, said once, where the cost is. */}
      {!hasPolicy && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="pt-6">
            <p className="text-sm font-semibold text-amber-900">
              You have no cancellation policy, so none of this was charged for.
            </p>
            <p className="mt-1 text-sm text-amber-800">
              A notice window and a late fee are under Settings → Booking rules. The fee is
              recorded on the booking for you to collect; nothing is charged automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {data.repeatOffenders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clients who keep missing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Two or more no-shows. One is an accident; four is a decision, and whether to
              keep taking their bookings is yours.
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
                      {row.client_email ?? "no email"} · last {day(row.latest)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge className="bg-rose-600 hover:bg-rose-600">
                      {num(row.no_shows)} no-shows
                    </Badge>
                    {num(row.cancellations) > 0 && (
                      <Badge variant="secondary">{num(row.cancellations)} cancelled</Badge>
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
            <CardTitle className="text-base">By month</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.byMonth.map((row) => (
                <li key={row.month}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{row.month}</span>
                    <span className="tabular-nums">
                      {num(row.no_shows)} no-shows · {num(row.cancellations)} cancelled
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
