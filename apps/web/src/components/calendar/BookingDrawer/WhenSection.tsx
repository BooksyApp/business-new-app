import { useState } from "react";
import { addDays, parse } from "date-fns";
import { format } from "@/i18n/dateFns";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { t as tr } from "@/i18n";
import { AF, Sec } from "./AF";
import type { BookingDrawerProps } from "./types";

type DateP = Pick<BookingDrawerProps, "form" | "setForm" | "setCurrentDate" | "salonNow" | "salonToday" | "getBusinessHoursForDate">;

/** 2 Tarix: day chips (today + 5 days) and "other date" (reveals a date field). Picking syncs the viewed day. */
export function DateSection({ form, setForm, setCurrentDate, salonNow, salonToday }: DateP) {
  const pick = (v: string) => {
    setForm((prev) => ({ ...prev, date: v }));
    const parsed = parse(v, "yyyy-MM-dd", new Date());
    if (!isNaN(parsed.getTime())) setCurrentDate(parsed);
  };
  const days = Array.from({ length: 6 }, (_, i) => addDays(salonNow(), i));
  const inChips = days.some((d) => format(d, "yyyy-MM-dd") === form.date);
  const [otherOpen, setOtherOpen] = useState(false);
  const showOther = otherOpen || (!!form.date && !inChips);
  return (
    <>
      <Sec n={2}>{tr("calendar.date2")}</Sec>
      <div className="a-chips" role="radiogroup" aria-label={tr("calendar.date2")}>
        {days.map((d) => {
          const v = format(d, "yyyy-MM-dd");
          const on = form.date === v;
          return (
            <button key={v} type="button" role="radio" aria-checked={on} onClick={() => { setOtherOpen(false); pick(v); }} className={cn("chip", on && !showOther && "vo")}>
              {salonToday(d) ? tr("common.today") : format(d, "EEE")}
            </button>
          );
        })}
        <button type="button" role="radio" aria-checked={showOther} onClick={() => setOtherOpen(true)} className={cn("chip", showOther && "vo")}>
          {tr("calendar.otherDate")}
        </button>
      </div>
      {showOther && (
        <AF label={tr("calendar.otherDate")}>
          <input
            type="date"
            value={form.date}
            min={format(salonNow(), "yyyy-MM-dd")}
            onChange={(e) => {
              if (e.target.value) pick(e.target.value);
            }}
            aria-label={tr("calendar.date2")}
          />
        </AF>
      )}
    </>
  );
}

type RepP = Pick<
  BookingDrawerProps,
  "editing" | "selectedPackage" | "bookingMode" | "setBookingMode" | "recurrence" | "setRecurrence" | "recurrenceDates" | "seriesPreview" | "describeConflict"
>;

/** Repeat checkbox row (`.a-ck`, new non-package bookings) + recurrence config (`.a-rep`) with per-date conflict preview. */
export function RepeatSection({ editing, selectedPackage, bookingMode, setBookingMode, recurrence, setRecurrence, recurrenceDates, seriesPreview, describeConflict }: RepP) {
  const on = bookingMode === "recurring";
  const toggle = () => setBookingMode(on ? "single" : "recurring");
  return (
    <>
      {!editing && !selectedPackage && (
        <div
          className="a-ck"
          role="checkbox"
          tabIndex={0}
          aria-checked={on}
          data-testid="repeat-toggle"
          style={{ cursor: "pointer" }}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              toggle();
            }
          }}
        >
          <span className={on ? "bx on" : "bx"}>{on ? <Check className="ic" aria-hidden /> : null}</span>
          <div>
            <b>{tr("calendar.series.repeatBooking")}</b>
          </div>
        </div>
      )}
      {on && (
        <div className="a-rep" data-testid="recurrence-config">
          <div className="hd">{tr("calendar.repeat")}</div>
          <div className="a-g2">
            <AF label={tr("calendar.frequency")}>
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
            </AF>
            <AF label={tr("calendar.occurrences")}>
              <input
                type="number"
                min={2}
                max={52}
                value={recurrence.count}
                data-testid="recurrence-count"
                onChange={(e) => setRecurrence((prev) => ({ ...prev, count: Math.max(2, Math.min(52, parseInt(e.target.value) || 2)) }))}
              />
            </AF>
          </div>
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

/** 5 Vaxt: start time as a 4-column slot grid inside the day's hours (no past times today) + end-time field. */
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
    <>
      <Sec n={5}>{tr("calendar.time2")}</Sec>
      {!isEnabled && <div className="bkd-note">{tr("calendar.closedThisDayYouCan")}</div>}
      <div className="a-note" style={{ fontWeight: 700, color: "var(--bz-ink)" }}>{tr("calendar.startTime")}</div>
      <div className="a-g4" role="radiogroup" aria-label={tr("calendar.startTime")} style={{ maxHeight: 208, overflowY: "auto" }}>
        {slots.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={form.startTime === t} onClick={() => setForm((prev) => ({ ...prev, startTime: t }))} className={`slot ${form.startTime === t ? "on" : "ln"}`} style={{ justifyContent: "center", border: 0, font: "inherit", cursor: "pointer" }}>
            {t}
          </button>
        ))}
      </div>
      <AF label={tr("calendar.endTime")} icon={<Clock className="ic" aria-hidden />} hint={form.serviceId && form.startTime ? tr("calendar.fromTheServiceLength") : undefined}>
        <select aria-label={tr("calendar.endTime")} value={form.endTime} onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}>
          {!form.endTime && <option value="" disabled>{tr("calendar.endTime")}</option>}
          {timeOptionsWith(form.endTime).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </AF>
    </>
  );
}
