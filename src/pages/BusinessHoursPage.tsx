import { useEffect, useMemo, useState } from "react";
import { salonNow, salonToday } from "@/lib/salonClock";
import { useSalonTimeZone } from "@/hooks/useSalonTimeZone";
import { CalendarOff, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, FormSheet, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { ActionMenu, ClientPreview, Field, RowAction, SectionTitle, Segmented, StatusChip } from "@/components/page/kit";
import { fieldCls, lifecycleOf } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { useBusinessId } from "@/hooks/useBusinessId";
import { cn } from "@/lib/utils";
import { hoursExceptionService, type HoursException } from "@/services/businessHoursService";
import { t as tr, fmtDate as formatLocaleDate } from "@/i18n";

const DAYS = [
  { key: "MONDAY", get label() { return tr("common.monday"); }, get short() { return tr("common.dayMon"); } },
  { key: "TUESDAY", get label() { return tr("common.tuesday"); }, get short() { return tr("common.dayTue"); } },
  { key: "WEDNESDAY", get label() { return tr("common.wednesday"); }, get short() { return tr("common.dayWed"); } },
  { key: "THURSDAY", get label() { return tr("common.thursday"); }, get short() { return tr("common.dayThu"); } },
  { key: "FRIDAY", get label() { return tr("common.friday"); }, get short() { return tr("common.dayFri"); } },
  { key: "SATURDAY", get label() { return tr("common.saturday"); }, get short() { return tr("common.daySat"); } },
  { key: "SUNDAY", get label() { return tr("common.sunday"); }, get short() { return tr("common.daySun"); } },
];
const WEEKDAYS = DAYS.slice(0, 5).map((d) => d.key);

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

interface DayState { enabled: boolean; startTime: string; endTime: string }

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");
const fmtDay = (d: string) => formatLocaleDate(new Date(d + "T12:00:00"), { weekday: "short", day: "numeric", month: "short" });
// LR-09: the salon's day, not the browser's (or UTC's — toISOString is UTC).
const today = () => salonToday();
const EMPTY_EXC = { startDate: "", endDate: "", closed: "closed" as "closed" | "special", openTime: "10:00", closeTime: "16:00", notes: "" };

/**
 * When the salon is open: the weekly hours, plus the days that break the pattern —
 * a holiday closure, or a short day before one. Clients only see free times inside these.
 */
export default function BusinessHoursPage() {
  const businessId = useBusinessId();
  useSalonTimeZone(businessId);
  const { businessHours, loading, updateBusinessHours } = useBusinessHours();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Record<string, DayState> | null>(null);

  const [schedule, setSchedule] = useState<Record<string, DayState>>(() =>
    Object.fromEntries(DAYS.map((d) => [d.key, { enabled: true, startTime: DEFAULT_START, endTime: DEFAULT_END }])),
  );

  // Populate from API once loaded
  useEffect(() => {
    if (!businessHours.length) return;
    const next: Record<string, DayState> = {};
    for (const d of DAYS) {
      const api = businessHours.find((h) => h.dayOfWeek === d.key);
      next[d.key] = {
        enabled: api ? api.enabled : false,
        startTime: hhmm(api?.startTime) || DEFAULT_START,
        endTime: hhmm(api?.endTime) || DEFAULT_END,
      };
    }
    setSchedule(next);
    setSaved(next);
  }, [businessHours]);

  const dirty = useMemo(() => saved != null && JSON.stringify(saved) !== JSON.stringify(schedule), [saved, schedule]);

  const toggle = (day: string) => setSchedule((s) => ({ ...s, [day]: { ...s[day], enabled: !s[day].enabled } }));
  const setTime = (day: string, field: "startTime" | "endTime", value: string) =>
    setSchedule((s) => ({ ...s, [day]: { ...s[day], [field]: value } }));

  /** Copy one day's hours onto others (open days only change times; closed days open). */
  const copyTo = (day: string, targets: string[], label: string) => {
    const { startTime, endTime, enabled } = schedule[day];
    setSchedule((s) => {
      const next = { ...s };
      for (const k of targets) next[k] = { enabled, startTime, endTime };
      return next;
    });
    toast.success(tr("businessHours.copiedTo", { label: DAYS.find((d) => d.key === day)?.label, label2: label }));
  };

  const handleSave = async () => {
    // Enabled days must close after they open.
    const invalidDays = DAYS.filter((d) => schedule[d.key].enabled && schedule[d.key].endTime <= schedule[d.key].startTime);
    if (invalidDays.length > 0) {
      toast.error(tr("businessHours.endTimeMustBeAfter", { value: invalidDays.map((d) => d.label).join(", ") }));
      return;
    }
    setSaving(true);
    try {
      await updateBusinessHours(
        DAYS.map((d) => ({
          dayOfWeek: d.key,
          enabled: schedule[d.key].enabled,
          startTime: schedule[d.key].startTime,
          endTime: schedule[d.key].endTime,
        })),
      );
      setSaved(schedule);
      toast.success(tr("businessHours.openingHoursSaved"));
    } catch {
      toast.error(tr("businessHours.failedToSaveBusinessHours"));
    } finally {
      setSaving(false);
    }
  };

  /* ── closed days & special hours ── */
  const [exceptions, setExceptions] = useState<HoursException[] | null>(null);
  const [excOpen, setExcOpen] = useState(false);
  const [exc, setExc] = useState(EMPTY_EXC);
  const [excBusy, setExcBusy] = useState(false);

  const loadExceptions = () => {
    if (!businessId) return;
    hoursExceptionService.list(businessId).then((d) => setExceptions(d || [])).catch(() => setExceptions([]));
  };
  useEffect(loadExceptions, [businessId]);

  const createException = async () => {
    const end = exc.endDate || exc.startDate;
    if (!exc.startDate) return toast.error(tr("businessHours.pickADate"));
    if (end < exc.startDate) return toast.error(tr("businessHours.theLastDayIsBefore"));
    if (exc.closed === "special" && exc.closeTime <= exc.openTime) return toast.error(tr("businessHours.closingTimeMustBeAfter"));
    setExcBusy(true);
    try {
      await hoursExceptionService.create({
        businessId,
        startDate: exc.startDate,
        endDate: end,
        closed: exc.closed === "closed",
        openTime: exc.closed === "special" ? exc.openTime : null,
        closeTime: exc.closed === "special" ? exc.closeTime : null,
        notes: exc.notes.trim() || null,
      });
      toast.success(exc.closed === "closed" ? tr("businessHours.closedDayAdded") : tr("businessHours.specialHoursAdded"));
      setExcOpen(false);
      setExc(EMPTY_EXC);
      loadExceptions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("businessHours.couldNotAddThat"));
    } finally {
      setExcBusy(false);
    }
  };

  const removeException = async (x: HoursException) => {
    if (!confirm(tr("businessHours.removeThisClientsCanBook"))) return;
    try {
      await hoursExceptionService.remove(businessId, x.id);
      toast.success(tr("businessHours.removed"));
      loadExceptions();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("businessHours.couldNotRemoveIt"));
    }
  };

  const upcoming = (exceptions ?? []).filter((x) => x.endDate >= today()).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = (exceptions ?? []).filter((x) => x.endDate < today());
  const todayKey = DAYS[(salonNow().getDay() + 6) % 7].key;

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={tr("common.openingHours")}
          subtitle={tr("businessHours.whenClientsCanBookYou")}
          actions={
            <Button className={primaryBtn} onClick={handleSave} disabled={saving || loading || !dirty}>
              {saving ? tr("common.saving") : dirty ? tr("businessHours.saveHours") : tr("common.saved")}
            </Button>
          }
        />

        <div className={pageBody}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-6">
              <section className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6">
                <SectionTitle
                  aside={
                    <div className="flex flex-wrap gap-2">
                      <RowAction tone="ink" icon={Copy} onClick={() => copyTo("MONDAY", WEEKDAYS.slice(1), tr("businessHours.targetTueFri"))}>{tr("businessHours.monWeekdays")}</RowAction>
                      <RowAction tone="ink" icon={Copy} onClick={() => copyTo("MONDAY", DAYS.slice(1).map((d) => d.key), tr("businessHours.targetEveryDay"))}>{tr("businessHours.monAll")}</RowAction>
                    </div>
                  }
                >
                  {tr("businessHours.weeklyHours")}
                </SectionTitle>
                {loading ? (
                  <div className="h-72 animate-pulse rounded-2xl bg-[rgb(var(--reg-canvas))]" aria-busy />
                ) : (
                  <ul className="divide-y divide-[rgb(var(--reg-line)/0.6)]">
                    {DAYS.map((d) => {
                      const day = schedule[d.key];
                      return (
                        <li key={d.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                          <Switch
                            checked={day.enabled}
                            onCheckedChange={() => toggle(d.key)}
                            id={`toggle-${d.key}`}
                            aria-label={`${d.label} open`}
                            className="data-[state=checked]:bg-[rgb(var(--reg-brand))]"
                          />
                          <label htmlFor={`toggle-${d.key}`} className="w-24 cursor-pointer text-[15px] font-semibold">
                            {d.label}
                          </label>
                          {day.enabled ? (
                            <div className="ml-auto flex items-center gap-2 sm:ml-0 sm:flex-1">
                              <input
                                type="time"
                                aria-label={`${d.label} opens`}
                                value={day.startTime}
                                onChange={(e) => setTime(d.key, "startTime", e.target.value)}
                                className={cn(fieldCls, "h-11 w-[118px] px-3", day.endTime <= day.startTime && "ring-2 ring-rose-400")}
                              />
                              <span className="text-sm text-[rgb(var(--reg-muted))]">–</span>
                              <input
                                type="time"
                                aria-label={`${d.label} closes`}
                                value={day.endTime}
                                onChange={(e) => setTime(d.key, "endTime", e.target.value)}
                                className={cn(fieldCls, "h-11 w-[118px] px-3", day.endTime <= day.startTime && "ring-2 ring-rose-400")}
                              />
                            </div>
                          ) : (
                            <span className="ml-auto text-sm font-semibold text-[rgb(var(--reg-muted))] sm:ml-0 sm:flex-1">{tr("common.closed")}</span>
                          )}
                          <ActionMenu
                            label={tr("businessHours.copy", { label: d.label })}
                            actions={[
                              { label: tr("businessHours.copyToAllDays"), icon: Copy, onSelect: () => copyTo(d.key, DAYS.filter((x) => x.key !== d.key).map((x) => x.key), tr("businessHours.targetEveryDay")) },
                              { label: tr("businessHours.copyToWeekdays"), icon: Copy, onSelect: () => copyTo(d.key, WEEKDAYS.filter((k) => k !== d.key), tr("businessHours.targetWeekdays")) },
                            ]}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <SectionTitle aside={<Button variant="outline" className={secondaryBtn} onClick={() => { setExc({ ...EMPTY_EXC, startDate: today() }); setExcOpen(true); }}><Plus size={16} />{" "}{tr("businessHours.addClosedDay")}</Button>}>
                  {tr("businessHours.closedDaysSpecialHours")}
                </SectionTitle>
                {exceptions === null ? (
                  <div className="h-24 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" />
                ) : upcoming.length === 0 ? (
                  <div className="flex items-center gap-3 rounded-[20px] bg-white p-5 text-sm text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                    <CalendarOff size={20} className="shrink-0" aria-hidden />
                    {tr("businessHours.holidaysAndShortDaysGo")}
                  </div>
                ) : (
                  <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                    {upcoming.map((x, i) => (
                      <li key={x.id} className={cn("flex items-center gap-3 px-4 py-3.5 md:px-5", i > 0 && "border-t border-[rgb(var(--reg-line)/0.6)]")}>
                        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", x.closed ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800")}>
                          <CalendarOff size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                            {x.startDate === x.endDate ? fmtDay(x.startDate) : `${fmtDay(x.startDate)} – ${fmtDay(x.endDate)}`}
                            {lifecycleOf({ from: x.startDate, to: x.endDate }) === "active" && <StatusChip status="active" label={tr("common.today")} />}
                          </p>
                          <p className="truncate text-sm text-[rgb(var(--reg-muted))]">
                            {x.closed ? tr("common.closed") : tr("businessHours.open", { value: hhmm(x.openTime), value2: hhmm(x.closeTime) })}
                            {x.notes ? ` · ${x.notes}` : ""}
                          </p>
                        </div>
                        <ActionMenu label={tr("common.more")} actions={[{ label: tr("common.remove"), icon: Trash2, danger: true, onSelect: () => void removeException(x) }]} />
                      </li>
                    ))}
                  </ul>
                )}
                {past.length > 0 && <p className="mt-2 text-xs text-[rgb(var(--reg-muted))]">{tr("businessHours.pastHidden", { count: past.length })}</p>}
              </section>
            </div>

            <aside className="min-w-0 lg:sticky lg:top-[132px] lg:self-start">
              <ClientPreview where={tr("common.yourSalonPage")}>
                <div className="rounded-2xl bg-white p-4">
                  <p className="mb-2 text-base font-extrabold">{tr("common.openingHours")}</p>
                  <ul className="space-y-1.5 text-sm">
                    {DAYS.map((d) => {
                      const day = schedule[d.key];
                      const isToday = d.key === todayKey;
                      return (
                        <li key={d.key} className={cn("flex justify-between gap-3", isToday && "font-bold")}>
                          <span>{d.label}</span>
                          <span className={cn("tabular-nums", !day.enabled && "text-[rgb(var(--reg-muted))]")}>
                            {day.enabled ? `${day.startTime} – ${day.endTime}` : tr("common.closed")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </ClientPreview>
            </aside>
          </div>
        </div>

        {/* Phone: the save sits above the floating tab bar once something changed. */}
        {dirty && (
          <div className="sticky bottom-[calc(88px+env(safe-area-inset-bottom))] z-10 px-4 pb-2 md:hidden">
            <Button className={cn(primaryBtn, "w-full")} onClick={handleSave} disabled={saving}>
              {saving ? tr("common.saving") : tr("businessHours.saveHours")}
            </Button>
          </div>
        )}

        <FormSheet
          open={excOpen}
          onOpenChange={setExcOpen}
          title={tr("businessHours.closedDayOrSpecialHours")}
          description={tr("businessHours.forOneDayOrA")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setExcOpen(false)}>{tr("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={excBusy || !exc.startDate} onClick={() => void createException()}>
                {excBusy ? tr("common.saving") : tr("businessHours.add")}
              </Button>
            </>
          }
        >
          <Segmented<"closed" | "special">
            label={tr("businessHours.type")}
            value={exc.closed}
            onChange={(closed) => setExc({ ...exc, closed })}
            options={[
              { value: "closed", label: tr("common.closed"), hint: tr("businessHours.noBookings") },
              { value: "special", label: tr("businessHours.specialHours"), hint: tr("businessHours.openDifferentTimes") },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("common.fromDate")} htmlFor="ex-from">
              <input id="ex-from" type="date" className={fieldCls} value={exc.startDate} min={today()} onChange={(e) => setExc({ ...exc, startDate: e.target.value })} />
            </Field>
            <Field label={tr("businessHours.until")} htmlFor="ex-to" hint={tr("businessHours.emptyOneDay")}>
              <input id="ex-to" type="date" className={fieldCls} value={exc.endDate} min={exc.startDate || today()} onChange={(e) => setExc({ ...exc, endDate: e.target.value })} />
            </Field>
          </div>
          {exc.closed === "special" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("businessHours.opens")} htmlFor="ex-open">
                <input id="ex-open" type="time" className={fieldCls} value={exc.openTime} onChange={(e) => setExc({ ...exc, openTime: e.target.value })} />
              </Field>
              <Field label={tr("businessHours.closes")} htmlFor="ex-close">
                <input id="ex-close" type="time" className={fieldCls} value={exc.closeTime} onChange={(e) => setExc({ ...exc, closeTime: e.target.value })} />
              </Field>
            </div>
          )}
          <Field label={tr("common.noteOptional")} htmlFor="ex-note">
            <input id="ex-note" className={fieldCls} value={exc.notes} maxLength={200} placeholder={tr("businessHours.novruzHoliday")} onChange={(e) => setExc({ ...exc, notes: e.target.value })} />
          </Field>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}
