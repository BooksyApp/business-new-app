import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, secondaryBtn } from "@/components/page/booqiStyles";
import { Empty, Panel, PeriodPicker } from "@/components/reports/ReportsKit";
import { fmtInt, fmtMoney, fmtPeriod, loc, useReportPeriod, type RangeKey } from "@/components/reports/reportsFormat";
import { accountsService, n, type TaxSummary } from "@/services/accountsService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { formatDate, formatNumber } from "@/i18n/format";
import { t } from "@/i18n";

const RANGES: readonly RangeKey[] = ["mtd", "lastMonth", "90d", "12m"];

const monthLabel = (m: string) => formatDate(loc(), `${m}-15T12:00:00`, { month: "long", year: "numeric" });
const rateLabel = (r: unknown) => `${formatNumber(loc(), n(r as number), { maximumFractionDigits: 2 })}%`;

/** The figures as CSV, built from what is on screen (no second request). */
function exportCsv(d: TaxSummary) {
  const head = [t("ledger.taxMonth"), t("ledger.taxRate"), t("ledger.taxCount"), t("ledger.taxNet"), t("ledger.taxTax"), t("ledger.taxGross")];
  const lines = [head.join(";")];
  for (const m of d.byMonth) lines.push([m.month, "", n(m.count), n(m.net).toFixed(2), n(m.tax).toFixed(2), n(m.gross).toFixed(2)].join(";"));
  for (const r of d.byRate) lines.push(["", n(r.rate).toFixed(2), n(r.count), n(r.net).toFixed(2), n(r.tax).toFixed(2), n(r.gross).toFixed(2)].join(";"));
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tax-${d.period.start}-${d.period.end}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Tax (HUB-V3): the tax on the invoices the salon issued, by rate and by month, with a CSV
 * export for the accountant. Only what the invoices record — no tax rules are applied here.
 */
export default function TaxPage() {
  const businessId = useBusinessId();
  const { range, setRange, start, end } = useReportPeriod("mtd");
  const q = useQuery({ queryKey: ["tax-summary", businessId, start, end], queryFn: () => accountsService.taxSummary(businessId, start, end), enabled: Boolean(businessId) });
  const d = q.data;

  const tile = (label: string, value: string) => (
    <div className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
      <p className="text-[13px] font-semibold text-[rgb(var(--reg-muted))]">{label}</p>
      <p className="mt-2 text-[24px] font-extrabold leading-none tracking-[-0.03em] tabular-nums md:text-[26px]">{value}</p>
    </div>
  );
  const table = (rows: { key: string; label: string; count: unknown; net: unknown; tax: unknown; gross: unknown }[], first: string) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-[14px]">
        <thead>
          <tr className="text-left text-[12px] text-[rgb(var(--reg-muted))]">
            <th scope="col" className="pb-2 font-medium">{first}</th>
            <th scope="col" className="pb-2 text-right font-medium">{t("ledger.taxCount")}</th>
            <th scope="col" className="pb-2 text-right font-medium">{t("ledger.taxNet")}</th>
            <th scope="col" className="pb-2 text-right font-medium">{t("ledger.taxTax")}</th>
            <th scope="col" className="pb-2 text-right font-medium">{t("ledger.taxGross")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-[rgb(var(--reg-line)/0.6)]">
              <th scope="row" className="py-2.5 text-left font-semibold">{r.label}</th>
              <td className="py-2.5 text-right tabular-nums">{fmtInt(n(r.count as number))}</td>
              <td className="py-2.5 text-right tabular-nums">{fmtMoney(n(r.net as number))}</td>
              <td className="py-2.5 text-right font-semibold tabular-nums">{fmtMoney(n(r.tax as number))}</td>
              <td className="py-2.5 text-right tabular-nums">{fmtMoney(n(r.gross as number))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("ledger.taxTitle")}
          subtitle={d ? `${fmtPeriod(d.period)} · ${t("ledger.taxSource")}` : t("ledger.taxSource")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <PeriodPicker value={range} onChange={setRange} ranges={RANGES} />
              <button type="button" className={secondaryBtn} disabled={!d || n(d.totals.count) === 0} onClick={() => d && exportCsv(d)}>
                <Download size={16} aria-hidden /> {t("ledger.exportCsv")}
              </button>
            </div>
          }
        />
        <div className={pageBody}>
          {q.isError ? (
            <Empty>{t("ledger.loadFailed")}</Empty>
          ) : !d ? (
            <div className="h-[260px] animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)] motion-reduce:animate-none" aria-busy="true" />
          ) : n(d.totals.count) === 0 ? (
            <Empty>{t("ledger.taxNone")}</Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
                {tile(t("ledger.taxTax"), fmtMoney(n(d.totals.tax)))}
                {tile(t("ledger.taxNet"), fmtMoney(n(d.totals.net)))}
                {tile(t("ledger.taxGross"), fmtMoney(n(d.totals.gross)))}
                {tile(t("ledger.taxCount"), fmtInt(n(d.totals.count)))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title={t("ledger.taxByRate")}>{table(d.byRate.map((r) => ({ key: String(r.rate), label: rateLabel(r.rate), ...r })), t("ledger.taxRate"))}</Panel>
                <Panel title={t("ledger.taxByMonth")}>{table(d.byMonth.map((m) => ({ key: m.month, label: monthLabel(m.month), ...m })), t("ledger.taxMonth"))}</Panel>
              </div>
              {n(d.voided) > 0 && <p className="text-[13px] text-[rgb(var(--reg-muted))]">{t("ledger.taxVoided", { count: n(d.voided) })}</p>}
            </>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
