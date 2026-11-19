import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, Clock, MessageCircle, Phone, Send, Sparkles, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { t as tr } from "@/i18n";
import { waitlistService, type WaitlistEntry } from "@/services/waitlistService";
import {
  WAITLIST_HOLD_MINUTES,
  hhmm,
  isBusy,
  phoneDigits,
  suggestSlots,
  toHHmm,
  toMinutes,
  type BusyRange,
  type SlotSuggestion,
  type WaitingPlacement,
} from "@/lib/waitlistCalendar";

const dashed = "repeating-linear-gradient(135deg, transparent 0 6px, rgb(var(--reg-brand) / 0.08) 6px 7px)";

/** Name shown on a waiting block or pill. */
const waitingName = (w: WaitlistEntry): string => w.clientName || w.clientEmail || tr("common.client");

interface CommonProps {
  entry: WaitlistEntry;
  placement: WaitingPlacement;
  businessId: string;
  dateStr: string;
  durationMin: number;
  /** Masters who do this service (already filtered), for suggestions. */
  masters: { id: string; name: string }[];
  busy: BusyRange[];
  dayStartMin: number;
  dayEndMin: number;
  /** Past times today are never suggested. */
  notBeforeMin?: number;
  /** Opens the new-booking form with this client, master and time filled in. */
  onBook: (entry: WaitlistEntry, staffId: string, startTime: string) => void;
  /** The list changed on the server; reload it. */
  onChanged: () => void;
}

/** The dashed "waiting" block drawn inside a master's column. Not a booking, never counted as busy. */
export function WaitingBlock({ height, freed, ...rest }: CommonProps & { height: number; freed: boolean }) {
  const { entry, placement } = rest;
  const compact = height < 44;
  return (
    <WaitlistPopover {...rest}>
      <button
        type="button"
        data-waiting-block="true"
        aria-label={`${tr("waitlistCal.waiting")}: ${waitingName(entry)}${entry.serviceName ? `, ${entry.serviceName}` : ""}`}
        className={`group flex h-full w-full flex-col overflow-hidden rounded-[10px] border-[1.5px] border-dashed px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand))] ${
          freed
            ? "border-emerald-600 bg-emerald-50 motion-safe:animate-pulse"
            : "border-[rgb(var(--reg-brand)/0.65)] bg-[rgb(var(--reg-brand-soft)/0.55)] hover:bg-[rgb(var(--reg-brand-soft))]"
        }`}
        style={{ backgroundImage: freed ? undefined : dashed }}
      >
        <span className={`flex items-center gap-1 text-[11px] font-bold leading-tight ${freed ? "text-emerald-800" : "text-[rgb(var(--reg-brand-strong))]"}`}>
          {freed ? <Sparkles size={12} aria-hidden /> : <Clock size={12} aria-hidden />}
          <span className="truncate">{freed ? tr("waitlistCal.opened") : tr("waitlistCal.waiting")}</span>
          {entry.status === "NOTIFIED" && !freed && (
            <span className="ml-auto shrink-0 rounded-full bg-white/80 px-1.5 text-[9px] font-semibold text-[rgb(var(--reg-muted))]">
              {tr("waitlistCal.told")}
            </span>
          )}
        </span>
        <span className="truncate text-[12px] font-semibold leading-tight text-[rgb(var(--reg-ink))]">{waitingName(entry)}</span>
        {!compact && entry.serviceName && (
          <span className="truncate text-[11px] leading-tight text-[rgb(var(--reg-muted))]">{entry.serviceName}</span>
        )}
        {!compact && placement.start && placement.end && (
          <span className="mt-auto text-[10px] tabular-nums text-[rgb(var(--reg-muted))]">
            {placement.start}–{placement.end}
          </span>
        )}
      </button>
    </WaitlistPopover>
  );
}

