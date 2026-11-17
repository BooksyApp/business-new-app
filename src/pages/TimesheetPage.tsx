import type { Id } from "@/types/id";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, LogIn, LogOut, Pencil, Timer, Users } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, FormSheet, PageHeader, StatCard } from "@/components/page/booqi";
import { pageBody, primaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls, money } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { hasPermission, myAccess } from "@/components/layout/navigation";
import { currencySymbol } from "@/lib/currency";
import { salonDayService, type TimeEntry, type TimesheetRow } from "@/services/salonDayService";
import { staffService, type Staff } from "@/services/staffService";
import { t } from "@/i18n";

/** Monday of the week that contains `d`, as yyyy-mm-dd. */
export function weekStart(d: Date): string {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dow);
  return x.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

const hhmm = (ts: string | null) => (ts ? ts.replace("T", " ").slice(11, 16) : "—");
const toLocalInput = (ts: string | null) => (ts ? ts.replace(" ", "T").slice(0, 16) : "");

function myStaffId(): Id | undefined {
  try {
    const b = JSON.parse(localStorage.getItem("currentBusiness") || "{}") as { myStaffId?: Id };
    return b.myStaffId || undefined;
  } catch {
    return undefined;
  }
}

/**
 * FG-W1-07: clock in / out (anyone on the team) and the weekly timesheet (whoever manages the
 * team): who is in now, hours per person and every entry, corrected in place. Corrections are
 * audited by the server; the hours feed the pay run (PayrollPage).
 */
