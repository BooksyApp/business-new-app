import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Btn, Chip, ChipRow, Field, Note, RowItem, SegPills, Tile, Tiles } from "@/components/bz";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
  const blocked = !summary || refundable <= 0;   // FG-W6-08: an online sale is refunded to the card through Stripe

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

  const footer = (
        <Btn kind="v" disabled={!valid || busy} onClick={() => void submit()}>
          {busy
            ? t("sales.saleRefund.submitting")
            : t("sales.saleRefund.submit", {
                value: formatPrice(mode === "lines" ? estimate : amountOk ? amountValue : 0),
              })}
        </Btn>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl bz-surface">
      <DialogHeader>
        <DialogTitle>{t("sales.saleRefund.title")}</DialogTitle>
        <DialogDescription>{t("sales.saleRefund.description")}</DialogDescription>
      </DialogHeader>
      <div className="stk">
      <Tiles cols={2}>
        <Tile label={t("sales.saleRefund.paid")} value={formatPrice(sale.total)} />
        <Tile label={t("sales.saleRefund.refundable")} value={formatPrice(refundable)} />
      </Tiles>

      {summary?.onlinePayment && <Note kind="in">{t("sales.saleRefund.onlinePaid")}</Note>}
      {summary && !summary.onlinePayment && refundable <= 0 && <Note kind="er">{t("sales.saleRefund.fullyRefunded")}</Note>}

      {!blocked && (
        <>
          <SegPills
            items={[
              { key: "lines", label: t("sales.saleRefund.byItems") },
              { key: "amount", label: t("sales.saleRefund.byAmount") },
            ]}
            value={mode}
            onChange={(k) => setMode(k as Mode)}
          />

          {mode === "lines" ? (
            <div className="stk">
              {pickable.length === 0 ? (
                <Note kind="in">{t("sales.saleRefund.noItems")}</Note>
              ) : (
                pickable.map((item) => {
                  const id = String(item.id);
                  return (
                    <RowItem
                      key={id}
                      title={item.serviceName}
                      sub={`${formatPrice(item.unitPrice)} × ${item.quantity}`}
                      right={
                        <div style={{ width: 96 }}>
                          <Field label={t("sales.saleRefund.quantity")}>
                            <input
                              id={`refund-qty-${id}`}
                              inputMode="numeric"
                              aria-label={t("sales.saleRefund.quantity")}
                              value={quantities[id] ?? 0}
                              onChange={(e) => setQty(item.id as Id, Number(e.target.value) || 0, item.quantity)}
                            />
                          </Field>
                        </div>
                      }
                    />
                  );
                })
              )}
              {chosenLines.length > 0 && <div className="a-note">{t("sales.saleRefund.estimate", { value: formatPrice(estimate) })}</div>}
            </div>
          ) : (
            <Field label={t("sales.saleRefund.amount")}>
              <input id="sale-refund-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          )}

          {!summary?.onlinePayment && (
            <>
              <div className="lbl2">{t("sales.saleRefund.method")}</div>
              <ChipRow>
                {METHODS.map((m) => (
                  <Chip key={m.value} on={method === m.value} onClick={() => setMethod(m.value)}>
                    {m.label}
                  </Chip>
                ))}
              </ChipRow>
            </>
          )}

          {method === "GIFT_CARD" && !summary?.onlinePayment && (
            <Field label={t("sales.saleRefund.giftCardCode")}>
              <input id="sale-refund-card" value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value)} />
            </Field>
          )}

          <Field label={t("sales.saleRefund.reason")} kind="ta" hint={reason.trim() === "" ? t("sales.saleRefund.reasonRequired") : undefined}>
            <textarea id="sale-refund-reason" maxLength={255} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </>
      )}
      </div>
      <div className="row gap8" style={{ justifyContent: "flex-end" }}>{footer}</div>
      </DialogContent>
    </Dialog>
  );
}
