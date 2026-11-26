import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, Chip, ChipRow, EmptyState, Tile, Tiles, RowItem } from "@/components/bz";
import { LedgerPill, P4Chips, P4Error, P4Loading, P4Page } from "@/components/bz/p4-kit";
import { fmtDay, fmtMoney, fmtPeriod, useReportPeriod, type RangeKey } from "@/components/reports/reportsFormat";
import { PaymentSheet } from "@/components/payments/PaymentSheet";
import { LEDGER_METHODS, LEDGER_STATUSES, ledgerService, methodLabel, type Ledger, type LedgerRow } from "@/services/ledgerService";
import { staffService } from "@/services/staffService";
import { booqiWalletService } from "@/services/booqiWalletService";
import { useWalletEnabled } from "@/services/platformService";
import { useNavigation } from "@/utils/navigationUtils";
import { useBusinessId } from "@/hooks/useBusinessId";
import { t, type TKey } from "@/i18n";

const PAY_RANGES: readonly RangeKey[] = ["today", "7d", "30d", "mtd", "lastMonth"];

/**
 * Payments (HUB-V3, 2026-11-19): every payment the salon took in a period — till sales by
 * tender, online gift cards and wallet top-ups, refunds and what is still owed — with the
 * day's totals on top and each payment's detail (lines, tenders, refund, receipt, invoice) in
 * a side sheet. One request: GET /sales/business/{id}/ledger.
 */
