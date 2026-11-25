import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/currency";
import { refundService } from "@/services/moneyService";
import { t, tOpt } from "@/i18n";

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  /** What was paid. Used for the full-refund default and to stop an over-refund. */
  paidAmount: number;
  clientName?: string | null;
  onRefunded?: (amount: number) => void;
}

const REASONS = [
  "Salon cancelled",
  "Customer cancelled in time",
  "Service not as expected",
  "Charged twice",
];

/**
 * Refunding a booking.
 *
 * The endpoint has existed since deposits were built and nothing in this app ever called
 * it, so a manager refunding a customer had to open the Stripe dashboard — where the
 * booking is not marked refunded, the commission is not cancelled, and the payout does
 * not know the money went back. Doing it here does all four.
 */
export function RefundDialog({
  open,
  onOpenChange,
  bookingId,
  paidAmount,
  clientName,
  onRefunded,
}: RefundDialogProps) {
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const value = partial ? Number(amount) : paidAmount;
  const invalid = partial && (!amount.trim() || Number.isNaN(value) || value <= 0 || value > paidAmount);

  const submit = async () => {
    if (invalid) return;
    setBusy(true);
    try {
      const result = await refundService.refund(bookingId, partial ? value : undefined, reason || undefined);
      if (result.status === "ALREADY_REFUNDED") {
        toast.info(t("money.thatBookingWasAlreadyRefunded"));
      } else {
        toast.success(t("money.refunded", { value: formatPrice(result.amount) }));
      }
      onRefunded?.(Number(result.amount ?? value));
      onOpenChange(false);
      setPartial(false); setAmount(""); setReason("");
    } catch (e) {
      // A provider failure leaves the booking alone on purpose — the books must not say
      // refunded when the money did not move.
      toast.error(e instanceof Error ? e.message : t("money.theRefundDidNotGo"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("money.refund", { value: clientName ? clientName : t("money.booking", { bookingId }) })}</DialogTitle>
          <DialogDescription>
            {t("money.theMoneyGoesBackThe")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("common.paid")}</p>
            <p className="text-2xl font-semibold tabular-nums">{formatPrice(paidAmount)}</p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={partial ? "outline" : "default"}
              onClick={() => setPartial(false)}
            >
              {t("money.refundItAll")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={partial ? "default" : "outline"}
              onClick={() => setPartial(true)}
            >
              {t("money.refundPartOfIt")}
            </Button>
          </div>

          {partial ? (
            <div className="space-y-2">
              <Label htmlFor="refund-amount">{t("money.howMuch")}</Label>
              <Input
                id="refund-amount"
                inputMode="decimal"
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              {amount.trim() && value > paidAmount ? (
                <p className="text-xs text-rose-600">
                  {t("money.thatIsMoreThanWas", { value: formatPrice(paidAmount) })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("money.useThisToKeepA")}
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="refund-reason">{t("money.why")}</Label>
            <div className="flex flex-wrap gap-2">
              {REASONS.map(preset => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={reason === preset ? "default" : "outline"}
                  onClick={() => setReason(reason === preset ? "" : preset)}
                >
                  {tOpt("refundReason", preset)}
                </Button>
              ))}
            </div>
            <Textarea
              id="refund-reason"
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t("money.orWriteYourOwn")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || invalid}>
            {busy ? t("money.refunding") : t("money.refund", { value: formatPrice(partial ? (Number.isNaN(value) ? 0 : value) : paidAmount) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
