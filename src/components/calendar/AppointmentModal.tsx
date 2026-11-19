import type { Id } from "@/types/id";
import { useState, useEffect } from "react";
import { salonNow } from "@/lib/salonClock";
import { useSalonTimeZone } from "@/hooks/useSalonTimeZone";
import { currencySymbol, formatPrice } from "@/lib/currency";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { categoryTint } from "@/lib/serviceCategoryColor";
import { appointmentStatusStyle } from "@/lib/appointmentStatus";
import "@/components/auth/auth-tokens.css";
import { Button } from "@/components/ui/button";
import { RefundDialog } from "@/components/money/RefundDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, CreditCard, Edit, TriangleAlert, Undo2, UserX, XCircle } from "lucide-react";
import { clientColorClasses } from "@/lib/appointmentVisuals";
import { useNavigate } from "react-router-dom";
import { useNavigation } from "@/utils/navigationUtils";
import type { Appointment, Staff } from "./AppointmentBlock";
import { appointmentService, type Appointment as ApiAppointment, type AppointmentHistoryEntry } from "@/services/appointmentService";
import { clientService, type Client } from "@/services/clientService";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parse } from "date-fns";
import { format } from "@/i18n/dateFns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { t as tr } from "@/i18n";

interface AppointmentModalProps {
  appointment: Appointment | null;
  staff: Staff | undefined;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (appointment: Appointment) => void;
  onDelete: (appointmentId: string) => void;
  onCancelled?: () => void;
}

