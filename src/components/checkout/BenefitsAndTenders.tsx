import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { currencySymbol } from "@/lib/currency";
import type { SalePayment } from "@/services/paymentConfirmationService";
import { useFeatureFlags } from "@/services/platformService";
import { tillBenefitsService, type ClientBenefits } from "@/services/tillBenefitsService";
import { useEffect, useState } from "react";
import { t } from "@/i18n";

export type Coverage = Record<string, "MEMBERSHIP" | "PACKAGE" | "VISIT_REWARD" | undefined>;

interface Props {
  businessId: number;
  clientId?: number | null;
  orderItems: Array<{ id: string; name: string; quantity: number; price: number; serviceId?: number }>;
  /** Bill total, after discount and tip. */
  total: number;
  onChange: (state: { coverage: Coverage; payments: SalePayment[]; due: number; remaining: number }) => void;
}

/**
 * The part of checkout that is not "one method for the whole bill".
 *
 * Two things happen here. A line can be paid by a benefit the client already holds — a
 * membership, a package, or a free service earned on the stamp card — which takes it off
 * the amount due. What is left can then be settled with more than one tender: a gift card
 * with 20 on it against an 80 bill is 20 from the card and 80 in cash, not a card that
 * cannot be used at all.
 */
export function BenefitsAndTenders({ businessId, clientId, orderItems, total, onChange }: Props) {
  const flags = useFeatureFlags();
  const [benefits, setBenefits] = useState<ClientBenefits | null>(null);
  const [coverage, setCoverage] = useState<Coverage>({});
  const [giftCode, setGiftCode] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [pointsToSpend, setPointsToSpend] = useState("");
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");

  useEffect(() => {
    if (!clientId) {
      setBenefits(null);
      setCoverage({});
      return;
    }
    tillBenefitsService
      .get(businessId, clientId)
      .then(setBenefits)
      .catch(() => setBenefits(null));
  }, [businessId, clientId]);

  const covered = orderItems.reduce(
    (sum, item) => (coverage[item.id] ? sum + item.price * item.quantity : sum),
    0
  );
  const due = Math.max(0, Number((total - covered).toFixed(2)));

  const payments: SalePayment[] = [];
  const giftPart = Math.min(parseFloat(giftAmount) || 0, due);
  if (giftPart > 0 && giftCode.trim()) {
    payments.push({ method: "GIFT_CARD", amount: giftPart, giftCardCode: giftCode.trim().toUpperCase() });
  }
  // 100 points is one currency unit, matching LoyaltyService on the server.
  const pointsValue = Math.max(0, Math.min((parseFloat(pointsToSpend) || 0) / 100, due - giftPart));
  if (pointsValue > 0) {
    payments.push({
      method: "POINTS",
      amount: Number(pointsValue.toFixed(2)),
      points: parseFloat(pointsToSpend),
    });
  }
  if ((parseFloat(cash) || 0) > 0) payments.push({ method: "CASH", amount: parseFloat(cash) });
  if ((parseFloat(card) || 0) > 0) payments.push({ method: "CARD_TERMINAL", amount: parseFloat(card) });

  const tendered = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Number((due - tendered).toFixed(2));

  useEffect(() => {
    onChange({ coverage, payments, due, remaining });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(coverage), JSON.stringify(payments), due, remaining]);

  /** A membership covers a line when it lists that service, or lists none at all. */
  const membershipCovers = (serviceId?: number) =>
    (benefits?.memberships ?? []).some(
      (m) =>
        (m.serviceIds.length === 0 || (serviceId != null && m.serviceIds.includes(serviceId))) &&
        (m.sessions_remaining > 0 || m.discount_percent > 0)
    );

  const packageCovers = (serviceId?: number) =>
    (benefits?.packages ?? []).some((p) => p.service_id == null || p.service_id === serviceId);

  if (!clientId) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          {t("checkout.pickAClientToUse")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("checkout.benefitsAndPayment")}</CardTitle>
        {benefits && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{t("checkout.points", { points: benefits.points })}</Badge>
            {benefits.visitsForReward > 0 && (
              <Badge variant="secondary">
                {t("checkout.visits", { visits: benefits.visits, visitsForReward: benefits.visitsForReward, value: benefits.rewardsAvailable > 0 ? t("checkout.free", { rewardsAvailable: benefits.rewardsAvailable }) : "" })}
              </Badge>
            )}

          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {orderItems.map((item) => {
            const options: Array<{ value: Coverage[string]; label: string; enabled: boolean }> = [
              { value: undefined, label: t("checkout.pay"), enabled: true },
              // The platform decides whether these exist. It was a literal `false` here, so
              // a till could never price a bill against a membership however the back
              // office was configured.
              {
                value: "MEMBERSHIP",
                label: t("checkout.membership"),
                enabled: flags.memberships === true && membershipCovers(item.serviceId),
              },
              {
                value: "PACKAGE",
                label: t("checkout.package"),
                enabled: flags.packages === true && packageCovers(item.serviceId),
              },
              {
                value: "VISIT_REWARD",
                label: t("checkout.freeEarned"),
                enabled: (benefits?.rewardsAvailable ?? 0) > 0,
              },
            ];
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
              >
                <div className="text-sm">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted-foreground">
                    {(item.price * item.quantity).toFixed(2)} {currencySymbol()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {options
                    .filter((o) => o.enabled)
                    .map((o) => (
                      <Button
                        key={o.label}
                        size="sm"
                        variant={coverage[item.id] === o.value ? "default" : "outline"}
                        onClick={() => setCoverage({ ...coverage, [item.id]: o.value })}
                      >
                        {o.label}
                      </Button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {/* Taking a gift card the platform has switched off leaves the till holding a
              tender the backend will refuse. */}
          {flags.gift_cards !== false && (
          <>
          <div>
            <label className="text-xs text-muted-foreground">{t("checkout.giftCardCode")}</label>
            <Input
              value={giftCode}
              onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
              placeholder={benefits?.giftCards[0]?.code ?? t("checkout.code")}
            />
            {benefits && benefits.giftCards.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {benefits.giftCards.map((c) => `${c.code}: ${c.balance} ${currencySymbol()}`).join(" · ")}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("checkout.takeFromTheCard")}</label>
            <Input
              type="number"
              min={0}
              value={giftAmount}
              onChange={(e) => setGiftAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          </>
          )}
          <div>
            <label className="text-xs text-muted-foreground">
              {t("checkout.pointsToSpend", { value: currencySymbol() })}
            </label>
            <Input
              type="number"
              min={0}
              max={benefits?.points ?? 0}
              value={pointsToSpend}
              onChange={(e) => setPointsToSpend(e.target.value)}
              placeholder="0"
            />
          </div>
          <div />
          <div>
            <label className="text-xs text-muted-foreground">{t("common.cash")}</label>
            <Input
              type="number"
              min={0}
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("common.card")}</label>
            <Input
              type="number"
              min={0}
              value={card}
              onChange={(e) => setCard(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="rounded-md bg-muted p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("checkout.coveredByBenefits")}</span>
            <span>
              {covered.toFixed(2)} {currencySymbol()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("checkout.due")}</span>
            <span className="font-medium">
              {due.toFixed(2)} {currencySymbol()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("checkout.stillToPay")}</span>
            <span
              className={
                remaining > 0.009 ? "font-medium text-destructive" : "font-medium text-green-600"
              }
            >
              {remaining.toFixed(2)} {currencySymbol()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
