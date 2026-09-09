import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currencySymbol } from "@/lib/currency";
import { analysisService, type DiscountImpact as Impact } from "@/services/analysisService";

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)} ${currencySymbol()}` : "—";
};
const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * What the offers cost, and what they brought in.
 *
 * A discount is easy to give and impossible to argue about afterwards without this. The
 * three questions worth asking are how much was given away, whether it reached anybody
 * new, and which services carried it — a sale that only ever reaches people who were
 * coming anyway is a price cut, not marketing.
 */
export function DiscountImpact({
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
      .getDiscountImpact(businessId, startDate, endDate)
      .then((next) => {
        if (live) setData(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [businessId, startDate, endDate]);

  if (!data) return null;

  const discounted = num(data.totals?.discounted_bookings);
  const bookings = num(data.totals?.bookings);
  const givenAway = num(data.totals?.given_away);
  const discountedRevenue = num(data.totals?.discounted_revenue);
  const firstVisits = num(data.newClients?.all_first_visits);
  const firstVisitsOnOffer = num(data.newClients?.on_offer);

  // Nothing was ever discounted in this period — say so once rather than draw four
  // charts of zero.
  if (discounted === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Offers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nothing was on offer in this period. Cutting a price puts a badge on your card in
            the app and on the web — it is under Marketing → Offers.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxGivenAway = Math.max(1, ...data.byService.map((row) => num(row.given_away)));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Given away</p>
            <p className="mt-1 text-2xl font-semibold">{money(givenAway)}</p>
            <p className="text-xs text-muted-foreground">
              off {discounted} of {bookings} bookings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Taken on offer
            </p>
            <p className="mt-1 text-2xl font-semibold">{money(discountedRevenue)}</p>
            <p className="text-xs text-muted-foreground">
              {givenAway > 0
                ? `${(discountedRevenue / givenAway).toFixed(1)} earned per 1 given away`
                : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Share of bookings
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {bookings > 0 ? `${Math.round((discounted / bookings) * 100)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">came in on an offer</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              New clients on offer
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {firstVisitsOnOffer}
              {firstVisits > 0 ? (
                <span className="text-base font-normal text-muted-foreground"> / {firstVisits}</span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              first visits that arrived on a cut price
            </p>
          </CardContent>
        </Card>
      </div>

      {data.byService.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Which services carried it</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.byService.map((row) => (
                <li key={row.service}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">
                      {row.service}
                      {row.average_percent != null ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          avg -{row.average_percent}%
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {money(row.given_away)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${Math.round((num(row.given_away) / maxGivenAway) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {num(row.bookings)} bookings · {money(row.revenue)} taken
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data.byMonth.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By month</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.byMonth.map((row) => (
                <li key={row.month} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{row.month}</span>
                  <span className="tabular-nums">
                    {num(row.discounted_bookings)} on offer ·{" "}
                    <span className="font-semibold">-{money(row.given_away)}</span> ·{" "}
                    {money(row.revenue)} taken
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
