import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Chip, ChipRow, DataTable, EmptyState } from "@/components/bz";
import { LedgerPill, P4Chips, P4Error, P4Loading, P4Page } from "@/components/bz/p4-kit";
import { fmtDay, fmtMoney, fmtPeriod, useReportPeriod, type RangeKey } from "@/components/reports/reportsFormat";
import { PaymentSheet } from "@/components/payments/PaymentSheet";
import { ledgerService, type LedgerRow } from "@/services/ledgerService";
import { useBusinessId } from "@/hooks/useBusinessId";
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
      <P4Page
        title={t("ledger.invoicesTitle")}
        sub={t("ledger.invoicesHint")}
        right={<P4Chips label={t("reports.period")} items={RANGES.map((r) => ({ key: r, label: t(`reports.range.${r}` as TKey) }))} value={range} onChange={setRange} />}
      >
        <div className="row gap8" style={{ flexWrap: "wrap" }}>
          <div className="fld" style={{ minWidth: 220, flex: 1 }}>
            <small>{t("ledger.search")}</small>
            <input placeholder={t("ledger.search")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("ledger.search")} />
          </div>
          <div role="radiogroup" aria-label={t("ledger.status")}>
            <ChipRow>
              {["", ...STATUSES].map((s) => (
                <span key={s || "all"} role="radio" aria-checked={status === s} tabIndex={0} onClick={() => setStatus(s)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setStatus(s)}>
                  <Chip on={status === s}>{s ? t(`ledger.s.${s}` as TKey) : t("ledger.allStatuses")}</Chip>
                </span>
              ))}
            </ChipRow>
          </div>
          <label className="chip" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={onlyInvoices} onChange={(e) => setOnlyInvoices(e.target.checked)} />
            {t("ledger.onlyInvoices")}
          </label>
        </div>

        {q.isError ? (
          <P4Error title={t("ledger.loadFailed")} />
        ) : !q.data ? (
          <P4Loading />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="ic" />}
            title={query.trim() ? t("ledger.noneSearch", { period: fmtPeriod(q.data.period), query: query.trim() }) : t("ledger.none", { period: fmtPeriod(q.data.period) })}
          />
        ) : (
          <DataTable
            grid="1.4fr 1.2fr 1.6fr 1fr 1fr"
            rows={rows}
            rowKey={(r) => String(r.id)}
            onRowClick={(r) => setOpen(r)}
            columns={[t("ledger.document"), t("ledger.date"), t("ledger.client"), t("ledger.status"), t("ledger.total")]}
            render={(r) => [
              r.invoiceNumber ? (
                <b style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <FileText size={14} aria-hidden /> {r.invoiceNumber}
                </b>
              ) : (
                t("ledger.receiptNo", { n: r.billNumber || "—" })
              ),
              `${fmtDay(r.date, { day: "numeric", month: "short" })} ${r.time}`,
              r.clientName || t("ledger.walkIn"),
              <LedgerPill status={r.status} />,
              <b>{fmtMoney(r.total)}</b>,
            ]}
          />
        )}
        <PaymentSheet row={open} onClose={() => setOpen(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["ledger", businessId] })} businessId={businessId} />
      </P4Page>
    </AppLayout>
  );
}
