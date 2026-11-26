import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "@/i18n/dateFns";
import { t } from "@/i18n";
import { setBookingConflictConfirmer, type BookingConflict } from "@/services/appointmentService";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

/** "SATURDAY" -> "Saturday" / "Şənbə" / "суббота", in the panel's language. */
function weekday(day: unknown): string {
  const i = DAYS.indexOf(String(day).toUpperCase());
  return i < 0 ? String(day ?? "") : format(new Date(2024, 0, 1 + i), "EEEE");
}

/** One conflict as a plain sentence in the panel's language (the server's English `detail` is the fallback). */
export function describeConflict(c: BookingConflict): string {
  const p = c.params ?? {};
  const staff = String(p.staff || "") || t("bookingConflict.thisTeamMember");
  const start = String(p.start ?? "");
  const client = String(p.client ?? "");
  const time = String(p.time ?? "");
  switch (c.type) {
    case "CLOSED_DAY": return t("bookingConflict.closedDay", { day: weekday(p.day) });
    case "OUTSIDE_HOURS":
      return p.side === "BEFORE_OPEN" ? t("bookingConflict.outsideBefore", { time }) : t("bookingConflict.outsideAfter", { time });
    case "STAFF_NOT_WORKING": return t("bookingConflict.staffNotWorking", { staff, day: weekday(p.day) });
    case "STAFF_OUTSIDE_SHIFT":
      return p.side === "BEFORE_START" ? t("bookingConflict.staffBefore", { staff, time }) : t("bookingConflict.staffAfter", { staff, time });
    case "STAFF_TIME_OFF": return t("bookingConflict.staffTimeOff", { staff });
    case "DOUBLE_BOOKING": return t("bookingConflict.doubleBooking", { start, client }).trim();
    case "BUFFER_CONFLICT": return t("bookingConflict.buffer", { start, client }).trim();
    case "MIN_LEAD_TIME": return t("bookingConflict.minLead", { minutes: String(p.minutes ?? "") });
    case "MAX_ADVANCE": return t("bookingConflict.maxAdvance", { days: String(p.days ?? "") });
    case "STAFF_NOT_ASSIGNED": return t("bookingConflict.notAssigned", { staff });
    default: return c.detail;
  }
}

interface Pending {
  conflicts: BookingConflict[];
  canOverride: boolean;
  resolve: (r: { reason?: string } | null) => void;
}

/**
 * Mounted once: every booking save in the panel that comes back with schedule conflicts
 * lands here. A person with the "book despite conflicts" permission can confirm (optionally
 * saying why); everyone else is told a manager has to do it.
 */
export function BookingConflictDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const current = useRef<Pending | null>(null);

  useEffect(() => {
    setBookingConflictConfirmer((c) => new Promise((resolve) => {
      setReason("");
      const next = { ...c, resolve };
      current.current = next;
      setPending(next);
    }));
    return () => setBookingConflictConfirmer(null);
  }, []);

  const finish = (answer: { reason?: string } | null) => {
    current.current?.resolve(answer);
    current.current = null;
    setPending(null);
  };

  return (
    <Dialog open={!!pending} onOpenChange={(open) => { if (!open) finish(null); }}>
      <DialogContent className="max-w-md rounded-2xl" data-testid="booking-conflict-dialog">
        {pending && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-8 w-8 rounded-full bg-amber-100 p-1.5 text-amber-700" aria-hidden />
                {pending.canOverride ? t("bookingConflict.title") : t("bookingConflict.needManagerTitle")}
              </DialogTitle>
              <DialogDescription>
                {pending.canOverride ? t("bookingConflict.intro") : t("bookingConflict.needManagerBody")}
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-1.5 rounded-xl border border-amber-200/70 bg-amber-50 p-3.5 text-sm text-amber-950">
              {pending.conflicts.map((c, i) => (
                <li key={`${c.type}-${i}`} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                  <span>{describeConflict(c)}</span>
                </li>
              ))}
            </ul>
            {pending.canOverride && (
              <div className="space-y-1.5">
                <label htmlFor="override-reason" className="text-sm font-medium">{t("bookingConflict.reasonLabel")}</label>
                <Textarea
                  id="override-reason"
                  value={reason}
                  maxLength={500}
                  rows={2}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("bookingConflict.reasonPlaceholder")}
                />
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => finish(null)}>
                {pending.canOverride ? t("bookingConflict.back") : t("bookingConflict.close")}
              </Button>
              {pending.canOverride && (
                <Button
                  variant="brand"
                  className="rounded-full"
                  data-testid="booking-conflict-confirm"
                  onClick={() => finish({ reason: reason.trim() || undefined })}
                >
                  {t("bookingConflict.confirm")}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