export function AppointmentModal({
  appointment,
  staff,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onCancelled,
}: AppointmentModalProps) {
  const [fullAppointment, setFullAppointment] = useState<ApiAppointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  // #30: one in-flight flag for both transitions — a double tap would otherwise fire the
  // second call, get rejected by BookingStateMachine, and show an error for an action
  // that actually succeeded.
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const navigate = useNavigate();
  const { getPath } = useNavigation();
  // The client was a read-only text box, so a booking taken under the wrong name — or a
  // walk-in typed in by hand — could never be attached to the real client record, and
  // everything keyed off that record (history, loyalty, memberships) stayed empty.
  const [clients, setClients] = useState<Client[]>([]);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [savingClient, setSavingClient] = useState(false);

  useEffect(() => {
    // Wait for the booking itself: before it loads there is no salon id, and the list was
    // asked for salon 0 — refused, so "Change client" offered nobody.
    if (!isOpen || !appointment?.apiId || !fullAppointment?.businessId) return;
    clientService
      .getClientsByBusiness(fullAppointment.businessId)
      .then(setClients)
      .catch(() => setClients([]));
  }, [isOpen, appointment?.apiId, fullAppointment?.businessId]);
  const salonTz = useSalonTimeZone(fullAppointment?.businessId);
  const [history, setHistory] = useState<AppointmentHistoryEntry[]>([]);
  useEffect(() => {
    if (!isOpen || !appointment?.apiId || !fullAppointment?.businessId) return;
    appointmentService
      .getAppointmentHistory(fullAppointment.businessId, appointment.apiId)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [isOpen, appointment?.apiId, fullAppointment?.businessId]);

  const reassignClient = async (client: Client) => {
    if (!appointment?.apiId || !fullAppointment) return;
    setSavingClient(true);
    try {
      const who = {
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName || ""}`.trim(),
        clientPhone: client.phone,
        clientEmail: client.email,
      };
      // A visit belongs to one client: change it on every service of the visit.
      const lines = appointment.visitMates && appointment.visitMates.length > 1
        ? appointment.visitMates.map((m) => ({
            id: m.id, staffId: m.staffId, serviceId: m.serviceId,
            startTime: m.startTime, endTime: m.endTime, price: m.price,
          }))
        : [{ id: appointment.apiId, staffId: fullAppointment.staffId, serviceId: fullAppointment.serviceId,
             startTime: fullAppointment.startTime, endTime: fullAppointment.endTime, price: fullAppointment.price }];
      let updated: ApiAppointment | null = null;
      for (const l of lines) {
        const res = await appointmentService.updateAppointment(l.id, {
          businessId: fullAppointment.businessId,
          staffId: l.staffId,
          serviceId: l.serviceId,
          appointmentDate: fullAppointment.appointmentDate,
          startTime: l.startTime,
          endTime: l.endTime,
          ...who,
          notes: fullAppointment.notes,
          price: l.price,
        } as never);
        if (l.id === appointment.apiId) updated = res;
      }
      if (updated) setFullAppointment(updated);
      setClientPickerOpen(false);
      toast.success(tr("calendar.clientUpdated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("calendar.couldNotChangeTheClient"));
    } finally {
      setSavingClient(false);
    }
  };

  /** Every appointment of this visit (just this one for an ordinary booking). */
  const visitIds = (): string[] =>
    appointment?.visitMates && appointment.visitMates.length > 1
      ? appointment.visitMates.filter((m) => (m.status || "").toUpperCase() !== "CANCELLED").map((m) => m.id)
      : appointment?.apiId ? [appointment.apiId] : [];
  /** null = the whole visit; an id = just that one service. */
  const [cancelOnly, setCancelOnly] = useState<string | null>(null);

  const runLifecycle = async (action: "confirm" | "no-show") => {
    if (!appointment?.apiId) return;
    setLifecycleBusy(true);
    try {
      // A visit with several services is acted on as one: every appointment of it.
      const ids = visitIds();
      for (const id of ids) {
        if (action === "confirm") await appointmentService.confirmAppointment(id);
        else await appointmentService.markNoShow(id);
      }
      toast.success(action === "confirm" ? tr("calendar.appointmentConfirmed") : tr("calendar.markedAsNoShow"));
      onCancelled?.();   // the same refresh callback the cancel path uses
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : tr("calendar.couldNotUpdateTheAppointment"));
    } finally {
      setLifecycleBusy(false);
    }
  };
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (isOpen && appointment?.apiId) {
      setLoading(true);
      appointmentService.getAppointmentById(appointment.apiId)
        .then((data) => {
          setFullAppointment(data);
        })
        .catch((error) => {
          // Error fetching appointment details - handled by toast
          toast.error(tr("calendar.failedToLoadAppointmentDetails"));
          // Fallback to the appointment data we have
          setFullAppointment(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (isOpen && !appointment?.apiId) {
      // If no API ID, use the appointment data we have
      setFullAppointment(null);
    }
  }, [isOpen, appointment?.apiId]);

  if (!appointment) return null;

  // Use full appointment data if available, otherwise fallback to appointment prop
  const appointmentData = fullAppointment || (appointment as unknown as ApiAppointment);
  const clientPhone = appointmentData.clientPhone || "";
  const clientEmail = appointmentData.clientEmail || "";
  const clientAddress = appointmentData.clientAddress || "";
  const notes = appointmentData.notes || "";
  const price = appointmentData.price || 0;
  /**
   * Money already taken, and money owed for cancelling late.
   *
   * Both existed on the booking and neither reached this screen: a cashier asked for the
   * full price on a booking with a 30% deposit and only found out from an error, and a
   * late cancellation left the salon owed a fee nobody could see.
   */
  const depositPaid =
    appointmentData.depositPaid && appointmentData.depositAmount
      ? Number(appointmentData.depositAmount)
      : 0;
  // Less what was already paid online from a gift card. A promo's discount is priced by
  // the server at the till, so the button names the code rather than a wrong amount.
  const pointsPaid = Number(appointmentData.pointsDiscount ?? 0);
  const dueNow = Math.max(0, price - depositPaid - Number(appointmentData.prepaidAmount ?? 0) - pointsPaid);
  const bookedPromo: string | null = appointmentData.promoCode ?? null;
  const cancellationFee = Number(appointmentData.cancellationFee ?? 0);
  const status = appointmentData.status || "PENDING";
  const paymentStatus = appointmentData.paymentStatus || "PENDING";
  const appointmentDate = appointmentData.appointmentDate || (appointment.date ? format(appointment.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  // LR-09: compared with the salon's today (market zone until the salon's is known).
  const isFutureVisit = appointmentDate > format(salonNow(salonTz), 'yyyy-MM-dd');
  const staffName = appointmentData.staffName || staff?.name || "Unassigned";
  const repServiceName = appointmentData.serviceName || appointment.service;
  // The API sends "10:00:00"; a receptionist reads "10:00".
  const startTime = (appointmentData.startTime || appointment.startTime)?.slice(0, 5);
  const endTime = (appointmentData.endTime || appointment.endTime)?.slice(0, 5);
  const durationMinutes = (() => {
    const toMinutes = (t: string) => {
      const [h, m] = String(t).split(":").map(Number);
      return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
    };
    const a = toMinutes(startTime);
    const b = toMinutes(endTime);
    return a != null && b != null && b > a ? b - a : null;
  })();
  const selectedClient = clients.find((c) => c.id === appointmentData.clientId);

  // Colour carries the state, so the panel reads at a glance instead of being scanned.
  // Same palette as the calendar blocks (lib/appointmentStatus).
  const tone = appointmentStatusStyle(status, "PENDING");
  // Category colour: the same tint as the calendar block. Status stays in the chip.
  const tint = categoryTint(appointment.categoryId, appointment.serviceId ?? appointmentData.serviceId);
  // A multi-service visit is one appointment per service; list them all with the total.
  const visitMates = appointment.visitMates && appointment.visitMates.length > 1 ? appointment.visitMates : null;
  const isGone = (m: { status?: string }) => (m.status || "").toUpperCase() === "CANCELLED";
  // Totals, times and counts are about what is still booked; cancelled services stay listed.
  const liveMates = visitMates ? visitMates.filter((m) => !isGone(m)) : null;
  const visitTotal = liveMates ? liveMates.reduce((n, m) => n + Number(m.price ?? 0), 0) : 0;
  const mateMinutes = (m: { startTime: string; endTime: string }) => {
    const mins = (t: string) => { const [h, mm] = String(t).split(":").map(Number); return h * 60 + mm; };
    const d = mins(m.endTime) - mins(m.startTime);
    return Number.isFinite(d) && d > 0 ? d : null;
  };
  // The header speaks for the whole visit, not for its first service.
  const serviceName = liveMates ? liveMates.map((m) => m.service).join(" + ") : repServiceName;
  const visitStaff = liveMates ? [...new Set(liveMates.map((m) => m.staffName).filter(Boolean))] as string[] : [];
  const headStart = liveMates ? liveMates.map((m) => m.startTime.slice(0, 5)).sort()[0] : startTime;
  const headEnd = liveMates ? liveMates.map((m) => m.endTime.slice(0, 5)).sort().slice(-1)[0] : endTime;
  const headMinutes = liveMates ? liveMates.reduce((n, m) => n + (mateMinutes(m) ?? 0), 0) : durationMinutes;
  const shownAnswers = visitMates ? appointment.answers : appointmentData.answers;
  const paid = paymentStatus === "PAID" || paymentStatus === "REFUNDED";
  /** Nothing can be done to it any more: the money is in, or it was called off. */
  const settled = paid || status === "CANCELLED";
  const clientName = appointmentData.clientName || appointment.clientName || "Walk-in";
  const initials = clientName
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part.charAt(0).toUpperCase())
    .join("");
  const visits = selectedClient?.totalVisits ?? null;
  const requested = notes.includes("Requested by client");
  // The salon typed nothing here; anything left is what the customer wrote when booking.
  const customerNote = notes.replace("⭐ Requested by client", "").replace(/^\s*—\s*/, "").trim();

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" style={{ fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif' }} className="!max-w-full w-full sm:w-[480px] p-0 flex flex-col h-[100dvh] max-h-[100dvh] gap-0 border-0 bg-[rgb(var(--reg-canvas))] text-[rgb(var(--reg-ink))] sm:border-l sm:border-[rgb(var(--reg-line))]">
        <SheetTitle className="sr-only">{tr("calendar.appointmentDetails")}</SheetTitle>
        <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: tint.accent }} />

        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pr-14 pt-5 md:px-6">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone.chip}`}>{tone.label}</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                paid ? "bg-[rgb(var(--reg-success-soft))] text-[rgb(var(--reg-success))]" : "bg-white text-[rgb(var(--reg-ink)/0.7)] ring-1 ring-[rgb(var(--reg-line))]"
              }`}
            >
              {paid ? tr("common.paid") : tr("calendar.unpaid")}
            </span>
          </div>
          {loading && <span className="text-xs text-muted-foreground">{tr("common.loading2")}</span>}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-5 md:px-6">
          {/* Who */}
          <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line))]">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${clientColorClasses(
                  clientName
                )}`}
              >
                {initials || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{clientName}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {visits != null && visits <= 1 && (
                    <Badge className="bg-[rgb(var(--reg-brand))] text-[10px] text-white hover:bg-[rgb(var(--reg-brand))]">{tr("calendar.newClient")}</Badge>
                  )}
                  {visits != null && visits >= 5 && (
                    <Badge className="bg-rose-600 text-[10px] text-white hover:bg-rose-600">
                      {tr("calendar.regularVisits", { visits })}
                    </Badge>
                  )}
                  {requested && (
                    <Badge className="bg-amber-500 text-[10px] text-white hover:bg-amber-500">
                      {tr("calendar.askedFor", { staffName })}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {clientPhone && <p>{clientPhone}</p>}
                  {clientEmail && <p className="truncate">{clientEmail}</p>}
                  {clientAddress && <p>{clientAddress}</p>}
                </div>
              </div>
              <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={savingClient} className="h-7 shrink-0 text-xs">
                    {tr("calendar.change")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder={tr("calendar.searchClients")} className="text-xs" />
                    <CommandList>
                      <CommandEmpty>{tr("calendar.noClientFound")}</CommandEmpty>
                      <CommandGroup>
                        {clients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={`${client.firstName} ${client.lastName || ""} ${client.email || ""} ${client.phone || ""}`}
                            onSelect={() => void reassignClient(client)}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="truncate">
                                {client.firstName} {client.lastName}
                              </span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {client.phone || client.email || ""}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* The customer's answers to what the salon asked when booking */}
          {(shownAnswers?.length ?? 0) > 0 && (
            <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line))]">
              <p className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--reg-muted))]">{tr("calendar.answersFromTheClient")}</p>
              <dl className="mt-2 space-y-2">
                {shownAnswers!.map((a, i) => (
                  <div key={i}>
                    <dt className="text-xs text-muted-foreground">{a.question}</dt>
                    <dd className="text-sm font-medium">{a.answer}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* What, when, how much */}
          <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line))]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{serviceName}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {tr("calendar.with", { value: liveMates ? `${tr("calendar.serviceCount", { count: liveMates.length })} · ` : "", value2: visitMates && visitStaff.length > 0 ? visitStaff.join(", ") : staffName })}
                </p>
              </div>
              <p className="shrink-0 text-right">
                {visitMates ? (
                  <>
                    <span className="block text-lg font-semibold">
                      {visitTotal} {currencySymbol()}
                    </span>
                    <span className="block text-xs text-muted-foreground">{tr("calendar.total")}</span>
                  </>
                ) : depositPaid > 0 ? (
                  <>
                    <span className="block text-lg font-semibold">
                      {dueNow} {currencySymbol()}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {tr("calendar.lessDeposit", { price, value: currencySymbol(), depositPaid })}
                    </span>
                  </>
                ) : (
                  <span className="text-lg font-semibold">
                    {price} {currencySymbol()}
                  </span>
                )}
              </p>
            </div>
            {visitMates && (
              <div className="mt-3 rounded-lg px-3 py-2" style={{ backgroundColor: tint.fill, color: tint.ink }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: tint.muted }}>
                  {tr("calendar.confirmNoShowAndCancel", { value: tr("calendar.thisVisit", { services: tr("calendar.serviceCount", { count: liveMates!.length }) }), value2: liveMates!.length < visitMates.length ? tr("calendar.cancelledCount", { count: visitMates.length - liveMates!.length }) : "" })}
                </p>
                <ul className="mt-1 divide-y divide-white/70">
                  {visitMates.map((m) => (
                    <li key={m.id} className={`py-1.5 text-sm ${m.id === appointment.id && !isGone(m) ? "font-semibold" : ""} ${isGone(m) ? "opacity-70" : ""}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`min-w-0 truncate ${isGone(m) ? "line-through" : ""}`}>
                        {m.service}
                        {m.staffName ? <span className="font-normal" style={{ color: tint.muted }}> · {m.staffName}</span> : null}
                      </span>
                      <span className="shrink-0 text-xs" style={{ color: tint.muted }}>
                        {m.startTime.slice(0, 5)}–{m.endTime.slice(0, 5)}
                        {mateMinutes(m) != null ? tr("calendar.min", { value: mateMinutes(m) }) : ""}
                        {m.price != null ? ` · ${m.price} ${currencySymbol()}` : ""}
                        {!settled && !isGone(m) && (
                          <button
                            type="button"
                            className="ml-2 font-semibold text-red-700 underline-offset-2 hover:underline"
                            onClick={() => { setCancelOnly(m.id); setCancelDialogOpen(true); }}
                          >
                            {tr("common.cancel")}
                          </button>
                        )}
                      </span>
                    </div>
                    {isGone(m) && (
                      <p className="mt-0.5 text-xs" style={{ color: tint.muted }}>
                        {tr("calendar.cancelled", { value: m.cancelledBy === "SALON" ? tr("calendar.bySalon") : m.cancelledBy === "CUSTOMER" ? tr("calendar.byClient") : "", value2: m.cancellationNote ? ` · “${m.cancellationNote}”` : "" })}
                      </p>
                    )}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 flex justify-between border-t border-white pt-1.5 text-sm font-bold">
                  <span>{tr("common.total")}</span>
                  <span>{visitTotal} {currencySymbol()}</span>
                </p>
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">
                {appointmentDate ? format(parse(appointmentDate, "yyyy-MM-dd", new Date()), "EEE d MMM") : "—"}
              </span>
              <span className="text-muted-foreground">
                {headStart}–{headEnd}
                {headMinutes != null && headMinutes > 0 ? tr("calendar.min2", { headMinutes, value: visitMates ? tr("calendar.inTotal") : "" }) : ""}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{tr("calendar.payingWith")}</span>
              <span className="font-medium">
                {appointmentData.paymentPreference === "GIFT_CARD"
                  ? tr("calendar.giftCard", { value: appointmentData.giftCardCode ? ` ${appointmentData.giftCardCode}` : "" })
                  : appointmentData.paymentPreference === "WALLET"
                    ? tr("calendar.theirWallet")
                    : tr("calendar.atTheSalon")}
              </span>
            </div>
            {pointsPaid > 0 && (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{tr("calendar.paidWithPoints")}</span>
                <span className="font-medium text-[rgb(var(--reg-success))]">{formatPrice(pointsPaid)}</span>
              </div>
            )}
            {Number(appointmentData.prepaidAmount ?? 0) > 0 && (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{tr("calendar.paidOnline")}</span>
                <span className="font-medium text-[rgb(var(--reg-success))]">
                  {tr("calendar.fromTheirGiftCard", { value: formatPrice(Number(appointmentData.prepaidAmount)) })}
                </span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{tr("calendar.booking")}</span>
              <span className="font-medium">#{appointment.apiId ? appointment.apiId.slice(0, 8).toUpperCase() : appointment.id}</span>
            </div>
          </div>

          {/* Forced past a conflict: who confirmed it and why. */}
          {appointmentData.overrideApplied && (
            <div data-testid="override-details" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                <TriangleAlert size={14} aria-hidden /> {tr("bookingConflict.markerTitle")}
              </p>
              <p className="mt-1 text-sm text-amber-900">
                {appointmentData.overrideByName
                  ? tr("bookingConflict.overrideBy", { name: appointmentData.overrideByName })
                  : tr("bookingConflict.overrideByUnknown")}
              </p>
              {appointmentData.overrideReason && (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-amber-900">
                  {tr("bookingConflict.overrideReason", { reason: appointmentData.overrideReason })}
                </p>
              )}
            </div>
          )}

          {/* Only when there is something to read. An empty grey box is noise. */}
          {customerNote && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-medium text-amber-900">{tr("calendar.noteFromTheClient")}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{customerNote}</p>
            </div>
          )}
        </div>

        {/* Everything you can do, at the bottom where actions live, one primary.
            A paid appointment is settled: cancelling, editing or marking a no-show after
            the money is taken would leave the till and the diary disagreeing. A cancelled
            one is over, so there is nothing to do to it either. */}
        <div className="shrink-0 space-y-2 border-t border-[rgb(var(--reg-line)/0.8)] bg-white/90 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur md:px-6">
          {/* Computed from your own cancellation window when the client cancelled. Nothing
              collects it automatically — it is here so you know to ask. */}
          {cancellationFee > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="font-semibold">
                {tr("calendar.lateCancellationFee", { cancellationFee, value: currencySymbol() })}
              </span>
              <span className="text-amber-800">{tr("calendar.cancelledInsideYourNoticeWindow")}</span>
            </div>
          )}

          {history.length > 0 && (
            <div className="space-y-1 rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">{tr("calendar.historyTitle")}</p>
              {history.map((h, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {format(new Date(h.createdAt), "dd.MM.yyyy HH:mm")} · {h.actorName || tr("calendar.historyUnknownUser")} · {h.method === "POST" ? tr("calendar.historyCreated") : h.method === "DELETE" ? tr("calendar.historyDeleted") : tr("calendar.historyChanged")}
                </p>
              ))}
            </div>
          )}
          {settled ? (
            paid ? (
              // "Nothing left to change" was not true — a customer who was charged twice, or
              // one the salon let down, has to be given their money back, and the only way to
              // do it was the Stripe dashboard, where none of this is recorded.
              <div className="space-y-2">
                <p className="text-center text-sm text-muted-foreground">{tr("calendar.paidAndSettled")}</p>
                {paymentStatus === "REFUNDED" ? (
                  <p className="text-center text-sm text-muted-foreground">{tr("calendar.alreadyRefunded")}</p>
                ) : (
                  <Button
                    variant="outline"
                    className="h-11 w-full gap-2 rounded-full border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50"
                    onClick={() => setRefundOpen(true)}
                  >
                    <Undo2 className="h-4 w-4" />
                    {tr("calendar.refund")}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                {tr("calendar.thisAppointmentWasCancelled")}
              </p>
            )
          ) : null}
          {/* A visit that has not happened yet is not taken to the till (the server refuses it
              too): it would show as completed to the customer before they have been. */}
          {!settled && !paid && isFutureVisit && (
            <p className="rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
              {tr("calendar.paymentCanBeTakenOn")}
            </p>
          )}
          {!settled && !paid && !isFutureVisit && (
            <Button
              className="h-[52px] w-full gap-2 rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] text-base font-semibold text-white shadow-[0_10px_24px_-8px_rgb(var(--reg-brand-strong)/0.6)] hover:brightness-110"
              onClick={() => {
                // Straight to the till with the whole visit already in the basket: one ticket,
                // one line per service still booked.
                navigate(getPath("sales"), { state: { appointmentId: appointment.apiId, appointmentIds: visitIds() } });
                onClose();
              }}
            >
              <CreditCard className="h-4 w-4" />
              {bookedPromo
                ? tr("calendar.takePaymentApplied", { bookedPromo })
                : liveMates && liveMates.length > 1
                  ? tr("calendar.checkOutVisit", { count: liveMates.length, total: visitTotal, value: currencySymbol() })
                  : visitMates
                  ? tr("calendar.takePayment", { repServiceName, dueNow, value: currencySymbol() })
                  : tr("calendar.takePayment2", { dueNow, value: currencySymbol() })}
            </Button>
          )}
          {!settled && (
          <div className="grid grid-cols-3 gap-2">
            {status === "PENDING" ? (
              <Button
                variant="outline"
                className="h-11 gap-1.5 rounded-full text-sm font-semibold"
                disabled={lifecycleBusy}
                onClick={() => void runLifecycle("confirm")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {tr("calendar.confirm")}
              </Button>
            ) : (
              <Button variant="outline" className="h-11 gap-1.5 rounded-full text-sm font-semibold" onClick={() => onEdit(appointment)}>
                <Edit className="h-3.5 w-3.5" />
                {tr("common.edit")}
              </Button>
            )}
            <Button
              variant="outline"
              className="h-11 gap-1.5 rounded-full text-sm font-semibold"
              disabled={lifecycleBusy || status === "NO_SHOW"}
              onClick={() => void runLifecycle("no-show")}
            >
              <UserX className="h-3.5 w-3.5" />
              {tr("calendar.noShow")}
            </Button>
            <Button
              variant="outline"
              className="h-11 gap-1.5 rounded-full border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50"
              onClick={() => { setCancelOnly(null); setCancelDialogOpen(true); }}
            >
              <XCircle className="h-3.5 w-3.5" />
              {tr("common.cancel")}
            </Button>
          </div>
          )}
        </div>
      </SheetContent>

      <RefundDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        bookingId={appointment.apiId ?? ""}
        // What the till took (after a promo or discount), not the list price — refunding
        // the price gave back more than was paid. The server enforces the same ceiling.
        paidAmount={appointmentData.paidAmount != null ? Number(appointmentData.paidAmount) : price}
        clientName={clientName}
        onRefunded={() => {
          onClose();
        }}
      />

      {/* Cancel Appointment Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{tr("calendar.cancelAppointment")}</DialogTitle>
            <DialogDescription>
              {cancelOnly
                ? tr("calendar.onlyThisServiceOfThe")
                : visitIds().length > 1
                  ? tr("calendar.thisCancelsTheWholeVisit", { count: visitIds().length })
                  : tr("calendar.pleaseProvideAReasonFor")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">{tr("calendar.cancellationReason")}</Label>
              <Textarea
                id="cancel-reason"
                placeholder={tr("calendar.enterReasonForCancellation")}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCancelDialogOpen(false);
                  setCancelReason("");
                }}
              >
                {tr("common.close")}
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!cancelReason.trim()) {
                    toast.error(tr("calendar.pleaseProvideACancellationReason"));
                    return;
                  }
                  
                  if (appointment?.apiId) {
                    try {
                      const ids = cancelOnly ? [cancelOnly] : visitIds();
                      // The whole visit is ONE call, so the customer gets one message; a single
                      // service of it is cancelled on its own and the rest stands.
                      if (cancelOnly || ids.length <= 1) await appointmentService.cancelAppointment(cancelOnly ?? ids[0] ?? appointment.apiId, cancelReason);
                      else await appointmentService.cancelAppointment(ids[0], cancelReason, true);
                      toast.success(!cancelOnly && ids.length > 1 ? tr("calendar.visitCancelledServices", { count: ids.length }) : tr("calendar.appointmentCancelledSuccessfully"));
                      setCancelOnly(null);
                      setCancelDialogOpen(false);
                      setCancelReason("");
                      onClose();
                      onCancelled?.();
                    } catch (error) {
                      toast.error((error instanceof Error && error.message) || tr("calendar.failedToCancelAppointment"));
                    }
                  } else if (appointment?.id) {
                    onDelete(appointment.id);
                    setCancelDialogOpen(false);
                    setCancelReason("");
                  }
                }}
                disabled={!cancelReason.trim()}
              >
                {tr("calendar.cancelAppointment")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