export default function TimesheetPage() {
  const businessId = useBusinessId();
  const access = myAccess();
  const canManage = hasPermission(access, "TEAM");
  const sym = currencySymbol();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [who, setWho] = useState<Id | "">(myStaffId() ?? "");
  const [open, setOpen] = useState<Array<{ id: Id; staff_id: Id; staff_name: string; clock_in: string }>>([]);
  const [week, setWeek] = useState(() => weekStart(new Date()));
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [form, setForm] = useState({ clockIn: "", clockOut: "", breakMinutes: "0", note: "" });

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      setOpen(await salonDayService.getClockedIn(businessId));
      if (canManage) {
        const sheet = await salonDayService.getTimesheets(businessId, week, addDays(week, 6));
        setRows(sheet.byStaff ?? []);
        setEntries(sheet.entries ?? []);
      }
    } catch {
      toast.error(t("timesheet.loadFailed"));
    }
  }, [businessId, canManage, week]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!businessId || !canManage) return;
    staffService.getStaffByBusiness(businessId).then(setStaff).catch(() => setStaff([]));
  }, [businessId, canManage]);

  const isIn = useMemo(() => open.some((o) => o.staff_id === who), [open, who]);

  const clock = async () => {
    if (!businessId || !who) return;
    setBusy(true);
    try {
      if (isIn) {
        await salonDayService.clockOut(businessId, who);
        toast.success(t("timesheet.clockedOut"));
      } else {
        await salonDayService.clockIn(businessId, who);
        toast.success(t("timesheet.clockedIn"));
      }
      await load();
    } catch (e) {
      toast.error((e instanceof Error && e.message) || t("timesheet.clockFailed"));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (e: TimeEntry) => {
    setEditing(e);
    setForm({
      clockIn: toLocalInput(e.clock_in),
      clockOut: toLocalInput(e.clock_out),
      breakMinutes: String(e.break_minutes ?? 0),
      note: e.note ?? "",
    });
  };

  const saveEdit = async () => {
    if (!businessId || !editing) return;
    setBusy(true);
    try {
      await salonDayService.correctEntry(businessId, editing.id, {
        clockIn: form.clockIn ? `${form.clockIn}:00` : undefined,
        clockOut: form.clockOut ? `${form.clockOut}:00` : undefined,
        breakMinutes: Math.max(0, Number(form.breakMinutes) || 0),
        note: form.note.trim() || undefined,
      });
      toast.success(t("timesheet.corrected"));
      setEditing(null);
      await load();
    } catch (e) {
      toast.error((e instanceof Error && e.message) || t("timesheet.correctFailed"));
    } finally {
      setBusy(false);
    }
  };

  const totalHours = rows.reduce((n, r) => n + Number(r.hours || 0), 0);
  const totalPay = rows.reduce((n, r) => n + Number(r.pay || 0), 0);

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("timesheet.title")} subtitle={t("timesheet.subtitle")} />
        <div className={pageBody}>
          <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
            <div className="flex flex-wrap items-end gap-3">
              {canManage ? (
                <Field label={t("timesheet.who")} htmlFor="ts-who">
                  <select id="ts-who" className={fieldCls} value={who} onChange={(e) => setWho(e.target.value)}>
                    <option value="">{t("timesheet.pickPerson")}</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Button className={primaryBtn} disabled={busy || !who} onClick={() => void clock()}>
                {isIn ? <LogOut size={16} /> : <LogIn size={16} />}{" "}
                {isIn ? t("timesheet.clockOut") : t("timesheet.clockIn")}
              </Button>
              {!who && !canManage ? <p className="text-sm text-[rgb(var(--reg-muted))]">{t("timesheet.noStaffProfile")}</p> : null}
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-[rgb(var(--reg-muted))]">{t("timesheet.inNow")}</p>
              {open.length === 0 ? (
                <p className="mt-1 text-sm">{t("timesheet.nobodyIn")}</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {open.map((o) => (
                    <li key={o.id} className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
                      {o.staff_name} · {t("timesheet.atWorkSince", { value: hhmm(o.clock_in) })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {canManage ? (
            <>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label={t("timesheet.prevWeek")} onClick={() => setWeek(addDays(week, -7))}>
                  <ChevronLeft size={16} />
                </Button>
                <span className="text-sm font-semibold">{week} — {addDays(week, 6)}</span>
                <Button variant="outline" size="icon" aria-label={t("timesheet.nextWeek")} onClick={() => setWeek(addDays(week, 7))}>
                  <ChevronRight size={16} />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatCard icon={Users} label={t("timesheet.people")} value={rows.length} tone="violet" />
                <StatCard icon={Timer} label={t("timesheet.hours")} value={totalHours.toFixed(1)} tone="sky" />
                <StatCard icon={Clock} label={t("timesheet.hourlyPay")} value={money(Math.round(totalPay), sym)} tone="emerald" />
              </div>
              {entries.length === 0 ? (
                <EmptyState icon={Clock} title={t("timesheet.emptyTitle")} body={t("timesheet.emptyBody")} />
              ) : (
                <div className="overflow-x-auto rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-[rgb(var(--reg-muted))]">
                      <tr>
                        <th className="px-4 py-3">{t("timesheet.person")}</th>
                        <th className="px-4 py-3">{t("timesheet.day")}</th>
                        <th className="px-4 py-3">{t("timesheet.in")}</th>
                        <th className="px-4 py-3">{t("timesheet.out")}</th>
                        <th className="px-4 py-3">{t("timesheet.break")}</th>
                        <th className="px-4 py-3">{t("timesheet.worked")}</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => (
                        <tr key={e.id} className="border-t border-[rgb(var(--reg-line)/0.6)]">
                          <td className="px-4 py-2 font-semibold">{e.staff_name}</td>
                          <td className="px-4 py-2">{e.work_date}</td>
                          <td className="px-4 py-2">{hhmm(e.clock_in)}</td>
                          <td className="px-4 py-2">{e.clock_out ? hhmm(e.clock_out) : <span className="font-semibold text-emerald-700">{t("timesheet.atWork")}</span>}</td>
                          <td className="px-4 py-2">{e.break_minutes} {t("timesheet.min")}</td>
                          <td className="px-4 py-2">{e.worked_minutes != null ? `${(e.worked_minutes / 60).toFixed(1)} ${t("timesheet.h")}` : "—"}{e.edited_at ? <span className="ml-1 text-xs text-[rgb(var(--reg-muted))]">({t("timesheet.edited")})</span> : null}</td>
                          <td className="px-4 py-2 text-right">
                            <Button variant="ghost" size="icon" aria-label={t("timesheet.correct")} onClick={() => startEdit(e)}>
                              <Pencil size={15} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </div>

        <FormSheet
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          title={t("timesheet.correctTitle")}
          description={editing?.staff_name ?? undefined}
          footer={
            <>
              <Button className={sheetSecondary} variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={busy} onClick={() => void saveEdit()}>{t("common.save")}</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label={t("timesheet.in")} htmlFor="ts-in">
              <input id="ts-in" type="datetime-local" className={fieldCls} value={form.clockIn} onChange={(e) => setForm({ ...form, clockIn: e.target.value })} />
            </Field>
            <Field label={t("timesheet.out")} htmlFor="ts-out">
              <input id="ts-out" type="datetime-local" className={fieldCls} value={form.clockOut} onChange={(e) => setForm({ ...form, clockOut: e.target.value })} />
            </Field>
            <Field label={t("timesheet.breakMinutes")} htmlFor="ts-break">
              <input id="ts-break" type="number" min={0} className={fieldCls} value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })} />
            </Field>
            <Field label={t("timesheet.reason")} htmlFor="ts-note">
              <input id="ts-note" className={fieldCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t("timesheet.reasonHint")} />
            </Field>
          </div>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}
