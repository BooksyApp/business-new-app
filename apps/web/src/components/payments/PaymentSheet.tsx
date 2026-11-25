import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Printer, ReceiptText, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { FormSheet } from "@/components/page/booqi";
import { primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { fmtDay, fmtMoney } from "@/components/reports/reportsFormat";
import { SaleRefundDialog } from "@/components/sales/SaleRefundDialog";
import { methodLabel, type LedgerRow, type LedgerStatus } from "@/services/ledgerService";
import { saleService } from "@/services/saleService";
import { moneyService } from "@/services/moneyService";
import { printReceipt } from "@/lib/printReceipt";
import { cn } from "@/lib/utils";
import { t, type TKey } from "@/i18n";
import type { Id } from "@/types/id";

const STATUS_TONE: Record<LedgerStatus, string> = {
  PAID: "bg-[rgb(var(--reg-success-soft))] text-[rgb(var(--reg-success))]",
  PARTIAL: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  OWED: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  REFUNDED: "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-ink)/0.75)]",
  PART_REFUNDED: "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-ink)/0.75)]",
  VOID: "bg-[rgb(var(--reg-ink)/0.04)] text-[rgb(var(--reg-muted))] line-through",
};

export function StatusPill({ status }: { status: LedgerStatus }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[12px] font-semibold", STATUS_TONE[status])}>{t(`ledger.s.${status}` as TKey)}</span>;
}

/** One payment in a side sheet: lines, tenders, refunds; refund, receipt/invoice print, issue invoice. */
export function PaymentSheet({ row, onClose, onChanged, businessId }: { row: LedgerRow | null; onClose: () => void; onChanged: () => void; businessId: Id }) {
  const isSale = row?.kind === "SALE" && row.id != null;
  const sale = useQuery({ queryKey: ["sale", row?.id], queryFn: () => saleService.getSaleById(row!.id as Id), enabled: Boolean(row) && isSale });
  const refunds = useQuery({ queryKey: ["sale-refunds", row?.id], queryFn: () => saleService.getRefundSummary(row!.id as Id), enabled: Boolean(row) && isSale });
  const [refunding, setRefunding] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const salonName = (() => {
    try {
      return JSON.parse(localStorage.getItem("currentBusiness") || "{}").name || "";
    } catch {
      return "";
    }
  })();

  const issueInvoice = async () => {
    if (!row?.id) return;
    setIssuing(true);
    try {
      const inv = await moneyService.issueInvoice(businessId, row.id);
      toast.success(t("money.issued", { number: inv.number }));
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("money.couldNotIssueThatInvoice"));
    } finally {
      setIssuing(false);
    }
  };
  const print = async () => {
    if (!sale.data || !row) return;
    // UI2-HUBB-076: an invoice carries the salon's address and VÖEN (when set).
    let salonAddress: string | null = null;
    let salonVoen: string | null = null;
    if (row.invoiceNumber) {
      try {
        const hit = (await moneyService.getInvoices(businessId)).find((i) => i.number === row.invoiceNumber);
        if (hit) {
          const inv = (await moneyService.getInvoice(businessId, hit.id)) as { salon_address?: string | null; salon_voen?: string | null };
          salonAddress = inv.salon_address || null;
          salonVoen = inv.salon_voen || null;
        }
      } catch {
        // the invoice prints without them
      }
    }
    const ok = printReceipt(sale.data, {
      salonName,
      salonAddress,
      salonVoen,
      invoiceNumber: row.invoiceNumber,
      methods: row.methods.filter((m) => m.method !== "DEBT").map((m) => ({ label: methodLabel(m.method), amount: m.amount })),
      refunded: row.refunded,
      owed: row.owed,
    });
    if (!ok) toast.error(t("ledger.popupBlocked"));
  };

  const canRefund = isSale && (refunds.data?.refundable ?? 0) > 0 && row?.status !== "VOID";
  return (
    <>
      <FormSheet
        open={Boolean(row)}
        onOpenChange={(o) => !o && onClose()}
        title={row ? fmtMoney(row.total) : ""}
        description={row ? `${row.clientName || t("ledger.walkIn")} · ${fmtDay(row.date, { day: "numeric", month: "long", year: "numeric" })} ${row.time}` : undefined}
        footer={
          isSale ? (
            <>
              <button type="button" className={cn(secondaryBtn, "flex-1")} onClick={print} disabled={!sale.data}>
                <Printer size={16} aria-hidden /> {row?.invoiceNumber ? t("ledger.printInvoice") : t("ledger.printReceipt")}
              </button>
              {canRefund && (
                <button type="button" className={cn(primaryBtn, "flex-1")} onClick={() => setRefunding(true)} disabled={!sale.data}>
                  <RotateCcw size={16} aria-hidden /> {t("ledger.refund")}
                </button>
              )}
            </>
          ) : undefined
        }
      >
        {row && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={row.status} />
              {row.invoiceNumber ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold ring-1 ring-[rgb(var(--reg-line))]">
                  <FileText size={13} aria-hidden /> {t("ledger.invoice")} {row.invoiceNumber}
                </span>
              ) : isSale && row.status !== "VOID" ? (
                <button type="button" onClick={issueInvoice} disabled={issuing} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold text-[rgb(var(--reg-brand-strong))] ring-1 ring-[rgb(var(--reg-brand)/0.35)] hover:bg-[rgb(var(--reg-brand-soft))]">
                  <FileText size={13} aria-hidden /> {t("ledger.issueInvoice")}
                </button>
              ) : null}
              {row.staffName && <span className="text-[13px] text-[rgb(var(--reg-muted))]">{row.staffName}</span>}
            </div>

            {isSale && (
              <section className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{t("ledger.lines")}</h3>
                {sale.data ? (
                  <ul className="space-y-1.5 text-[14px]">
                    {(sale.data.items ?? []).map((i, k) => (
                      <li key={k} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">{i.serviceName}{i.quantity > 1 ? ` × ${i.quantity}` : ""}</span>
                        <span className="tabular-nums">{fmtMoney(Number(i.totalPrice ?? i.unitPrice * i.quantity))}</span>
                      </li>
                    ))}
                    {Number(sale.data.discountAmount) > 0 && (
                      <li className="flex justify-between text-[rgb(var(--reg-muted))]"><span>{t("ledger.discount")}</span><span className="tabular-nums">−{fmtMoney(Number(sale.data.discountAmount))}</span></li>
                    )}
                    {Number(sale.data.tipAmount) > 0 && (
                      <li className="flex justify-between text-[rgb(var(--reg-muted))]"><span>{t("ledger.tip")}</span><span className="tabular-nums">{fmtMoney(Number(sale.data.tipAmount))}</span></li>
                    )}
                  </ul>
                ) : (
                  <div className="h-16 animate-pulse rounded-xl bg-[rgb(var(--reg-canvas))]" />
                )}
              </section>
            )}

            <section className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{t("ledger.tender")}</h3>
              <ul className="space-y-1.5 text-[14px]">
                {row.methods.map((m) => (
                  <li key={m.method} className={cn("flex justify-between gap-3", m.method === "DEBT" && "font-semibold text-amber-800")}>
                    <span>{methodLabel(m.method)}</span>
                    <span className="tabular-nums">{fmtMoney(m.amount)}</span>
                  </li>
                ))}
                {row.refunded > 0 && (
                  <li className="flex justify-between gap-3 text-[rgb(var(--reg-muted))]"><span>{t("ledger.refunded")}</span><span className="tabular-nums">−{fmtMoney(row.refunded)}</span></li>
                )}
              </ul>
              {(refunds.data?.refunds ?? []).length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-[rgb(var(--reg-line)/0.6)] pt-3 text-[13px] text-[rgb(var(--reg-muted))]">
                  {refunds.data!.refunds.map((r, k) => (
                    <li key={k}>{t("ledger.refundLine", { amount: fmtMoney(r.amount), method: methodLabel(r.method), reason: r.reason })}</li>
                  ))}
                </ul>
              )}
            </section>
            {!isSale && <p className="flex items-start gap-2 text-[13px] text-[rgb(var(--reg-muted))]"><ReceiptText size={16} aria-hidden className="mt-0.5 shrink-0" />{t("ledger.onlineHint")}</p>}
          </>
        )}
      </FormSheet>
      {sale.data && (
        <SaleRefundDialog
          open={refunding}
          onOpenChange={setRefunding}
          sale={sale.data}
          onRefunded={() => {
            setRefunding(false);
            refunds.refetch();
            onChanged();
          }}
        />
      )}
    </>
  );
}
