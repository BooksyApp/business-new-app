import { useEffect, useMemo, useState } from "react";
import { salonToday } from "@/lib/salonClock";
import { useSalonTimeZone } from "@/hooks/useSalonTimeZone";
import { CalendarOff, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Btn, Card, Dialog, Field, FormGrid, SegPills, Skeleton, PageHead, Tag } from "@/components/bz";
import { BzPage } from "@/components/bz/p2-page";
import { ActionMenu } from "@/components/page/kit";
import { lifecycleOf } from "@/components/page/kitStyles";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { useBusinessId } from "@/hooks/useBusinessId";
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
  
  const excDialog = excOpen ? (
    <Dialog
      title={tr("businessHours.closedDayOrSpecialHours")}
      sub={tr("businessHours.forOneDayOrA")}
      onClose={() => setExcOpen(false)}
      footer={
        <>
          <Btn kind="ol" onClick={() => setExcOpen(false)}>{tr("common.cancel")}</Btn>
          <Btn kind="v" disabled={excBusy || !exc.startDate} onClick={() => void createException()}>
            {excBusy ? tr("common.saving") : tr("businessHours.add")}
          </Btn>
        </>
      }
    >
      <SegPills
        wide
        items={[
          { key: "closed", label: `${tr("common.closed")} · ${tr("businessHours.noBookings")}` },
          { key: "special", label: `${tr("businessHours.specialHours")} · ${tr("businessHours.openDifferentTimes")}` },
        ]}
        value={exc.closed}
        onChange={(closed) => setExc({ ...exc, closed: closed as "closed" | "special" })}
      />
      <FormGrid cols={2}>
        <Field label={tr("common.fromDate")}>
          <input id="ex-from" type="date" value={exc.startDate} min={today()} onChange={(e) => setExc({ ...exc, startDate: e.target.value })} />
        </Field>
        <Field label={tr("businessHours.until")} hint={tr("businessHours.emptyOneDay")}>
          <input id="ex-to" type="date" value={exc.endDate} min={exc.startDate || today()} onChange={(e) => setExc({ ...exc, endDate: e.target.value })} />
        </Field>
      </FormGrid>
      {exc.closed === "special" && (
        <FormGrid cols={2}>
          <Field label={tr("businessHours.opens")}>
            <input id="ex-open" type="time" value={exc.openTime} onChange={(e) => setExc({ ...exc, openTime: e.target.value })} />
          </Field>
          <Field label={tr("businessHours.closes")}>
            <input id="ex-close" type="time" value={exc.closeTime} onChange={(e) => setExc({ ...exc, closeTime: e.target.value })} />
          </Field>
        </FormGrid>
      )}
      <Field label={tr("common.noteOptional")}>
        <input id="ex-note" value={exc.notes} maxLength={200} placeholder={tr("businessHours.novruzHoliday")} onChange={(e) => setExc({ ...exc, notes: e.target.value })} />
      </Field>
    </Dialog>
  ) : undefined;

  return (
    <BzPage overlay={excDialog}>
      <PageHead
        title={tr("common.openingHours")}
        sub={tr("businessHours.whenClientsCanBookYou")}
        right={
          <Btn kind="v" onClick={handleSave} disabled={saving || loading || !dirty}>
            {saving ? tr("common.saving") : dirty ? tr("businessHours.saveHours") : tr("common.saved")}
          </Btn>
        }
      />

      <Card title={tr("businessHours.weeklyHours")}>
        <div className="row gap8" style={{ marginBottom: 8 }}>
          <Btn kind="ol" icon={<Copy className="ic" />} onClick={() => copyTo("MONDAY", WEEKDAYS.slice(1), tr("businessHours.targetTueFri"))}>{tr("businessHours.monWeekdays")}</Btn>
          <Btn kind="ol" icon={<Copy className="ic" />} onClick={() => copyTo("MONDAY", DAYS.slice(1).map((d) => d.key), tr("businessHours.targetEveryDay"))}>{tr("businessHours.monAll")}</Btn>
        </div>
        {loading ? (
          <Skeleton />
        ) : (
          <div>
            {DAYS.map((d) => {
              const day = schedule[d.key];
              const bad = day.endTime <= day.startTime;
              return (
                <div key={d.key} className="hrw">
                  <b>{d.label}</b>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={day.enabled}
                    aria-label={d.label}
                    id={`toggle-${d.key}`}
                    className={day.enabled ? "tg" : "tg off"}
                    style={{ border: 0, padding: 0 }}
                    onClick={() => toggle(d.key)}
                  />
                  {day.enabled ? (
                    <>
                      <Field label={tr("businessHours.opens")}>
                        <input type="time" aria-label={`${d.label} ${tr("businessHours.opens")}`} value={day.startTime} onChange={(e) => setTime(d.key, "startTime", e.target.value)} />
                      </Field>
                      <Field label={tr("businessHours.closes")}>
                        <input type="time" aria-label={`${d.label} ${tr("businessHours.closes")}`} value={day.endTime} onChange={(e) => setTime(d.key, "endTime", e.target.value)} style={bad ? { color: "var(--bz-gink)" } : undefined} />
                      </Field>
                    </>
                  ) : (
                    <>
                      <div className="cl">{tr("common.closed")}</div>
                      <div />
                    </>
                  )}
                  <ActionMenu
                    label={tr("businessHours.copy", { label: d.label })}
                    actions={[
                      { label: tr("businessHours.copyToAllDays"), icon: Copy, onSelect: () => copyTo(d.key, DAYS.filter((x) => x.key !== d.key).map((x) => x.key), tr("businessHours.targetEveryDay")) },
                      { label: tr("businessHours.copyToWeekdays"), icon: Copy, onSelect: () => copyTo(d.key, WEEKDAYS.filter((k) => k !== d.key), tr("businessHours.targetWeekdays")) },
                    ]}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div className="row sp">
          <div>
            <h6>{tr("businessHours.closedDaysSpecialHours")}</h6>
            <p>{tr("businessHours.holidaysAndShortDaysGo")}</p>
          </div>
          <Btn kind="v" icon={<Plus className="ic" />} onClick={() => { setExc({ ...EMPTY_EXC, startDate: today() }); setExcOpen(true); }}>{tr("businessHours.addClosedDay")}</Btn>
        </div>
        {exceptions === null ? (
          <Skeleton lines={[90, 70]} />
        ) : (
          upcoming.map((x) => (
            <div key={x.id} className="lr">
              <span className="mn" style={{ background: "var(--bz-vsoft)", color: "var(--bz-vtext)" }}>
                <CalendarOff className="ic" />
              </span>
              <div className="tx">
                <b>{x.startDate === x.endDate ? fmtDay(x.startDate) : `${fmtDay(x.startDate)} – ${fmtDay(x.endDate)}`}</b>
                <span>
                  {x.closed ? tr("common.closed") : tr("businessHours.open", { value: hhmm(x.openTime), value2: hhmm(x.closeTime) })}
                  {x.notes ? ` · ${x.notes}` : ""}
                </span>
              </div>
              {lifecycleOf({ from: x.startDate, to: x.endDate }) === "active" ? <Tag kind="v">{tr("common.today")}</Tag> : <span className="tag2" />}
              <span className="acts">
                <Btn kind="dg" icon={<Trash2 className="ic" />} onClick={() => void removeException(x)}>{tr("common.remove")}</Btn>
              </span>
            </div>
          ))
        )}
        {exceptions !== null && upcoming.length === 0 && <span className="hint">{tr("businessHours.holidaysAndShortDaysGo")}</span>}
        {past.length > 0 && <span className="hint">{tr("businessHours.pastHidden", { count: past.length })}</span>}
      </Card>
    </BzPage>
  );
}
