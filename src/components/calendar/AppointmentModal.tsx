import { useState, useEffect } from "react";
import { currencySymbol } from "@/lib/currency";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Edit, Trash2, ArrowRight, Calendar as CalendarIcon, ChevronDown, XCircle, CheckCircle2, UserX } from "lucide-react";
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

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="!max-w-none w-[500px] p-0 flex flex-col h-screen max-h-screen">
        {/* Header with Cancel button */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold">Appointment</h2>
          <div className="flex items-center gap-2">
            {loading && <span className="text-xs text-gray-500">Loading...</span>}
            {status !== "CANCELLED" && status !== "COMPLETED" && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 text-red-600 border-red-600 hover:bg-red-50"
                onClick={() => {
                  setCancelDialogOpen(true);
                }}
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Client */}
        <div className="px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="space-y-2">
            <Label className="text-xs">Client</Label>
            <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={savingClient}
                  className="h-8 w-full justify-between text-xs font-normal"
                >
                  <span className="truncate">
                    {appointmentData.clientName || appointment.clientName || "Select a client"}
                  </span>
                  <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start">
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
            <div className="grid grid-cols-2 gap-2">
              <Input value={clientPhone} placeholder="Phone" readOnly className="h-8 text-xs bg-gray-50" />
              <Input value={clientEmail} placeholder="Email" readOnly className="h-8 text-xs bg-gray-50" />
            </div>
            {selectedClient && (
              // What the salon actually wants to know before this person walks in.
              <p className="text-[11px] text-muted-foreground">
                {selectedClient.totalVisits ?? 0} visit{(selectedClient.totalVisits ?? 0) === 1 ? "" : "s"}
                {selectedClient.totalVisits != null && selectedClient.totalVisits <= 1 ? " · new client" : ""}
                {selectedClient.totalVisits != null && selectedClient.totalVisits >= 5 ? " · regular" : ""}
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 shrink-0">
          <button className="px-3 py-2 text-xs font-medium border-b-2 border-gray-900 text-gray-900">
            APPOINTMENT
          </button>
          <button className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-900">
            NOTES & INFO
          </button>
        </div>

        {/* Form Content - Scrollable if needed */}
        <div className="flex-1 p-4 space-y-3 overflow-y-auto min-h-0">
          {/* Date/Time Controls */}
          <div className="flex gap-1.5">
            <Button variant="outline" className="flex-1 justify-between h-8 text-xs px-2" disabled>
              {appointmentDate ? format(parse(appointmentDate, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy') : 'Today'}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
            <Button variant="outline" className="flex-1 h-8 text-xs px-2" disabled>
              <User className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">GROUP</span>
            </Button>
            <Button variant="outline" className="flex-1 h-8 text-xs px-2" disabled>
              <CalendarIcon className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">RECURRING</span>
            </Button>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              Status: {status}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Payment: {paymentStatus}
            </Badge>
            {notes.includes("Requested by client") && (
              <Badge className="bg-amber-500 text-xs text-white">Asked for {staffName}</Badge>
            )}
          </div>

          {/* The facts that were missing: who is doing it, how long it takes, what it
              costs, and when it is. They were all in the payload and none were shown. */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border p-3 text-xs">
            <div>
              <p className="text-muted-foreground">Staff</p>
              <p className="font-medium">{staffName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Service</p>
              <p className="font-medium">{serviceName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">When</p>
              <p className="font-medium">
                {appointmentDate
                  ? format(parse(appointmentDate, "yyyy-MM-dd", new Date()), "EEE d MMM")
                  : "—"}{" "}
                {startTime}–{endTime}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="font-medium">{durationMinutes != null ? `${durationMinutes} min` : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Price</p>
              <p className="font-medium">
                {price} {currencySymbol()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Booking ref</p>
              <p className="font-medium">#{appointment.apiId ?? appointment.id}</p>
            </div>
          </div>

          {/* Service Selection */}
          <div className="space-y-1">
            <Label className="text-xs">Service</Label>
            <div className="relative">
              <Input
                value={appointment.service}
                readOnly
                className="pr-8 h-8 text-xs bg-gray-50"
              />
            </div>
          </div>

          {/* Add-ons */}
          <div className="space-y-1">
            <Label className="text-xs">Add-ons</Label>
            <div className="relative">
              <Input
                placeholder="Add-ons"
                className="pr-8 cursor-pointer h-8 text-xs bg-gray-50"
                readOnly
              />
              <ArrowRight className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Start</Label>
              <Input value={startTime} readOnly className="h-8 text-xs bg-gray-50" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End</Label>
              <Input value={endTime} readOnly className="h-8 text-xs bg-gray-50" />
            </div>
          </div>

          {/* Staff Selection */}
          <div className="space-y-1">
            <Label className="text-xs">Staff</Label>
            <Select value={appointment.staffId} disabled>
              <SelectTrigger className="h-8 text-xs bg-gray-50">
                <SelectValue placeholder={staffName} />
              </SelectTrigger>
              <SelectContent>
                {staff && (
                  <SelectItem value={staff.id}>
                    {staff.name}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={notes}
              placeholder="Add notes..."
              readOnly
              className="h-16 text-xs resize-none bg-gray-50"
            />
          </div>

          {/* Financial Summary */}
          <div className="pt-2 border-t border-gray-200 space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium">Total</Label>
              <span className="text-xs font-semibold">
                {price ? `${price.toFixed(2)} ${currencySymbol()}` : `0,00 ${currencySymbol()}`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium">To be paid</Label>
              <span className="text-xs font-semibold">
                {price ? `${price.toFixed(2)} ${currencySymbol()}` : `0,00 ${currencySymbol()}`}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        {/* #30: the backend has supported confirm and no-show since V22, both guarded by
            BookingStateMachine, but this footer offered only Cancel and Edit.
            confirmAppointment() sat in appointmentService with zero callers, and a salon
            had no way to record a no-show at all — the status that drives deposits and
            client history. */}
        <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap gap-2 shrink-0">
          {appointment?.apiId && appointment.status === "PENDING" && (
            <Button variant="outline" className="flex-1 h-8 text-xs" disabled={lifecycleBusy}
              onClick={() => runLifecycle("confirm")}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              CONFIRM
            </Button>
          )}
          {appointment?.apiId && (appointment.status === "PENDING" || appointment.status === "CONFIRMED") && (
            <Button variant="outline" className="flex-1 h-8 text-xs" disabled={lifecycleBusy}
              onClick={() => runLifecycle("no-show")}>
              <UserX className="h-3.5 w-3.5 mr-1.5" />
              NO-SHOW
            </Button>
          )}
          <Button
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={() => setCancelDialogOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            CANCEL
          </Button>
          <Button
            className="flex-1 h-8 text-xs bg-gray-600 hover:bg-gray-700"
            onClick={() => onEdit(appointment)}
          >
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            EDIT
          </Button>
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
