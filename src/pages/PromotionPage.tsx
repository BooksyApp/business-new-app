import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, Megaphone, MousePointerClick, Pause, Play } from "lucide-react";

import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentBusinessId } from "@/config/api";
import { formatPrice } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  promotionService,
  type PromotionQuote,
  type PromotionRow,
} from "@/services/promotionService";

/**
 * Paying to be seen, and seeing what it bought.
 *
 * This started as a buy button and a table: pick a price, pay, wait for it to expire. That
 * is a purchase, not a campaign — and what was missing were the ordinary things. A salon
 * fills up for the week, a stylist goes off sick, a rate turns out not to pay for itself.
 * Every ad platform answers that with pause, resume and change the budget, because an
 * advertiser who cannot stop spending stops spending with you.
 *
 * So the shape is: what is running right now with the controls on it, starting a new one
 * underneath, and what previous ones returned at the bottom.
 */
export default function PromotionPage() {
  const businessId = getCurrentBusinessId();
  const [quote, setQuote] = useState<PromotionQuote | null>(null);
  const [history, setHistory] = useState<PromotionRow[]>([]);
  const [dailyBudget, setDailyBudget] = useState("");
  const [days, setDays] = useState("7");
  const [liveBudget, setLiveBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const rows = await promotionService.history(businessId);
      setHistory(rows);
      const running = rows.find((r) => r.status === "ACTIVE" || r.status === "PAUSED");
      // Seeded from the server once, never overwritten while the salon is mid-edit.
      setLiveBudget((prev) => (prev === "" && running ? String(running.dailyBudget) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load promotions");
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-quoted as the numbers change, debounced: the forecast is the product here, and one
  // that only appears after committing is not a forecast.
  useEffect(() => {
    const rate = Number(dailyBudget);
    const timer = setTimeout(() => {
      promotionService
        .quote(businessId, Number.isFinite(rate) && rate > 0 ? rate : undefined, Number(days) || 7)
        .then((q) => {
          setQuote(q);
          // First load: start the field at the platform's floor rather than empty, so the
          // forecast has something to describe.
          setDailyBudget((prev) => (prev === "" ? String(q.minDaily) : prev));
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Could not load promotions"));
    }, 250);
    return () => clearTimeout(timer);
  }, [businessId, dailyBudget, days]);

  const buy = async () => {
    setBusy(true);
    try {
      const reserved = await promotionService.buy(businessId, Number(dailyBudget), Number(days) || 7);
      // Reserved first, paid second: a Stripe session created before the reservation
      // exists leaves nothing behind when the salon abandons the page.
      const { checkoutUrl } = await promotionService.checkout(
        businessId,
        reserved.id,
        `${window.location.origin}/promotion`,
        `${window.location.origin}/promotion`
      );
      window.location.href = checkoutUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the purchase");
      setBusy(false);
    }
  };

  const live = history.find((r) => r.status === "ACTIVE" || r.status === "PAUSED");
  /**
   * #144: a campaign reserved but never confirmed.
   *
   * The row is created PENDING and the Stripe webhook turns it ACTIVE. When that webhook
   * does not arrive — an unregistered endpoint, a missing signing secret, a salon that
   * closed the Stripe tab — it stays PENDING, and the server refuses a second campaign
   * while one exists. This screen showed nothing at all in that state, so the salon met a
   * 409 with no explanation and no way out.
   */
  const pending = history.find((r) => r.status === "PENDING");
  const past = history.filter((r) => r.status === "ENDED" || r.status === "CANCELLED");

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      await load();
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not work");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Advertise"
        subtitle="Reach customers browsing booqi. Set a daily budget, watch what it delivers, stop whenever you like."
      />
      <div className="space-y-6 p-4 md:p-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {quote && !quote.enabled ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Promoted placement is not on sale at the moment.
            </CardContent>
          </Card>
        ) : null}

        {/* Reserved but not confirmed. Above everything, because until it is resolved the
            salon cannot do anything else here. */}
        {pending && !live ? (
          <Card>
            <CardHeader>
              <CardTitle>Payment not confirmed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A campaign at {formatPrice(pending.dailyBudget)} a day for {pending.days} days is
                waiting on payment. Nothing has been charged and nothing is being shown. Finish
                it, or cancel it and start again.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const { checkoutUrl } = await promotionService.checkout(
                        businessId,
                        pending.id,
                        `${window.location.origin}/promotion`,
                        `${window.location.origin}/promotion`
                      );
                      window.location.href = checkoutUrl;
                    }, "Opening payment…")
                  }
                >
                  Finish payment
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () => promotionService.discard(businessId, pending.id),
                      "Reservation cancelled."
                    )
                  }
                >
                  Cancel it
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Running now, with its controls on it. A salon opening this page mid-campaign
            came to check on it or to stop it, not to buy another one. */}
        {live ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                {live.status === "PAUSED" ? "Campaign paused" : "Campaign running"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Seen</p>
                  <p className="text-lg font-semibold">{live.impressions.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tapped</p>
                  <p className="text-lg font-semibold">{live.clicks.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tap rate</p>
                  <p className="text-lg font-semibold">
                    {live.impressions > 0
                      ? `${((live.clicks / live.impressions) * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Runs until</p>
                  <p className="text-lg font-semibold">
                    {new Date(live.endsAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {live.status === "PAUSED" ? (
                <p className="text-sm text-muted-foreground">
                  Nothing is being spent or shown. The days you stay paused are added back to
                  the end, so you keep the days you paid for.
                </p>
              ) : null}

              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <Label htmlFor="liveBudget">Daily budget</Label>
                  <Input
                    id="liveBudget"
                    inputMode="decimal"
                    value={liveBudget}
                    onChange={(e) => setLiveBudget(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={busy || !liveBudget || Number(liveBudget) === live.dailyBudget}
                  onClick={() =>
                    void act(
                      () => promotionService.setBudget(businessId, live.id, Number(liveBudget)),
                      "Daily budget updated."
                    )
                  }
                >
                  Save budget
                </Button>
                {live.status === "ACTIVE" ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void act(() => promotionService.pause(businessId, live.id), "Campaign paused.")
                    }
                  >
                    <Pause className="mr-2 h-4 w-4" /> Pause
                  </Button>
                ) : (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => promotionService.resume(businessId, live.id),
                        "Campaign running again."
                      )
                    }
                  >
                    <Play className="mr-2 h-4 w-4" /> Resume
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                A new budget applies to the days still to come — what has already been
                delivered was delivered at the old rate.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {quote?.enabled && !live && !pending ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                New campaign
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your salon appears at the top of the lists customers browse in{" "}
                {quote.countryCode ?? "your country"}, marked as promoted. You set a daily
                budget; how often you are shown is your share of what every promoted salon is
                spending that day, so spending more really does show you more.
              </p>

              <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="dailyBudget">Daily budget</Label>
                      <Input
                        id="dailyBudget"
                        inputMode="decimal"
                        value={dailyBudget}
                        onChange={(e) => setDailyBudget(e.target.value)}
                        placeholder={String(quote.minDaily)}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Minimum {formatPrice(quote.minDaily)} a day.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="days">Days</Label>
                      <Input
                        id="days"
                        inputMode="numeric"
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                        placeholder="7"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Up to {quote.maxDays}. Ends {quote.endsOn}.
                      </p>
                    </div>
                  </div>

                  {/* The forecast, or an honest admission that there is not one yet. A
                      salon quoted a number and given a fifth of it does not buy a second
                      run, so an invented figure costs more than a blank. */}
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    {quote.forecastKnown ? (
                      <>
                        <span className="font-medium">
                          About {quote.forecastPerDay.toLocaleString()} people a day
                        </span>{" "}
                        <span className="text-muted-foreground">
                          see your salon at this budget, based on what promotion delivered here
                          yesterday. It moves with what other salons are spending.
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        No promotion has run here yet, so there is nothing to forecast from. The
                        numbers below fill in from your first day.
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => void buy()} disabled={busy || !dailyBudget}>
                      {busy ? "Opening payment…" : `Promote for ${formatPrice(quote.total)}`}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {formatPrice(quote.dailyBudget)} × {quote.days} days
                    </span>
                  </div>
              </>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Past campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            {past.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing finished yet. Once a campaign ends, what it cost and what it brought
                in appears here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 font-medium">Period</th>
                      <th className="py-2 font-medium">Rate</th>
                      <th className="py-2 font-medium">Paid</th>
                      <th className="py-2 font-medium">Seen</th>
                      <th className="py-2 font-medium">Tapped</th>
                      <th className="py-2 font-medium">Rate</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {past.map((row) => {
                      // Guarded: a period that has just started has no impressions yet, and
                      // "NaN%" in the one column a buyer checks is worse than a dash.
                      const rate =
                        row.impressions > 0
                          ? `${((row.clicks / row.impressions) * 100).toFixed(1)}%`
                          : "—";
                      return (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="py-2">
                            {new Date(row.startsAt).toLocaleDateString()} –{" "}
                            {new Date(row.endsAt).toLocaleDateString()}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {formatPrice(row.dailyBudget)}/day
                          </td>
                          <td className="py-2">{formatPrice(row.amount)}</td>
                          <td className="py-2">
                            <span className="inline-flex items-center gap-1.5">
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                              {row.impressions.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-2">
                            <span className="inline-flex items-center gap-1.5">
                              <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                              {row.clicks.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-2">{rate}</td>
                          <td className="py-2 text-muted-foreground">{row.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
