import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Megaphone, MousePointerClick, Pause, Play } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader, Card, CardContent, CardHeader, CardTitle } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { Button } from "@/components/ui/button";
import { getCurrentBusinessId } from "@/config/api";
import { salonPath } from "@/lib/salonKey";
import { PaymentReturnBanner } from "@/components/page/PaymentReturnBanner";
import { formatPrice } from "@/lib/currency";
import {
  promotionService,
  type PromotionPackage,
  type PromotionQuote,
  type PromotionRow,
} from "@/services/promotionService";
import { t, getLocale, fmtDate as formatLocaleDate } from "@/i18n";

const packageName = (p: PromotionPackage) => {
  const l = getLocale();
  return (l === "az" ? p.nameAz : l === "ru" ? p.nameRu : p.nameEn) || p.nameEn;
};

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();
  const returnFlag = searchParams.get("paid");

  const load = useCallback(async () => {
    try {
      const rows = await promotionService.history(businessId);
      setHistory(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("promotion.couldNotLoadPromotions"));
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Back from Stripe: the webhook, not the redirect, activates the campaign, and it can land a
  // few seconds later. Re-read a handful of times instead of showing a stale PENDING row.
  const activated = history.some((r) => r.status === "ACTIVE" || r.status === "PAUSED");
  useEffect(() => {
    if (returnFlag !== "1" || activated) return;
    let tries = 0;
    const id = setInterval(() => {
      if (++tries > 12) clearInterval(id);
      else void load();
    }, 2500);
    return () => clearInterval(id);
  }, [returnFlag, activated, load]);

  useEffect(() => {
    promotionService
      .quote(businessId)
      .then(setQuote)
      .catch((e) => setError(e instanceof Error ? e.message : t("promotion.couldNotLoadPromotions")));
  }, [businessId]);

  const buy = async (packageId: PromotionPackage["id"]) => {
    setBusy(true);
    try {
      const reserved = await promotionService.buy(businessId, packageId);
      // Reserved first, paid second: a Stripe session created before the reservation
      // exists leaves nothing behind when the salon abandons the page.
      const { checkoutUrl } = await promotionService.checkout(
        businessId,
        reserved.id,
        `${window.location.origin}${salonPath(businessId, "promotion")}?paid=1`,
        `${window.location.origin}${salonPath(businessId, "promotion")}?paid=0`
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
        <PaymentReturnBanner kind="promotion" flag={returnFlag} confirmed={activated} />
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
                {t("promotion.pendingPackage", { value: formatPrice(pending.amount), days: pending.days })}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const { checkoutUrl } = await promotionService.checkout(
                        businessId,
                        pending.id,
                        `${window.location.origin}${salonPath(businessId, "promotion")}?paid=1`,
                        `${window.location.origin}${salonPath(businessId, "promotion")}?paid=0`
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
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {quote.packages.map((p) => (
                  <div key={p.id} className="flex flex-col gap-3 rounded-lg border p-4">
                    <div>
                      <p className="font-semibold">{packageName(p)}</p>
                      <p className="text-sm text-muted-foreground">{t("promotion.packageDays", { days: p.days })}</p>
                    </div>
                    {/* A forecast, or an honest admission that there is not one yet. */}
                    <p className="flex-1 text-xs text-muted-foreground">
                      {p.forecastKnown
                        ? t("promotion.packageForecast", { value: p.forecastPerDay.toLocaleString() })
                        : t("promotion.noPromotionHasRunHere")}
                    </p>
                    {p.overridden && (
                      <p className="flex items-center gap-2 text-xs">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{t("billing.specialPrice")}</span>
                        {p.defaultPrice !== undefined && (
                          <span className="text-muted-foreground line-through">{formatPrice(p.defaultPrice)}</span>
                        )}
                      </p>
                    )}
                    <Button disabled={busy} onClick={() => void buy(p.id)}>
                      {busy ? t("promotion.openingPayment") : t("promotion.promoteFor", { value: formatPrice(p.price) })}
                    </Button>
                  </div>
                ))}
              </div>
              {quote.packages.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("promotion.noPackages")}</p>
              ) : null}
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
                      <th className="py-2 font-medium">{t("promotion.days")}</th>
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
                            {row.days}
                          </td>
                          <td className="py-2">
                            {row.source === "FREE_GRANT" ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                {t("promotion.freeGrant")}
                              </span>
                            ) : (
                              formatPrice(row.amount)
                            )}
                          </td>
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
