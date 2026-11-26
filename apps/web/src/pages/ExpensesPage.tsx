import { useCallback, useEffect, useState } from "react";
import { Plus, Receipt, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { FormSheet } from "@/components/page/booqi";
import { primaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls, money } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import { salonDayService, type Expense, type ExpenseCategory, type ProfitAndLoss } from "@/services/salonDayService";
import { t } from "@/i18n";
import { BooqiScope, EmptyState, PageHeader, StatCard, pageBody } from "@/components/bz/p4-compat";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "RENT", "STOCK", "UTILITIES", "WAGES", "MARKETING", "EQUIPMENT", "INSURANCE", "SOFTWARE", "TRAVEL", "FEES", "OTHER",
];

/** First and last day of a yyyy-mm month. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

/** "+12%" against last month, or null when last month had nothing to compare with. */
export function change(now: number, before: number): string | null {
  if (!before) return null;
  const p = Math.round(((now - before) / Math.abs(before)) * 100);
  return `${p > 0 ? "+" : ""}${p}%`;
}

/**
 * FG-W1-08: the salon's costs and its month: add / delete expenses by category, and the profit
 * and loss for the month next to the month before. Revenue is the server's (the same sales the
 * cash report counts). Needs MONEY.
 */
export default function ExpensesPage() {
  const businessId = useBusinessId();
  const sym = currencySymbol();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [list, setList] = useState<Expense[]>([]);
  const [pl, setPl] = useState<ProfitAndLoss | null>(null);
  const [prev, setPrev] = useState<ProfitAndLoss | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ category: "RENT" as ExpenseCategory, amount: "", spentOn: "", description: "", recurs: false });

  const load = useCallback(async () => {
    if (!businessId) return;
    const r = monthRange(month);
    const p = monthRange(prevMonth(month));
    try {
      const [items, now, before] = await Promise.all([
        salonDayService.getExpenses(businessId, r.from, r.to),
        salonDayService.getProfitAndLoss(businessId, r.from, r.to),
        salonDayService.getProfitAndLoss(businessId, p.from, p.to),
      ]);
      setList(items);
      setPl(now);
      setPrev(before);
    } catch {
      toast.error(t("expenses.loadFailed"));
    }
  }, [businessId, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const amount = Number(form.amount);
    if (!businessId || !(amount > 0)) return toast.error(t("expenses.amountRequired"));
    setBusy(true);
    try {
      const body = {
        category: form.category,
        amount,
        spentOn: form.spentOn || monthRange(month).from,
        description: form.description.trim() || (editing ? null : undefined),
        recursMonthly: form.recurs,
      };
      if (editing) await salonDayService.updateExpense(businessId, editing.id, body);
      else await salonDayService.addExpense(businessId, body);
      toast.success(editing ? t("expenses.saved") : t("expenses.added"));
      setAdding(false);
      setEditing(null);
      setForm({ ...form, amount: "", description: "", recurs: false });
      await load();
    } catch (e) {
      toast.error((e instanceof Error && e.message) || t("expenses.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: Expense) => {
    if (!businessId || !window.confirm(t("expenses.confirmDelete"))) return;
    try {
      await salonDayService.deleteExpense(businessId, e.id);
      await load();
    } catch {
      toast.error(t("expenses.deleteFailed"));
    }
  };

  const edit = (e: Expense) => {
    setEditing(e);
    setForm({ category: e.category, amount: String(e.amount ?? ""), spentOn: String(e.spent_on ?? "").slice(0, 10), description: e.description ?? "", recurs: Boolean(e.recurs_monthly) });
    setAdding(true);
  };
  const startAdd = () => {
    setEditing(null);
    setForm({ category: "RENT", amount: "", spentOn: "", description: "", recurs: false });
    setAdding(true);
  };

  const cat = (c: ExpenseCategory) => t(`expenses.cat.${c}`);
  const n = (v: number | undefined) => Number(v || 0);

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("expenses.title")}
          subtitle={t("expenses.subtitle")}
          actions={
            <Button className={primaryBtn} onClick={startAdd}>
              <Plus size={16} />{" "}{t("expenses.add")}
            </Button>
          }
        />
        <div className={pageBody}>
          <Field label={t("expenses.month")} htmlFor="ex-month">
            <input id="ex-month" type="month" className={`${fieldCls} max-w-[200px]`} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </Field>

          {pl ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={TrendingUp} label={t("expenses.revenue")} value={money(Math.round(n(pl.revenue)), sym)} hint={change(n(pl.revenue), n(prev?.revenue)) ?? undefined} tone="emerald" />
              <StatCard icon={Wallet} label={t("expenses.wages")} value={money(Math.round(n(pl.wages)), sym)} hint={change(n(pl.wages), n(prev?.wages)) ?? undefined} tone="sky" />
              <StatCard icon={TrendingDown} label={t("expenses.costs")} value={money(Math.round(n(pl.costs)), sym)} hint={change(n(pl.costs), n(prev?.costs)) ?? undefined} tone="violet" />
              <StatCard icon={Receipt} label={t("expenses.profit")} value={money(Math.round(n(pl.profit)), sym)} hint={prev ? t("expenses.lastMonth", { value: money(Math.round(n(prev.profit)), sym) }) : undefined} tone={n(pl.profit) >= 0 ? "emerald" : "violet"} />
            </div>
          ) : null}

          {pl && pl.byCategory?.length ? (
            <section className="crd2">
              <p className="mb-3 font-semibold">{t("expenses.byCategory")}</p>
              <ul className="space-y-2 text-sm">
                {pl.byCategory.map((c) => (
                  <li key={c.category} className="flex justify-between">
                    <span>{cat(c.category)} · {c.entries}</span>
                    <span className="font-semibold">{money(n(c.amount), sym)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {list.length === 0 ? (
            <EmptyState icon={Receipt} title={t("expenses.emptyTitle")} body={t("expenses.emptyBody")} />
          ) : (
            <div className="overflow-x-auto rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              <table className="w-full text-sm">
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id} className="border-t border-[rgb(var(--reg-line)/0.6)] first:border-0">
                      <td className="px-4 py-3.5">{e.spent_on}</td>
                      <td className="px-4 py-3.5 font-semibold">
                        <button type="button" onClick={() => edit(e)} className="rounded text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]">{cat(e.category)}</button>
                      </td>
                      <td className="px-4 py-3.5 text-[rgb(var(--reg-muted))]">{e.description ?? ""}{e.recurs_monthly ? ` · ${t("expenses.monthly")}` : ""}</td>
                      <td className="px-4 py-3.5 text-right font-semibold">{money(n(e.amount), sym)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <Button variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => void remove(e)}>
                          <Trash2 size={15} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <FormSheet
          open={adding}
          onOpenChange={(o) => { setAdding(o); if (!o) setEditing(null); }}
          title={editing ? t("expenses.edit") : t("expenses.add")}
          footer={
            <>
              <Button className={sheetSecondary} variant="outline" onClick={() => setAdding(false)}>{t("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={busy} onClick={() => void add()}>{t("common.save")}</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label={t("expenses.category")} htmlFor="ex-cat">
              <select id="ex-cat" className={fieldCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{cat(c)}</option>
                ))}
              </select>
            </Field>
            <Field label={t("expenses.amount")} htmlFor="ex-amount">
              <input id="ex-amount" type="number" min={0} step="0.01" className={fieldCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label={t("expenses.date")} htmlFor="ex-date">
              <input id="ex-date" type="date" className={fieldCls} value={form.spentOn} onChange={(e) => setForm({ ...form, spentOn: e.target.value })} />
            </Field>
            <Field label={t("expenses.description")} htmlFor="ex-desc">
              <input id="ex-desc" className={fieldCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.recurs} onChange={(e) => setForm({ ...form, recurs: e.target.checked })} />
              {t("expenses.recurs")}
            </label>
          </div>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}
