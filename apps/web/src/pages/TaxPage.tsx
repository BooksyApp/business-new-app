import { Btn, DataTable, Tile, Tiles } from "@/components/bz";
import { P4Loading, P4Error } from "@/components/bz/p4-kit";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { secondaryBtn } from "@/components/page/booqiStyles";
import { fmtInt, fmtMoney, fmtPeriod, loc, useReportPeriod, type RangeKey } from "@/components/reports/reportsFormat";
import { accountsService, n, type TaxSummary } from "@/services/accountsService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { formatDate, formatNumber } from "@/i18n/format";
import { t } from "@/i18n";
import { BooqiScope, Empty, PageHeader, Panel, PeriodPicker, pageBody } from "@/components/bz/p4-compat";

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

  const table = (rows: { key: string; label: string; count: unknown; net: unknown; tax: unknown; gross: unknown }[], first: string) => (
    <DataTable
      grid="1.4fr 0.8fr 1fr 1fr 1fr"
      rows={rows}
      rowKey={(r) => r.key}
      columns={[first, t("ledger.taxCount"), t("ledger.taxNet"), t("ledger.taxTax"), t("ledger.taxGross")]}
      render={(r) => [<b>{r.label}</b>, fmtInt(n(r.count as number)), fmtMoney(n(r.net as number)), <b>{fmtMoney(n(r.tax as number))}</b>, fmtMoney(n(r.gross as number))]}
    />
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
              <Btn kind="ol" icon={<Download size={16} aria-hidden />} disabled={!d || n(d.totals.count) === 0} onClick={() => d && exportCsv(d)}>
                {t("ledger.exportCsv")}
              </Btn>
            </div>
          }
        />
        <div className={pageBody}>
          {q.isError ? (
            <P4Error title={t("ledger.loadFailed")} />
          ) : !d ? (
            <P4Loading />
          ) : n(d.totals.count) === 0 ? (
            <Empty>{t("ledger.taxNone")}</Empty>
          ) : (
            <>
              <Tiles cols={4}>
                <Tile label={t("ledger.taxTax")} value={fmtMoney(n(d.totals.tax))} />
                <Tile label={t("ledger.taxNet")} value={fmtMoney(n(d.totals.net))} />
                <Tile label={t("ledger.taxGross")} value={fmtMoney(n(d.totals.gross))} />
                <Tile label={t("ledger.taxCount")} value={fmtInt(n(d.totals.count))} />
              </Tiles>
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title={t("ledger.taxByRate")}>{table(d.byRate.map((r) => ({ key: String(r.rate), label: rateLabel(r.rate), ...r })), t("ledger.taxRate"))}</Panel>
                <Panel title={t("ledger.taxByMonth")}>{table(d.byMonth.map((m) => ({ key: m.month, label: monthLabel(m.month), ...m })), t("ledger.taxMonth"))}</Panel>
              </div>
              {n(d.voided) > 0 && <small>{t("ledger.taxVoided", { count: n(d.voided) })}</small>}
            </>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
