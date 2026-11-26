import type { Dispatch, SetStateAction } from "react";
import type { Id } from "@/types/id";
import type { Client } from "@/services/clientService";
import type { Staff } from "@/components/calendar/AppointmentBlock";
import type { Service, ServicePackage } from "@/services/serviceService";
import type { BookingConflict } from "@/services/appointmentService";

export interface BookingForm {
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceId: string;
  staffId: string;
  startTime: string;
  endTime: string;
  notes: string;
  price: string;
  date: string;
  requestedByClient: boolean;
  idempotencyKey: string;
}
export interface ExtraService { serviceId: string; staffId: string; startTime: string; endTime: string }
export interface GroupMember { clientName: string; clientPhone: string; clientEmail: string; staffId: string; startTime: string }
export type BookingMode = "single" | "group" | "recurring";
export interface Recurrence { frequency: "DAILY" | "WEEKLY" | "MONTHLY"; interval: number; count: number }
export interface EditingVisit { ids: string[] }

/** Everything the booking drawer needs. State, queries and the submit/close handlers stay in CalendarPage. */
export interface BookingDrawerProps {
  editing: boolean;
  editingVisit: EditingVisit | null;
  form: BookingForm;
  setForm: Dispatch<SetStateAction<BookingForm>>;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  canSubmit: boolean;
  submitLabel: string;
  subtitle: string;

  clients: Client[];
  clientSearchOpen: boolean;
  setClientSearchOpen: (v: boolean) => void;
  services: Service[];
  serviceQuery: string;
  setServiceQuery: (v: string) => void;
  staff: Staff[];

  bookingMode: BookingMode;
  setBookingMode: (m: BookingMode) => void;
  recurrence: Recurrence;
  setRecurrence: Dispatch<SetStateAction<Recurrence>>;
  recurrenceDates: string[];
  seriesPreview: { date: string; conflicts: BookingConflict[] }[] | null;
  describeConflict: (c: BookingConflict) => string;
  groupMembers: GroupMember[];
  setGroupMembers: Dispatch<SetStateAction<GroupMember[]>>;
  extraServices: ExtraService[];
  setExtraServices: Dispatch<SetStateAction<ExtraService[]>>;

  selectedPackage?: ServicePackage;
  packageParty: number;
  setPackageParty: (n: number) => void;
  businessId?: Id | null;

  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  salonNow: () => Date;
  salonToday: (d: Date) => boolean;
  getBusinessHoursForDate: (d: Date) => { startHour: number; endHour: number; isEnabled: boolean };
  timeOptionsWith: (current: string) => string[];
  serviceDuration: (serviceId: string) => number;
  addMinutesToTime: (time: string, minutes: number) => string;
  initialsOf: (name: string) => string;
  total: number;
}
