import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, parseISO, startOfWeek } from "date-fns";
import { format } from "@/i18n/dateFns";
import { CalendarOff, ChevronLeft, ChevronRight, CopyPlus, Eraser, Plus } from "lucide-react";
import { toast } from "sonner";

import { FormSheet } from "@/components/page/booqi";
import { primaryBtn, secondaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { Field, RowAction } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { salonDayService, type Rota, type RotaDay, type RotaRow } from "@/services/salonDayService";
import type { TimeOff } from "@/services/timeOffService";
import { t as tr } from "@/i18n";

const hm = (t?: string | null) => (t ? t.slice(0, 5) : "");
const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** How a day reads in the grid, by rota state. */
const PILL: Record<RotaDay["state"], { cls: string; label: (d: RotaDay) => string; sub?: string }> = {
  SHIFT: { cls: "bg-[rgb(var(--reg-brand))] text-white", label: (d) => `${hm(d.start)}–${hm(d.end)}`, get sub() { return tr("team.shift"); } },
  USUAL: { cls: "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]", label: (d) => `${hm(d.start)}–${hm(d.end)}` },
  OFF: { cls: "bg-[rgb(var(--reg-ink)/0.04)] text-[rgb(var(--reg-muted))]", label: () => "Off" },
  TIME_OFF: { cls: "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200", label: () => tr("team.timeOff") },
  TIME_OFF_PENDING: { cls: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200", label: () => "Requested" },
};

/**
 * The week, one row per team member: their usual hours, one-off shifts, days off and
 * time off. A cell opens a sheet to set or clear that day's shift. Shifts override the
 * usual weekly hours for that date only.
 */
export function ShiftsWeek({
  businessId,
  timeOffs,
  approvingId,
  onApprove,
  onAddTimeOff,
}: {
  businessId: number;
  timeOffs: TimeOff[];
  approvingId: number | null;
  onApprove: (id: number) => Promise<void> | void;
  onAddTimeOff: () => void;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [rota, setRota] = useState<Rota | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ row: RotaRow; day: RotaDay } | null>(null);
  const [form, setForm] = useState({ start: "10:00", end: "19:00", notes: "" });

  const load = useCallback(() => {
    if (!businessId) return;
    salonDayService.getRota(businessId, iso(weekStart)).then(setRota).catch(() => setRota({ weekStart: iso(weekStart), weekEnd: "", staff: [] }));
  }, [businessId, weekStart]);
  useEffect(load, [load]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = iso(new Date());
  const shiftCount = (rota?.staff ?? []).reduce((n, r) => n + r.days.filter((d) => d.state === "SHIFT").length, 0);
  const pending = timeOffs.filter((t) => !t.isApproved);

  const open = (row: RotaRow, day: RotaDay) => {
    setForm({ start: hm(day.start) || "10:00", end: hm(day.end) || "19:00", notes: day.notes ?? "" });
    setEdit({ row, day });
  };

  const run = async (p: Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await p;
      toast.success(ok);
      setEdit(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("team.couldNotSaveThat"));
    } finally {
      setBusy(false);
    }
  };

  const saveShift = () => {
    if (!edit) return;
    if (form.end <= form.start) return toast.error(tr("team.theShiftMustEndAfter"));
    void run(
      salonDayService.setShift(businessId, { staffId: edit.row.id, date: edit.day.date, start: form.start, end: form.end, notes: form.notes.trim() || undefined }),
      `${edit.row.name}: ${form.start}–${form.end} on ${format(parseISO(edit.day.date), "EEE d MMM")}`,
    );
  };

  const copyWeek = () => {
    const to = iso(addDays(weekStart, 7));
    if (!confirm(tr("team.copyThisWeekSShifts", { value: format(addDays(weekStart, 7), "d MMM") }))) return;
    setBusy(true);
    salonDayService
      .copyWeek(businessId, iso(weekStart), to)
      .then((r) => toast.success(tr("team.copiedToNextWeek", { count: r.copied })))
      .catch((e) => toast.error(e instanceof Error ? e.message : tr("team.couldNotCopyTheWeek")))
      .finally(() => setBusy(false));
  };

  const clearWeek = async () => {
    const shifts = (rota?.staff ?? []).flatMap((r) => r.days.filter((d) => d.state === "SHIFT").map((d) => ({ id: r.id, date: d.date })));
    if (!shifts.length || !confirm(tr("team.clearWeekConfirm", { count: shifts.length }))) return;
    await run(Promise.all(shifts.map((s) => salonDayService.clearShift(businessId, s.id, s.date))), tr("team.weekCleared"));
  };

  const pendingFor = (row: RotaRow, day: RotaDay) =>
    timeOffs.find((t) => !t.isApproved && t.staffId === row.id && t.startDate <= day.date && t.endDate >= day.date);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" aria-label={tr("team.previousWeek")} onClick={() => setWeekStart((w) => addDays(w, -7))} className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-[rgb(var(--reg-line))] hover:bg-[rgb(var(--reg-canvas))]">
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label={tr("team.nextWeek")} onClick={() => setWeekStart((w) => addDays(w, 7))} className="flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-[rgb(var(--reg-line))] hover:bg-[rgb(var(--reg-canvas))]">
            <ChevronRight size={18} />
          </button>
          <p className="ml-2 text-base font-extrabold">
            {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
          </p>
          <button type="button" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="ml-2 text-sm font-semibold text-[rgb(var(--reg-brand-strong))] hover:underline">
            {tr("team.thisWeek")}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className={secondaryBtn} disabled={busy} onClick={copyWeek}><CopyPlus size={16} />{" "}{tr("team.copyToNextWeek")}</Button>
          <Button variant="outline" className={secondaryBtn} disabled={busy || !shiftCount} onClick={() => void clearWeek()}><Eraser size={16} />{" "}{tr("team.clearWeek")}</Button>
          <Button className={primaryBtn} onClick={onAddTimeOff}><Plus size={16} />{" "}{tr("team.timeOff")}</Button>
        </div>
      </div>

      {/* #48: time off left pending was invisible and could never be approved. */}
      {pending.length > 0 && (
        <section className="rounded-[20px] bg-amber-50/60 p-4 ring-1 ring-inset ring-amber-200">
          <p className="mb-2 text-sm font-extrabold text-amber-900">{tr("team.timeOffWaitingForYou")}</p>
          <ul className="space-y-2">
            {pending.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2.5 text-sm">
                <CalendarOff size={16} className="text-amber-700" aria-hidden />
                <span className="font-semibold">{t.staffName || rota?.staff.find((r) => r.id === t.staffId)?.name || tr("common.teamMember")}</span>
                <span className="text-[rgb(var(--reg-muted))]">
                  {t.startDate === t.endDate ? format(parseISO(t.startDate), "EEE d MMM") : `${format(parseISO(t.startDate), "d MMM")} – ${format(parseISO(t.endDate), "d MMM")}`}
                  {t.isFullDay ? "" : ` · ${hm(t.startTime)}–${hm(t.endTime)}`}
                  {t.reason ? ` · ${t.reason}` : ""}
                </span>
                <span className="ml-auto">
                  <RowAction disabled={approvingId === t.id} onClick={() => void onApprove(t.id)}>{tr("team.approve")}</RowAction>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[1] w-[150px] bg-white px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{tr("common.team")}</th>
              {days.map((d) => {
                const isToday = iso(d) === today;
                return (
                  <th key={iso(d)} scope="col" className={cn("px-1.5 py-3 text-center", isToday && "bg-[rgb(var(--reg-brand-soft))]")}>
                    <span className={cn("block text-xs font-semibold", isToday ? "text-[rgb(var(--reg-brand-strong))]" : "text-[rgb(var(--reg-muted))]")}>{format(d, "EEE")}</span>
                    <span className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold", isToday && "bg-[rgb(var(--reg-brand))] text-white")}>{format(d, "d")}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rota === null ? (
              <tr><td colSpan={8} className="h-40 animate-pulse bg-[rgb(var(--reg-canvas)/0.6)]" /></tr>
            ) : rota.staff.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-[rgb(var(--reg-muted))]">{tr("team.noTeamMembersYet")}</td></tr>
            ) : (
              rota.staff.map((row) => (
                <tr key={row.id} className="border-t border-[rgb(var(--reg-line)/0.6)]">
                  <th scope="row" className="sticky left-0 z-[1] bg-white px-4 py-2.5 text-left font-normal">
                    <span className="block truncate font-semibold">{row.name}</span>
                    <span className="block truncate text-xs text-[rgb(var(--reg-muted))]">{row.position || "—"}</span>
                  </th>
                  {row.days.map((day) => {
                    const p = PILL[day.state] ?? PILL.OFF;
                    const isToday = day.date === today;
                    return (
                      <td key={day.date} className={cn("px-1.5 py-2", isToday && "bg-[rgb(var(--reg-brand-soft)/0.6)]")}>
                        <button
                          type="button"
                          onClick={() => open(row, day)}
                          aria-label={`${row.name}, ${format(parseISO(day.date), "EEEE d MMMM")}: ${p.label(day)}`}
                          className={cn("flex min-h-[44px] w-full flex-col items-center justify-center rounded-xl px-1 py-1.5 text-xs font-bold tabular-nums transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.6)]", p.cls)}
                        >
                          {p.label(day)}
                          {(p.sub || day.reason) && <span className="mt-0.5 max-w-full truncate text-[10px] font-semibold opacity-80">{p.sub ?? day.reason}</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[rgb(var(--reg-muted))]">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[rgb(var(--reg-brand-soft))] ring-1 ring-[rgb(var(--reg-brand)/0.3)]" />{tr("team.usualHours")}</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[rgb(var(--reg-brand))]" />{tr("team.oneOffShift")}</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-rose-200" />{tr("team.timeOff")}</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-200" />{tr("team.requested")}</span>
      </p>

      <FormSheet
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={edit ? edit.row.name : tr("team.shift")}
        description={edit ? `${format(parseISO(edit.day.date), "EEEE d MMMM")} · ${edit.day.state === "SHIFT" ? tr("team.oneOffShift2") : edit.day.state === "USUAL" ? tr("team.usualHours2") : edit.day.state === "OFF" ? tr("team.dayOff") : tr("team.timeOff2")}` : undefined}
        footer={
          <>
            {edit?.day.state === "SHIFT" ? (
              <Button variant="outline" className={sheetSecondary} disabled={busy} onClick={() => edit && void run(salonDayService.clearShift(businessId, edit.row.id, edit.day.date), tr("team.shiftCleared"))}>
                {tr("team.clearShift")}
              </Button>
            ) : (
              <Button variant="outline" className={sheetSecondary} onClick={() => setEdit(null)}>{tr("common.cancel")}</Button>
            )}
            <Button className={sheetPrimary} disabled={busy} onClick={saveShift}>{busy ? tr("common.saving") : tr("team.saveShift")}</Button>
          </>
        }
      >
        {edit && (
          <>
            {(() => {
              const t = pendingFor(edit.row, edit.day);
              return t ? (
                <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-3 text-sm ring-1 ring-inset ring-amber-200">
                  <span className="flex-1">{tr("team.timeOffRequested", { value: t.reason ? `: ${t.reason}` : "" })}</span>
                  <RowAction disabled={approvingId === t.id} onClick={() => void Promise.resolve(onApprove(t.id)).then(() => { setEdit(null); load(); })}>{tr("team.approve")}</RowAction>
                </div>
              ) : null;
            })()}
            <p className="text-sm text-[rgb(var(--reg-muted))]">{tr("team.aShiftReplacesTheUsual")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("team.starts")} htmlFor="sh-start">
                <input id="sh-start" type="time" className={fieldCls} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </Field>
              <Field label={tr("common.ends")} htmlFor="sh-end">
                <input id="sh-end" type="time" className={fieldCls} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </Field>
            </div>
            <Field label={tr("common.noteOptional")} htmlFor="sh-note">
              <input id="sh-note" className={fieldCls} value={form.notes} maxLength={200} placeholder={tr("team.coveringForLeyla")} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </>
        )}
      </FormSheet>
    </div>
  );
}
