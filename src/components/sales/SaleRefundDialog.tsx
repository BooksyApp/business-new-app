import { useEffect, useState } from "react";
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
import { t } from "@/i18n";
import {
  saleService,
  type Sale,
  type SaleRefundRequest,
  type SaleRefundSummary,
} from "@/services/saleService";
import type { Id } from "@/types/id";

type Method = SaleRefundRequest["method"];
type Mode = "lines" | "amount";

interface SaleRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale;
  onRefunded?: () => void;
}

/**
 * FG-W6-08: refund a completed till sale, by items or by amount, with a required reason.
 * The server decides who may refund (owner or manager) and works out the exact amount;
 * the figure shown here is an estimate for the person refunding.
 */
export function SaleRefundDialog({ open, onOpenChange, sale, onRefunded }: SaleRefundDialogProps) {
  const [summary, setSummary] = useState<SaleRefundSummary | null>(null);
  const [mode, setMode] = useState<Mode>("lines");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("CASH");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuantities({});
    setAmount("");
    setReason("");
    setMethod(sale.paymentMethod === "GIFT_CARD" ? "GIFT_CARD" : "CASH");
    setGiftCardCode(sale.giftCardCode ?? "");
    setSummary(null);
    saleService
      .getRefundSummary(sale.id)
      .then(setSummary)
      .catch((e) => toast.error(e instanceof Error ? e.message : t("sales.saleRefund.failed")));
  }, [open, sale.id, sale.paymentMethod, sale.giftCardCode]);

  const METHODS: Array<{ value: Method; label: string }> = [
    { value: "CASH", label: t("sales.saleRefund.methodCash") },
    { value: "CARD_TERMINAL", label: t("sales.saleRefund.methodCard") },
    { value: "CHECK", label: t("sales.saleRefund.methodCheck") },
    { value: "GIFT_CARD", label: t("sales.saleRefund.methodGiftCard") },
  ];

  const refundable = summary?.refundable ?? 0;
  const blocked = !summary || summary.onlinePayment || refundable <= 0;

  // The server prorates line prices for the sale's discount and leaves the tip out.
  const netRatio = sale.subtotal > 0 ? (sale.total - (sale.tipAmount || 0)) / sale.subtotal : 1;
  const pickable = sale.items.filter((item) => item.id);

  const estimate = pickable.reduce((sum, item) => {
    const q = quantities[String(item.id)] ?? 0;
    return sum + q * item.unitPrice * netRatio;
  }, 0);

  const amountValue = Number(amount);
  const chosenLines = pickable.filter((item) => (quantities[String(item.id)] ?? 0) > 0);
  const linesOk =
    chosenLines.length > 0 &&
    chosenLines.every((item) => (quantities[String(item.id)] ?? 0) <= item.quantity);
  const amountOk = amount.trim() !== "" && amountValue > 0 && amountValue <= refundable + 0.001;
  const hasTarget = mode === "lines" ? linesOk : amountOk;
  const giftOk = method !== "GIFT_CARD" || giftCardCode.trim() !== "";
  const valid = !blocked && hasTarget && giftOk && reason.trim() !== "";

  const setQty = (id: Id, value: number, max: number) => {
    const next = Math.max(0, Math.min(max, Math.floor(value)));
    setQuantities((prev) => ({ ...prev, [String(id)]: next }));
  };

  const submit = async () => {
    if (!valid || !summary) return;
    const body: SaleRefundRequest = {
      method,
      reason: reason.trim(),
      ...(method === "GIFT_CARD" ? { giftCardCode: giftCardCode.trim() } : {}),
      ...(mode === "lines"
        ? {
            lines: chosenLines.map((item) => ({
              saleItemId: item.id as Id,
              quantity: quantities[String(item.id)] ?? 0,
            })),
          }
        : { amount: amountValue }),
    };
    setBusy(true);
    try {
      const result = await saleService.refundSale(sale.id, body);
      toast.success(t("sales.saleRefund.done", { value: formatPrice(result.amount) }));
      onRefunded?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("sales.saleRefund.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("sales.saleRefund.title")}</DialogTitle>
          <DialogDescription>{t("sales.saleRefund.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("sales.saleRefund.paid")}</p>
              <p className="text-lg font-semibold tabular-nums">{formatPrice(sale.total)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("sales.saleRefund.refundable")}</p>
              <p className="text-lg font-semibold tabular-nums">{formatPrice(refundable)}</p>
            </div>
          </div>

          {summary?.onlinePayment && (
            <p className="text-sm text-rose-600">{t("sales.saleRefund.onlinePaid")}</p>
          )}
          {summary && !summary.onlinePayment && refundable <= 0 && (
            <p className="text-sm text-rose-600">{t("sales.saleRefund.fullyRefunded")}</p>
          )}

          {!blocked && (
            <>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={mode === "lines" ? "default" : "outline"} onClick={() => setMode("lines")}>
                  {t("sales.saleRefund.byItems")}
                </Button>
                <Button type="button" size="sm" variant={mode === "amount" ? "default" : "outline"} onClick={() => setMode("amount")}>
                  {t("sales.saleRefund.byAmount")}
                </Button>
              </div>

              {mode === "lines" ? (
                <div className="space-y-2">
                  {pickable.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("sales.saleRefund.noItems")}</p>
                  ) : (
                    pickable.map((item) => {
                      const id = String(item.id);
                      return (
                        <div key={id} className="flex items-center gap-3 rounded-lg border p-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{item.serviceName}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {formatPrice(item.unitPrice)} × {item.quantity}
                            </p>
                          </div>
                          <Label htmlFor={`refund-qty-${id}`} className="sr-only">
                            {t("sales.saleRefund.quantity")}
                          </Label>
                          <Input
                            id={`refund-qty-${id}`}
                            className="w-20"
                            inputMode="numeric"
                            aria-label={t("sales.saleRefund.quantity")}
                            value={quantities[id] ?? 0}
                            onChange={(e) => setQty(item.id as Id, Number(e.target.value) || 0, item.quantity)}
                          />
                        </div>
                      );
                    })
                  )}
                  {chosenLines.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("sales.saleRefund.estimate", { value: formatPrice(estimate) })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="sale-refund-amount">{t("sales.saleRefund.amount")}</Label>
                  <Input
                    id="sale-refund-amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="sale-refund-method">{t("sales.saleRefund.method")}</Label>
                <div className="flex flex-wrap gap-2">
                  {METHODS.map((m) => (
                    <Button
                      key={m.value}
                      type="button"
                      size="sm"
                      variant={method === m.value ? "default" : "outline"}
                      onClick={() => setMethod(m.value)}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
              </div>

              {method === "GIFT_CARD" && (
                <div className="space-y-2">
                  <Label htmlFor="sale-refund-card">{t("sales.saleRefund.giftCardCode")}</Label>
                  <Input
                    id="sale-refund-card"
                    value={giftCardCode}
                    onChange={(e) => setGiftCardCode(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="sale-refund-reason">{t("sales.saleRefund.reason")}</Label>
                <Textarea
                  id="sale-refund-reason"
                  maxLength={255}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                {reason.trim() === "" && (
                  <p className="text-xs text-muted-foreground">{t("sales.saleRefund.reasonRequired")}</p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={!valid || busy}
            onClick={() => void submit()}
          >
            {busy
              ? t("sales.saleRefund.submitting")
              : t("sales.saleRefund.submit", {
                  value: formatPrice(mode === "lines" ? estimate : amountOk ? amountValue : 0),
                })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
