import type { Id } from "@/types/id";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Calculator, Download, Pencil, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, FormSheet, PageHeader, StatCard } from "@/components/page/booqi";
import { pageBody, primaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls, money } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import { salonDayService, type PayrollLine, type PayrollRun } from "@/services/salonDayService";
import { PayrollAdvances } from "@/components/payroll/PayrollAdvances";
import { t } from "@/i18n";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

/** CSV of a pay run's lines (Excel-friendly: BOM, semicolons would break AZ decimals — use commas + quotes). */
export function payrollCsv(run: PayrollRun): string {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["staff", "hours", "base_pay", "commission", "tips", "adjustment", "advances", "total", "note"];
  const rows = (run.lines ?? []).map((l) =>
    [l.staff_name, l.hours, l.base_pay, l.commission, l.tips, l.adjustment, l.advances ?? 0, l.total, l.note].map(q).join(","),
  );
  return "﻿" + [head.join(","), ...rows].join("\n");
}

/**
 * FG-W1-06: the pay run. Pick a period → calculate (hourly pay from the timesheet + commission
 * + tips) → adjust a line with a note → approve (lines lock) → mark paid. CSV for the bookkeeper.
 * Needs MONEY (navigation.ts PAGE_NEEDS; the server enforces the same).
 */
export default function PayrollPage() {
  const businessId = useBusinessId();
  const sym = currencySymbol();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<PayrollLine | null>(null);
  const [adj, setAdj] = useState({ amount: "0", note: "" });
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ paidOn: today(), method: "CASH" });

  const loadRuns = useCallback(async () => {
    if (!businessId) return;
    try {
      setRuns(await salonDayService.getPayrollRuns(businessId));
    } catch {
      toast.error(t("payroll.loadFailed"));
    }
  }, [businessId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const openRun = async (id: Id) => {
    if (!businessId) return;
    try {
      setRun(await salonDayService.getPayrollRun(businessId, id));
    } catch {
      toast.error(t("payroll.loadFailed"));
    }
  };

  const act = async (fn: () => Promise<PayrollRun>, ok: string) => {
    setBusy(true);
    try {
      const r = await fn();
      setRun(r);
      toast.success(ok);
      await loadRuns();
    } catch (e) {
      toast.error((e instanceof Error && e.message) || t("payroll.actionFailed"));
    } finally {
      setBusy(false);
    }
  };

  /** A calendar month for the whole team: first to last day. */
  const pickMonth = (m: string) => {
    setMonth(m);
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    const last = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
    setFrom(`${m}-01`);
    setTo(`${m}-${String(last).padStart(2, "0")}`);
  };

  const confirmPaid = async () => {
    if (!businessId || !run) return;
    await act(() => salonDayService.markPayrollPaid(businessId, run.id, pay.paidOn || undefined, pay.method), t("payroll.paidToast"));
    setPayOpen(false);
  };

  const calculate = () => {
    if (!businessId || !from || !to || from > to) return toast.error(t("payroll.badPeriod"));
    void act(() => salonDayService.buildPayroll(businessId, from, to), t("payroll.calculated"));
  };

  const saveAdjustment = async () => {
    if (!businessId || !run || !line) return;
    if (!adj.note.trim()) return toast.error(t("payroll.noteRequired"));
    await act(
      () => salonDayService.adjustPayrollLine(businessId, run.id, line.id, Number(adj.amount) || 0, adj.note.trim()),
      t("payroll.adjusted"),
    );
    setLine(null);
  };

  const exportCsv = () => {
    if (!run) return;
    const url = URL.createObjectURL(new Blob([payrollCsv(run)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${run.period_start}_${run.period_end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const status = (s: PayrollRun["status"]) =>
    s === "DRAFT" ? t("payroll.draft") : s === "APPROVED" ? t("payroll.approved") : t("payroll.paid");
  const draft = run?.status === "DRAFT";

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("payroll.title")} subtitle={t("payroll.subtitle")} />
        <div className={pageBody}>
          <section className="flex flex-wrap items-end gap-3 rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
            <Field label={t("payroll.month")} htmlFor="pr-month">
              <input id="pr-month" type="month" className={fieldCls} value={month} onChange={(e) => pickMonth(e.target.value)} />
            </Field>
            <Field label={t("payroll.from")} htmlFor="pr-from">
              <input id="pr-from" type="date" className={fieldCls} value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t("payroll.to")} htmlFor="pr-to">
              <input id="pr-to" type="date" className={fieldCls} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Button className={primaryBtn} disabled={busy} onClick={calculate}>
              <Calculator size={16} />{" "}{t("payroll.calculate")}
            </Button>
          </section>

          <PayrollAdvances businessId={businessId} />

          {runs.length === 0 ? (
            <EmptyState icon={Wallet} title={t("payroll.emptyTitle")} body={t("payroll.emptyBody")} />
          ) : (
            <ul className="flex flex-wrap gap-2">
              {runs.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => void openRun(r.id)}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${run?.id === r.id ? "bg-[rgb(var(--reg-ink))] text-white" : "bg-white ring-[rgb(var(--reg-line))]"}`}
                  >
                    {r.period_start} — {r.period_end} · {status(r.status)} · {money(Math.round(Number(r.total_amount || 0)), sym)}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {run ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatCard icon={Wallet} label={t("payroll.total")} value={money(Math.round(Number(run.total_amount || 0)), sym)} tone="emerald" />
                <StatCard icon={BadgeCheck} label={t("payroll.status")} value={status(run.status)} tone="violet" />
              </div>
              <div className="flex flex-wrap gap-2">
                {draft ? (
                  <Button className={primaryBtn} disabled={busy} onClick={() => void act(() => salonDayService.approvePayroll(businessId, run.id), t("payroll.approvedToast"))}>
                    {t("payroll.approve")}
                  </Button>
                ) : null}
                {run.status === "APPROVED" ? (
                  <Button className={primaryBtn} disabled={busy} onClick={() => setPayOpen(true)}>
                    {t("payroll.markPaid")}
                  </Button>
                ) : null}
                <Button variant="outline" onClick={exportCsv}>
                  <Download size={16} />{" "}CSV
                </Button>
              </div>
              <div className="overflow-x-auto rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-[rgb(var(--reg-muted))]">
                    <tr>
                      <th className="px-4 py-3">{t("payroll.person")}</th>
                      <th className="px-4 py-3">{t("payroll.hours")}</th>
                      <th className="px-4 py-3">{t("payroll.basePay")}</th>
                      <th className="px-4 py-3">{t("payroll.commission")}</th>
                      <th className="px-4 py-3">{t("payroll.tips")}</th>
                      <th className="px-4 py-3">{t("payroll.adjustment")}</th>
                      <th className="px-4 py-3">{t("payroll.advances")}</th>
                      <th className="px-4 py-3">{t("payroll.total")}</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {(run.lines ?? []).map((l) => (
                      <tr key={l.id} className="border-t border-[rgb(var(--reg-line)/0.6)]">
                        <td className="px-4 py-3.5 font-semibold">{l.staff_name}</td>
                        <td className="px-4 py-3.5">{Number(l.hours || 0).toFixed(1)}</td>
                        <td className="px-4 py-3.5">{money(Number(l.base_pay || 0), sym)}</td>
                        <td className="px-4 py-3.5">{money(Number(l.commission || 0), sym)}</td>
                        <td className="px-4 py-3.5">{money(Number(l.tips || 0), sym)}</td>
                        <td className="px-4 py-3.5" title={l.note ?? ""}>
                          {money(Number(l.adjustment || 0), sym)}
                          {l.note ? <span className="block text-xs text-[rgb(var(--reg-muted))]">{l.note}</span> : null}
                        </td>
                        <td className="px-4 py-3.5">{Number(l.advances || 0) > 0 ? `−${money(Number(l.advances), sym)}` : "—"}</td>
                        <td className="px-4 py-3.5 font-semibold">{money(Number(l.total || 0), sym)}</td>
                        <td className="px-4 py-3.5 text-right">
                          {draft ? (
                            <Button variant="ghost" size="icon" aria-label={t("payroll.adjust")} onClick={() => { setLine(l); setAdj({ amount: String(l.adjustment ?? 0), note: l.note ?? "" }); }}>
                              <Pencil size={15} />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!draft ? <p className="text-xs text-[rgb(var(--reg-muted))]">{t("payroll.locked")}</p> : null}
            </>
          ) : null}
        </div>

        <FormSheet
          open={payOpen}
          onOpenChange={setPayOpen}
          title={t("payroll.payTitle")}
          description={t("payroll.payHint")}
          footer={
            <>
              <Button className={sheetSecondary} variant="outline" onClick={() => setPayOpen(false)}>{t("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={busy} onClick={() => void confirmPaid()}>{t("payroll.markPaid")}</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label={t("payroll.payDate")} htmlFor="pr-paid-on">
              <input id="pr-paid-on" type="date" className={fieldCls} value={pay.paidOn} onChange={(e) => setPay({ ...pay, paidOn: e.target.value })} />
            </Field>
            <Field label={t("payroll.payMethod")} htmlFor="pr-paid-method">
              <select id="pr-paid-method" className={fieldCls} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                <option value="CASH">{t("payroll.methodCash")}</option>
                <option value="CARD">{t("payroll.methodCard")}</option>
                <option value="TRANSFER">{t("payroll.methodTransfer")}</option>
              </select>
            </Field>
          </div>
        </FormSheet>

        <FormSheet
          open={!!line}
          onOpenChange={(o) => !o && setLine(null)}
          title={t("payroll.adjustTitle")}
          description={line?.staff_name ?? undefined}
          footer={
            <>
              <Button className={sheetSecondary} variant="outline" onClick={() => setLine(null)}>{t("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={busy} onClick={() => void saveAdjustment()}>{t("common.save")}</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label={t("payroll.adjustAmount")} htmlFor="pr-adj">
              <input id="pr-adj" type="number" step="0.01" className={fieldCls} value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} />
            </Field>
            <Field label={t("payroll.adjustNote")} htmlFor="pr-note">
              <input id="pr-note" className={fieldCls} value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
            </Field>
          </div>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}