export default function PaymentsPage() {
  const businessId = useBusinessId();
  const qc = useQueryClient();
  const { range, setRange, start, end } = useReportPeriod("7d");
  const [day, setDay] = useState<string | null>(null);
  const [method, setMethod] = useState("");
  const [staffId, setStaffId] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<LedgerRow | null>(null);

  const filter = { from: day ?? start, to: day ?? end, method: method || undefined, staffId: staffId || undefined, status: status || undefined, q: query.trim() || undefined };
  const q = useQuery({
    queryKey: ["ledger", businessId, filter],
    queryFn: () => ledgerService.get(businessId, filter),
    enabled: Boolean(businessId),
    placeholderData: (prev) => prev,
  });
  // The strip shows the whole period, whatever day is picked.
  const strip = useQuery({
    queryKey: ["ledger", businessId, { from: start, to: end }],
    queryFn: () => ledgerService.get(businessId, { from: start, to: end }),
    enabled: Boolean(businessId) && Boolean(day || method || staffId || status || query.trim()),
  });
  const staff = useQuery({ queryKey: ["staff-list", businessId], queryFn: () => staffService.getStaffByBusiness(businessId), enabled: Boolean(businessId), staleTime: 300_000 });

  // "Pending payout from booqi": only while the platform has the booqi wallet on.
  const walletOn = useWalletEnabled();
  const { getPath } = useNavigation();
  const owed = useQuery({
    queryKey: ["booqi-payouts", businessId],
    queryFn: () => booqiWalletService.payouts(businessId),
    enabled: Boolean(businessId) && walletOn,
    retry: false,
  });

  const d = q.data;
  const days = (strip.data ?? d)?.days ?? [];
  const groups = useMemo(() => groupByDay(d?.rows ?? []), [d]);
  const changeRange = (r: RangeKey) => {
    setDay(null);
    setRange(r);
  };

  return (
    <AppLayout>
      <P4Page
        helpSlug="odenisler-ve-qebzler"
        title={t("ledger.title")}
        sub={t("ledger.subtitle")}
        right={<P4Chips label={t("reports.period")} items={PAY_RANGES.map((r) => ({ key: r, label: t(`reports.range.${r}` as TKey) }))} value={range} onChange={changeRange} />}
      >
        {walletOn && owed.data && (
          <Link to={getPath("/money/booqi")} data-testid="booqi-owed-card" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
            <Card>
              <div className="row gap8" style={{ justifyContent: "space-between" }}>
                <span>
                  <b style={{ display: "block" }}>{t("bwallet.pendingTitle")}</b>
                  <small style={{ display: "block" }}>{t("bwallet.navHint")}</small>
                </span>
                <b style={{ fontSize: 22 }}>{fmtMoney(owed.data.pending)}</b>
              </div>
            </Card>
          </Link>
        )}
        {d && <Totals d={d} />}

        {days.length > 1 && <DayStrip days={days} picked={day} onPick={(x) => setDay(x === day ? null : x)} />}

        <div className="g3" style={{ gridTemplateColumns: "minmax(0,1.4fr) repeat(3,minmax(0,1fr))" }}>
          <div className="fld">
            <small>{t("ledger.search")}</small>
            <input aria-label={t("ledger.search")} placeholder={t("ledger.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="fld sel">
            <small>{t("ledger.method")}</small>
            <select aria-label={t("ledger.method")} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">{t("ledger.allMethods")}</option>
              {LEDGER_METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
            </select>
          </div>
          <div className="fld sel">
            <small>{t("ledger.staff")}</small>
            <select aria-label={t("ledger.staff")} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">{t("ledger.allStaff")}</option>
              {(staff.data ?? []).map((s) => <option key={String(s.id)} value={String(s.id)}>{s.name}</option>)}
            </select>
          </div>
          <div className="fld sel">
            <small>{t("ledger.status")}</small>
            <select aria-label={t("ledger.status")} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("ledger.allStatuses")}</option>
              {LEDGER_STATUSES.map((s) => <option key={s} value={s}>{t(`ledger.s.${s}` as TKey)}</option>)}
            </select>
          </div>
        </div>

        {q.isError ? (
          <P4Error title={t("ledger.loadFailed")} />
        ) : !d ? (
          <P4Loading />
        ) : d.rows.length === 0 ? (
          <EmptyState icon={<Wallet className="ic" />} title={t("ledger.none", { period: fmtPeriod(d.period) })} />
        ) : (
          <div style={{ display: "grid", gap: 20 }}>
            {groups.map(([date, rows]) => (
              <section key={date} aria-label={fmtDay(date, { weekday: "long", day: "numeric", month: "long" })}>
                <div className="row gap8" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                  <b>{fmtDay(date, { weekday: "long", day: "numeric", month: "long" })}</b>
                  <b>{fmtMoney(rows.filter((r) => r.status !== "VOID").reduce((a, r) => a + r.paid - r.refunded, 0))}</b>
                </div>
                <Card>
                  {rows.map((r, i) => (
                    <RowItem
                      key={`${r.id ?? r.ref}-${i}`}
                      onClick={() => setOpen(r)}
                      left={<small>{r.time}</small>}
                      title={r.clientName || t("ledger.walkIn")}
                      sub={`${r.kind === "SALE" ? r.items || t("ledger.sale") : t(`ledger.k.${r.kind}` as TKey)}${r.staffName ? ` · ${r.staffName}` : ""}${r.methods.length ? ` · ${r.methods.map((m) => methodLabel(m.method)).join(", ")}` : ""}`}
                      right={
                        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          <b style={r.status === "VOID" ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>{fmtMoney(r.total)}</b>
                          {r.status !== "PAID" && <LedgerPill status={r.status} />}
                        </span>
                      }
                    />
                  ))}
                </Card>
              </section>
            ))}
            {d.truncated && <small style={{ textAlign: "center" }}>{t("ledger.truncated")}</small>}
          </div>
        )}

        <PaymentSheet
          row={open}
          onClose={() => setOpen(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["ledger", businessId] })}
          businessId={businessId}
        />
      </P4Page>
    </AppLayout>
  );
}

function groupByDay(rows: LedgerRow[]): [string, LedgerRow[]][] {
  const m = new Map<string, LedgerRow[]>();
  for (const r of rows) m.set(r.date, [...(m.get(r.date) ?? []), r]);
  return [...m.entries()];
}

function Totals({ d }: { d: Ledger }) {
  const t0 = d.totals;
  const methods = Object.entries(t0.byMethod).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)" }}>
      <Tiles cols={(t0.renterRevenue ?? 0) > 0 ? 5 : 4}>
        <Tile label={t("ledger.net")} value={fmtMoney(t0.net)} hint={t("ledger.paymentsN", { count: t0.count })} />
        <Tile label={t("ledger.refunds")} value={fmtMoney(t0.refunds)} />
        <Tile label={t("ledger.owedTotal")} value={fmtMoney(t0.owed)} hint={t("ledger.owedHint")} />
        <Tile label={t("ledger.tips")} value={fmtMoney(t0.tips)} />
        {(t0.renterRevenue ?? 0) > 0 && <Tile label={t("ledger.renterRevenue")} value={fmtMoney(t0.renterRevenue ?? 0)} hint={t("ledger.renterRevenueHint")} />}
      </Tiles>
      <Card title={t("ledger.byMethod")}>
        {methods.length ? (
          methods.map(([m, v]) => <RowItem key={m} title={methodLabel(m)} right={<b>{fmtMoney(v)}</b>} />)
        ) : (
          <small>{t("ledger.noneShort")}</small>
        )}
      </Card>
    </div>
  );
}

/** One column per day: the day's net takings; picking a day narrows the list to it. */
function DayStrip({ days, picked, onPick }: { days: Ledger["days"]; picked: string | null; onPick: (d: string) => void }) {
  return (
    <div role="group" aria-label={t("ledger.dailyTotals")} style={{ overflowX: "auto" }}>
      <ChipRow>
        {days.map((x) => (
          <span key={x.date} role="button" aria-pressed={picked === x.date} tabIndex={0} onClick={() => onPick(x.date)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(x.date)}>
            <Chip on={picked === x.date}>
              {fmtDay(x.date, { weekday: "short", day: "numeric" })} · {fmtMoney(x.net)}
            </Chip>
          </span>
        ))}
      </ChipRow>
    </div>
  );
}
