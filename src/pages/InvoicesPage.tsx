import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { Empty, PeriodPicker } from "@/components/reports/ReportsKit";
import { fmtDay, fmtMoney, fmtPeriod, useReportPeriod, type RangeKey } from "@/components/reports/reportsFormat";
import { PaymentSheet, StatusPill } from "@/components/payments/PaymentSheet";
import { ledgerService, type LedgerRow } from "@/services/ledgerService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { cn } from "@/lib/utils";
import { t, type TKey } from "@/i18n";

const RANGES: readonly RangeKey[] = ["7d", "30d", "mtd", "lastMonth", "90d", "12m"];
const STATUSES = ["PAID", "PARTIAL", "OWED", "REFUNDED"] as const;

/**
 * Invoices & receipts (HUB-V3): every till sale is a receipt; the ones with an invoice show its
 * number. Search, filter by status, and open one to print it (or save as PDF), issue an invoice
 * or refund. Reads the same ledger as Payments, so the two never disagree.
 */
export default function InvoicesPage() {
  const businessId = useBusinessId();
  const qc = useQueryClient();
  const { range, setRange, start, end } = useReportPeriod("30d");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [onlyInvoices, setOnlyInvoices] = useState(false);
  const [open, setOpen] = useState<LedgerRow | null>(null);

  const filter = { from: start, to: end, status: status === "REFUNDED" ? undefined : status || undefined, q: query.trim() || undefined };
  const q = useQuery({
    queryKey: ["ledger", businessId, filter],
    queryFn: () => ledgerService.get(businessId, filter),
    enabled: Boolean(businessId),
    placeholderData: (prev) => prev,
  });
  const rows = (q.data?.rows ?? []).filter(
    (r) =>
      r.kind === "SALE" &&
      (!onlyInvoices || r.invoiceNumber) &&
      (status !== "REFUNDED" || r.status === "REFUNDED" || r.status === "PART_REFUNDED"),
  );

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("ledger.invoicesTitle")} subtitle={t("ledger.invoicesHint")} actions={<PeriodPicker value={range} onChange={setRange} ranges={RANGES} />} />
        <div className={pageBody}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">{t("ledger.search")}</span>
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
              <input className={cn(fieldCls, "h-10 w-full pl-10 text-[14px]")} placeholder={t("ledger.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div role="radiogroup" aria-label={t("ledger.status")} className="flex flex-wrap gap-1">
              {["", ...STATUSES].map((s) => (
                <button
                  key={s || "all"}
                  type="button"
                  role="radio"
                  aria-checked={status === s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "h-9 rounded-full px-3 text-[13px] font-semibold ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
                    status === s ? "bg-[rgb(var(--reg-ink))] text-white ring-transparent" : "bg-white text-[rgb(var(--reg-ink)/0.7)] ring-[rgb(var(--reg-line))]",
                  )}
                >
                  {s ? t(`ledger.s.${s}` as TKey) : t("ledger.allStatuses")}
                </button>
              ))}
            </div>
            <label className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-[13px] font-semibold ring-1 ring-[rgb(var(--reg-line))]">
              <input type="checkbox" checked={onlyInvoices} onChange={(e) => setOnlyInvoices(e.target.checked)} className="accent-[rgb(var(--reg-brand))]" />
              {t("ledger.onlyInvoices")}
            </label>
          </div>

          {q.isError ? (
            <Empty>{t("ledger.loadFailed")}</Empty>
          ) : !q.data ? (
            <div className="h-[320px] animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)] motion-reduce:animate-none" aria-busy="true" />
          ) : rows.length === 0 ? (
            <Empty>{query.trim() ? t("ledger.noneSearch", { period: fmtPeriod(q.data.period), query: query.trim() }) : t("ledger.none", { period: fmtPeriod(q.data.period) })}</Empty>
          ) : (
            <div className="overflow-x-auto rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              <table className="w-full min-w-[620px] text-[14px]">
                <thead>
                  <tr className="text-left text-[12px] text-[rgb(var(--reg-muted))]">
                    <th scope="col" className="px-5 py-3 font-medium">{t("ledger.document")}</th>
                    <th scope="col" className="py-3 font-medium">{t("ledger.date")}</th>
                    <th scope="col" className="py-3 font-medium">{t("ledger.client")}</th>
                    <th scope="col" className="py-3 font-medium">{t("ledger.status")}</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">{t("ledger.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={String(r.id)} onClick={() => setOpen(r)} className="cursor-pointer border-t border-[rgb(var(--reg-line)/0.6)] hover:bg-[rgb(var(--reg-canvas)/0.7)]">
                      <th scope="row" className="px-5 py-3 text-left font-semibold">
                        <button type="button" onClick={() => setOpen(r)} className="inline-flex items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]">
                          {r.invoiceNumber ? (
                            <>
                              <FileText size={14} aria-hidden className="text-[rgb(var(--reg-brand))]" /> {r.invoiceNumber}
                            </>
                          ) : (
                            <span className="text-[rgb(var(--reg-ink)/0.75)]">{t("ledger.receiptNo", { n: r.billNumber || "—" })}</span>
                          )}
                        </button>
                      </th>
                      <td className="py-3 tabular-nums text-[rgb(var(--reg-ink)/0.75)]">{fmtDay(r.date, { day: "numeric", month: "short" })} {r.time}</td>
                      <td className="max-w-[220px] truncate py-3">{r.clientName || t("ledger.walkIn")}</td>
                      <td className="py-3"><StatusPill status={r.status} /></td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">{fmtMoney(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <PaymentSheet row={open} onClose={() => setOpen(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["ledger", businessId] })} businessId={businessId} />
      </BooqiScope>
    </AppLayout>
  );
}
