import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { t } from "@/i18n";

type Props = {
  /** What the salon paid for; picks the wording of the confirmed line. */
  kind: "promotion" | "subscription";
  /** The return flag from the URL: "1" came back from Stripe paid, "0" cancelled. */
  flag: string | null;
  /** True once the server (webhook) has confirmed it. The redirect alone never proves payment. */
  confirmed: boolean;
};

/**
 * Shown when Stripe sends the salon back. The redirect only means "the customer left Stripe";
 * the webhook is what marks the payment, so this says "received, confirming" until the server
 * state says otherwise.
 */
export function PaymentReturnBanner({ kind, flag, confirmed }: Props) {
  if (flag !== "1" && flag !== "0") return null;
  if (flag === "0") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border p-4 text-sm">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">{t("paymentReturn.cancelledTitle")}</p>
          <p className="text-muted-foreground">{t("paymentReturn.cancelledBody")}</p>
        </div>
      </div>
    );
  }
  const Icon = confirmed ? CheckCircle2 : Clock;
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-medium">{t("paymentReturn.receivedTitle")}</p>
        <p>
          {confirmed
            ? t(kind === "promotion" ? "paymentReturn.confirmedPromotion" : "paymentReturn.confirmedSubscription")
            : t("paymentReturn.receivedBody")}
        </p>
      </div>
    </div>
  );
}
