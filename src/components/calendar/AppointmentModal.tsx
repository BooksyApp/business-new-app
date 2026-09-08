import { useState, useEffect } from "react";
import { currencySymbol } from "@/lib/currency";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, CreditCard, Edit, UserX, XCircle } from "lucide-react";
import { clientColorClasses } from "@/lib/appointmentVisuals";
import { useNavigate } from "react-router-dom";
import { useNavigation } from "@/utils/navigationUtils";
import type { Appointment, Staff } from "./AppointmentBlock";
import { appointmentService, type Appointment as ApiAppointment } from "@/services/appointmentService";
import { clientService, type Client } from "@/services/clientService";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parse } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
    if (!isOpen || !appointment?.apiId) return;
    clientService
      .getClientsByBusiness((fullAppointment?.businessId ?? 0) || 0)
      .then(setClients)
      .catch(() => setClients([]));
  }, [isOpen, appointment?.apiId, fullAppointment?.businessId]);

  const reassignClient = async (client: Client) => {
    if (!appointment?.apiId || !fullAppointment) return;
    setSavingClient(true);
    try {
      const updated = await appointmentService.updateAppointment(appointment.apiId, {
        businessId: fullAppointment.businessId,
        staffId: fullAppointment.staffId,
        serviceId: fullAppointment.serviceId,
        appointmentDate: fullAppointment.appointmentDate,
        startTime: fullAppointment.startTime,
        endTime: fullAppointment.endTime,
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName || ""}`.trim(),
        clientPhone: client.phone,
        clientEmail: client.email,
        notes: fullAppointment.notes,
        price: fullAppointment.price,
      } as never);
      setFullAppointment(updated);
      setClientPickerOpen(false);
      toast.success("Client updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change the client");
    } finally {
      setSavingClient(false);
    }
  };

  const runLifecycle = async (action: "confirm" | "no-show") => {
    if (!appointment?.apiId) return;
    setLifecycleBusy(true);
    try {
      if (action === "confirm") {
        await appointmentService.confirmAppointment(appointment.apiId);
        toast.success("Appointment confirmed");
      } else {
        await appointmentService.markNoShow(appointment.apiId);
        toast.success("Marked as no-show");
      }
      onCancelled?.();   // the same refresh callback the cancel path uses
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not update the appointment");
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
          toast.error("Failed to load appointment details");
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
  const appointmentData = fullAppointment || (appointment as any);
  const clientPhone = appointmentData.clientPhone || "";
  const clientEmail = appointmentData.clientEmail || "";
  const notes = appointmentData.notes || "";
  const price = appointmentData.price || 0;
  const status = appointmentData.status || "PENDING";
  const paymentStatus = appointmentData.paymentStatus || "PENDING";
  const appointmentDate = appointmentData.appointmentDate || (appointment.date ? format(appointment.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  const staffName = appointmentData.staffName || staff?.name || "Unassigned";
  const serviceName = appointmentData.serviceName || appointment.service;
  const startTime = appointmentData.startTime || appointment.startTime;
  const endTime = appointmentData.endTime || appointment.endTime;
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
  const statusTone: Record<string, { band: string; chip: string; label: string }> = {
    PENDING: { band: "bg-amber-500", chip: "bg-amber-100 text-amber-900", label: "Awaiting confirmation" },
    CONFIRMED: { band: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-900", label: "Confirmed" },
    COMPLETED: { band: "bg-slate-500", chip: "bg-slate-200 text-slate-900", label: "Completed" },
    CANCELLED: { band: "bg-red-500", chip: "bg-red-100 text-red-900", label: "Cancelled" },
    NO_SHOW: { band: "bg-rose-600", chip: "bg-rose-100 text-rose-900", label: "No-show" },
  };
  const tone = statusTone[status] ?? statusTone.PENDING;
  const paid = paymentStatus === "PAID";
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
      <SheetContent side="right" className="!max-w-none w-[460px] p-0 flex flex-col h-screen max-h-screen gap-0">
        <div className={`h-1.5 w-full shrink-0 ${tone.band}`} />

        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.chip}`}>{tone.label}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                paid ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"
              }`}
            >
              {paid ? "Paid" : "Unpaid"}
            </span>
          </div>
          {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5 min-h-0">
          {/* Who */}
          <div className="rounded-xl border p-4">
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
                    <Badge className="bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">New client</Badge>
                  )}
                  {visits != null && visits >= 5 && (
                    <Badge className="bg-rose-600 text-[10px] text-white hover:bg-rose-600">
                      Regular · {visits} visits
                    </Badge>
                  )}
                  {requested && (
                    <Badge className="bg-amber-500 text-[10px] text-white hover:bg-amber-500">
                      Asked for {staffName}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {clientPhone && <p>{clientPhone}</p>}
                  {clientEmail && <p className="truncate">{clientEmail}</p>}
                </div>
              </div>
              <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={savingClient} className="h-7 shrink-0 text-xs">
                    Change
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Search clients..." className="text-xs" />
                    <CommandList>
                      <CommandEmpty>No client found.</CommandEmpty>
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

          {/* What, when, how much */}
          <div className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{serviceName}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">with {staffName}</p>
              </div>
              <p className="shrink-0 text-lg font-semibold">
                {price} {currencySymbol()}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">
                {appointmentDate ? format(parse(appointmentDate, "yyyy-MM-dd", new Date()), "EEE d MMM") : "—"}
              </span>
              <span className="text-muted-foreground">
                {startTime}–{endTime}
                {durationMinutes != null ? ` · ${durationMinutes} min` : ""}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Paying with</span>
              <span className="font-medium">
                {appointmentData.paymentPreference === "GIFT_CARD"
                  ? `Gift card${appointmentData.giftCardCode ? ` ${appointmentData.giftCardCode}` : ""}`
                  : appointmentData.paymentPreference === "WALLET"
                    ? "Their wallet"
                    : "At the salon"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Booking</span>
              <span className="font-medium">#{appointment.apiId ?? appointment.id}</span>
            </div>
          </div>

          {/* Only when there is something to read. An empty grey box is noise. */}
          {customerNote && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-medium text-amber-900">Note from the client</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{customerNote}</p>
            </div>
          )}
        </div>

        {/* Everything you can do, at the bottom where actions live, one primary. */}
        <div className="space-y-2 border-t px-5 py-4 shrink-0">
          {status !== "CANCELLED" && !paid && (
            <Button
              className="h-11 w-full gap-2 text-sm"
              onClick={() => {
                // Straight to the till with this booking already in the basket.
                navigate(getPath("sales"), { state: { appointmentId: appointment.apiId } });
                onClose();
              }}
            >
              <CreditCard className="h-4 w-4" />
              Take payment · {price} {currencySymbol()}
            </Button>
          )}
          <div className="grid grid-cols-3 gap-2">
            {status === "PENDING" ? (
              <Button
                variant="outline"
                className="h-9 gap-1.5 text-xs"
                disabled={lifecycleBusy}
                onClick={() => void runLifecycle("confirm")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm
              </Button>
            ) : (
              <Button variant="outline" className="h-9 gap-1.5 text-xs" onClick={() => onEdit(appointment)}>
                <Edit className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              className="h-9 gap-1.5 text-xs"
              disabled={lifecycleBusy || status === "CANCELLED" || status === "NO_SHOW"}
              onClick={() => void runLifecycle("no-show")}
            >
              <UserX className="h-3.5 w-3.5" />
              No-show
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-1.5 border-red-200 text-xs text-red-600 hover:bg-red-50"
              disabled={status === "CANCELLED"}
              onClick={() => setCancelDialogOpen(true)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>

      {/* Cancel Appointment Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Cancellation Reason *</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Enter reason for cancellation..."
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
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!cancelReason.trim()) {
                    toast.error("Please provide a cancellation reason");
                    return;
                  }
                  
                  if (appointment?.apiId) {
                    try {
                      await appointmentService.cancelAppointment(appointment.apiId, cancelReason);
                      toast.success("Appointment cancelled successfully");
                      setCancelDialogOpen(false);
                      setCancelReason("");
                      onClose();
                      onCancelled?.();
                    } catch (error: any) {
                      toast.error(error.message || "Failed to cancel appointment");
                    }
                  } else if (appointment?.id) {
                    onDelete(appointment.id);
                    setCancelDialogOpen(false);
                    setCancelReason("");
                  }
                }}
                disabled={!cancelReason.trim()}
              >
                Cancel Appointment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
