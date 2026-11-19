import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { t } from "@/i18n";
import type { Id } from "@/types/id";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/page/kit";
import { fieldCls, money } from "@/components/page/kitStyles";
import { primaryBtn } from "@/components/page/booqiStyles";
import { currencySymbol } from "@/lib/currency";
import { salonToday } from "@/lib/salonClock";
import { salonDayService, type StaffAdvance } from "@/services/salonDayService";
import { staffService, type Staff } from "@/services/staffService";

/** FG-W1-06: advances handed to staff before payday. The next pay run takes the outstanding amount off. */
export function PayrollAdvances({ businessId, onChanged }: { businessId: Id; onChanged?: () => void }) {
  const sym = currencySymbol();
  const [list, setList] = useState<StaffAdvance[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [form, setForm] = useState({ staffId: "", amount: "", givenOn: salonToday(), note: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      setList(await salonDayService.getAdvances(businessId));
    } catch {
      setList([]);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
    if (businessId) staffService.getStaffByBusiness(businessId).then(setStaff).catch(() => setStaff([]));
  }, [businessId, load]);

  const add = async () => {
    const amount = Number(form.amount);
    if (!form.staffId || !(amount > 0)) return toast.error(t("payroll.advanceInvalid"));
    setBusy(true);
    try {
      await salonDayService.addAdvance(businessId, { staffId: form.staffId, amount, givenOn: form.givenOn || undefined, note: form.note.trim() || undefined });
      setForm({ ...form, amount: "", note: "" });
      await load();
      onChanged?.();
    } catch {
      toast.error(t("payroll.actionFailed"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: Id) => {
    setBusy(true);
    try {
      await salonDayService.deleteAdvance(businessId, id);
      await load();
    } catch {
      toast.error(t("payroll.advanceLocked"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
      <div>
        <h2 className="text-base font-extrabold">{t("payroll.advancesTitle")}</h2>
        <p className="text-sm text-[rgb(var(--reg-muted))]">{t("payroll.advancesHint")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("payroll.person")} htmlFor="adv-staff">
          <select id="adv-staff" className={fieldCls} value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
            <option value="">—</option>
            {staff.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        </Field>
        <Field label={t("payroll.advanceAmount")} htmlFor="adv-amount">
          <input id="adv-amount" type="number" min="0" step="0.01" className={fieldCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label={t("payroll.advanceDate")} htmlFor="adv-date">
          <input id="adv-date" type="date" className={fieldCls} value={form.givenOn} onChange={(e) => setForm({ ...form, givenOn: e.target.value })} />
        </Field>
        <Field label={t("payroll.advanceNote")} htmlFor="adv-note">
          <input id="adv-note" className={fieldCls} maxLength={255} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
        <Button className={primaryBtn} disabled={busy} onClick={() => void add()}>{t("payroll.advanceAdd")}</Button>
      </div>
      {list.length > 0 && (
        <ul className="divide-y divide-[rgb(var(--reg-line)/0.6)] text-sm">
          {list.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="font-semibold">{a.staff_name}</span> · {a.given_on} · {money(Number(a.amount), sym)}
                {a.note ? <span className="text-[rgb(var(--reg-muted))]"> · {a.note}</span> : null}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={Number(a.outstanding) > 0 ? "font-semibold" : "text-[rgb(var(--reg-muted))]"}>
                  {Number(a.outstanding) > 0 ? t("payroll.advanceOutstanding", { amount: money(Number(a.outstanding), sym) }) : t("payroll.advanceSettled")}
                </span>
                {Number(a.repaid) === 0 && (
                  <Button variant="ghost" size="icon" aria-label={t("payroll.advanceDelete")} disabled={busy} onClick={() => void remove(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