/** Slim chip for waiters with no drawn time (any master, or date only). Sits in a strip, not a column. */
export function WaitingPill({ freed, ...rest }: CommonProps & { freed: boolean }) {
  const { entry } = rest;
  return (
    <WaitlistPopover {...rest}>
      <button
        type="button"
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-dashed px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand))] ${
          freed
            ? "border-emerald-600 bg-emerald-50 text-emerald-800 motion-safe:animate-pulse"
            : "border-[rgb(var(--reg-brand)/0.6)] bg-white text-[rgb(var(--reg-brand-strong))] hover:bg-[rgb(var(--reg-brand-soft)/0.6)]"
        }`}
      >
        {freed ? <Sparkles size={13} aria-hidden /> : <Clock size={13} aria-hidden />}
        <span className="max-w-[140px] truncate">{waitingName(entry)}</span>
        <span className="max-w-[120px] truncate font-normal text-[rgb(var(--reg-muted))]">
          {entry.staffName ? tr("waitlistCal.withMaster", { name: entry.staffName }) : tr("waitlistCal.anyMaster")}
        </span>
      </button>
    </WaitlistPopover>
  );
}

type View = "main" | "pick" | "offer";

function WaitlistPopover({ children, ...p }: CommonProps & { children: ReactNode }) {
  const { entry, placement, businessId } = p;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const [autoNotify, setAutoNotify] = useState(entry.autoNotify !== false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState(false);

  const staffId = placement.staffId ?? (entry.staffId ? String(entry.staffId) : null);
  const wantedStart = placement.start;
  const phone = phoneDigits(entry.clientPhone);
  const freedTime = hhmm(entry.freedStartTime);

  const wantedIsBusy = useMemo(
    () => (staffId && wantedStart ? isBusy(p.busy, staffId, wantedStart, toHHmm(toMinutes(wantedStart) + p.durationMin)) : false),
    [staffId, wantedStart, p.busy, p.durationMin],
  );

  const suggestions = useMemo(
    () =>
      suggestSlots({
        masters: p.masters,
        preferredStaffId: staffId,
        busy: p.busy,
        dayStartMin: p.dayStartMin,
        dayEndMin: p.dayEndMin,
        durationMin: p.durationMin,
        anchorMin: wantedStart ? toMinutes(wantedStart) : p.dayStartMin,
        notBeforeMin: p.notBeforeMin,
      }),
    [p.masters, staffId, p.busy, p.dayStartMin, p.dayEndMin, p.durationMin, wantedStart, p.notBeforeMin],
  );
  const staffName = (id: string | null) => p.masters.find((m) => m.id === id)?.name ?? entry.staffName ?? "";
  const all: SlotSuggestion[] = [...suggestions.same, ...suggestions.others];
  const keyOf = (s: SlotSuggestion) => `${s.staffId}@${s.time}`;

  const close = () => {
    setOpen(false);
    setView("main");
    setChosen([]);
  };
  const book = (sid: string, time: string) => {
    close();
    p.onBook(entry, sid, time);
  };

  const startBooking = () => {
    if (staffId && wantedStart && !wantedIsBusy) return book(staffId, wantedStart);
    setView("pick");
  };

  const toggleAuto = async (on: boolean) => {
    setAutoNotify(on);
    try {
      await waitlistService.setAutoNotify(businessId, entry.id, on);
      p.onChanged();
    } catch {
      setAutoNotify(!on);
      toast.error(tr("waitlistCal.saveFailed"));
    }
  };

  const remove = async () => {
    setBusyAction(true);
    try {
      await waitlistService.remove(businessId, entry.id);
      toast.success(tr("waitlistCal.removed"));
      close();
      p.onChanged();
    } catch {
      toast.error(tr("waitlistCal.removeFailed"));
    } finally {
      setBusyAction(false);
    }
  };

  const sendOffer = async () => {
    const slots = all.filter((s) => chosen.includes(keyOf(s))).map((s) => ({ staffId: s.staffId, date: p.dateStr, startTime: s.time }));
    if (slots.length === 0) return;
    setBusyAction(true);
    try {
      await waitlistService.offer(businessId, entry.id, slots);
      toast.success(tr("waitlistCal.offerSent"));
      close();
      p.onChanged();
    } catch {
      toast.error(tr("waitlistCal.offerFailed"));
    } finally {
      setBusyAction(false);
    }
  };

  const chip = (s: SlotSuggestion, onClick: () => void, selected = false) => (
    <button
      key={keyOf(s)}
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand))] ${
        selected
          ? "border-[rgb(var(--reg-brand))] bg-[rgb(var(--reg-brand))] text-white"
          : "border-[rgb(var(--reg-line))] bg-white hover:border-[rgb(var(--reg-brand)/0.5)]"
      }`}
    >
      <span className="tabular-nums">{s.time}</span>
      <span className={`text-xs font-normal ${selected ? "text-white/85" : "text-[rgb(var(--reg-muted))]"}`}>{s.staffName}</span>
    </button>
  );

  const suggestionLists = (onPick: (s: SlotSuggestion) => void, isSelected: (s: SlotSuggestion) => boolean) => (
    <div className="space-y-3">
      {suggestions.same.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-[rgb(var(--reg-muted))]">
            {tr("waitlistCal.nearestSame", { name: staffName(staffId) })}
          </p>
          <div className="flex flex-wrap gap-1.5">{suggestions.same.map((s) => chip(s, () => onPick(s), isSelected(s)))}</div>
        </div>
      )}
      {suggestions.others.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-[rgb(var(--reg-muted))]">{tr("waitlistCal.nearestOthers")}</p>
          <div className="flex flex-wrap gap-1.5">{suggestions.others.map((s) => chip(s, () => onPick(s), isSelected(s)))}</div>
        </div>
      )}
      {all.length === 0 && <p className="text-sm text-[rgb(var(--reg-muted))]">{tr("waitlistCal.noFree")}</p>}
    </div>
  );

  const backBtn = (
    <button
      type="button"
      onClick={() => setView("main")}
      className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]"
    >
      <ArrowLeft size={14} aria-hidden /> {tr("waitlistCal.back")}
    </button>
  );

  const actionBtn =
    "flex h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand))] disabled:opacity-60";

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] rounded-2xl p-4" onOpenAutoFocus={(e) => e.preventDefault()}>
        {view === "main" && (
          <div className="space-y-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[rgb(var(--reg-brand-strong))]">
                <Clock size={13} aria-hidden /> {tr("waitlistCal.waiting")}
              </p>
              <p className="mt-1 text-base font-bold leading-snug">{waitingName(entry)}</p>
              <p className="text-sm text-[rgb(var(--reg-muted))]">
                {[
                  entry.serviceName || tr("calendar.anyService"),
                  entry.staffName ? tr("waitlistCal.withMaster", { name: entry.staffName }) : tr("waitlistCal.anyMaster"),
                  entry.preferredStartTime && entry.preferredEndTime
                    ? tr("waitlistCal.window", { from: hhmm(entry.preferredStartTime), to: hhmm(entry.preferredEndTime) })
                    : tr("waitlistCal.anyTime"),
                ].join(" · ")}
              </p>
            </div>

            {placement.freed && (
              <div role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                <Sparkles size={16} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  <strong>{tr("waitlistCal.opened")}</strong>
                  {freedTime ? ` · ${tr("waitlistCal.freedAt", { time: freedTime })}` : ""}
                  {entry.holdUntil ? ` · ${tr("waitlistCal.heldUntil", { time: new Date(entry.holdUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}` : ""}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              {phone ? (
                <>
                  <a href={`tel:+${phone}`} className={`${actionBtn} border border-[rgb(var(--reg-line))] bg-white hover:bg-[rgb(var(--reg-canvas))]`}>
                    <Phone size={15} aria-hidden /> {tr("waitlistCal.call")}
                  </a>
                  <a
                    href={`https://wa.me/${phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${actionBtn} border border-[rgb(var(--reg-line))] bg-white hover:bg-[rgb(var(--reg-canvas))]`}
                  >
                    <MessageCircle size={15} aria-hidden /> {tr("waitlistCal.whatsapp")}
                  </a>
                </>
              ) : (
                <p className="text-sm text-[rgb(var(--reg-muted))]">{tr("waitlistCal.noPhone")}</p>
              )}
            </div>
            {entry.clientPhone && <p className="-mt-1 text-xs tabular-nums text-[rgb(var(--reg-muted))]">{entry.clientPhone}</p>}

            <button
              type="button"
              onClick={startBooking}
              className={`${actionBtn} bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] text-white hover:brightness-110`}
            >
              <UserPlus size={16} aria-hidden /> {tr("waitlistCal.book")}
            </button>
            <button
              type="button"
              onClick={() => setView("offer")}
              className={`${actionBtn} border border-[rgb(var(--reg-brand)/0.5)] bg-white text-[rgb(var(--reg-brand-strong))] hover:bg-[rgb(var(--reg-brand-soft)/0.5)]`}
            >
              <Send size={15} aria-hidden /> {tr("waitlistCal.offer")}
            </button>

            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl bg-[rgb(var(--reg-canvas))] px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{tr("waitlistCal.autoNotify")}</span>
                <span className="block text-xs leading-snug text-[rgb(var(--reg-muted))]">
                  {autoNotify ? tr("waitlistCal.autoOnHint", { minutes: WAITLIST_HOLD_MINUTES }) : tr("waitlistCal.autoOffHint")}
                </span>
              </span>
              <Switch checked={autoNotify} onCheckedChange={toggleAuto} aria-label={tr("waitlistCal.autoNotify")} />
            </label>

            <button
              type="button"
              onClick={remove}
              disabled={busyAction}
              className="flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              <Trash2 size={14} aria-hidden /> {tr("waitlistCal.cancel")}
            </button>
          </div>
        )}

        {view === "pick" && (
          <div>
            {backBtn}
            {wantedIsBusy && staffId && wantedStart && (
              <div role="alert" className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  <strong>{tr("waitlistCal.slotBusy")}</strong>
                  <br />
                  {tr("waitlistCal.slotBusyHint", { name: staffName(staffId), time: wantedStart })}
                </span>
              </div>
            )}
            {suggestionLists((s) => book(s.staffId, s.time), () => false)}
            {wantedIsBusy && staffId && wantedStart && (
              <div className="mt-3 border-t pt-3">
                <p className="mb-2 text-xs text-amber-800">{tr("waitlistCal.overlapWarning")}</p>
                <button
                  type="button"
                  onClick={() => book(staffId, wantedStart)}
                  className={`${actionBtn} border border-amber-400 bg-white text-amber-900 hover:bg-amber-50`}
                >
                  {tr("waitlistCal.bookAnyway")}
                </button>
              </div>
            )}
          </div>
        )}

        {view === "offer" && (
          <div>
            {backBtn}
            <p className="mb-3 text-sm font-semibold">{tr("waitlistCal.offerPick")}</p>
            {suggestionLists(
              (s) =>
                setChosen((c) => (c.includes(keyOf(s)) ? c.filter((x) => x !== keyOf(s)) : c.length < 3 ? [...c, keyOf(s)] : c)),
              (s) => chosen.includes(keyOf(s)),
            )}
            <button
              type="button"
              onClick={sendOffer}
              disabled={chosen.length === 0 || busyAction}
              className={`${actionBtn} mt-4 bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] text-white hover:brightness-110`}
            >
              <Send size={15} aria-hidden /> {tr("waitlistCal.offerSend")}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
