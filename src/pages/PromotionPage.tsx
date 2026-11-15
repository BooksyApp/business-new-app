import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, Megaphone, MousePointerClick, Pause, Play } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader, Card, CardContent, CardHeader, CardTitle } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { Button } from "@/components/ui/button";
import { getCurrentBusinessId } from "@/config/api";
import { formatPrice } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  promotionService,
  type PromotionQuote,
  type PromotionRow,
} from "@/services/promotionService";
import { t, fmtDate as formatLocaleDate } from "@/i18n";

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
      setError(e instanceof Error ? e.message : t("promotion.couldNotLoadPromotions"));
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
        .catch((e) => setError(e instanceof Error ? e.message : t("promotion.couldNotLoadPromotions")));
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
      toast.error(e instanceof Error ? e.message : t("promotion.couldNotStartThePurchase"));
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
      toast.error(e instanceof Error ? e.message : t("promotion.thatDidNotWork"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <BooqiScope>
      <PageHeader
        title={t("promotion.advertise")}
        subtitle={t("promotion.reachCustomersBrowsingBooqiSet")}
      />
      <div className={pageBody}>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {quote && !quote.enabled ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              {t("promotion.promotedPlacementIsNotOn")}
            </CardContent>
          </Card>
        ) : null}

        {/* Reserved but not confirmed. Above everything, because until it is resolved the
            salon cannot do anything else here. */}
        {pending && !live ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("promotion.paymentNotConfirmed")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("promotion.aCampaignAtADay", { value: formatPrice(pending.dailyBudget), days: pending.days })}
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
                    }, t("promotion.openingPayment"))
                  }
                >
                  {t("promotion.finishPayment")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () => promotionService.discard(businessId, pending.id),
                      t("promotion.reservationCancelled")
                    )
                  }
                >
                  {t("promotion.cancelIt")}
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
                {live.status === "PAUSED" ? t("promotion.campaignPaused") : t("promotion.campaignRunning")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t("promotion.seen")}</p>
                  <p className="text-lg font-semibold">{live.impressions.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("promotion.tapped")}</p>
                  <p className="text-lg font-semibold">{live.clicks.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("promotion.tapRate")}</p>
                  <p className="text-lg font-semibold">
                    {live.impressions > 0
                      ? `${((live.clicks / live.impressions) * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("promotion.runsUntil")}</p>
                  <p className="text-lg font-semibold">
                    {formatLocaleDate(new Date(live.endsAt), { year: "numeric", month: "numeric", day: "numeric" })}
                  </p>
                </div>
              </div>

              {live.status === "PAUSED" ? (
                <p className="text-sm text-muted-foreground">
                  {t("promotion.nothingIsBeingSpentOr")}
                </p>
              ) : null}

              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <Label htmlFor="liveBudget">{t("promotion.dailyBudget")}</Label>
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
                      t("promotion.dailyBudgetUpdated")
                    )
                  }
                >
                  {t("promotion.saveBudget")}
                </Button>
                {live.status === "ACTIVE" ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void act(() => promotionService.pause(businessId, live.id), t("promotion.campaignPaused2"))
                    }
                  >
                    <Pause className="mr-2 h-4 w-4" />{" "}{t("promotion.pause")}
                  </Button>
                ) : (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => promotionService.resume(businessId, live.id),
                        t("promotion.campaignRunningAgain")
                      )
                    }
                  >
                    <Play className="mr-2 h-4 w-4" />{" "}{t("promotion.resume")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("promotion.aNewBudgetAppliesTo")}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {quote?.enabled && !live && !pending ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {t("promotion.newCampaign")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("promotion.yourSalonAppearsAtThe")}{" "}
                {t("promotion.markedAsPromotedYouSet", { value: quote.countryCode ?? t("promotion.yourCountry") })}
              </p>

              <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="dailyBudget">{t("promotion.dailyBudget")}</Label>
                      <Input
                        id="dailyBudget"
                        inputMode="decimal"
                        value={dailyBudget}
                        onChange={(e) => setDailyBudget(e.target.value)}
                        placeholder={String(quote.minDaily)}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("promotion.minimumADay", { value: formatPrice(quote.minDaily) })}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="days">{t("promotion.days")}</Label>
                      <Input
                        id="days"
                        inputMode="numeric"
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                        placeholder="7"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("promotion.upToEnds", { maxDays: quote.maxDays, endsOn: quote.endsOn })}
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
                          {t("promotion.aboutPeopleADay", { value: quote.forecastPerDay.toLocaleString() })}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {t("promotion.seeYourSalonAtThis")}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("promotion.noPromotionHasRunHere")}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => void buy()} disabled={busy || !dailyBudget}>
                      {busy ? t("promotion.openingPayment") : t("promotion.promoteFor", { value: formatPrice(quote.total) })}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t("promotion.days2", { value: formatPrice(quote.dailyBudget), days: quote.days })}
                    </span>
                  </div>
              </>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("promotion.pastCampaigns")}</CardTitle>
          </CardHeader>
          <CardContent>
            {past.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("promotion.nothingFinishedYetOnceA")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 font-medium">{t("common.period")}</th>
                      <th className="py-2 font-medium">{t("promotion.rate")}</th>
                      <th className="py-2 font-medium">{t("common.paid")}</th>
                      <th className="py-2 font-medium">{t("promotion.seen")}</th>
                      <th className="py-2 font-medium">{t("promotion.tapped")}</th>
                      <th className="py-2 font-medium">{t("promotion.rate")}</th>
                      <th className="py-2 font-medium">{t("promotion.status")}</th>
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
                            {formatLocaleDate(new Date(row.startsAt), { year: "numeric", month: "numeric", day: "numeric" })} –{" "}
                            {formatLocaleDate(new Date(row.endsAt), { year: "numeric", month: "numeric", day: "numeric" })}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {t("promotion.day", { value: formatPrice(row.dailyBudget) })}
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
    </BooqiScope>
    </AppLayout>
  );
}
