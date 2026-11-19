import { useCallback, useEffect, useState } from "react";
import { Target, Users } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls, money } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import { t } from "@/i18n";
import { staffTargetService, type StaffTargetRow } from "@/services/staffTargetService";

const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

/** How far a member is through the month's target, 0 to 100. A missing target shows 0. */
const pct = (actual: number, target: number) => (target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0);

function Progress({ actual, target }: { actual: number; target: number }) {
  const p = pct(actual, target);
  return (
    <div className="mt-1">
      <div className="h-1.5 w-full rounded-full bg-[rgb(var(--reg-line)/0.8)]">
        <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${p}%` }} />
      </div>
      <p className="mt-1 text-xs text-[rgb(var(--reg-muted))]">{target > 0 ? `${p}%` : t("staffTargets.noTarget")}</p>
    </div>
  );
}

function TargetRow({
  row,
  month,
  sym,
  onSaved,
}: {
  row: StaffTargetRow;
  month: string;
  sym: string;
  onSaved: () => void;
}) {
  const businessId = useBusinessId();
  const [rev, setRev] = useState(String(row.revenueTarget));
  const [book, setBook] = useState(String(row.bookingsTarget));
  const [busy, setBusy] = useState(false);
  const revNum = Number(rev);
  const bookNum = Number(book);
  const valid = rev !== "" && Number.isFinite(revNum) && revNum >= 0 && book !== "" && Number.isInteger(bookNum) && bookNum >= 0;
  const changed = valid && (revNum !== row.revenueTarget || bookNum !== row.bookingsTarget);

  const save = async () => {
    if (!businessId || !valid) return;
    setBusy(true);
    try {
      await staffTargetService.set(businessId, row.staffId, month, { revenueTarget: revNum, bookingsTarget: bookNum });
      onSaved();
    } catch {
      toast.error(t("staffTargets.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-t border-[rgb(var(--reg-line)/0.8)] align-top">
      <td className="px-4 py-3 font-semibold">{row.staffName}</td>
      <td className="px-4 py-3">
        <input className={fieldCls} type="number" min={0} step="0.01" aria-label={t("staffTargets.revenueTarget")} value={rev} onChange={(e) => setRev(e.target.value)} />
      </td>
      <td className="px-4 py-3">
        {money(Math.round(row.revenueActual), sym)}
        <Progress actual={row.revenueActual} target={row.revenueTarget} />
      </td>
      <td className="px-4 py-3">
        <input className={fieldCls} type="number" min={0} step={1} aria-label={t("staffTargets.bookingsTarget")} value={book} onChange={(e) => setBook(e.target.value)} />
      </td>
      <td className="px-4 py-3">
        {row.bookingsActual}
        <Progress actual={row.bookingsActual} target={row.bookingsTarget} />
      </td>
      <td className="px-4 py-3">
        <Button className={primaryBtn} disabled={!changed || busy} onClick={() => void save()}>
          {t("staffTargets.save")}
        </Button>
      </td>
    </tr>
  );
}

/** Owner and managers: each member's monthly revenue and bookings target, against the month so far. */
export default function StaffTargetsPage() {
  const businessId = useBusinessId();
  const sym = currencySymbol();
  const [month, setMonth] = useState(thisMonth);
  const [rows, setRows] = useState<StaffTargetRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!businessId) return;
    setBusy(true);
    staffTargetService
      .list(businessId, month)
      .then(setRows)
      .catch(() => toast.error(t("staffTargets.loadFailed")))
      .finally(() => setBusy(false));
  }, [businessId, month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("staffTargets.title")} subtitle={t("staffTargets.subtitle")} />
        <div className={pageBody}>
          <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
            <Field label={t("staffTargets.month")} htmlFor="st-month">
              <input id="st-month" type="month" className={fieldCls} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            </Field>
          </section>

          {rows.length === 0 && !busy ? (
            <EmptyState icon={Users} title={t("staffTargets.empty")} body={t("staffTargets.emptyBody")} />
          ) : (
            <div className="overflow-x-auto rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs font-semibold text-[rgb(var(--reg-muted))]">
                  <tr>
                    <th className="px-4 py-3">{t("staffTargets.colStaff")}</th>
                    <th className="px-4 py-3">{t("staffTargets.revenueTarget")}</th>
                    <th className="px-4 py-3">{t("staffTargets.revenueActual")}</th>
                    <th className="px-4 py-3">{t("staffTargets.bookingsTarget")}</th>
                    <th className="px-4 py-3">{t("staffTargets.bookingsActual")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <TargetRow key={`${r.staffId}-${month}-${r.revenueTarget}-${r.bookingsTarget}`} row={r} month={month} sym={sym} onSaved={load} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="flex items-center gap-2 text-xs text-[rgb(var(--reg-muted))]">
            <Target size={14} /> {t("staffTargets.note")}
          </p>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
