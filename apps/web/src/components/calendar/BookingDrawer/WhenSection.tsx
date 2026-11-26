import { addDays, parse } from "date-fns";
import { format } from "@/i18n/dateFns";
import { Field, FormGrid } from "@/components/bz";
import { t as tr } from "@/i18n";
import type { BookingDrawerProps } from "./types";

type DateP = Pick<BookingDrawerProps, "form" | "setForm" | "setCurrentDate" | "salonNow" | "salonToday" | "getBusinessHoursForDate">;

/** Date: 21 days as three week strips (`.dstrip` look) + "other date" field. Picking syncs the viewed day. */
export function DateSection({ form, setForm, setCurrentDate, salonNow, salonToday, getBusinessHoursForDate }: DateP) {
  const pick = (v: string) => {
    setForm((prev) => ({ ...prev, date: v }));
    const parsed = parse(v, "yyyy-MM-dd", new Date());
    if (!isNaN(parsed.getTime())) setCurrentDate(parsed);
  };
  const days = Array.from({ length: 21 }, (_, i) => addDays(salonNow(), i));
  return (
    <section className="bkd-sec">
      <div className="bkd-k">{tr("calendar.date2")}</div>
      <div className="bkd-days" role="radiogroup" aria-label={tr("calendar.date2")}>
        {days.map((d) => {
          const v = format(d, "yyyy-MM-dd");
          const on = form.date === v;
          const open = getBusinessHoursForDate(d).isEnabled;
          return (
            <button key={v} type="button" role="radio" aria-checked={on} onClick={() => pick(v)} className={`${on ? "on" : ""} ${open ? "" : "off"}`}>
              <span>{salonToday(d) ? tr("common.today") : format(d, "EEE")}</span>
              <b>{format(d, "d")}</b>
              <span>{format(d, "MMM")}</span>
            </button>
          );
        })}
      </div>
      <Field label={tr("calendar.otherDate")}>
        <input
          type="date"
          value={form.date}
          min={format(salonNow(), "yyyy-MM-dd")}
          onChange={(e) => {
            if (e.target.value) pick(e.target.value);
          }}
          aria-label={tr("calendar.date2")}
        />
      </Field>
    </section>
  );
}

type RepP = Pick<
  BookingDrawerProps,
  "editing" | "selectedPackage" | "bookingMode" | "setBookingMode" | "recurrence" | "setRecurrence" | "recurrenceDates" | "seriesPreview" | "describeConflict"
>;

/** Repeat toggle (new, non-package bookings) + recurrence config with per-date conflict preview. */
export function RepeatSection({ editing, selectedPackage, bookingMode, setBookingMode, recurrence, setRecurrence, recurrenceDates, seriesPreview, describeConflict }: RepP) {
  return (
    <>
      {!editing && !selectedPackage && (
        <label className="bkd-rep" htmlFor="repeat-booking">
          <input id="repeat-booking" type="checkbox" data-testid="repeat-toggle" checked={bookingMode === "recurring"} onChange={(e) => setBookingMode(e.target.checked ? "recurring" : "single")} />
          {tr("calendar.series.repeatBooking")}
        </label>
      )}
      {bookingMode === "recurring" && (
        <div className="bkd-box" data-testid="recurrence-config">
          <div className="bkd-k">{tr("calendar.repeat")}</div>
          <FormGrid cols={2}>
            <Field label={tr("calendar.frequency")} kind="sel">
              <select
                data-testid="recurrence-pattern"
                value={recurrence.frequency === "MONTHLY" ? "MONTHLY" : recurrence.interval === 2 ? "BIWEEKLY" : "WEEKLY"}
                onChange={(e) => {
                  const v = e.target.value;
                  setRecurrence((prev) => ({ ...prev, frequency: v === "MONTHLY" ? "MONTHLY" : "WEEKLY", interval: v === "BIWEEKLY" ? 2 : 1 }));
                }}
              >
                <option value="WEEKLY">{tr("calendar.weekly")}</option>
                <option value="BIWEEKLY">{tr("calendar.series.biweekly")}</option>
                <option value="MONTHLY">{tr("calendar.monthly")}</option>
              </select>
            </Field>
            <Field label={tr("calendar.occurrences")}>
              <input
                type="number"
                min={2}
                max={52}
                value={recurrence.count}
                data-testid="recurrence-count"
                onChange={(e) => setRecurrence((prev) => ({ ...prev, count: Math.max(2, Math.min(52, parseInt(e.target.value) || 2)) }))}
              />
            </Field>
          </FormGrid>
          <ul className="bkd-ul" data-testid="recurrence-dates">
            {recurrenceDates.map((d) => {
              const row = seriesPreview?.find((r) => r.date === d);
              const bad = !!row && row.conflicts.length > 0;
              return (
                <li key={d} className={bad ? "bad" : ""}>
                  <b>{d}</b>
                  {bad ? ` · ${row!.conflicts.map(describeConflict).join("; ")}` : row ? " ✓" : ""}
                </li>
              );
            })}
          </ul>
          {seriesPreview?.some((r) => r.conflicts.length > 0) && (
            <div className="bkd-note" data-testid="recurrence-conflicts">
              {tr("calendar.series.conflictsHint")}
            </div>
          )}
        </div>
      )}
    </>
  );
}

type TimeP = Pick<BookingDrawerProps, "form" | "setForm" | "editing" | "currentDate" | "salonNow" | "salonToday" | "getBusinessHoursForDate" | "timeOptionsWith">;

/** Start time as a slot grid inside the day's hours (no past times today) + end-time select. */
export function TimeSection({ form, setForm, editing, currentDate, salonNow, salonToday, getBusinessHoursForDate, timeOptionsWith }: TimeP) {
  const day = parse(form.date || format(currentDate, "yyyy-MM-dd"), "yyyy-MM-dd", new Date());
  const { startHour, endHour, isEnabled } = getBusinessHoursForDate(isNaN(day.getTime()) ? currentDate : day);
  const lo = isEnabled ? startHour : 8;
  const hi = isEnabled ? endHour : 20;
  // Today, a new booking cannot start in the past (the API refuses it), so those times are not offered.
  const nowHm = !editing && salonToday(day) ? format(salonNow(), "HH:mm") : null;
  const slots = timeOptionsWith(form.startTime).filter((t) => {
    const h = parseInt(t.slice(0, 2), 10);
    if (nowHm && t < nowHm && t !== form.startTime) return false;
    return (h >= lo && h < hi) || t === form.startTime;
  });
  return (
    <section className="bkd-sec">
      <div className="bkd-k">{tr("calendar.time2")}</div>
      {!isEnabled && <div className="bkd-note">{tr("calendar.closedThisDayYouCan")}</div>}
      <div className="bkd-slots" role="radiogroup" aria-label={tr("calendar.startTime")}>
        {slots.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={form.startTime === t} onClick={() => setForm((prev) => ({ ...prev, startTime: t }))} className={`slot${form.startTime === t ? " on" : ""}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="bkd-end">
        <Field label={tr("common.ends")} kind="sel">
          <select aria-label={tr("calendar.endTime")} value={form.endTime} onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}>
            {!form.endTime && <option value="" disabled>{tr("calendar.endTime")}</option>}
            {timeOptionsWith(form.endTime).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        {form.serviceId && form.startTime && <span className="sm t-m b7">{tr("calendar.fromTheServiceLength")}</span>}
      </div>
    </section>
  );
}
