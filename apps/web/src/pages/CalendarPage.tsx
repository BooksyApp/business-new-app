import type { Id } from "@/types/id";
import { useState, useEffect, useMemo, useCallback, useRef, Suspense, Fragment } from "react";
import { lazyWithReload } from "@/lib/lazyWithReload";
import { appointmentTags, clientColorClasses } from "@/lib/appointmentVisuals";
import { ChevronLeft, ChevronRight, Bell, Search, Settings, SlidersHorizontal, Plus, ChevronDown, ChevronUp, Calendar as CalendarIcon, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek, getDay, parse } from "date-fns";
import { format } from "@/i18n/dateFns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MiniTile } from "@/components/biz/a-MiniTile";
import { AppointmentBlock, StaffAvatar, appointmentServiceLabel, type Appointment, type Staff } from "@/components/calendar/AppointmentBlock";
import { appointmentFlagKeys } from "@/lib/appointmentFlags";
// The visit sheet (~700 lines plus refund dialog and client picker) is only needed once a
// visit is opened: its own chunk, fetched on idle after the calendar has painted.
const loadAppointmentModal = () => import("@/components/calendar/AppointmentModal");
const AppointmentModal = lazyWithReload(() => loadAppointmentModal().then((m) => ({ default: m.AppointmentModal })));
import { toast } from "sonner";
import { websocketService } from "@/services/websocketService";
import { WaitlistAddDialog } from "@/components/calendar/WaitlistAddDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Users, HelpCircle, Clock, Check, Layers } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppointments, type Appointment as AppointmentType } from "@/hooks/useAppointments";
import { useServices } from "@/hooks/useServices";
import { useTimeOff } from "@/hooks/useTimeOff";
import { CalendarSidePanel } from "@/components/calendar/CalendarSidePanel";
import { BookingDrawer } from "@/components/calendar/BookingDrawer/BookingDrawer";
import { WhatsAppReminders } from "@/components/calendar/WhatsAppReminders";
import type { TimeOff } from "@/services/timeOffService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useSalonTimeZone } from "@/hooks/useSalonTimeZone";
import { isSalonToday, salonNow } from "@/lib/salonClock";
import { VisibilityBanner } from "@/components/VisibilityBanner";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FlagIcons, FlagLegend, type CalendarDensity } from "@/components/calendar/AppointmentFlags";
import { categoryTint, type CategoryTint } from "@/lib/serviceCategoryColor";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useServiceOffers } from "@/hooks/useServiceOffers";
import { useFeatureFlags } from "@/services/platformService";
import { appointmentService, BookingConflictDeclined, type BookingConflict } from "@/services/appointmentService";
import { describeConflict } from "@/components/calendar/BookingConflictDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { serviceService, type ServicePackage } from "@/services/serviceService";
import { waitlistService, type WaitlistEntry } from "@/services/waitlistService";
import { WaitingBlock } from "@/components/calendar/WaitingBlock";
import { isFreed, placeWaiting, waitsOn, toHHmm, toMinutes, type BusyRange, type WaitingPlacement } from "@/lib/waitlistCalendar";
import { clientService, Client } from "@/services/clientService";
import { useNavigation } from "@/utils/navigationUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { BRAND_FONT, useBrandFont } from "@/components/auth/useBrandFont";
import "@/components/auth/auth-tokens.css";
import { t as tr } from "@/i18n";

// Extended appointment type with date
interface AppointmentWithDate extends Appointment {
  date: Date;
  apiId?: string;
  /** Carries the "requested by client" flag the booking form writes into the notes. */
  notes?: string;
}

// Convert hook appointments to component format
const convertToComponentAppointment = (apt: AppointmentType): AppointmentWithDate => {
  return {
    id: apt.id,
    clientName: apt.clientName,
    clientAlert: apt.clientAlert,
    lateMinutes: apt.lateMinutes,
    service: apt.service,
    startTime: apt.startTime,
    endTime: apt.endTime,
    staffId: apt.staffId,
    color: apt.color,
    // Needed on the block itself: the "requested by client" flag lives in the notes, and
    // the badges are keyed off the client record rather than a name string.
    notes: apt.notes,
    clientId: (apt as { clientId?: Id }).clientId,
    clientEmail: (apt as { clientEmail?: string }).clientEmail,
    date: apt.date,
    apiId: apt.apiId,
    status: apt.status,   // #30
    price: apt.price,
    serviceId: apt.serviceId,
    visitId: apt.visitId,
    staffAutoAssigned: apt.staffAutoAssigned,
    isClass: (apt as { isClass?: boolean }).isClass,
    answers: apt.answers,
    cancelledBy: apt.cancelledBy,
    cancellationNote: apt.cancellationNote,
    overrideApplied: apt.overrideApplied,
    overrideReason: apt.overrideReason,
    overrideByName: apt.overrideByName,
  };
};

// Time slots from 00:00 to 23:59 with 15-minute intervals
// 24 hours * 4 slots per hour = 96 slots (00:00, 00:15, 00:30, 00:45, ..., 23:45)
// Note: isBusinessHour is not set here - it's checked dynamically per day
const generateTimeSlots = () => {
  return Array.from({ length: 96 }, (_, i) => {
    const totalMinutes = i * 15;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    
    return {
      time: timeString,
      label: minute === 0 ? `${hour.toString().padStart(2, "0")}:00` : `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      hour,
      minute,
      isHourMark: minute === 0,
    };
  });
};

/**
 * FG-W1-12: a group class is one block in the calendar — every booking of the same class
 * session (service + start) folds into the first one, which carries the participant list.
 */
function groupClassSessions<T extends { isClass?: boolean; serviceId?: unknown; startTime: string; clientName: string; status?: string; participants?: string[] }>(list: T[]): T[] {
  const out: T[] = [];
  const sessions = new Map<string, T>();
  for (const apt of list) {
    if (!apt.isClass || apt.status === "CANCELLED") { out.push(apt); continue; }
    const key = `${String(apt.serviceId)}@${apt.startTime}`;
    const head = sessions.get(key);
    if (!head) {
      const first = { ...apt, participants: [apt.clientName] };
      sessions.set(key, first);
      out.push(first);
    } else {
      head.participants = [...(head.participants ?? []), apt.clientName];
      head.clientName = `${head.participants[0]} +${head.participants.length - 1}`;
    }
  }
  return out;
}

function getAppointmentsForStaff(appointments: Appointment[], staffId: string): Appointment[] {
  return appointments.filter((apt) => apt.staffId === staffId);
}

function getTimeOffsForStaffAndDate(timeOffs: TimeOff[], staffId: string, date: Date): TimeOff[] {
  const dateStr = format(date, "yyyy-MM-dd");
  return timeOffs.filter((to) => {
    if (to.staffId.toString() !== staffId.toString()) return false;
    const startDate = parse(to.startDate, "yyyy-MM-dd", new Date());
    const endDate = parse(to.endDate, "yyyy-MM-dd", new Date());
    const currentDate = parse(dateStr, "yyyy-MM-dd", new Date());
    return currentDate >= startDate && currentDate <= endDate;
  });
}

/** LR-01: a valid ?date=YYYY-MM-DD from a query string, else null. */
function dateFromQuery(search: string): Date | null {
  const raw = new URLSearchParams(search).get("date");
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = parse(raw, "yyyy-MM-dd", new Date());
  return isNaN(d.getTime()) ? null : d;
}

function parseTime(time: string): number {
  const parts = time.split(":");
  const hour = parseInt(parts[0]);
  const minute = parseInt(parts[1] || "0");
  return hour * 60 + minute; // Total minutes from 00:00
}

// Slot height for better readability (20px per 15-minute slot)
const SLOT_HEIGHT = 20;

/** Overlapping bookings sit side by side up to this many columns; the rest go behind a "+N" chip. */
const MAX_OVERLAP_COLUMNS = 3;

/* The calendar's sheets (new booking, time off, block time): right sheet on a desktop,
   full screen on a phone, sticky header and footer, 48px fields as on the auth pages. */
const SHEET_FRAME =
  "!max-w-full w-full sm:w-[480px] p-0 flex flex-col h-[100dvh] max-h-[100dvh] gap-0 border-0 bg-[rgb(var(--reg-canvas))] text-[rgb(var(--reg-ink))] sm:border-l sm:border-[rgb(var(--reg-line))]";
const SHEET_HEAD = "shrink-0 border-b border-[rgb(var(--reg-line)/0.8)] bg-[rgb(var(--reg-canvas))] px-5 pb-4 pr-14 pt-5 md:px-6";
const SHEET_TITLE = "text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[rgb(var(--reg-ink))]";
const SHEET_FOOT =
  "flex shrink-0 gap-3 border-t border-[rgb(var(--reg-line)/0.8)] bg-white/90 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur md:px-6";
const SECTION_LABEL = "text-[12px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]";
const FIELD_LABEL = "text-sm font-semibold text-[rgb(var(--reg-ink))]";
const FIELD =
  "h-12 w-full rounded-[14px] border border-[rgb(var(--reg-line))] bg-white px-4 text-base text-[rgb(var(--reg-ink))] focus-visible:ring-4 focus-visible:ring-[rgb(var(--reg-brand)/0.12)] focus-visible:ring-offset-0 focus-visible:border-[rgb(var(--reg-brand))]";
const SECONDARY_BTN =
  "h-[52px] flex-1 rounded-full border-[rgb(var(--reg-line))] bg-white text-base font-semibold text-[rgb(var(--reg-ink))] hover:bg-[rgb(var(--reg-canvas))]";
const PRIMARY_BTN =
  "h-[52px] flex-[1.6] rounded-full text-base font-semibold text-white bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] shadow-[0_10px_24px_-8px_rgb(var(--reg-brand-strong)/0.6)] hover:brightness-110 disabled:opacity-60";

function getTimePosition(startTime: string, endTime: string, slotHeight: number = SLOT_HEIGHT): { top: number; height: number } {
  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);
  const duration = endMinutes - startMinutes;
  const top = (startMinutes / 15) * slotHeight; // 15-minute intervals
  const height = (duration / 15) * slotHeight;
  return { top, height };
}

// Convert pixel position to time string
function getTimeFromPosition(top: number, slotHeight: number = SLOT_HEIGHT): string {
  const slotIndex = Math.floor(top / slotHeight);
  const totalMinutes = slotIndex * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

// Add minutes to a time string
function addMinutesToTime(time: string, minutes: number): string {
  const totalMinutes = parseTime(time) + minutes;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

// Expand a recurring booking into concrete dates (yyyy-MM-dd). Capped at 52
// occurrences so a runaway "count" can never flood the calendar/DB.
function computeRecurrenceDates(
  baseDate: string,
  rec: { frequency: "DAILY" | "WEEKLY" | "MONTHLY"; interval: number; count: number },
): string[] {
  const start = parse(baseDate, "yyyy-MM-dd", new Date());
  if (isNaN(start.getTime())) return [];
  const n = Math.max(1, Math.min(52, Math.floor(rec.count) || 1));
  const step = Math.max(1, Math.floor(rec.interval) || 1);
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const d =
      rec.frequency === "DAILY"
        ? addDays(start, i * step)
        : rec.frequency === "WEEKLY"
          ? addWeeks(start, i * step)
          : addMonths(start, i * step);
    dates.push(format(d, "yyyy-MM-dd"));
  }
  return dates;
}

// This will be updated to use dynamic business hours
function isBusinessHour(hour: number, businessStartHour: number, businessEndHour: number): boolean {
  return hour >= businessStartHour && hour < businessEndHour;
}

// Check if a time range overlaps with any existing appointments
function hasTimeConflict(
  appointments: Appointment[],
  staffId: string,
  startTime: string,
  endTime: string
): boolean {
  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);
  
  return appointments.some((apt) => {
    if (apt.staffId !== staffId) return false;
    
    const aptStartMinutes = parseTime(apt.startTime);
    const aptEndMinutes = parseTime(apt.endTime);
    
    // Check for overlap: new booking overlaps if:
    // - New start is within existing appointment (start >= aptStart && start < aptEnd)
    // - New end is within existing appointment (end > aptStart && end <= aptEnd)
    // - New booking completely contains existing appointment (start <= aptStart && end >= aptEnd)
    // - Existing appointment completely contains new booking (aptStart <= start && aptEnd >= end)
    return (
      (startMinutes >= aptStartMinutes && startMinutes < aptEndMinutes) || // Start overlaps
      (endMinutes > aptStartMinutes && endMinutes <= aptEndMinutes) || // End overlaps
      (startMinutes <= aptStartMinutes && endMinutes >= aptEndMinutes) || // New contains existing
      (aptStartMinutes <= startMinutes && aptEndMinutes >= endMinutes) // Existing contains new
    );
  });
}

// Check if two appointments overlap
function appointmentsOverlap(apt1: Appointment, apt2: Appointment): boolean {
  if (apt1.staffId !== apt2.staffId) return false;
  
  const start1 = parseTime(apt1.startTime);
  const end1 = parseTime(apt1.endTime);
  const start2 = parseTime(apt2.startTime);
  const end2 = parseTime(apt2.endTime);
  
  return (
    (start1 < end2 && end1 > start2)
  );
}

// Normalize time string to HH:mm format (handles HH:mm:ss)
function normalizeTime(timeStr: string): string {
  if (!timeStr) return "00:00";
  // If it's already in HH:mm format, return as is
  if (timeStr.match(/^\d{2}:\d{2}$/)) return timeStr;
  // If it's in HH:mm:ss format, extract HH:mm
  if (timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
    return timeStr.substring(0, 5);
  }
  return timeStr;
}

// Check if time off overlaps with appointment
function timeOffOverlapsAppointment(timeOff: TimeOff, appointment: Appointment, businessStartHour: number, businessEndHour: number): boolean {
  if (timeOff.staffId.toString() !== appointment.staffId.toString()) return false;
  
  // Normalize time formats and handle full day time offs
  const toStartTime = timeOff.isFullDay 
    ? `${businessStartHour.toString().padStart(2, "0")}:00` 
    : normalizeTime(timeOff.startTime || "00:00");
  const toEndTime = timeOff.isFullDay 
    ? `${businessEndHour.toString().padStart(2, "0")}:00` 
    : normalizeTime(timeOff.endTime || "23:59");
  const aptStartTime = normalizeTime(appointment.startTime);
  const aptEndTime = normalizeTime(appointment.endTime);
  
  const toStart = parseTime(toStartTime);
  const toEnd = parseTime(toEndTime);
  const aptStart = parseTime(aptStartTime);
  const aptEnd = parseTime(aptEndTime);
  
  return (toStart < aptEnd && toEnd > aptStart);
}

// Check if a new time off conflicts with existing time offs
function hasTimeOffConflict(
  existingTimeOffs: TimeOff[],
  staffId: string | number,
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  isFullDay: boolean,
  businessStartHour: number,
  businessEndHour: number
): boolean {
  const staffIdStr = staffId.toString();
  const newStartDate = parse(startDate, "yyyy-MM-dd", new Date());
  const newEndDate = parse(endDate, "yyyy-MM-dd", new Date());
  
  // For full day time offs, use business hours for conflict detection
  const newStart = parseTime(isFullDay 
    ? `${businessStartHour.toString().padStart(2, "0")}:00` 
    : startTime);
  const newEnd = parseTime(isFullDay 
    ? `${businessEndHour.toString().padStart(2, "0")}:00` 
    : endTime);
  
  return existingTimeOffs.some((existing) => {
    // Must be same staff member
    if (existing.staffId.toString() !== staffIdStr) return false;
    
    // Check if date ranges overlap
    const existingStartDate = parse(existing.startDate, "yyyy-MM-dd", new Date());
    const existingEndDate = parse(existing.endDate, "yyyy-MM-dd", new Date());
    
    // Date ranges must overlap
    if (newEndDate < existingStartDate || newStartDate > existingEndDate) {
      return false;
    }
    
    // If dates overlap, check time overlap
    const existingStart = parseTime(existing.isFullDay 
      ? `${businessStartHour.toString().padStart(2, "0")}:00` 
      : (existing.startTime || "00:00"));
    const existingEnd = parseTime(existing.isFullDay 
      ? `${businessEndHour.toString().padStart(2, "0")}:00` 
      : (existing.endTime || "23:59"));
    
    // Check for time overlap
    return (newStart < existingEnd && newEnd > existingStart);
  });
}

type ConflictItem =
  | { type: 'appointment'; item: Appointment }
  | { type: 'timeoff'; item: TimeOff }
  | { type: 'waiting'; item: WaitlistEntry; placement: WaitingPlacement; start: string; end: string };

// Group appointments and time offs by conflicts
function groupConflictingItems(
  appointments: Appointment[], 
  timeOffs: TimeOff[],
  businessStartHour: number,
  businessEndHour: number
): ConflictItem[][] {
  const groups: ConflictItem[][] = [];
  const processedApts = new Set<string>();
  const processedTimeOffs = new Set<Id>();
  
  // Process appointments first
  appointments.forEach((apt) => {
    if (processedApts.has(apt.id)) return;
    
    const conflictGroup: ConflictItem[] = [
      { type: 'appointment', item: apt }
    ];
    processedApts.add(apt.id);
    
    // Find all overlapping items
    let foundNew = true;
    while (foundNew) {
      foundNew = false;
      
      // Check other appointments
      appointments.forEach((otherApt) => {
        if (processedApts.has(otherApt.id)) return;
        if (appointmentsOverlap(apt, otherApt)) {
          conflictGroup.push({ type: 'appointment', item: otherApt });
          processedApts.add(otherApt.id);
          foundNew = true;
        }
      });
      
      // Check time offs
      timeOffs.forEach((timeOff) => {
        if (processedTimeOffs.has(timeOff.id)) return;
        if (timeOffOverlapsAppointment(timeOff, apt, businessStartHour, businessEndHour)) {
          conflictGroup.push({ type: 'timeoff', item: timeOff });
          processedTimeOffs.add(timeOff.id);
          foundNew = true;
        }
      });
    }
    
    groups.push(conflictGroup);
  });
  
  // Process remaining time offs that don't conflict with appointments
  timeOffs.forEach((timeOff) => {
    if (processedTimeOffs.has(timeOff.id)) return;
    
    const conflictGroup: ConflictItem[] = [
      { type: 'timeoff', item: timeOff }
    ];
    processedTimeOffs.add(timeOff.id);
    
    // Check if this time off conflicts with other time offs
    let foundNew = true;
    while (foundNew) {
      foundNew = false;
      timeOffs.forEach((otherTimeOff) => {
        if (processedTimeOffs.has(otherTimeOff.id)) return;
        if (timeOffOverlapsAppointment(timeOff, {
          id: otherTimeOff.id.toString(),
          staffId: otherTimeOff.staffId.toString(),
          startTime: otherTimeOff.isFullDay ? "00:00" : (otherTimeOff.startTime || "00:00"),
          endTime: otherTimeOff.isFullDay ? "23:59" : (otherTimeOff.endTime || "23:59"),
        } as Appointment, businessStartHour, businessEndHour)) {
          conflictGroup.push({ type: 'timeoff', item: otherTimeOff });
          processedTimeOffs.add(otherTimeOff.id);
          foundNew = true;
        }
      });
    }
    
    groups.push(conflictGroup);
  });
  
  return groups;
}

// Group appointments by conflicts - appointments that overlap are in the same group
function groupConflictingAppointments(appointments: Appointment[]): Appointment[][] {
  const groups: Appointment[][] = [];
  const processed = new Set<string>();
  
  appointments.forEach((apt) => {
    if (processed.has(apt.id)) return;
    
    // Find all appointments that conflict with this one
    const conflictGroup = [apt];
    processed.add(apt.id);
    
    // Find all overlapping appointments
    let foundNew = true;
    while (foundNew) {
      foundNew = false;
      appointments.forEach((otherApt) => {
        if (processed.has(otherApt.id)) return;
        
        // Check if this appointment conflicts with any in the current group
        const conflictsWithGroup = conflictGroup.some(groupApt => 
          appointmentsOverlap(groupApt, otherApt)
        );
        
        if (conflictsWithGroup) {
          conflictGroup.push(otherApt);
          processed.add(otherApt.id);
          foundNew = true;
        }
      });
    }
    
    groups.push(conflictGroup);
  });
  
  return groups;
}


export default function CalendarPage() {
  const navigate = useNavigate();
  // LR-01: the salon email's "Open in calendar" link lands on ?date=YYYY-MM-DD — open that day.
  const [currentDate, setCurrentDate] = useState(() => dateFromQuery(window.location.search) ?? salonNow());
  const businessId = useBusinessId();
  // LR-09: "today" and the "now" line are the salon's clock (businesses.timezone), not the browser's.
  const salonTz = useSalonTimeZone(businessId);
  const salonToday = (d: Date) => isSalonToday(d, salonTz);
  
  const { getPath } = useNavigation();
  const { appointments: apiAppointments, staff: apiStaff, loading, createAppointment: createAppointmentAPI, updateAppointment: updateAppointmentAPI, deleteAppointment: deleteAppointmentAPI, websocketStatus, refresh: refreshAppointments } = useAppointments(businessId, currentDate);
  const { services } = useServices(businessId);
  const { timeOffs, createTimeOff } = useTimeOff(businessId);
  const { businessHours, getHoursForDay, getDefaultHours } = useBusinessHours(businessId);
  
  // Helper function to get business hours for any date
  // Note: If enabled=false in DB, it means the business is CLOSED on that day
  const getBusinessHoursForDate = (date: Date): { startHour: number; endHour: number; isEnabled: boolean } => {
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayOfWeek = dayNames[date.getDay()];
    const dayHours = getHoursForDay(dayOfWeek);
    
    // If day is explicitly disabled (enabled=false in DB), business is CLOSED - entire day is non-business
    if (dayHours && !dayHours.enabled) {
      return { startHour: 0, endHour: 0, isEnabled: false };
    }
    
    // If day has hours configured, use them
    if (dayHours?.enabled && dayHours?.startTime && dayHours?.endTime) {
      return {
        startHour: parseInt(dayHours.startTime.split(':')[0]),
        endHour: parseInt(dayHours.endTime.split(':')[0]),
        isEnabled: true
      };
    }
    
    // Fallback to default hours if day not configured
    const defaultHours = getDefaultHours();
    if (defaultHours) {
      return {
        startHour: parseInt(defaultHours.startTime.split(':')[0]),
        endHour: parseInt(defaultHours.endTime.split(':')[0]),
        isEnabled: true
      };
    }
    
    // No business hours configured at all - entire day is non-business
    return { startHour: 0, endHour: 0, isEnabled: false };
  };
  
  // Get business hours for current date (for day view)
  const { startHour: businessStartHour, endHour: businessEndHour } = getBusinessHoursForDate(currentDate);
  
  // Generate time slots (always 00:00-23:59, business hours checked dynamically per day)
  const timeSlots = generateTimeSlots();
  // Time <Select> options are on a 15-min grid, but a service whose duration
  // isn't a multiple of 15 (e.g. 20/50 min) yields an off-grid end time like
  // "09:20" that has no matching option, so the dropdown renders blank even
  // though the value is set. Always include the current value as an option.
  const timeOptionsWith = (current: string) => {
    const base = timeSlots.map((s) => s.time);
    if (current && !base.includes(current)) {
      return [...base, current].sort();
    }
    return base;
  };
  
  // Convert API appointments to component format (with error handling)
  // Each service of a multi-service visit is its own appointment (same visitId). Show the
  // visit as ONE block per team member: earliest start to latest end, "A + B" inside. When
  // the visit spans several team members each gets a block, marked as linked. Every block
  // carries the whole visit so the details sheet can list it and act on all of it.
  const appointments: AppointmentWithDate[] = (() => {
    const base = (apiAppointments || []).map(convertToComponentAppointment).map((a) => {
      const svc = services.find((x) => x.id === a.serviceId);
      return { ...a, categoryId: svc?.categoryId, categoryName: svc?.categoryName };
    });
    const byVisit = new Map<string, AppointmentWithDate[]>();
    for (const a of base) {
      if (!a.visitId) continue;
      byVisit.set(a.visitId, [...(byVisit.get(a.visitId) ?? []), a]);
    }
    // "Most active" first: a visit with one pending service still needs attention.
    const ORDER = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED"];
    const combined = (rows: AppointmentWithDate[]) => {
      const set = [...new Set(rows.map((r) => (r.status || "CONFIRMED").toUpperCase()))];
      return set.length === 1 ? set[0] : [...set].sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y))[0];
    };
    const out: AppointmentWithDate[] = [];
    const done = new Set<string>();
    const isCancelled = (m: AppointmentWithDate) => (m.status || "").toUpperCase() === "CANCELLED";
    for (const a of base) {
      const group = a.visitId ? byVisit.get(a.visitId) : undefined;
      if (!group || group.length < 2) {
        if (!isCancelled(a) || !a.visitId) out.push(a);
        continue;
      }
      // A visit stays one visit when a service is cancelled: the block shows what is still
      // booked, the sheet lists the cancelled one(s) struck through.
      const active = group.filter((m) => !isCancelled(m));
      if (active.length === 0) continue;   // the whole visit is cancelled
      if (isCancelled(a) && !active.some((m) => m.staffId === a.staffId)) continue;
      const key = `${a.visitId}|${a.staffId}`;
      if (done.has(key)) continue;
      done.add(key);
      const sorted = [...group].sort((x, y) => x.startTime.localeCompare(y.startTime));
      const sortedActive = sorted.filter((m) => !isCancelled(m));
      const mine = sortedActive.filter((m) => m.staffId === a.staffId);
      const first = mine[0];
      out.push({
        ...first,
        startTime: mine.reduce((m, x) => (x.startTime < m ? x.startTime : m), first.startTime),
        endTime: mine.reduce((m, x) => (x.endTime > m ? x.endTime : m), first.endTime),
        status: combined(sortedActive),
        price: sortedActive.reduce((n, x) => n + Number(x.price ?? 0), 0),
        groupServices: mine.length > 1 ? mine.map((m) => m.service) : undefined,
        answers: sorted.flatMap((m) => m.answers ?? []),
        // Basket visits (non-package) with a same-day sibling are always grouped, even with one master.
        linked: new Set(sortedActive.map((m) => m.staffId)).size > 1 || (!first.isPackage && sortedActive.length > 1),
        groupSize: sortedActive.length,
        staffAutoAssigned: mine.some((m) => m.staffAutoAssigned),
        visitMates: sorted.map((m) => ({
          id: m.id, service: m.service, startTime: m.startTime, endTime: m.endTime, price: m.price,
          status: m.status, packageStep: m.packageStep, guestName: m.guestName, staffId: m.staffId, serviceId: String(m.serviceId ?? ""), staffName: apiStaff?.find((st) => String(st.id) === m.staffId)?.name,
          cancelledBy: m.cancelledBy, cancellationNote: m.cancellationNote,
        })),
      });
    }
    return out;
  })();

  // Legend: the categories that actually have a booking on screen, in their calendar colours.
  const legendEntries = (() => {
    const seen = new Map<string, { key: string; name: string; tint: CategoryTint }>();
    for (const a of appointments) {
      const key = a.categoryId != null ? `c${a.categoryId}` : `s${a.serviceId ?? a.service}`;
      if (!seen.has(key)) {
        seen.set(key, { key, name: a.categoryName || a.service, tint: categoryTint(a.categoryId, a.serviceId) });
      }
    }
    return [...seen.values()];
  })();
  
  // Convert staff with fallback to default staff if empty
  const staff: Staff[] = (apiStaff && apiStaff.length > 0) 
    ? apiStaff.map(s => ({
        id: s.id,
        name: s.name,
        avatar: s.avatar,
        initials: s.initials,
        workingHours: s.workingHours,
      }))
    : [{
        id: "1",
        name: "Staff Member",
        avatar: "",
        initials: "SM",
        workingHours: "10:00-19:00",
      }];

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Mounted from the first open on (so its close animation still plays); prefetched on idle.
  const [modalMounted, setModalMounted] = useState(false);
  useEffect(() => {
    if (isModalOpen) setModalMounted(true);
  }, [isModalOpen]);
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const warm = () => void loadAppointmentModal().catch(() => undefined);
    const id = idle ? idle(warm) : window.setTimeout(warm, 2000);
    return () => {
      if (!idle) window.clearTimeout(id);
    };
  }, []);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [monthViewDate, setMonthViewDate] = useState(new Date());
  const [weekViewDate, setWeekViewDate] = useState(new Date());
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [isEmployeesOpen, setIsEmployeesOpen] = useState(false);
  // Day view staff filter (desktop) and the one column shown on a phone.
  const [hiddenStaffIds, setHiddenStaffIds] = useState<string[]>([]);
  const [mobileStaffId, setMobileStaffId] = useState<string | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const isMobile = useIsMobile();
  // The phone tab bar's "+" lands here with ?new=1: open the booking form, then drop the
  // flag so a refresh or Back does not open it again.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    // From a client's profile: the booking starts with that client filled in.
    const prefillName = searchParams.get("clientName");
    if (prefillName) {
      setAppointmentForm((prev) => ({
        ...prev,
        clientId: searchParams.get("clientId") || "",
        clientName: prefillName,
        clientPhone: searchParams.get("clientPhone") || "",
        clientEmail: searchParams.get("clientEmail") || "",
      }));
    }
    setIsNewAppointmentOpen(true);
    const next = new URLSearchParams(searchParams);
    ["new", "clientId", "clientName", "clientPhone", "clientEmail"].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  // A ?date= link followed while the calendar is already open: jump there, then drop the
  // param so later day navigation is not pulled back to it.
  useEffect(() => {
    if (!searchParams.has("date")) return;
    const d = dateFromQuery(`?${searchParams.toString()}`);
    if (d) setCurrentDate(d);
    const next = new URLSearchParams(searchParams);
    next.delete("date");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  useBrandFont();

  // Names come without initials from the API; the column headers need them.
  const initialsOf = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  // Day view: a phone shows one person at a time (switcher above the grid); a desktop
  // shows everyone not filtered out — never nobody.
  const visibleStaff: Staff[] = isMobile
    ? [staff.find((x) => x.id === mobileStaffId) ?? staff[0]]
    : staff.filter((x) => !hiddenStaffIds.includes(x.id)).length
      ? staff.filter((x) => !hiddenStaffIds.includes(x.id))
      : staff;
  const [isHighlightOpen, setIsHighlightOpen] = useState(true);
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(true);
  const [viewType, setViewType] = useState<"Day" | "Month" | "Weekly">("Day");
  const [selectedDayForPopup, setSelectedDayForPopup] = useState<Date | null>(null);
  const [isDayPopupOpen, setIsDayPopupOpen] = useState(false);
  const [selectedWeeklyPopup, setSelectedWeeklyPopup] = useState<{ day: Date; staffId: string } | null>(null);
  const [isWeeklyPopupOpen, setIsWeeklyPopupOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ staffId: string; time: string } | null>(null);
  const [dragSelection, setDragSelection] = useState<{
    staffId: string;
    startTime: string; // Original click time
    endTime: string; // Current drag time
    isDragging: boolean;
    hasMoved: boolean;
  } | null>(null);
  const [selectionConflict, setSelectionConflict] = useState(false);
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);
  const [showAppointmentTimeOffConflictDialog, setShowAppointmentTimeOffConflictDialog] = useState(false);
  const [pendingAppointmentWithTimeOffData, setPendingAppointmentWithTimeOffData] = useState<Parameters<typeof createAppointmentAPI>[0] | null>(null);
  const [finalSelection, setFinalSelection] = useState<{
    staffId: string;
    staffName: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(() => salonNow(salonTz));
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const flags = useFeatureFlags();
  const offers = useServiceOffers(businessId);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [addWaiterOpen, setAddWaiterOpen] = useState(false);

  const reloadWaitlist = useCallback(() => {
    if (!businessId) return;
    waitlistService
      .listForBusiness(businessId)
      .then(rows => setWaitlist(rows.filter(w => w.status !== "CANCELLED")))
      // A failed waitlist fetch must not take the calendar down with it.
      .catch(() => setWaitlist([]));
  }, [businessId]);

  useEffect(reloadWaitlist, [reloadWaitlist]);

  // Live: a waiter who joins (or leaves, or whose offer lapses) shows up without a reload.
  useEffect(() => {
    if (!businessId) return;
    let unsubscribe: (() => void) | null = null;
    let alive = true;
    websocketService
      .connect()
      .then(() => {
        if (!alive) return;
        unsubscribe = websocketService.subscribeToWaitlist(businessId, (msg) => {
          reloadWaitlist();
          if (msg?.event === "JOINED") toast.info(tr("waitlistCal.newWaiter"));
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (unsubscribe) unsubscribe();
    };
  }, [businessId, reloadWaitlist]);

  /** Which waiting client this booking is for, so the card leaves the column when it is booked. */
  const [placingEntryId, setPlacingEntryId] = useState<Id | null>(null);
  const [calendarSearch, setCalendarSearch] = useState("");

  /**
   * Opens the booking form with this person filled in, on the day they asked for. Not
   * drag-and-drop: the slot is the salon's judgement — which staff member, how long,
   * whether it fits around the next booking — and a drop target cannot ask any of that.
   */
  /**
   * Dropping a waiting client onto a staff column at a time.
   *
   * The strip could only open a blank booking form and leave the salon to pick the slot
   * again — the one thing they were already looking at when they saw the gap. Dragging the
   * card onto the gap says who, when and with whom in one gesture.
   */
  const dropOnSlot = (entry: WaitlistEntry, staffId: string, startTime: string) => {
    const duration = entry.serviceId ? serviceDuration(String(entry.serviceId)) : 30;
    const [h, m] = startTime.split(":").map(Number);
    const end = new Date(0, 0, 0, h, m + duration);
    setAppointmentForm(prev => ({
      ...prev,
      clientId: "",
      clientName: entry.clientName || "",
      clientEmail: entry.clientEmail || "",
      clientPhone: entry.clientPhone || "",
      serviceId: entry.serviceId ? String(entry.serviceId) : "",
      staffId,
      date: format(currentDate, "yyyy-MM-dd"),
      startTime,
      endTime: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
      notes: "From the waiting list",
    }));
    setPlacingEntryId(entry.id);
    setIsNewAppointmentOpen(true);
  };

  const placeFromWaitlist = (entry: WaitlistEntry) => {
    if (entry.preferredDate) setCurrentDate(new Date(entry.preferredDate));
    setAppointmentForm(prev => ({
      ...prev,
      clientId: "",
      clientName: entry.clientName || "",
      clientEmail: entry.clientEmail || "",
      clientPhone: entry.clientPhone || "",
      serviceId: entry.serviceId ? String(entry.serviceId) : "",
      staffId: entry.staffId ? String(entry.staffId) : "",
      date: entry.preferredDate || format(currentDate, "yyyy-MM-dd"),
      notes: "From the waiting list",
    }));
    setPlacingEntryId(entry.id);
    setIsNewAppointmentOpen(true);
  };
  const [isAddReservationOpen, setIsAddReservationOpen] = useState(false);
  const [reservationForm, setReservationForm] = useState({
    staffId: "",
    date: format(currentDate, "yyyy-MM-dd"),
    startTime: "10:00",
    endTime: "11:00",
    reason: "",
  });
  const [isAddTimeOffOpen, setIsAddTimeOffOpen] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({
    staffId: "",
    startDate: format(currentDate, "yyyy-MM-dd"),
    endDate: format(currentDate, "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    isFullDay: true,
    isRecurring: false,
    recurrencePattern: "",
    recurrenceEndDate: "",
    reason: "",
    isApproved: false,
  });
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingAppointmentData, setPendingAppointmentData] = useState<Parameters<typeof createAppointmentAPI>[0] | null>(null);
  const [showTimeOffConflictDialog, setShowTimeOffConflictDialog] = useState(false);
  const [pendingTimeOffData, setPendingTimeOffData] = useState<{ staffId: string; startDate: string; endDate: string; startTime: string; endTime: string; isFullDay: boolean; reason: string } | null>(null);
  
  // Clients state for dropdown
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  
  // Appointment form state
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  /**
   * Editing a multi-service visit: its appointments in order, as they were booked. The form's
   * primary line is the first one and the "extra" lines are the rest, one to one; saving
   * writes each back (with rollback). Adding or removing a service is not offered here.
   */
  const [editingVisit, setEditingVisit] = useState<{
    ids: string[];
    date: string;
    original: { staffId: Id; serviceId: Id; startTime: string; endTime: string; price?: number }[];
  } | null>(null);
  const [appointmentForm, setAppointmentForm] = useState({
    clientId: "",
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    serviceId: "",
    staffId: "",
    startTime: "",
    endTime: "",
    notes: "",
    price: "",
    date: format(currentDate, 'yyyy-MM-dd'),
    requestedByClient: false,
    // Generated when form opens — stable across retries for the same booking attempt
    idempotencyKey: `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
  const [serviceSearchOpen, setServiceSearchOpen] = useState(false);
  const [serviceQuery, setServiceQuery] = useState("");

  // --- Advanced booking modes (composed on top of the single-booking API) ---
  // 'single' = one client/one service; 'group' = several clients (each with
  // their own staff + time); 'recurring' = the same booking repeated on a
  // schedule. Multi-service ("add another service") stacks extra sequential
  // service lines onto a single/recurring booking.
  const [bookingMode, setBookingMode] = useState<"single" | "group" | "recurring">("single");
  const [extraServices, setExtraServices] = useState<Array<{ serviceId: string; staffId: string; startTime: string; endTime: string }>>([]);
  const [groupMembers, setGroupMembers] = useState<Array<{ clientName: string; clientPhone: string; clientEmail: string; staffId: string; startTime: string }>>([]);
  const [recurrence, setRecurrence] = useState<{ frequency: "DAILY" | "WEEKLY" | "MONTHLY"; interval: number; count: number }>({ frequency: "WEEKLY", interval: 1, count: 4 });
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

  // Recurring booking: conflicts of every date, looked up before anything is saved.
  const [seriesPreview, setSeriesPreview] = useState<{ date: string; conflicts: BookingConflict[] }[] | null>(null);
  useEffect(() => {
    setSeriesPreview(null);
    if (bookingMode !== "recurring" || !isNewAppointmentOpen || !businessId) return;
    if (!appointmentForm.staffId || !appointmentForm.serviceId || !appointmentForm.startTime || !appointmentForm.endTime) return;
    const dates = computeRecurrenceDates(appointmentForm.date, recurrence);
    if (dates.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      appointmentService
        .previewSeries({ businessId, staffId: appointmentForm.staffId, serviceId: appointmentForm.serviceId, startTime: appointmentForm.startTime, endTime: appointmentForm.endTime, dates })
        .then((r) => { if (!cancelled) setSeriesPreview(r.dates); })
        .catch(() => { if (!cancelled) setSeriesPreview(null); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [bookingMode, isNewAppointmentOpen, businessId, appointmentForm.staffId, appointmentForm.serviceId, appointmentForm.startTime, appointmentForm.endTime, appointmentForm.date, recurrence]);

  // Calendar drag & resize (desktop). `dnd` is the live gesture; `pendingMove` waits for the confirm step.
  const [dnd, setDnd] = useState<{ id: string; mode: "move" | "resize"; dx: number; dy: number } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ apt: Appointment; staffId: string; startTime: string; endTime: string } | null>(null);
  const [movingBusy, setMovingBusy] = useState(false);
  const justDragged = useRef(false);
  const beginDnd = (e: React.PointerEvent, apt: Appointment, mode: "move" | "resize") => {
    if (e.button !== 0 || window.innerWidth < 768) return;
    const st = (apt.status || "").toUpperCase();
    if (!apt.apiId || apt.isClass || apt.isPackage || apt.visitId || ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(st)) return;
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const origStart = parseTime(normalizeTime(apt.startTime));
    const origEnd = parseTime(normalizeTime(apt.endTime));
    let active = false;
    const snapDy = (dy: number) => Math.round(dy / SLOT_HEIGHT) * 15;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!active && Math.hypot(dx, dy) < 6) return;
      active = true;
      setDnd({ id: apt.id, mode, dx: mode === "move" ? dx : 0, dy: Math.round(dy / SLOT_HEIGHT) * SLOT_HEIGHT });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDnd(null);
      if (!active) return;
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 80);
      const delta = snapDy(ev.clientY - startY);
      let ns = origStart, ne = origEnd, staffId = apt.staffId;
      if (mode === "move") {
        const dur = origEnd - origStart;
        ns = Math.max(0, Math.min(24 * 60 - dur, origStart + delta));
        ne = ns + dur;
        const col = document.elementsFromPoint(ev.clientX, ev.clientY).find((el) => (el as HTMLElement).dataset?.staffCol) as HTMLElement | undefined;
        if (col?.dataset.staffCol) staffId = col.dataset.staffCol;
      } else {
        ne = Math.max(origStart + 15, Math.min(24 * 60, origEnd + delta));
      }
      if (ns === origStart && ne === origEnd && staffId === apt.staffId) return;
      const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      setPendingMove({ apt, staffId, startTime: hhmm(ns), endTime: hhmm(ne) });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const confirmMove = async () => {
    if (!pendingMove?.apt.apiId) return;
    const { apt, staffId, startTime, endTime } = pendingMove;
    setMovingBusy(true);
    // Close this step first: a schedule conflict opens its own "book anyway?" dialog, which must not sit under this one.
    setPendingMove(null);
    try {
      await updateAppointmentAPI(apt.apiId!, {
        staffId,
        serviceId: apt.serviceId as string,
        appointmentDate: format(apt.date ?? currentDate, "yyyy-MM-dd"),
        startTime,
        endTime,
        clientId: apt.clientId || undefined,
        clientName: apt.clientName || undefined,
        clientPhone: apt.clientPhone || undefined,
        clientEmail: apt.clientEmail || undefined,
        price: apt.price,
        notes: apt.notes,
      });
    } catch (err) {
      // 409 / validation: the hook already showed a localized message; the declined override just closes.
      refreshAppointments();
    } finally {
      setMovingBusy(false);
    }
  };

  // FG-W3-01: package services (several specialists in one visit). Picking one swaps the staff/time
  // pickers for the package slot finder; the server plans who does which step.
  const [packages, setPackages] = useState<Map<string, ServicePackage>>(new Map());
  const [packageParty, setPackageParty] = useState(1);
  useEffect(() => {
    if (!isNewAppointmentOpen || !businessId) return;
    let cancelled = false;
    serviceService
      .getPackagesByBusiness(businessId)
      .then((list) => {
        if (!cancelled) setPackages(new Map((list ?? []).map((p) => [String(p.serviceId), p])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [businessId, isNewAppointmentOpen]);
  const selectedPackage = appointmentForm.serviceId ? packages.get(String(appointmentForm.serviceId)) : undefined;
  useEffect(() => {
    // A new package starts with one person, and never more than it allows.
    setPackageParty((n) => Math.max(1, Math.min(n, selectedPackage?.maxPartySize ?? 1)));
  }, [selectedPackage]);

  // Reset advanced-booking state whenever the form closes.
  useEffect(() => {
    if (!isNewAppointmentOpen) {
      setBookingMode("single");
      setExtraServices([]);
      setEditingVisit(null);
      setGroupMembers([]);
      setRecurrence({ frequency: "WEEKLY", interval: 1, count: 4 });
    }
  }, [isNewAppointmentOpen]);

  // Loaded on mount, not only when the booking form opens: the calendar blocks need each
  // client's visit count to say who is new and who is a regular.
  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, isNewAppointmentOpen]);

  /**
   * Visits per client, for the new/regular badges.
   *
   * Keyed three ways on purpose: an appointment carries a client id when it was booked
   * against a record, and only a typed-in name when it was not. Matching on the name alone
   * missed every booking where the two differed by a middle name or a capital letter, so
   * the badges never appeared.
   */
  const visitsByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      const visits = c.totalVisits ?? 0;
      map.set(`id:${c.id}`, visits);
      const name = `${c.firstName} ${c.lastName || ""}`.trim().toLowerCase();
      if (name) map.set(`name:${name}`, visits);
      if (c.email) map.set(`email:${c.email.trim().toLowerCase()}`, visits);
    }
    return map;
  }, [clients]);

  const visitsFor = (who?: { clientId?: Id; clientName?: string; clientEmail?: string } | string) => {
    const key = typeof who === "string" ? { clientName: who } : who;
    if (!key) return null;
    if (key.clientId != null) {
      const byId = visitsByClient.get(`id:${key.clientId}`);
      if (byId != null) return byId;
    }
    if (key.clientEmail) {
      const byEmail = visitsByClient.get(`email:${key.clientEmail.trim().toLowerCase()}`);
      if (byEmail != null) return byEmail;
    }
    if (key.clientName) {
      const byName = visitsByClient.get(`name:${key.clientName.trim().toLowerCase()}`);
      if (byName != null) return byName;
    }
    return null;
  };

  /** Clients whose birthday (month-day) falls on a given appointment day, same three keys as visits. */
  const birthdayByClient = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) {
      const md = typeof c.birthday === "string" && c.birthday.length >= 10 ? c.birthday.slice(5, 10) : "";
      if (!md) continue;
      map.set(`id:${c.id}`, md);
      const name = `${c.firstName} ${c.lastName || ""}`.trim().toLowerCase();
      if (name) map.set(`name:${name}`, md);
      if (c.email) map.set(`email:${c.email.trim().toLowerCase()}`, md);
    }
    return map;
  }, [clients]);

  /** Everything the small icons need beyond the appointment row: birthday today, VIP (no list field yet). */
  const flagCtxFor = (apt: { clientId?: Id; clientName?: string; clientEmail?: string; date?: Date }) => {
    const md =
      (apt.clientId != null ? birthdayByClient.get(`id:${apt.clientId}`) : undefined) ??
      (apt.clientEmail ? birthdayByClient.get(`email:${apt.clientEmail.trim().toLowerCase()}`) : undefined) ??
      (apt.clientName ? birthdayByClient.get(`name:${apt.clientName.trim().toLowerCase()}`) : undefined);
    return { birthday: !!md && !!apt.date && format(apt.date, "MM-dd") === md };
  };

  const blockVisuals = (apt: {
    clientName?: string;
    notes?: string;
    clientId?: Id;
    clientEmail?: string;
    price?: number | string | null;
    listPrice?: number | string | null;
  }) => ({
    colorClasses: clientColorClasses(apt.clientName),
    tags: appointmentTags({
      notes: apt.notes,
      visits: visitsFor(apt),
      // Recorded on the booking when it was priced, so a block still shows the offer it
      // was taken on after the offer itself has ended.
      discountPercent: discountOn(apt.price, apt.listPrice),
    }),
  });

  /** What was taken off this booking, as a percentage, or null when nothing was. */
  const discountOn = (price: unknown, listPrice: unknown): number | null => {
    const paid = Number(price);
    const listed = Number(listPrice);
    if (!Number.isFinite(paid) || !Number.isFinite(listed) || listed <= paid || listed <= 0) {
      return null;
    }
    return ((listed - paid) / listed) * 100;
  };

  const loadClients = async () => {
    try {
      const data = await clientService.getClientsByBusiness(businessId);
      setClients(data);
    } catch (error) {
      console.error("Failed to load clients:", error);
      // Don't show error toast, just log it
    }
  };

  // Duration (minutes) for a service id, defaulting to 30 when unknown.
  const serviceDuration = (serviceId: string): number => {
    const s = services.find((x) => x.id.toString() === serviceId);
    return s?.durationMinutes || 30;
  };
  /**
   * What this booking will actually cost, offers applied.
   *
   * The catalogue carries the list price, and the backend re-prices the booking when it
   * saves it — so a salon booking a service that is 20% off saw one number on the form
   * and a different one on the appointment.
   */
  const servicePrice = (serviceId: string): number | undefined => {
    const service = services.find((x) => x.id.toString() === serviceId);
    if (!service) return undefined;
    return offers.get(service.id)?.price ?? service.price;
  };
  // Fold the "requested by client" flag into notes (no dedicated column yet).
  const withRequestedFlag = (notes: string, requested: boolean): string | undefined => {
    const tagged = requested ? ["⭐ Requested by client", notes].filter(Boolean).join(" — ") : notes;
    return tagged || undefined;
  };

  /**
   * FG-W3-01: book the chosen package for the chosen party at the chosen start. One request; the
   * server plans the specialists again and answers a conflict with the usual "book anyway" dialog.
   */
  const submitPackageBooking = async () => {
    const base = appointmentForm;
    if (!selectedPackage || !businessId) return;
    if (!base.startTime) {
      toast.error(tr("calendar.packagePickTime"));
      return;
    }
    setIsBatchSubmitting(true);
    try {
      const result = await appointmentService.createPackageBooking({
        businessId,
        serviceId: base.serviceId,
        partySize: packageParty,
        clientId: base.clientId ? base.clientId : undefined,
        clientName: base.clientName || undefined,
        clientPhone: base.clientPhone || undefined,
        clientEmail: base.clientEmail || undefined,
        appointmentDate: base.date,
        startTime: base.startTime,
        notes: withRequestedFlag(base.notes, base.requestedByClient),
      });
      toast.success(tr("calendar.packageCreated", { count: result.items?.length ?? 0 }));
      refreshAppointments();
      setIsNewAppointmentOpen(false);
      setEditingAppointmentId(null);
      setFinalSelection(null);
      setPackageParty(1);
      setAppointmentForm({ clientId: "", clientName: "", clientPhone: "", clientEmail: "", serviceId: "", staffId: "", startTime: "", endTime: "", notes: "", price: "", date: format(currentDate, "yyyy-MM-dd"), requestedByClient: false, idempotencyKey: `booking-${Date.now()}-${Math.random().toString(36).slice(2)}` });
    } catch (err) {
      if (!(err instanceof BookingConflictDeclined)) {
        toast.error(tr("calendar.packageNotCreated", { reason: (err instanceof Error && err.message) || "" }));
      }
    } finally {
      setIsBatchSubmitting(false);
    }
  };

  // Advanced bookings (group / recurring / multi-service) are composed from the
  // existing single-booking endpoint — one race-safe request per row — so the
  // core booking path (with its atomic no-double-booking guard) stays untouched.
  // Rows whose slot is already taken are skipped and reported, not fatal.
  const submitAdvancedBooking = async () => {
    const base = appointmentForm;
    if (!base.serviceId) {
      toast.error(tr("calendar.pleaseSelectAService"));
      return;
    }
    type CreateReq = Parameters<typeof createAppointmentAPI>[0];
    const reqs: CreateReq[] = [];
    const notes = withRequestedFlag(base.notes, base.requestedByClient);

    if (bookingMode === "group") {
      // The primary client is member #1; each member gets their own staff + time
      // and the double-booking guard enforces "one staff, one client at a time".
      const members = [
        { clientName: base.clientName, clientPhone: base.clientPhone, clientEmail: base.clientEmail, staffId: base.staffId, startTime: base.startTime },
        ...groupMembers,
      ];
      for (const m of members) {
        if (!m.staffId || !m.startTime) continue;
        reqs.push({
          staffId: m.staffId,
          serviceId: base.serviceId,
          appointmentDate: base.date,
          startTime: m.startTime,
          endTime: addMinutesToTime(m.startTime, serviceDuration(base.serviceId)),
          clientName: m.clientName || undefined,
          clientPhone: m.clientPhone || undefined,
          clientEmail: m.clientEmail || undefined,
          price: servicePrice(base.serviceId),
          notes,
        });
      }
    } else {
      // single or recurring: one "visit" = primary service line + any extra
      // (multi-service) lines, repeated across the recurrence dates.
      const lines = [
        { serviceId: base.serviceId, staffId: base.staffId, startTime: base.startTime, endTime: base.endTime },
        ...extraServices,
      ];
      const dates = bookingMode === "recurring" ? computeRecurrenceDates(base.date, recurrence) : [base.date];
      const seriesId = bookingMode === "recurring" ? crypto.randomUUID() : undefined;
      for (const d of dates) {
        // H-01: 2+ services on one date are ONE visit — the same visit_id grouping a web
        // cart gets, so the calendar card, details, till (one ticket) and partial cancel
        // treat them as a single booking. A lone service stays a standalone booking.
        const filled = lines.filter((l) => l.serviceId && l.staffId && l.startTime && l.endTime);
        const visitId = filled.length > 1 ? crypto.randomUUID() : undefined;
        for (const l of filled) {
          reqs.push({
            staffId: l.staffId,
            serviceId: l.serviceId,
            appointmentDate: d,
            startTime: l.startTime,
            endTime: l.endTime,
            clientName: base.clientName || undefined,
            clientPhone: base.clientPhone || undefined,
            clientEmail: base.clientEmail || undefined,
            price: servicePrice(l.serviceId),
            notes,
            ...(visitId ? { visitId } : {}),
            ...(seriesId ? { seriesId } : {}),
          });
        }
      }
    }

    if (reqs.length === 0) {
      toast.error(tr("calendar.nothingToBookPleaseComplete"));
      return;
    }

    setIsBatchSubmitting(true);
    let created = 0;
    let skipped = 0;
    let visitsCreated = 0;
    const failedVisits: string[] = [];
    // H-01: the services of one visit stand or fall together (as a web cart does). Requests of
    // one visit are consecutive; if one fails, the ones already saved are removed again.
    for (let i = 0; i < reqs.length; ) {
      const visitId = reqs[i].visitId;
      let j = i + 1;
      while (visitId && j < reqs.length && reqs[j].visitId === visitId) j++;
      const group = reqs.slice(i, j);
      i = j;
      const savedIds: string[] = [];
      let failure: unknown = null;
      // The first service of a visit makes the server resolve/create the client record; the
      // next services must carry that client id, or the server answers "Unknown visit" (the
      // visit's client no longer matches a request that only has a typed name and phone).
      let visitClientId: string | undefined;
      for (const [k, r] of group.entries()) {
        try {
          // Only the visit's last service triggers the (one) confirmation email.
          const withClient = visitClientId ? { ...r, clientId: visitClientId } : r;
          const req = visitId && k < group.length - 1 ? { ...withClient, visitPending: true } : withClient;
          const saved = await createAppointmentAPI(req, { silent: true });
          if (saved?.apiId) savedIds.push(saved.apiId);
          if (visitId && !visitClientId && saved?.clientId) visitClientId = String(saved.clientId);
        } catch (err) {
          failure = err;
          break;
        }
      }
      if (failure === null) {
        created += group.length;
        if (visitId) visitsCreated++;
        continue;
      }
      if (!visitId) {
        skipped++;
        continue;
      }
      // Undo silently (DELETE = soft cancel without a customer email), so no half visit stays.
      for (const id of savedIds) {
        try {
          await appointmentService.deleteAppointment(id);
        } catch {
          /* best effort; the calendar refresh below shows anything left */
        }
      }
      skipped += group.length;
      if (!(failure instanceof BookingConflictDeclined)) {
        failedVisits.push((failure instanceof Error && failure.message) || "");
      }
    }
    setIsBatchSubmitting(false);
    if (failedVisits.length > 0 || skipped > 0) refreshAppointments();

    if (failedVisits.length > 0) {
      const reason = failedVisits.find((m) => m) ?? "";
      toast.error(tr("calendar.visitNotCreated", { reason }));
    } else if (created > 0 && skipped === 0 && visitsCreated === 1 && created === reqs.length && bookingMode !== "recurring") {
      toast.success(tr("calendar.visitCreated", { count: created }));
    } else if (created > 0 && skipped === 0) {
      toast.success(tr("calendar.appointmentsCreated", { count: created }));
    } else if (created > 0) {
      toast.info(tr("calendar.createdSkippedSlotAlreadyTaken", { created, skipped }));
    } else {
      toast.error(tr("calendar.noAppointmentsCreatedSlotTaken", { count: skipped }));
    }

    if (created > 0) {
      setIsNewAppointmentOpen(false);
      setEditingAppointmentId(null);
      setFinalSelection(null);
      setAppointmentForm({ clientId: "", clientName: "", clientPhone: "", clientEmail: "", serviceId: "", staffId: "", startTime: "", endTime: "", notes: "", price: "", date: format(currentDate, "yyyy-MM-dd"), requestedByClient: false, idempotencyKey: `booking-${Date.now()}-${Math.random().toString(36).slice(2)}` });
    }
  };

  // Keep the appointment's date in sync with the day being viewed.
  // Without this the form's `date` stays stuck at its initial (mount-time)
  // value, so every appointment was saved to "today" regardless of the
  // day the user had navigated to. Runs when the form opens and whenever
  // the viewed day changes while it's open. The user can still override it
  // via the date picker inside the form (that sets `date` directly).
  useEffect(() => {
    if (isNewAppointmentOpen) {
      setAppointmentForm(prev => ({ ...prev, date: format(currentDate, 'yyyy-MM-dd') }));
    }
  }, [isNewAppointmentOpen, currentDate]);

  // Update form when finalSelection changes and form is opened
  useEffect(() => {
    if (finalSelection && isNewAppointmentOpen) {
      setAppointmentForm(prev => ({
        ...prev,
        staffId: finalSelection.staffId || prev.staffId,
        startTime: finalSelection.startTime || prev.startTime,
        // Don't set endTime here - let it be calculated from service duration
        endTime: prev.endTime || finalSelection.endTime || "",
      }));
    }
  }, [finalSelection, isNewAppointmentOpen]);

  // Auto-calculate end time based on service duration when service or start time changes
  useEffect(() => {
    if (appointmentForm.serviceId && appointmentForm.startTime && isNewAppointmentOpen) {
      const selectedService = services.find(s => s.id.toString() === appointmentForm.serviceId);
      if (selectedService && selectedService.durationMinutes) {
        const calculatedEndTime = addMinutesToTime(appointmentForm.startTime, selectedService.durationMinutes);
        // Only update if the calculated time is different to avoid unnecessary re-renders
        setAppointmentForm(prev => {
          if (prev.endTime !== calculatedEndTime) {
            return {
              ...prev,
              endTime: calculatedEndTime,
            };
          }
          return prev;
        });
      }
    }
  }, [appointmentForm.serviceId, appointmentForm.startTime, services, isNewAppointmentOpen]);

  const goToPrevDay = () => setCurrentDate(subDays(currentDate, 1));
  const goToNextDay = () => setCurrentDate(addDays(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(salonNow(salonTz));
    setMonthViewDate(salonNow(salonTz));
    setWeekViewDate(salonNow(salonTz));
  };

  const goToPrevMonth = () => setMonthViewDate(subMonths(monthViewDate, 1));
  const goToNextMonth = () => setMonthViewDate(addMonths(monthViewDate, 1));

  const goToPrevWeek = () => setWeekViewDate(subWeeks(weekViewDate, 1));
  const goToNextWeek = () => setWeekViewDate(addWeeks(weekViewDate, 1));

  // Get appointments for a specific date
  /**
   * The search box was an input with no state and no handler — you could type in it and
   * the calendar did not move. It filters what the grid draws now: client, service or
   * staff member.
   */
  const matchesSearch = (apt: AppointmentWithDate) => {
    const q = calendarSearch.trim().toLowerCase();
    if (!q) return true;
    return [apt.clientName, apt.service, apt.staffName]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q));
  };

  const getAppointmentsForDate = (date: Date): AppointmentWithDate[] => {
    return appointments.filter(apt => isSameDay(apt.date, date) && matchesSearch(apt));
  };

  // Get appointments for a specific date and staff
  const getAppointmentsForDateAndStaff = (date: Date, staffId: string): AppointmentWithDate[] => {
    return groupClassSessions(appointments.filter(
      apt => isSameDay(apt.date, date) && apt.staffId === staffId && matchesSearch(apt)
    ));
  };

  // Get week days (Monday to Sunday)
  /**
   * What is waiting on the salon today, in one list.
   *
   * The bell had no handler at all. This is not a notification feed — it is the three
   * things on this day that need a decision: a booking nobody has confirmed, someone
   * who came and has not paid, and people waiting for a slot.
   */
  const attention = useMemo(() => {
    const todays = appointments.filter(apt => isSameDay(apt.date, currentDate));
    const items: { label: string; detail: string; tone: string; name?: string; chip?: string; onClick: () => void }[] = [];

    for (const apt of todays.filter(a => a.status === "PENDING")) {
      items.push({
        label: tr("calendar.confirm2", { value: apt.clientName || tr("calendar.confirmBookingGeneric") }),
        detail: `${apt.startTime} · ${apt.service}`,
        name: apt.clientName || undefined,
        chip: tr("waitlistCal.waiting"),
        tone: "bg-amber-500",
        onClick: () => handleAppointmentClick(apt),
      });
    }
    for (const apt of todays.filter(a => a.status === "COMPLETED")) {
      items.push({
        label: tr("calendar.takePayment3", { value: apt.clientName || tr("common.client") }),
        detail: `${apt.startTime} · ${apt.service}`,
        name: apt.clientName || undefined,
        tone: "bg-[rgb(var(--reg-brand))]",
        onClick: () => handleAppointmentClick(apt),
      });
    }
    for (const w of waitlist) {
      items.push({
        label: tr("calendar.isWaiting", { value: w.clientName || w.clientEmail || tr("common.client") }),
        detail: [w.serviceName, w.preferredDate || "any date"].filter(Boolean).join(" · "),
        name: w.clientName || w.clientEmail || undefined,
        chip: tr("waitlistCal.waiting"),
        tone: "bg-violet-500",
        onClick: () => placeFromWaitlist(w),
      });
    }
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- placeFromWaitlist is rebuilt each render and only reads currentDate, which is listed
  }, [appointments, currentDate, waitlist]);

  const getWeekDays = (date: Date): Date[] => {
    const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  // Update current time every minute
  useEffect(() => {
    setCurrentTime(salonNow(salonTz));
    const interval = setInterval(() => {
      setCurrentTime(salonNow(salonTz));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [salonTz]);

  // Note: useAppointments and useTimeOff hooks already handle loading data
  // when currentDate changes and on mount. WebSocket handles all real-time updates.
  // No need for additional refresh logic here.

  // Check if current date is being viewed
  const isCurrentDate = salonToday(currentDate);

  // Open the day at the salon's opening hour (or an hour before now, today) instead of
  // midnight: the grid used to start with nine hours of closed, hatched rows.
  const dayGridRef = useRef<HTMLDivElement>(null);
  const openingHour = getBusinessHoursForDate(currentDate).startHour;
  useEffect(() => {
    if (viewType !== "Day" || loading || !dayGridRef.current) return;
    const nowHour = salonNow(salonTz).getHours();
    const target = isCurrentDate ? Math.max(openingHour, Math.min(nowHour - 1, 23)) : openingHour;
    dayGridRef.current.scrollTop = Math.max(0, target) * 4 * SLOT_HEIGHT;
  }, [viewType, loading, openingHour, isCurrentDate, currentDate, salonTz]);

  // Day grid geometry (BF40): hour column 64px, columns 12px apart, widened to fill the card.
  const HOUR_COL = isMobile ? 52 : 64;
  const COL_GAP = 12;
  const [gridW, setGridW] = useState(0);
  useEffect(() => {
    const el = dayGridRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setGridW(el.clientWidth));
    ro.observe(el);
    setGridW(el.clientWidth);
    return () => ro.disconnect();
  }, [viewType, loading, isMobile]);
  const colCount = Math.max(1, visibleStaff.length);
  const colW = Math.max(isMobile ? 120 : 200, Math.floor((gridW - 12 - HOUR_COL) / colCount) - COL_GAP);
  const gridInnerW = HOUR_COL + colCount * (colW + COL_GAP);

  // Get current time position
  const getCurrentTimePosition = (): number | null => {
    if (!isCurrentDate) return null;
    
    const now = currentTime;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    
    // Calculate position based on 15-minute slots
    return (totalMinutes / 15) * SLOT_HEIGHT;
  };

  const handleAppointmentClick = (appointment: Appointment | AppointmentWithDate) => {
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAppointment(null);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    const liveMates = (appointment.visitMates ?? []).filter((m) => (m.status || "").toUpperCase() !== "CANCELLED");
    const mates = liveMates.length > 1 ? liveMates : null;
    // Several services booked together: load every one of them, exactly as booked.
    if (mates) {
      const sorted = [...mates].sort((a, b) => a.startTime.localeCompare(b.startTime));
      const toHm = (t: string) => t.slice(0, 5);
      setEditingVisit({
        ids: sorted.map((m) => m.id),
        date: appointment.date ? format(appointment.date, 'yyyy-MM-dd') : format(currentDate, 'yyyy-MM-dd'),
        original: sorted.map((m) => ({
          staffId: m.staffId, serviceId: m.serviceId,
          startTime: m.startTime, endTime: m.endTime, price: m.price,
        })),
      });
      setExtraServices(sorted.slice(1).map((m) => ({
        serviceId: String(m.serviceId ?? ""), staffId: String(m.staffId ?? ""),
        startTime: toHm(m.startTime), endTime: toHm(m.endTime),
      })));
    } else {
      setEditingVisit(null);
    }
    const first = mates ? [...mates].sort((a, b) => a.startTime.localeCompare(b.startTime))[0] : null;
    setEditingAppointmentId(first?.id ?? appointment.apiId ?? null);
    setAppointmentForm({
      // Opening a booking to edit used to drop these two: cancelling the edit and then
      // creating a new booking sent no idempotency key.
      requestedByClient: ((appointment as { notes?: string }).notes ?? "").includes("Requested by client"),
      idempotencyKey: `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      clientId: appointment.clientId ? String(appointment.clientId) : "",
      clientName: appointment.clientName || "",
      clientPhone: appointment.clientPhone || "",
      clientEmail: appointment.clientEmail || "",
      // The service id, not its name: the form's service select is keyed by id.
      serviceId: first ? String(first.serviceId ?? "") : appointment.serviceId != null ? String(appointment.serviceId) : "",
      staffId: (first?.staffId ?? appointment.staffId) || "",
      startTime: (first ? first.startTime : appointment.startTime || "").slice(0, 5),
      endTime: (first ? first.endTime : appointment.endTime || "").slice(0, 5),
      notes: appointment.notes || "",
      price: first ? String(first.price ?? "") : appointment.price ? String(appointment.price) : "",
      date: appointment.date ? format(appointment.date, 'yyyy-MM-dd') : format(currentDate, 'yyyy-MM-dd'),
    });
    handleCloseModal();
    setIsNewAppointmentOpen(true);
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (appointment?.apiId) {
      try {
        await deleteAppointmentAPI(appointment.apiId);
    handleCloseModal();
      } catch (error) {
        // Error already handled in hook
      }
    } else {
      toast.error(tr("calendar.appointmentNotFound"));
    }
  };

  const selectedStaff = selectedAppointment 
    ? staff.find((s) => s.id === selectedAppointment.staffId) 
    : undefined;

  // Calendar month navigation
  const calendarStart = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const prevMonth = () => setCalendarMonth(subMonths(calendarMonth, 1));
  const nextMonth = () => setCalendarMonth(addMonths(calendarMonth, 1));

  // Waiting clients on the grid. A toggle in the view options (default on); the server flag
  // `waitlist` still switches the whole feature off.
  const [showWaiting, setShowWaitingState] = useState<boolean>(() => {
    try { return localStorage.getItem("calendar.showWaiting") !== "0"; } catch { return true; }
  });
  const setShowWaiting = (on: boolean) => {
    setShowWaitingState(on);
    try { localStorage.setItem("calendar.showWaiting", on ? "1" : "0"); } catch { /* per-viewer convenience only */ }
  };
  const waitingVisible = flags.waitlist !== false && showWaiting;
  // Row density: "comfy" (default) or "compact" for busy days; remembered per browser.
  const [density, setDensityState] = useState<CalendarDensity>(() => {
    try { return localStorage.getItem("calendar.density") === "compact" ? "compact" : "comfy"; } catch { return "comfy"; }
  });
  const setDensity = (d: CalendarDensity) => {
    setDensityState(d);
    try { localStorage.setItem("calendar.density", d); } catch { /* per-viewer convenience only */ }
  };
  const waitingEnabled = waitingVisible && viewType === "Day";
  /** Masters (in calendar order) who do this waiter's service; all of them when the service lists none. */
  const mastersForService = (w: WaitlistEntry, from: Staff[]): Staff[] => {
    const doing = services.find(x => w.serviceId && x.id.toString() === String(w.serviceId))?.staffIds;
    return from.filter(st => !doing || doing.length === 0 || doing.map(String).includes(String(st.id)));
  };
  /** Week view: compact chips per master and day; a click opens that day, where the full block lives. */
  const waitingChipsFor = (day: Date, staffId: string): WaitlistEntry[] => {
    if (!waitingVisible || viewType !== "Weekly") return [];
    const key = format(day, "yyyy-MM-dd");
    return waitlist.filter(w => {
      if (!waitsOn(w, key) || !w.preferredDate) return false;
      const owner = w.staffId
        ? String(w.staffId)
        : isFreed(w) && w.freedStaffId
          ? String(w.freedStaffId)
          : mastersForService(w, staff)[0]?.id;
      return owner !== undefined && String(owner) === String(staffId);
    });
  };
  const dayKey = format(currentDate, "yyyy-MM-dd");
  const waitingForDay = useMemo(
    () =>
      waitingEnabled
        ? waitlist
            .filter(w => waitsOn(w, dayKey))
            .map(w => {
              const dur = w.serviceId ? serviceDuration(String(w.serviceId)) : 30;
              const hours = getBusinessHoursForDate(currentDate);
              const working = mastersForService(w, visibleStaff).filter(
                st => !!st.workingHours && !getTimeOffsForStaffAndDate(timeOffs, st.id, currentDate).some(to => to.isFullDay),
              );
              const ctx = { masters: working.map(st => st.id), openMin: (hours.isEnabled ? hours.startHour : 9) * 60 };
              return { entry: w, durationMin: dur, placement: placeWaiting(w, dur, ctx) };
            })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serviceDuration reads `services`, listed
    [waitingEnabled, waitlist, dayKey, services, apiStaff, timeOffs, isMobile, hiddenStaffIds],
  );
  // What is really booked (appointments and time off) that day, per master. Waiting blocks are
  // deliberately not in here: a waiting client does not occupy the chair.
  const dayBusy: BusyRange[] = useMemo(() => {
    if (!waitingEnabled) return [];
    const out: BusyRange[] = appointments
      .filter(a => isSameDay(a.date, currentDate) && (a as { status?: string }).status !== "CANCELLED")
      .map(a => ({ staffId: a.staffId, start: normalizeTime(a.startTime), end: normalizeTime(a.endTime) }));
    for (const st of staff) {
      for (const to of getTimeOffsForStaffAndDate(timeOffs, st.id, currentDate)) {
        out.push({ staffId: st.id, start: to.isFullDay ? "00:00" : normalizeTime(to.startTime || "00:00"), end: to.isFullDay ? "23:59" : normalizeTime(to.endTime || "23:59") });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- staff is derived from apiStaff each render
  }, [waitingEnabled, appointments, timeOffs, currentDate, apiStaff]);
  const waitingProps = (w: { entry: WaitlistEntry; durationMin: number; placement: WaitingPlacement }) => {
    const { startHour, endHour } = getBusinessHoursForDate(currentDate);
    const masters = mastersForService(w.entry, staff).map(st => ({ id: st.id, name: st.name }));
    const now = salonNow(salonTz);
    return {
      entry: w.entry,
      placement: w.placement,
      businessId: String(businessId),
      dateStr: dayKey,
      durationMin: w.durationMin,
      masters,
      busy: dayBusy,
      dayStartMin: startHour * 60,
      dayEndMin: Math.max(endHour, startHour + 1) * 60,
      notBeforeMin: isSameDay(currentDate, now) ? now.getHours() * 60 + now.getMinutes() : undefined,
      onBook: dropOnSlot,
      onChanged: reloadWaitlist,
    };
  };

  const closeBookingDrawer = () => {
    setIsNewAppointmentOpen(false);
    setEditingAppointmentId(null);
    setAppointmentForm({
      clientId: "",
      clientName: "",
      clientPhone: "",
      clientEmail: "",
      serviceId: "",
      staffId: "",
      startTime: "",
      endTime: "",
      notes: "",
      price: "",
      date: format(currentDate, 'yyyy-MM-dd'),
      requestedByClient: false,
      // A fresh key for the next booking: closing the sheet dropped it, so the next
      // one lost its double-click protection.
      idempotencyKey: `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
  };

  // Next client of the day (side panel): first live booking still to come; before opening hours, the first of the day.
  const nextClient = (() => {
    const nowHm = format(currentTime, "HH:mm");
    const live = getAppointmentsForDate(currentDate)
      .filter((a) => !["CANCELLED", "NO_SHOW", "COMPLETED"].includes((a.status || "").toUpperCase()))
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    if (live.length === 0) return null;
    return (isCurrentDate ? live.find((a) => (a.endTime || a.startTime || "") >= nowHm) : null) ?? live[0];
  })();

  // Booking drawer total: reflects group members / extra services / occurrences.
  const bookingTotal = (() => {
    const primary = servicePrice(appointmentForm.serviceId) || 0;
    if (bookingMode === "group") return primary * (groupMembers.length + 1);
    const perVisit = primary + extraServices.reduce((sum, es) => sum + (servicePrice(es.serviceId) || 0), 0);
    const occurrences = bookingMode === "recurring" ? computeRecurrenceDates(appointmentForm.date, recurrence).length : 1;
    return perVisit * occurrences;
  })();

  // Save from the booking drawer: validation, then package / advanced / multi-service / single create-or-update.
  const submitBooking = async () => {
    try {
      // FG-W3-01: a package goes through its own endpoint (server-side planner).
      if (selectedPackage && !editingAppointmentId) {
        const day = parse(appointmentForm.date || format(currentDate, 'yyyy-MM-dd'), 'yyyy-MM-dd', new Date());
        const todayStart = salonNow(salonTz);
        todayStart.setHours(0, 0, 0, 0);
        if (day < todayStart) {
          toast.error(tr("calendar.cannotCreateAppointmentsInThe"));
          return;
        }
        await submitPackageBooking();
        return;
      }
      if (!appointmentForm.serviceId) {
        toast.error(tr("calendar.pleaseSelectAService"));
        return;
      }
      if (!appointmentForm.staffId) {
        toast.error(tr("calendar.pleaseSelectAStaffMember"));
        return;
      }
      if (!appointmentForm.startTime || !appointmentForm.endTime) {
        toast.error(tr("calendar.pleaseSelectStartAndEnd"));
        return;
      }

      // End time must be after start time
      if (appointmentForm.startTime && appointmentForm.endTime &&
          appointmentForm.startTime >= appointmentForm.endTime) {
        toast.error(tr("calendar.endTimeMustBeAfter"));
        return;
      }

      // Email format validation
      const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
      if (appointmentForm.clientEmail && !emailRegex.test(appointmentForm.clientEmail)) {
        toast.error(tr("calendar.invalidEmailAddressFormat"));
        return;
      }

      // Field length limits
      if (appointmentForm.clientName && appointmentForm.clientName.length > 255) {
        toast.error(tr("calendar.clientNameIsTooLong"));
        return;
      }
      if (appointmentForm.notes && appointmentForm.notes.length > 2000) {
        toast.error(tr("calendar.notesAreTooLongMax"));
        return;
      }

      // Past date check for new appointments only
      const appointmentDate = parse(appointmentForm.date || format(currentDate, 'yyyy-MM-dd'), 'yyyy-MM-dd', new Date());
      const today = salonNow(salonTz);
      today.setHours(0, 0, 0, 0);
      if (!editingAppointmentId && appointmentDate < today) {
        toast.error(tr("calendar.cannotCreateAppointmentsInThe"));
        return;
      }

      // Advanced modes (group / recurring / multi-service) are composed
      // from the single-booking endpoint — hand off to the batch submitter.
      if (!editingAppointmentId && (bookingMode !== "single" || extraServices.length > 0)) {
        await submitAdvancedBooking();
        return;
      }

      // A multi-service visit is saved as a whole: every appointment of it, one after
      // the other. If one is refused, the ones already written are put back.
      if (editingAppointmentId && editingVisit) {
        const lines = [
          { serviceId: appointmentForm.serviceId, staffId: appointmentForm.staffId, startTime: appointmentForm.startTime, endTime: appointmentForm.endTime },
          ...extraServices,
        ];
        if (lines.length !== editingVisit.ids.length || lines.some((l) => !l.serviceId || !l.staffId || !l.startTime || !l.endTime)) {
          toast.error(tr("calendar.fillInTheServiceTeam"));
          return;
        }
        const date = appointmentForm.date || format(currentDate, 'yyyy-MM-dd');
        const notes = withRequestedFlag(appointmentForm.notes, appointmentForm.requestedByClient);
        const who = {
          clientId: appointmentForm.clientId ? appointmentForm.clientId : undefined,
          clientName: appointmentForm.clientName || undefined,
          clientPhone: appointmentForm.clientPhone || undefined,
          clientEmail: appointmentForm.clientEmail || undefined,
        };
        const done: number[] = [];
        try {
          for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            const o = editingVisit.original[i];
            await appointmentService.updateAppointment(editingVisit.ids[i], {
              businessId: businessId!,
              staffId: l.staffId,
              serviceId: l.serviceId,
              appointmentDate: date,
              startTime: l.startTime,
              endTime: l.endTime,
              ...who,
              // The price the booking was made at, unless the service itself changed.
              price: String(o.serviceId) === l.serviceId ? o.price : servicePrice(l.serviceId),
              notes,
            } as never);
            done.push(i);
          }
        } catch (err) {
          for (const i of done) {
            const o = editingVisit.original[i];
            await appointmentService.updateAppointment(editingVisit.ids[i], {
              businessId: businessId!, staffId: o.staffId, serviceId: o.serviceId,
              appointmentDate: editingVisit.date,
              startTime: o.startTime, endTime: o.endTime, price: o.price, ...who,
            } as never).catch(() => undefined);
          }
          toast.error(tr("calendar.nothingWasChanged", { value: (err instanceof Error && err.message) || tr("calendar.couldNotSave") }));
          await refreshAppointments();
          return;
        }
        toast.success(tr("calendar.bookingUpdated"));
        await refreshAppointments();
        setIsNewAppointmentOpen(false);
        setEditingAppointmentId(null);
        setEditingVisit(null);
        setAppointmentForm({ clientId: "", clientName: "", clientPhone: "", clientEmail: "", serviceId: "", staffId: "", startTime: "", endTime: "", notes: "", price: "", date: format(currentDate, 'yyyy-MM-dd'), requestedByClient: false, idempotencyKey: `booking-${Date.now()}-${Math.random().toString(36).slice(2)}` });
        return;
      }

      const selectedService = services.find(s => s.id.toString() === appointmentForm.serviceId);
      
      const appointmentData = {
        staffId: appointmentForm.staffId,
        serviceId: appointmentForm.serviceId,
        appointmentDate: appointmentForm.date || format(currentDate, 'yyyy-MM-dd'),
        startTime: appointmentForm.startTime,
        endTime: appointmentForm.endTime,
        clientId: appointmentForm.clientId ? appointmentForm.clientId : undefined,
        clientName: appointmentForm.clientName || undefined,
        clientPhone: appointmentForm.clientPhone || undefined,
        clientEmail: appointmentForm.clientEmail || undefined,
        price: selectedService?.price,
        notes: withRequestedFlag(appointmentForm.notes, appointmentForm.requestedByClient),
        // Key generated when form opened — stable across retries for this booking attempt
        idempotencyKey: appointmentForm.idempotencyKey,
      };

      const EMPTY_FORM = { clientId: "", clientName: "", clientPhone: "", clientEmail: "", serviceId: "", staffId: "", startTime: "", endTime: "", notes: "", price: "", date: format(currentDate, 'yyyy-MM-dd'), requestedByClient: false, idempotencyKey: `booking-${Date.now()}-${Math.random().toString(36).slice(2)}` };

      // Conflicts (closed day, time off, double booking...) come back from the server as a
      // list; the booking-conflict dialog asks the person and re-sends with an override.
      {
        if (editingAppointmentId) {
          await updateAppointmentAPI(editingAppointmentId, appointmentData);
        } else {
          await createAppointmentAPI(appointmentData);
          // The server closes the waitlist entry on the booking's own email,
          // but the column is a snapshot taken when the page loaded — so it
          // kept showing someone who had just been booked in.
          if (placingEntryId != null) {
            setWaitlist(prev => prev.filter(w => w.id !== placingEntryId));
            setPlacingEntryId(null);
          }
          reloadWaitlist();
        }
        setIsNewAppointmentOpen(false);
        setEditingAppointmentId(null);
        setFinalSelection(null);
        setAppointmentForm(EMPTY_FORM);
      }
    } catch (error) {
      // Error already handled in hook
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full w-full overflow-hidden bg-[rgb(var(--reg-canvas))] text-[rgb(var(--reg-ink))]" style={{ fontFamily: BRAND_FONT }}>
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Live-update status. A permanent "WebSocket: Connected" badge meant nothing to a
              salon; only a broken connection is worth their attention, in their words. */}
          {websocketStatus === 'error' && (
            <div role="status" className="px-4 py-2 border-b border-amber-200 bg-amber-50 text-sm text-amber-800">
              {tr("calendar.liveUpdatesArePausedNew")}
            </div>
          )}
          
          {/* The waitlist, where the slots are. It lived only on the Clients page, so a
              salon looking at a gap in today's calendar had no idea somebody was waiting
              for exactly that. Clicking one opens the booking form with them filled in;
              the salon then picks the slot, which is the part only they can decide. */}
          {/* LR-02: what still stops clients booking, with a link to each fix (not-bookable only). */}
          {businessId ? <VisibilityBanner businessId={businessId} showLive={false} className="mx-3 mt-3 md:mx-6" /> : null}

          {/* Loading State */}
          {loading && (
            <div className="cal-empty" role="status">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--bz-violet)", borderTopColor: "transparent" }}></div>
              <p className="sm t-m b7">{tr("calendar.loadingCalendar")}</p>
            </div>
          )}

          {/* No Staff State */}
          {!loading && (!apiStaff || apiStaff.length === 0) && (
            <div className="cal-empty">
              <span className="ico">
                <Users className="ic" style={{ width: 30, height: 30 }} aria-hidden />
              </span>
              <h2>{tr("calendar.addYourTeamToStart")}</h2>
              <p className="sm t-m b7" style={{ fontSize: 15 }}>
                {tr("calendar.eachPersonGetsTheirOwn")}
              </p>
              <button type="button" onClick={() => navigate(getPath("staff"))} className="btn btn-v" style={{ marginTop: 8 }}>
                <Plus className="ic" aria-hidden />
                {tr("common.addTeamMember")}
              </button>
            </div>
          )}

          {/* Top Navigation Bar - Only show when staff exists */}
          {!loading && apiStaff && apiStaff.length > 0 && (
          <>
<div className="cal-head">
            <div className="pgt">
              <div>
                <h5>{tr("nav.calendar")}</h5>
                <small>{format(viewType === "Day" ? currentDate : viewType === "Weekly" ? weekViewDate : monthViewDate, viewType === "Month" ? "MMMM yyyy" : "EEEE, d MMMM")}</small>
              </div>
              <div className="row gap8">
                <div role="tablist" aria-label={tr("calendar.calendarView")} className="segc" style={{ width: 300, gridTemplateColumns: "repeat(3, 1fr)" }}>
                  {([["Day", tr("calendar.viewDay")], ["Weekly", tr("calendar.viewWeek")], ["Month", tr("calendar.viewMonth")]] as const).map(([v, label]) => (
                    <span key={v} role="tab" tabIndex={0} aria-selected={viewType === v} onClick={() => setViewType(v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewType(v); } }} className={viewType === v ? "on" : undefined} style={{ cursor: "pointer" }}>
                      {label}
                    </span>
                  ))}
                </div>
                {viewType === "Day" && !isMobile && staff.length > 1 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="chip">
                      <SlidersHorizontal className="ic" aria-hidden />
                      {visibleStaff.length === staff.length ? tr("common.team") : tr("calendar.of", { count: visibleStaff.length, count2: staff.length })}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 rounded-2xl p-2">
                    <button type="button" onClick={() => setHiddenStaffIds([])} className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-[rgb(var(--reg-canvas))]">
                      {tr("calendar.showEveryone")}
                    </button>
                    {staff.map((member) => {
                      const shown = !hiddenStaffIds.includes(member.id);
                      return (
                        <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-[rgb(var(--reg-canvas))]">
                          <Checkbox
                            checked={shown}
                            onCheckedChange={(on) =>
                              setHiddenStaffIds((ids) => (on ? ids.filter((x) => x !== member.id) : [...ids, member.id]))
                            }
                            className="data-[state=checked]:border-[rgb(var(--reg-brand))] data-[state=checked]:bg-[rgb(var(--reg-brand))]"
                          />
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-[11px] font-bold text-[rgb(var(--reg-brand-strong))]">
                            {initialsOf(member.name)}
                          </span>
                          <span className="truncate">{member.name}</span>
                        </label>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              )}

              
              </div>
            </div>

            <div className="a-tb">
              <button
                type="button"
                className="circ"
                style={{ border: 0, cursor: "pointer", color: "inherit" }}
                aria-label={viewType === "Day" ? tr("calendar.previousDay") : viewType === "Weekly" ? tr("calendar.previousWeek") : tr("calendar.previousMonth")}
                onClick={viewType === "Day" ? goToPrevDay : viewType === "Weekly" ? goToPrevWeek : goToPrevMonth}
              >
                <ChevronLeft className="ic" />
              </button>
              <button type="button" onClick={goToToday} className={cn("chip", isCurrentDate && viewType === "Day" && "on")} style={{ border: 0, cursor: "pointer", font: "inherit", fontWeight: 600 }}>
                {tr("common.today")}
              </button>
              <button
                type="button"
                className="circ"
                style={{ border: 0, cursor: "pointer", color: "inherit" }}
                aria-label={viewType === "Day" ? tr("calendar.nextDay") : viewType === "Weekly" ? tr("calendar.nextWeek") : tr("calendar.nextMonth")}
                onClick={viewType === "Day" ? goToNextDay : viewType === "Weekly" ? goToNextWeek : goToNextMonth}
              >
                <ChevronRight className="ic" />
              </button>

                            {viewType === "Day" ? (
                <Popover onOpenChange={(open) => { if (open) setDatePickerMonth(currentDate); }}>
                  <PopoverTrigger asChild>
                    <button type="button" aria-label={tr("calendar.pickDate")} className="order-last flex min-w-0 basis-full items-center gap-1.5 bg-transparent p-0 text-left md:order-none md:basis-auto" style={{ border: 0, cursor: "pointer", color: "inherit" }}>
                      <b style={{ fontSize: 16, marginLeft: 6 }}>
                        <span className="md:hidden">{format(currentDate, "EEE, d MMM")}</span>
                        <span className="hidden md:inline">{format(currentDate, "EEEE, d MMMM")}</span>
                      </b>
                      <ChevronDown className="ic" style={{ width: 16, height: 16 }} aria-hidden />
                    </button>
                  </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-sm">
                            {format(datePickerMonth, "LLLL yyyy")}
                          </h3>
                          <div className="flex gap-1">
                            <Button aria-label={tr("calendar.previousMonth")} variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDatePickerMonth(subMonths(datePickerMonth, 1))}>
                              <ChevronLeft size={14} />
                            </Button>
                            <Button aria-label={tr("calendar.nextMonth")} variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDatePickerMonth(addMonths(datePickerMonth, 1))}>
                              <ChevronRight size={14} />
            </Button>
          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {[tr("common.dayMon"), tr("common.dayTue"), tr("common.dayWed"), tr("common.dayThu"), tr("common.dayFri"), tr("common.daySat"), tr("common.daySun")].map((day) => (
                            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1 w-8">
                              {day}
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {(() => {
                            const monthStart = startOfMonth(datePickerMonth);
                            const monthEnd = endOfMonth(datePickerMonth);
                            const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                            const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                            const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
                            
                            return days.map((day, idx) => {
                              const isCurrentMonth = isSameMonth(day, datePickerMonth);
                              const isSelected = isSameDay(day, currentDate);
                              const isTodayDate = salonToday(day);
                              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                              
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setCurrentDate(day);
                                  }}
                                  className={cn(
                                    "h-8 w-8 text-xs rounded-full flex items-center justify-center relative",
                                    isCurrentMonth ? "text-foreground" : "text-muted-foreground/50",
                                    isSelected ? "bg-[rgb(var(--reg-brand))] text-white" : "",
                                    isTodayDate && !isSelected ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))] font-semibold" : "",
                                                                        !isSelected ? "hover:bg-muted" : ""
                                  )}
                                >
                                  {format(day, "d")}
                                  {isTodayDate && !isSelected && (
                                    <span className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-[rgb(var(--reg-brand))] rounded-full" />
                                  )}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </PopoverContent>
                </Popover>
              ) : (
                <b className="order-last min-w-0 basis-full truncate md:order-none md:basis-auto" style={{ fontSize: 16, marginLeft: 6 }}>
                  {viewType === "Weekly"
                    ? (() => {
                        const weekStart = startOfWeek(weekViewDate, { weekStartsOn: 1 });
                        const weekEnd = endOfWeek(weekViewDate, { weekStartsOn: 1 });
                        return `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM")}`;
                      })()
                    : format(monthViewDate, "MMMM yyyy")}
                </b>
              )}

              <span style={{ flex: 1 }} />

              <label className="sch max-lg:!hidden">
                <Search className="ic" />
                <input
                  type="text"
                  value={calendarSearch}
                  onChange={(e) => setCalendarSearch(e.target.value)}
                  placeholder={tr("calendar.findAClient")}
                  aria-label={tr("calendar.findAClient2")}
                  style={{ flex: 1, minWidth: 0, background: "transparent", border: 0, outline: 0, font: "inherit", color: "inherit" }}
                />
                {calendarSearch && (
                  <button type="button" onClick={() => setCalendarSearch("")} aria-label={tr("calendar.clearSearch")} style={{ border: 0, background: "none", cursor: "pointer", color: "inherit", display: "flex" }}>
                    <X className="ic" />
                  </button>
                )}
              </label>
              <button
                type="button"
                aria-label={tr("calendar.findAClient2")}
                aria-expanded={mobileSearchOpen}
                className="circ lg:!hidden"
                style={{ border: 0, cursor: "pointer", color: "inherit" }}
                onClick={() => setMobileSearchOpen((v) => !v)}
              >
                <Search className="ic" />
              </button>
                            {legendEntries.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={tr("calendar.colourLegend")}
                      className="chip shrink-0"
                    >
                      <span className="flex -space-x-1">
                        {legendEntries.slice(0, 4).map((e) => (
                          <span key={e.key} className="h-3 w-3 rounded-full ring-2 ring-white" style={{ backgroundColor: e.tint.accent }} />
                        ))}
                      </span>
                      {tr("calendar.colours")}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[rgb(var(--reg-muted))]">{tr("calendar.serviceCategory")}</p>
                    <ul className="space-y-1.5">
                      {legendEntries.map((e) => (
                        <li key={e.key} className="flex items-center gap-2 text-sm">
                          <span className="h-4 w-4 shrink-0 rounded border-l-[3px]" style={{ backgroundColor: e.tint.fill, borderColor: e.tint.accent }} />
                          <span className="truncate">{e.name}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 border-t border-[rgb(var(--reg-line))] pt-2 text-xs text-[rgb(var(--reg-muted))]">
                      {tr("calendar.statusDotInTheCorner")}
                    </p>
                  </PopoverContent>
                </Popover>
              )}
              {businessId && <WhatsAppReminders businessId={businessId} />}
                        <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label={tr("calendar.needsAttention")} className="circ ib" style={{ border: 0, cursor: "pointer", color: "inherit" }}>
                <Bell className="ic" />
                {attention.length > 0 && <sup>{attention.length}</sup>}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[320px] p-0">
              <div className="border-b px-3 py-2">
                <p className="text-sm font-medium">{tr("calendar.needsAttention")}</p>
                <p className="text-xs text-muted-foreground">{tr("calendar.todayFromThisCalendar")}</p>
              </div>
              {attention.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {tr("calendar.nothingWaitingOnYou")}
                </p>
              ) : (
                <div className="max-h-[320px] overflow-y-auto">
                  {attention.map((item, i) => (
                    <button
                      key={i}
                      onClick={item.onClick}
                      className="flex w-full items-start gap-2 border-b px-3 py-2 text-left last:border-0 hover:bg-muted/50"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.tone}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{item.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
              <button
                type="button"
                aria-label={tr("calendar.calendarSettings")}
                title={tr("calendar.calendarSettings")}
                className="circ max-sm:!hidden"
                style={{ border: 0, cursor: "pointer", color: "inherit" }}
                onClick={() => navigate(getPath("/booking-rules"))}
              >
                <Settings className="ic" />
              </button>
              <button type="button" onClick={() => setIsNewAppointmentOpen(true)} className="btn btn-v s max-md:!hidden">
                <Plus className="ic" aria-hidden />
                {tr("common.newBooking")}
              </button>
            </div>

            {mobileSearchOpen && (
              <div className="sch lg:!hidden" style={{ marginBottom: 12 }}>
                <Search className="ic" />
                <input
                  autoFocus
                  type="text"
                  value={calendarSearch}
                  onChange={(e) => setCalendarSearch(e.target.value)}
                  placeholder={tr("calendar.findAClient")}
                  aria-label={tr("calendar.findAClient2")}
                  style={{ flex: 1, minWidth: 0, background: "transparent", border: 0, outline: 0, font: "inherit", color: "inherit" }}
                />
                {calendarSearch && (
                  <button type="button" onClick={() => setCalendarSearch("")} aria-label={tr("calendar.clearSearch")} style={{ border: 0, background: "none", cursor: "pointer", color: "inherit", display: "flex" }}>
                    <X className="ic" />
                  </button>
                )}
              </div>
            )}

            {(viewType === "Day" || viewType === "Weekly") && (
              <div className="a-tb" style={{ marginBottom: 0 }}>
                {viewType === "Day" && !isMobile && staff.length > 1 && staff.map((member) => {
                  const shown = !hiddenStaffIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      aria-pressed={shown}
                      onClick={() => setHiddenStaffIds((ids) => (shown ? [...ids, member.id] : ids.filter((x) => x !== member.id)))}
                      className={cn("chip", shown && "vo")}
                      style={{ height: 42, paddingLeft: 6, border: 0, cursor: "pointer", font: "inherit", fontWeight: 600 }}
                    >
                      <div className="ring">
                        {member.avatar ? (
                          <img src={member.avatar} alt="" style={{ width: 28, height: 28 }} />
                        ) : (
                          <span style={{ width: 28, height: 28, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{member.initials || initialsOf(member.name)}</span>
                        )}
                      </div>
                      {member.name}
                    </button>
                  );
                })}
                <span style={{ flex: 1 }} />
                <FlagLegend />
                <span className="a-dns" role="group" aria-label={tr("calendar.densityTitle")}>
                  <b>{tr("calendar.densityTitle")}</b>
                  {(["comfy", "compact"] as const).map((d) => (
                    <span key={d} role="button" tabIndex={0} aria-pressed={density === d} onClick={() => setDensity(d)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDensity(d); } }} className={density === d ? "on" : undefined} style={{ cursor: "pointer" }}>
                      {d === "comfy" ? tr("calendar.densityComfy") : tr("calendar.densityTight")}
                    </span>
                  ))}
                </span>
                {flags.waitlist !== false && (
                  <span className="row gap8" style={{ marginLeft: 14, fontSize: 14.5, fontWeight: 700 }}>
                    {tr("waitlistCal.showWaiting")}
                    <span role="switch" tabIndex={0} aria-checked={showWaiting} aria-label={tr("waitlistCal.showWaiting")} onClick={() => setShowWaiting(!showWaiting)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowWaiting(!showWaiting); } }} className={cn("tg", !showWaiting && "off")} />
                  </span>
                )}
              </div>
            )}

            {(viewType === "Day" || viewType === "Weekly") && flags.waitlist !== false && showWaiting && (
              <div className="a-wait">
                <b style={{ fontSize: 14.5, color: "var(--bz-vtext)" }}>{tr("waitlistCal.stripLabel")}</b>
                {waitlist.filter((w) => waitsOn(w, dayKey)).slice(0, 4).map((w) => (
                  <span key={String(w.id)} className="c">{[w.clientName, w.serviceName].filter(Boolean).join(" · ")}</span>
                ))}
                <span style={{ flex: 1 }} />
                <button type="button" onClick={() => setAddWaiterOpen(true)} className="btn btn-soft s" style={{ height: 38 }}>
                  <Plus className="ic" aria-hidden />
                  {tr("waitlistCal.addButton")}
                </button>
              </div>
            )}

                        {/* Phone: the week as a day strip (BF02 · 390). */}
            {viewType === "Day" && isMobile && (
              <div className="dstrip" style={{ marginTop: 12 }} role="tablist" aria-label={tr("calendar.calendarView")}>
                {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i)).map((d) => (
                  <span key={d.toISOString()} role="tab" aria-selected={isSameDay(d, currentDate)} tabIndex={0} className={isSameDay(d, currentDate) ? "on" : undefined} onClick={() => setCurrentDate(d)} style={{ cursor: "pointer" }}>
                    {format(d, "EEEEEE")}
                    <b>{format(d, "d")}</b>
                  </span>
                ))}
              </div>
            )}

            {/* A phone shows one column; this is how you move between people. */}
            {viewType === "Day" && isMobile && staff.length > 1 && (
              <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]" role="tablist" aria-label={tr("common.teamMember")}>
                {staff.map((member) => {
                  const on = visibleStaff[0]?.id === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setMobileStaffId(member.id)}
                      className={cn("chip shrink-0", on && "on")}
                    >
                      <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold", on ? "bg-white/15 text-white" : "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]")}>
                        {initialsOf(member.name)}
                      </span>
                      {member.name.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

      {/* Calendar Grid - Conditional based on view type */}
          {viewType === "Day" && (
          <div className="flex min-h-0 flex-1 gap-5 overflow-hidden px-3 pb-3 md:px-8 md:pb-8">
          <div ref={dayGridRef} className="a-gridw min-w-0 flex-1" style={{ overflow: "auto", padding: "0 12px 12px 0" }}>
            {/* Staff headers (BF40 .colh, one per column, absolutely placed above the grid). */}
            <div style={{ position: "sticky", top: 0, zIndex: 8, height: 68, background: "var(--bz-surface)", minWidth: gridInnerW }}>
              {visibleStaff.map((staff, colIdx) => {
                const n = new Set(getAppointmentsForStaff(getAppointmentsForDate(currentDate), staff.id).map((a) => a.apiId ?? a.id)).size;
                return (
                  <div key={staff.id} className="colh" style={{ position: "absolute", left: HOUR_COL + colIdx * (colW + COL_GAP), top: 12, width: colW, height: 56 }}>
                    <div className="ring">
                      {staff.avatar ? (
                        <img src={staff.avatar} alt="" style={{ width: 36, height: 36 }} />
                      ) : (
                        <span style={{ width: 36, height: 36, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{staff.initials || initialsOf(staff.name)}</span>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{staff.name}</div>
                      <div style={{ fontSize: 14, color: "var(--bz-muted)", fontWeight: 600 }}>
                        {n ? tr("common.bookingCount", { count: n }) : staff.workingHours || tr("calendar.noBookings")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lt" style={{ position: "relative", height: timeSlots.length * SLOT_HEIGHT, minWidth: gridInnerW }}>
              {Array.from({ length: 24 }, (_, hour) => (
                <Fragment key={hour}>
                  {hour > 0 && <div className="lt-h" style={{ top: hour * 4 * SLOT_HEIGHT - 10, left: 0 }}>{`${hour}:00`}</div>}
                  <div className="lt-l" style={{ top: hour * 4 * SLOT_HEIGHT, left: HOUR_COL - 8 }} />
                </Fragment>
              ))}
              {(() => {
                const { startHour: bs, endHour: be, isEnabled: bOn } = getBusinessHoursForDate(currentDate);
                const full = 24 * 4 * SLOT_HEIGHT;
                const bands = !bOn ? [[0, full]] : [[0, bs * 4 * SLOT_HEIGHT], [be * 4 * SLOT_HEIGHT, full]];
                return bands.filter(([a, b]) => b > a).map(([a, b]) => (
                  <div key={a} className="a-off" style={{ left: HOUR_COL - 8, right: 0, top: a, height: b - a }} />
                ));
              })()}

              {visibleStaff.map((staff, colIdx) => {
                const dayAppointments = getAppointmentsForDate(currentDate);
                const staffAppointments = getAppointmentsForStaff(dayAppointments, staff.id);
                const staffTimeOffs = getTimeOffsForStaffAndDate(timeOffs, staff.id, currentDate);
                const { startHour: dayBusinessStartHour, endHour: dayBusinessEndHour, isEnabled: dayIsEnabled } = getBusinessHoursForDate(currentDate);
                const colLeft = HOUR_COL + colIdx * (colW + COL_GAP);

                return (
                  <Fragment key={staff.id}>
                    <div 
                      className="select-none"
                      data-staff-col={staff.id}
                      style={{ position: "absolute", left: colLeft, width: colW, top: 0, height: `${timeSlots.length * SLOT_HEIGHT}px` }}
                      onMouseDown={(e) => {
                        // Allow selection even if clicking on or near appointments
                        // Only prevent if clicking directly on appointment content
                        const target = e.target as HTMLElement;
                        if (target.closest('[data-appointment-block]')) {
                          return; // Don't start selection if clicking on appointment
                        }
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickY = e.clientY - rect.top;
                        const startTime = getTimeFromPosition(clickY, SLOT_HEIGHT);
                        
                        // Allow selection of any time slot (including non-business hours)
                        setDragSelection({
                          staffId: staff.id,
                          startTime,
                          endTime: startTime,
                          isDragging: true,
                          hasMoved: false,
                        });
                      }}
                      onMouseMove={(e) => {
                        if (dragSelection && dragSelection.isDragging && dragSelection.staffId === staff.id) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickY = Math.max(0, Math.min(e.clientY - rect.top, timeSlots.length * SLOT_HEIGHT));
                          // Get the slot index (floor to get the slot the mouse is in)
                          const slotIndex = Math.floor(clickY / SLOT_HEIGHT);
                          const currentTime = getTimeFromPosition(slotIndex * SLOT_HEIGHT, SLOT_HEIGHT);
                          
                          // Allow selection of any time slot (including non-business hours)
                          // When dragging to a slot, we want to include that entire slot
                          // So if dragging to 13:15, we want to include the 13:15-13:30 block
                          // The end time should be the end of the slot the mouse is in
                          const endTime = addMinutesToTime(currentTime, 15);
                          
                          // Check for conflicts while dragging
                          const startMinutes = parseTime(dragSelection.startTime);
                          const endMinutes = parseTime(endTime);
                          const actualStart = startMinutes <= endMinutes ? dragSelection.startTime : endTime;
                          const actualEnd = startMinutes <= endMinutes ? endTime : dragSelection.startTime;
                          
                          const dayAppointments = appointments.filter((apt) =>
                            isSameDay(apt.date, currentDate)
                          );
                          const hasConflict = hasTimeConflict(dayAppointments, staff.id, actualStart, actualEnd);
                          
                          setDragSelection({
                            ...dragSelection,
                            endTime: endTime,
                            hasMoved: true,
                          });
                          setSelectionConflict(hasConflict);
                        }
                      }}
                      onMouseUp={(e) => {
                        if (dragSelection && dragSelection.isDragging && dragSelection.staffId === staff.id) {
                          const startMinutes = parseTime(dragSelection.startTime);
                          const endMinutes = parseTime(dragSelection.endTime);
                          
                          // Determine actual start and end (handle backward dragging)
                          let actualStart = startMinutes <= endMinutes ? dragSelection.startTime : dragSelection.endTime;
                          let actualEnd = startMinutes <= endMinutes ? dragSelection.endTime : dragSelection.startTime;
                          const actualStartMinutes = parseTime(actualStart);
                          let actualEndMinutes = parseTime(actualEnd);
                          
                          // If user just clicked (didn't drag), select a single 15-minute slot
                          // Example: Click 13:00 → 13:00-13:15
                          if (!dragSelection.hasMoved) {
                            actualEnd = addMinutesToTime(actualStart, 15);
                            actualEndMinutes = parseTime(actualEnd);
                          } else {
                            // For range selection:
                            // Example: Drag from 13:00 to 13:15 → 13:00-13:30
                            // The endTime is already the end of the slot (13:15 + 15 = 13:30)
                            // We just need to handle backward dragging correctly
                            if (startMinutes > endMinutes) {
                              // Dragging backward: swap start and end
                              // If dragging from 13:15 to 13:00, we want 13:00-13:30
                              const originalStartEnd = addMinutesToTime(dragSelection.startTime, 15);
                              actualStart = dragSelection.endTime; // Earlier time (13:00)
                              actualEnd = originalStartEnd; // End of original start slot (13:30)
                              actualEndMinutes = parseTime(actualEnd);
                            }
                            // If dragging forward, actualEnd is already correct (end of the slot)
                            // Example: 13:00 to 13:15 → endTime is 13:30, which is correct
                          }
                          
                          // Ensure we have a valid range (at least 15 minutes)
                          if (actualEndMinutes > actualStartMinutes) {
                            // Check for conflicts with existing appointments (for visual feedback only)
                            const dayAppointments = appointments.filter((apt) =>
                              isSameDay(apt.date, currentDate)
                            );
                            
                            const hasConflict = hasTimeConflict(dayAppointments, staff.id, actualStart, actualEnd);
                            
                            // Always allow booking - overlapping appointments are allowed
                            // Set final selection and keep it visible
                            setFinalSelection({
                              staffId: staff.id,
                              staffName: staff.name,
                              startTime: actualStart,
                              endTime: actualEnd,
                            });
                            setIsSelectionDialogOpen(true);
                            setSelectionConflict(hasConflict);
                          }
                          
                          // Keep drag selection visible but mark as not dragging
                          setDragSelection({
                            ...dragSelection,
                            isDragging: false,
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        if (dragSelection && dragSelection.isDragging && dragSelection.staffId === staff.id) {
                          setDragSelection({
                            ...dragSelection,
                            isDragging: false,
                          });
                        }
                      }}
                    >
                      {/* Drag selection range highlight - show while dragging */}
                      {dragSelection && dragSelection.staffId === staff.id && dragSelection.isDragging && (
                        (() => {
                          const startMinutes = parseTime(dragSelection.startTime);
                          const endMinutes = parseTime(dragSelection.endTime);
                          
                          // Determine actual start and end for visual display (handle backward dragging)
                          const displayStart = startMinutes <= endMinutes ? dragSelection.startTime : dragSelection.endTime;
                          let displayEnd = startMinutes <= endMinutes ? dragSelection.endTime : dragSelection.startTime;
                          
                          // If end equals start (initial click), show at least 15 minutes for visual feedback
                          if (displayStart === displayEnd) {
                            displayEnd = addMinutesToTime(displayStart, 15);
                          }
                          
                          const { top, height } = getTimePosition(displayStart, displayEnd, SLOT_HEIGHT);
                          
                          // Always show the original start time and current end time (even if dragging backwards)
                          const showStartTime = startMinutes <= endMinutes ? dragSelection.startTime : dragSelection.endTime;
                          const showEndTime = startMinutes <= endMinutes ? dragSelection.endTime : dragSelection.startTime;
                          
                          // Check for conflict
                          const dayAppointments = appointments.filter((apt) =>
                            isSameDay(apt.date, currentDate)
                          );
                          const hasConflict = hasTimeConflict(dayAppointments, staff.id, displayStart, displayEnd);

                  return (
                    <div
                              className={`absolute left-1 right-1 rounded-[10px] border-2 z-15 pointer-events-none flex items-center ${
                                hasConflict 
                                  ? "bg-red-100/70 border-red-500" 
                                  : "bg-[rgb(var(--reg-brand)/0.12)] border-[rgb(var(--reg-brand))]"
                              }`}
                      style={{
                                top: `${top}px`,
                                height: `${Math.max(height, SLOT_HEIGHT)}px`,
                              }}
                            >
                              <div className={`text-xs font-medium px-2 whitespace-nowrap ${
                                hasConflict ? "text-red-700" : "text-[rgb(var(--reg-brand-strong))]"
                              }`}>
                                {showStartTime} - {showEndTime}
                                {hasConflict && tr("calendar.conflict")}
                              </div>
                            </div>
                          );
                        })()
                      )}

                      {/* Final selection highlight - show when popup is open */}
                      {finalSelection && finalSelection.staffId === staff.id && (
                        (() => {
                          const { top, height } = getTimePosition(finalSelection.startTime, finalSelection.endTime, SLOT_HEIGHT);
                          
                          return (
                            <div
                              className="absolute left-1 right-1 rounded-[10px] bg-[rgb(var(--reg-brand)/0.12)] border-2 border-[rgb(var(--reg-brand))] z-15 pointer-events-none flex items-center"
                              style={{
                                top: `${top}px`,
                                height: `${Math.max(height, SLOT_HEIGHT)}px`,
                              }}
                            >
                              <div className="text-xs font-semibold text-[rgb(var(--reg-brand-strong))] px-2 whitespace-nowrap">
                                {finalSelection.startTime} - {finalSelection.endTime}
                              </div>
                            </div>
                          );
                        })()
                      )}

                    </div>

                      {/* Appointments and Time Offs - Grouped by conflicts */}
                      {(() => {
                        const conflictGroups = groupConflictingItems(staffAppointments, staffTimeOffs, dayBusinessStartHour, dayBusinessEndHour);
                        // Waiting clients join the master's lanes like an overlapping booking:
                        // beside the appointment they overlap, alone otherwise.
                        for (const w of waitingForDay) {
                          if (!w.placement.start || !w.placement.end || String(w.placement.staffId) !== String(staff.id)) continue;
                          const ws = toMinutes(w.placement.start);
                          const we = toMinutes(w.placement.end);
                          const item: ConflictItem = { type: 'waiting', item: w.entry, placement: w.placement, start: w.placement.start, end: w.placement.end };
                          const host = conflictGroups.find((g) =>
                            g.some((x) => x.type === 'appointment' && ws < parseTime(normalizeTime(x.item.endTime)) && we > parseTime(normalizeTime(x.item.startTime))));
                          if (host) host.push(item); else conflictGroups.push([item]);
                        }
                        const isDragging = dragSelection?.isDragging && dragSelection.staffId === staff.id;
                        
                        return conflictGroups.flatMap((fullGroup) => {
                          // More than 3 overlapping: three columns plus a "+N" chip with the rest.
                          const hiddenItems = fullGroup.length > MAX_OVERLAP_COLUMNS ? fullGroup.slice(MAX_OVERLAP_COLUMNS) : [];
                          const group = hiddenItems.length ? fullGroup.slice(0, MAX_OVERLAP_COLUMNS) : fullGroup;
                          const groupSize = group.length;
                          
                          // For each item in the group, render it with calculated width/position
                          const rendered = group.map((item, itemIndex) => {
                            let top = 0;
                            let height = 0;
                            
                            if (item.type === 'appointment') {
                              const aptStartTime = normalizeTime(item.item.startTime);
                              const aptEndTime = normalizeTime(item.item.endTime);
                              const pos = getTimePosition(aptStartTime, aptEndTime, SLOT_HEIGHT);
                              top = pos.top;
                              height = pos.height;
                            } else if (item.type === 'waiting') {
                              const pos = getTimePosition(item.start, item.end, SLOT_HEIGHT);
                              top = pos.top;
                              height = Math.max(pos.height, SLOT_HEIGHT * 2);
                            } else {
                              // For full day time offs, show them only during business hours for this day (or 00:00-00:00 if disabled)
                              const startTime = item.item.isFullDay 
                                ? (dayIsEnabled ? `${dayBusinessStartHour.toString().padStart(2, "0")}:00` : "00:00")
                                : normalizeTime(item.item.startTime || "00:00");
                              const endTime = item.item.isFullDay 
                                ? (dayIsEnabled ? `${dayBusinessEndHour.toString().padStart(2, "0")}:00` : "00:00")
                                : normalizeTime(item.item.endTime || "23:59");
                              const pos = getTimePosition(startTime, endTime, SLOT_HEIGHT);
                              top = pos.top;
                              height = pos.height;
                            }
                            
                            // Each overlapping item gets an equal share of the column, in px like the frame's tiles.
                            const laneGap = 4;
                            const laneW = (colW - (groupSize - 1) * laneGap) / groupSize;
                            const laneLeft = colLeft + itemIndex * (laneW + laneGap);

                            if (item.type === 'appointment') {
                              const draggingThis = dnd?.id === item.item.id;
                              const canDrag = item.item.apiId && !item.item.isClass && !item.item.isPackage && !item.item.visitId && !["CANCELLED", "COMPLETED", "NO_SHOW"].includes((item.item.status || "").toUpperCase());
                              return (
                                <AppointmentBlock
                                  key={item.item.id}
                                  visits={visitsFor(item.item)}
                                  flagCtx={flagCtxFor(item.item)}
                                  density={density}
                                  height={height}
                                  appointment={item.item}
                                  placed={{
                                    style: {
                                      position: "absolute",
                                      top,
                                      height: draggingThis && dnd.mode === "resize" ? Math.max(SLOT_HEIGHT, height + dnd.dy) : height,
                                      left: laneLeft,
                                      width: laneW,
                                      transform: draggingThis && dnd.mode === "move" ? `translate(${dnd.dx}px, ${dnd.dy}px)` : undefined,
                                      zIndex: draggingThis ? 40 : 3,
                                      outline: draggingThis ? "2px solid var(--bz-violet)" : undefined,
                                      touchAction: "pan-y",
                                      pointerEvents: isDragging ? "none" : "auto",
                                    },
                                    props: {
                                      "data-appointment-block": "true",
                                      "data-testid": "appointment-block",
                                      "data-apt-id": item.item.apiId,
                                      onPointerDown: (e: React.PointerEvent) => { if (!(e.target as HTMLElement).closest('[data-resize-handle]')) beginDnd(e, item.item, "move"); },
                                    },
                                  }}
                                  onClick={(e) => {
                                    if (!isDragging && !justDragged.current) {
                                      e?.stopPropagation?.();
                                      handleAppointmentClick(item.item);
                                    }
                                  }}
                                >
                                  {canDrag && (
                                    <div
                                      data-resize-handle="true"
                                      data-testid="resize-handle"
                                      title={tr("calendar.dnd.resizeHint")}
                                      className="absolute inset-x-0 bottom-0 hidden h-2 cursor-ns-resize items-end justify-center md:flex"
                                      onPointerDown={(e) => beginDnd(e, item.item, "resize")}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="mb-0.5 h-0.5 w-8 rounded-full bg-black/25" />
                                    </div>
                                  )}
                                </AppointmentBlock>
                              );
                            } else if (item.type === 'waiting') {
                              const wp = waitingProps({ entry: item.item, durationMin: item.item.serviceId ? serviceDuration(String(item.item.serviceId)) : 30, placement: item.placement });
                              return (
                                <div
                                  key={`waiting-${item.item.id}`}
                                  className="absolute z-20"
                                  data-appointment-block="true"
                                  style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    left: laneLeft,
                                    width: laneW,
                                    pointerEvents: isDragging ? "none" : "auto",
                                  }}
                                  onMouseDown={(e) => { if (!isDragging) e.stopPropagation(); }}
                                  onMouseUp={(e) => { if (!isDragging) e.stopPropagation(); }}
                                >
                                  <WaitingBlock {...wp} height={height} freed={item.placement.freed} />
                                </div>
                              );
                            } else {
                              // Time off block
                              const timeOff = item.item;
                              // For full day, use business hours for the specific day (or 00:00-00:00 if disabled)
                              const displayStartTime = timeOff.isFullDay 
                                ? (dayIsEnabled ? `${dayBusinessStartHour.toString().padStart(2, "0")}:00` : "00:00")
                                : normalizeTime(timeOff.startTime || "00:00");
                              const displayEndTime = timeOff.isFullDay 
                                ? (dayIsEnabled ? `${dayBusinessEndHour.toString().padStart(2, "0")}:00` : "00:00")
                                : normalizeTime(timeOff.endTime || "23:59");
                              const timeOffDate = parse(timeOff.startDate, "yyyy-MM-dd", new Date());
                              const dateStr = format(timeOffDate, "MMM d, yyyy");
                              const timeStr = timeOff.isFullDay ? tr("calendar.fullDay") : `${displayStartTime} - ${displayEndTime}`;
                              const typeStr = timeOff.isFullDay ? tr("calendar.fullDay") : tr("calendar.specificHours");
                              
                              // For non-full day time offs, ensure they're positioned within business hours if possible
                              // But still show them at their actual time
                              const minHeight = Math.max(height, SLOT_HEIGHT * 2); // Minimum height to show content
                              
                              return (
                                <div
                                  key={`timeoff-${timeOff.id}`}
                                  className="tile a-off2"
                                  style={{ top, height: minHeight, left: laneLeft, width: laneW, zIndex: 2 }}
                                  title={tr("calendar.timeOff", { dateStr, timeStr, value: timeOff.reason || tr("calendar.noReason") })}
                                >
                                  <b>{timeOff.reason || tr("calendar.timeOff2")}</b>
                                  <span>{timeOff.reason ? tr("calendar.timeOff3") : ""}{timeStr}</span>
                                </div>
                              );
                            }
                          });
                          if (hiddenItems.length === 0) return rendered;
                          const tops = fullGroup.flatMap((x) =>
                            x.type === "appointment" ? [getTimePosition(normalizeTime(x.item.startTime), normalizeTime(x.item.endTime), SLOT_HEIGHT).top]
                            : x.type === "waiting" ? [getTimePosition(x.start, x.end, SLOT_HEIGHT).top] : []);
                          const chipTop = tops.length ? Math.min(...tops) : 0;
                          const chip = (
                            <div key={`more-${fullGroup.map((x) => (x.type === "appointment" ? x.item.id : `${x.type}-${x.item.id}`)).join("_")}`} className="a-ov" style={{ left: colLeft + colW - 56, top: chipTop + 2 }} data-appointment-block="true" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    data-testid="overlap-overflow"
                                    aria-label={`${tr("calendar.overflowTitle")}: +${hiddenItems.length}`}
                                    className="bg-transparent p-0 font-[inherit] text-[inherit] font-extrabold text-white focus-visible:outline-none"
                                  >
                                    +{hiddenItems.length}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-72 p-2">
                                  <p className="px-2 pb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{tr("calendar.overflowTitle")}</p>
                                  <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                                    {hiddenItems.map((x) => {
                                      if (x.type === "appointment") {
                                        return (
                                          <li key={x.item.id}>
                                            <button type="button" onClick={() => handleAppointmentClick(x.item)} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-[rgb(var(--reg-canvas))]">
                                              <span className="shrink-0 text-xs font-bold tabular-nums text-[rgb(var(--reg-brand-strong))]">{normalizeTime(x.item.startTime).slice(0, 5)}</span>
                                              <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{x.item.clientName}</span> · {appointmentServiceLabel(x.item)}</span>
                                              <FlagIcons keys={appointmentFlagKeys(x.item, { visits: visitsFor(x.item), ...flagCtxFor(x.item) })} max={3} size={12} />
                                            </button>
                                          </li>
                                        );
                                      }
                                      if (x.type === "waiting") {
                                        return (
                                          <li key={`w-${x.item.id}`} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                                            <span className="shrink-0 text-xs font-bold tabular-nums text-[rgb(var(--reg-muted))]">{x.start.slice(0, 5)}</span>
                                            <span className="min-w-0 flex-1 truncate">{x.item.clientName}{x.item.serviceName ? ` · ${x.item.serviceName}` : ""}</span>
                                          </li>
                                        );
                                      }
                                      return (
                                        <li key={`t-${x.item.id}`} className="flex items-center gap-2 px-2 py-1.5 text-sm text-[rgb(var(--reg-muted))]">
                                          <span className="min-w-0 flex-1 truncate">{x.item.reason || tr("calendar.timeOff2")}</span>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </PopoverContent>
                              </Popover>
                            </div>
                          );
                          return [...rendered, chip];
                        });
                      })()}

                  </Fragment>
                );
              })}

              {isCurrentDate && (() => {
                const timePosition = getCurrentTimePosition();
                if (timePosition === null) return null;
                return (
                  <div className="nowl" style={{ top: timePosition, left: HOUR_COL - 8 }}>
                    <em>{format(currentTime, "HH:mm")}</em>
                  </div>
                );
              })()}
            </div>
          </div>
          {!isMobile && (
            <div className="hidden shrink-0 overflow-y-auto xl:block">
              <CalendarSidePanel
                next={nextClient}
                attention={attention}
                team={visibleStaff}
                onOpenAppointment={handleAppointmentClick}
                initialsOf={initialsOf}
              />
            </div>
          )}
          </div>
          )}

          {viewType === "Month" && (
            <div className="flex flex-1 overflow-auto bg-white p-6">
              <div className="w-full">
                {/* Month Calendar Grid */}
                <div className="cal-card overflow-hidden border-0 border-[var(--bz-line)]">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 border-b border-[var(--bz-line)]">
                    {[tr("common.dayMon"), tr("common.dayTue"), tr("common.dayWed"), tr("common.dayThu"), tr("common.dayFri"), tr("common.daySat"), tr("common.daySun")].map((day) => (
                      <div
                        key={day}
                        className="p-3 text-center text-xs font-medium text-muted-foreground border-r border-[var(--bz-line)] last:border-r-0"
                      >
                        {day}
            </div>
          ))}
        </div>

                  {/* Calendar Days Grid */}
                  <div className="grid grid-cols-7">
                    {(() => {
                      const monthStart = startOfMonth(monthViewDate);
                      const monthEnd = endOfMonth(monthViewDate);
                      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
                      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 }); // Monday
                      const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

                      return calendarDays.map((day, idx) => {
                        const dayAppointments = getAppointmentsForDate(day);
                        const isCurrentMonth = isSameMonth(day, monthViewDate);
                        const isCurrentDay = salonToday(day);

                        return (
                          <div
                            key={idx}
                            className={`
                              min-h-[120px] border-r border-b border-[var(--bz-line)] last:border-r-0
                              ${isCurrentMonth ? "bg-[var(--bz-surface)]" : "bg-muted"}
                              ${isCurrentDay ? "bg-[var(--bz-vsoft)]" : ""}
                              p-2
                            `}
                          >
                            {/* Date Number */}
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`
                                  text-sm font-medium
                                  ${isCurrentDay ? "bg-[rgb(var(--reg-brand))] text-white rounded-full w-6 h-6 flex items-center justify-center" : ""}
                                  ${!isCurrentMonth ? "text-muted-foreground/50" : ""}
                                `}
                              >
                                {format(day, "d")}
                              </span>
                              {dayAppointments.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {dayAppointments.length}
                                </span>
                              )}
      </div>

                            {/* Appointments */}
                            <div className="space-y-1 mt-1">
                              {dayAppointments.slice(0, 3).map((apt) => (
                                <MiniTile
                                  key={apt.id}
                                  appointment={apt}
                                  visits={visitsFor(apt)}
                                  flagCtx={flagCtxFor(apt)}
                                  onClick={() => handleAppointmentClick(apt)}
                                />
                              ))}
                              {dayAppointments.length > 3 && (
                                <div 
                                  className="text-xs text-muted-foreground text-center pt-1 cursor-pointer hover:text-foreground hover:font-medium transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDayForPopup(day);
                                    setIsDayPopupOpen(true);
                                  }}
                                >
                                  {tr("calendar.more", { value: dayAppointments.length - 3 })}
        </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewType === "Weekly" && (
            <div className="flex flex-1 overflow-auto bg-[var(--bz-surface)]">
              {/* Staff Column */}
              <div className="w-64 shrink-0 border-r border-[var(--bz-line)] bg-[var(--bz-surface)] sticky left-0 z-10">
                <div className="h-16 border-b border-[var(--bz-line)] bg-[var(--bz-surface)]"></div>
                <div className="divide-y divide-border">
                  {staff.map((staff) => {
                    // All rows should have the same height to fit 3 blocks + "+X more" row
                    // Height: 3 blocks (~180px with spacing) + "+X more" row (~40px) + padding (~16px) = ~250px
                    const rowHeight = "h-[250px]";
                    
                    return (
                      <div
                        key={staff.id}
                        className={`${rowHeight} border-b border-[var(--bz-line)] px-4 py-3 bg-[var(--bz-surface)] flex items-center gap-3`}
                      >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[rgb(var(--reg-brand))] to-[#e83e63] flex items-center justify-center text-white font-semibold text-sm shrink-0">
                        {staff.initials}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="text-sm font-medium truncate">{staff.name}</div>
                        <div className="text-xs text-muted-foreground">{staff.workingHours}</div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* Week Days Columns */}
              <div className="flex flex-1">
                {getWeekDays(weekViewDate).map((day) => {
                  const dayAppointments = getAppointmentsForDate(day);
                  const isCurrentDay = salonToday(day);
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className="min-w-[200px] flex-1 border-r border-[var(--bz-line)] last:border-r-0 bg-[var(--bz-surface)]"
                    >
                      {/* Day Header */}
                      <div className={`h-16 border-b border-[var(--bz-line)] flex flex-col items-center justify-center px-2 bg-[var(--bz-surface)] sticky top-0 z-10 ${isCurrentDay ? "bg-[var(--bz-vsoft)]" : ""}`}>
                        <div className="text-xs font-medium text-muted-foreground">
                          {format(day, "EEE")}
                        </div>
                        <div className={`text-sm font-semibold ${isCurrentDay ? "text-[rgb(var(--reg-brand-strong))]" : ""}`}>
                          {format(day, "d")}
                        </div>
                        {dayAppointments.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {dayAppointments.length} {dayAppointments.length === 1 ? tr("calendar.reservation") : tr("calendar.reservations")}
                          </div>
                        )}
                      </div>

                      {/* Staff Rows with Appointments */}
                      <div className="divide-y divide-border">
                        {staff.map((staff) => {
                          const staffAppointments = getAppointmentsForDateAndStaff(day, staff.id);
                          const waitChips = waitingChipsFor(day, staff.id);
                          // All rows should have the same height to fit 3 blocks + "+X more" row
                          // Height: 3 blocks (~180px with spacing) + "+X more" row (~40px) + padding (~16px) = ~250px
                          const rowHeight = "h-[250px]";
                          
                          return (
                            <div
                              key={staff.id}
                              className={`${rowHeight} p-2 flex flex-col border-b border-[var(--bz-line)]`}
                            >
                              {waitChips.length > 0 && (
                                <div className="mb-1 flex flex-wrap gap-1">
                                  {waitChips.map(w => (
                                    <button
                                      key={w.id}
                                      type="button"
                                      onClick={() => { setCurrentDate(day); setViewType("Day"); }}
                                      title={`${tr("waitlistCal.waiting")}: ${w.clientName || w.clientEmail || ""}`}
                                      className={`inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-dashed px-2 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand))] ${
                                        isFreed(w)
                                          ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                                          : "border-[rgb(var(--reg-brand)/0.6)] bg-[var(--bz-surface)] text-[rgb(var(--reg-brand-strong))]"
                                      }`}
                                    >
                                      <Clock size={11} aria-hidden />
                                      <span className="truncate">{w.clientName || w.clientEmail || tr("common.client")}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {staffAppointments.length > 0 ? (
                                <div className="flex flex-col h-full justify-between">
                                  {/* Appointment Blocks - Maximum 3 */}
                                  <div className="space-y-1">
                                    {staffAppointments.slice(0, 3).map((apt) => (
                                      <MiniTile
                                        key={apt.id}
                                        appointment={apt}
                                        visits={visitsFor(apt)}
                                        flagCtx={flagCtxFor(apt)}
                                        onClick={() => handleAppointmentClick(apt)}
                                      />
                                    ))}
                                  </div>
                                  {/* "+X more" on separate row - Only show if more than 3 */}
                                  {staffAppointments.length > 3 && (
                                    <div 
                                      className="text-xs text-muted-foreground text-center pt-2 mt-auto cursor-pointer hover:text-foreground hover:font-medium transition-colors border-t border-[var(--bz-line)]"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedWeeklyPopup({ day, staffId: staff.id });
                                        setIsWeeklyPopupOpen(true);
                                      }}
                                    >
                                      {tr("calendar.more", { value: staffAppointments.length - 3 })}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="h-full flex items-center justify-center">
                                  <span className={`text-xs text-muted-foreground/50 ${waitChips.length > 0 ? "sr-only" : ""}`}>{tr("calendar.noAppointments")}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* New booking: the top bar button (desktop) and the tab bar's "+" (phone). */}

      {/* Appointment Modal */}
      {(modalMounted || isModalOpen) && (
        <Suspense fallback={null}>
          <AppointmentModal
            appointment={selectedAppointment}
            staff={selectedStaff}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onEdit={handleEditAppointment}
            onDelete={handleDeleteAppointment}
            onCancelled={() => { handleCloseModal(); }}
          />
        </Suspense>
      )}

      {/* Drag / resize: nothing is saved until the person confirms */}
      <AlertDialog open={!!pendingMove} onOpenChange={(o) => { if (!o && !movingBusy) { setPendingMove(null); } }}>
        <AlertDialogContent data-testid="move-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("calendar.dnd.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                {pendingMove && (
                  <>
                    <p className="font-semibold text-foreground">{pendingMove.apt.clientName} · {pendingMove.apt.service}</p>
                    <p>{tr("calendar.dnd.from")}: {staff.find((x) => x.id === pendingMove.apt.staffId)?.name} · {normalizeTime(pendingMove.apt.startTime)}–{normalizeTime(pendingMove.apt.endTime)}</p>
                    <p>{tr("calendar.dnd.to")}: {staff.find((x) => x.id === pendingMove.staffId)?.name} · {pendingMove.startTime}–{pendingMove.endTime}</p>
                    <p className="text-xs">{tr("calendar.dnd.notifyHint")}</p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={movingBusy}>{tr("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction data-testid="move-confirm-ok" disabled={movingBusy} onClick={(e) => { e.preventDefault(); void confirmMove(); }}>
              {tr("calendar.dnd.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Day Appointments Popup */}
      <Sheet open={isDayPopupOpen} onOpenChange={setIsDayPopupOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedDayForPopup && format(selectedDayForPopup, "EEEE, MMMM d, yyyy")}
            </SheetTitle>
            <SheetDescription>
              {selectedDayForPopup && tr("common.appointmentCount", { count: getAppointmentsForDate(selectedDayForPopup).length })}
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-3">
            {selectedDayForPopup && getAppointmentsForDate(selectedDayForPopup).map((apt) => {
              const staffMember = staff.find(s => s.id === apt.staffId);
              return (
                <div
                  key={apt.id}
                  onClick={() => {
                    handleAppointmentClick(apt);
                    setIsDayPopupOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <AppointmentBlock
                    visits={visitsFor(apt)}
                    flagCtx={flagCtxFor(apt)}
                    appointment={apt} 
                    onClick={() => {
                      handleAppointmentClick(apt);
                      setIsDayPopupOpen(false);
                    }}
                  />
                  {staffMember && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                      <span>{tr("calendar.staff")}</span>
                      <span className="font-medium">{staffMember.name}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Weekly Appointments Popup */}
      <Sheet open={isWeeklyPopupOpen} onOpenChange={setIsWeeklyPopupOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedWeeklyPopup && (() => {
                const staffMember = staff.find(s => s.id === selectedWeeklyPopup.staffId);
                return `${staffMember?.name || tr("common.staff")} - ${format(selectedWeeklyPopup.day, "EEEE, MMMM d, yyyy")}`;
              })()}
            </SheetTitle>
            <SheetDescription>
              {selectedWeeklyPopup && tr("common.appointmentCount", { count: getAppointmentsForDateAndStaff(selectedWeeklyPopup.day, selectedWeeklyPopup.staffId).length })}
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-3">
            {selectedWeeklyPopup && getAppointmentsForDateAndStaff(selectedWeeklyPopup.day, selectedWeeklyPopup.staffId).map((apt) => {
              const staffMember = staff.find(s => s.id === apt.staffId);
              return (
                <div
                  key={apt.id}
                  onClick={() => {
                    handleAppointmentClick(apt);
                    setIsWeeklyPopupOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <AppointmentBlock
                    visits={visitsFor(apt)}
                    flagCtx={flagCtxFor(apt)}
                    appointment={apt} 
                    onClick={() => {
                      handleAppointmentClick(apt);
                      setIsWeeklyPopupOpen(false);
                    }}
                  />
                  {staff && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                      <span>{tr("calendar.time")}</span>
                      <span className="font-medium">{apt.startTime?.slice(0, 5)} - {apt.endTime?.slice(0, 5)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Selection Dialog - Opens when time range is selected */}
      <Dialog open={isSelectionDialogOpen} onOpenChange={(open) => {
        setIsSelectionDialogOpen(open);
        if (!open) {
          // Clear selection when dialog closes
          setFinalSelection(null);
          setDragSelection(null);
        }
      }}>
        <DialogContent className="rounded-[24px] border-0 bg-[rgb(var(--reg-canvas))] p-6 sm:max-w-[420px]" style={{ fontFamily: BRAND_FONT }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-[-0.02em]">{tr("calendar.whatWouldYouLikeTo")}</DialogTitle>
            <DialogDescription>
              {finalSelection && (
                <>
                  {tr("calendar.selectedTime", { startTime: finalSelection.startTime, endTime: finalSelection.endTime })}
                  <br />
                  {tr("calendar.staff2", { staffName: finalSelection.staffName })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => {
                if (finalSelection) {
                  setIsSelectionDialogOpen(false);
                  setIsNewAppointmentOpen(true);
                }
              }}
              className="h-14 w-full justify-start gap-1 rounded-2xl border-[rgb(var(--reg-line))] bg-white px-4 text-[15px] font-semibold text-[rgb(var(--reg-ink))] hover:border-[rgb(var(--reg-brand)/0.4)] hover:bg-white"
              variant="outline"
            >
              <Plus className="mr-2 h-5 w-5 text-[rgb(var(--reg-brand))]" />
              {tr("common.newBooking")}
            </Button>
            <Button
              onClick={() => {
                if (finalSelection) {
                  setIsSelectionDialogOpen(false);
                  // Pre-fill form with selected time before opening
                  setTimeOffForm({
                    staffId: finalSelection.staffId,
                    startDate: format(currentDate, "yyyy-MM-dd"),
                    endDate: format(currentDate, "yyyy-MM-dd"),
                    startTime: finalSelection.startTime,
                    endTime: finalSelection.endTime,
                    isFullDay: false, // When time is selected, it's not full day
                    isRecurring: false,
                    recurrencePattern: "",
                    recurrenceEndDate: "",
                    reason: "",
                    isApproved: false,
                  });
                  setIsAddTimeOffOpen(true);
                }
              }}
              className="h-14 w-full justify-start gap-1 rounded-2xl border-[rgb(var(--reg-line))] bg-white px-4 text-[15px] font-semibold text-[rgb(var(--reg-ink))] hover:border-[rgb(var(--reg-brand)/0.4)] hover:bg-white"
              variant="outline"
            >
              <CalendarIcon className="mr-2 h-5 w-5 text-[rgb(var(--reg-brand))]" />
              {tr("calendar.timeOff2")}
            </Button>
            <Button
              onClick={() => {
                if (finalSelection) {
                  setIsSelectionDialogOpen(false);
                  // A controlled Sheet never fires onOpenChange(true) for this call, so the
                  // chosen master/time must be copied here (it used to default to 10:00-11:00,
                  // first master, whatever slot was clicked).
                  setReservationForm((prev) => ({
                    ...prev,
                    staffId: finalSelection.staffId || prev.staffId,
                    startTime: finalSelection.startTime || prev.startTime,
                    endTime: finalSelection.endTime || prev.endTime,
                    date: format(currentDate, "yyyy-MM-dd"),
                  }));
                  setIsAddReservationOpen(true);
                }
              }}
              className="h-14 w-full justify-start gap-1 rounded-2xl border-[rgb(var(--reg-line))] bg-white px-4 text-[15px] font-semibold text-[rgb(var(--reg-ink))] hover:border-[rgb(var(--reg-brand)/0.4)] hover:bg-white"
              variant="outline"
            >
              <CalendarIcon className="mr-2 h-5 w-5 text-[rgb(var(--reg-brand))]" />
              {tr("calendar.blockTime")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conflict Confirmation Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={(open) => {
        if (!open) {
          setShowConflictDialog(false);
          setPendingAppointmentData(null);
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{tr("calendar.timeConflictDetected")}</DialogTitle>
            <DialogDescription>
              {tr("calendar.thisTimeSlotConflictsWith")}
              <br />
              <br />
              {pendingAppointmentData && (
                <>
                  <strong>{tr("calendar.selectedTime2")}</strong> {pendingAppointmentData.startTime} - {pendingAppointmentData.endTime}
                  <br />
                  <strong>{tr("calendar.date")}</strong> {format(parse(pendingAppointmentData.appointmentDate, 'yyyy-MM-dd', new Date()), 'MMM dd, yyyy')}
                </>
              )}
              <br />
              <br />
              {tr("calendar.doYouWantToProceed")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowConflictDialog(false);
                setPendingAppointmentData(null);
              }}
            >
              {tr("common.cancel")}
            </Button>
            <Button
              className="flex-1 bg-gray-600 hover:bg-gray-700"
              onClick={async () => {
                if (pendingAppointmentData) {
                  try {
                    await createAppointmentAPI(pendingAppointmentData);
                    setShowConflictDialog(false);
                    setPendingAppointmentData(null);
                    setIsNewAppointmentOpen(false);
                    setEditingAppointmentId(null);
                    setFinalSelection(null);
                    setAppointmentForm({ clientId: "", clientName: "", clientPhone: "", clientEmail: "", serviceId: "", staffId: "", startTime: "", endTime: "", notes: "", price: "", date: format(currentDate, 'yyyy-MM-dd'), requestedByClient: false, idempotencyKey: `booking-${Date.now()}-${Math.random().toString(36).slice(2)}` });
                    toast.success(tr("calendar.appointmentCreatedSuccessfullyWithConflict"));
                  } catch (error) {
                    toast.error(tr("calendar.failedToCreateAppointment"));
                  }
                }
              }}
            >
              {tr("calendar.yesCreateAnyway")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Conflict with Time Off Dialog */}
      <Dialog open={showAppointmentTimeOffConflictDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAppointmentTimeOffConflictDialog(false);
          setPendingAppointmentWithTimeOffData(null);
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{tr("calendar.timeOffConflictDetected")}</DialogTitle>
            <DialogDescription>
              {tr("calendar.thisAppointmentConflictsWithAn")}
              <br />
              <br />
              {pendingAppointmentWithTimeOffData && (
                <>
                  <strong>{tr("calendar.appointmentTime")}</strong> {pendingAppointmentWithTimeOffData.startTime} - {pendingAppointmentWithTimeOffData.endTime}
                  <br />
                  <strong>{tr("calendar.date")}</strong> {format(parse(pendingAppointmentWithTimeOffData.appointmentDate, 'yyyy-MM-dd', new Date()), 'MMM dd, yyyy')}
                </>
              )}
              <br />
              <br />
              <strong>{tr("calendar.note")}</strong>{" "}{tr("calendar.appointmentsAndTimeOffsCan")}
              <br />
              <br />
              {tr("calendar.doYouWantToProceed2")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowAppointmentTimeOffConflictDialog(false);
                setPendingAppointmentWithTimeOffData(null);
              }}
            >
              {tr("common.cancel")}
            </Button>
            <Button
              className="flex-1 bg-gray-600 hover:bg-gray-700"
              onClick={async () => {
                if (pendingAppointmentWithTimeOffData) {
                  try {
                    await createAppointmentAPI(pendingAppointmentWithTimeOffData);
                    setShowAppointmentTimeOffConflictDialog(false);
                    setPendingAppointmentWithTimeOffData(null);
                    setIsNewAppointmentOpen(false);
                    setEditingAppointmentId(null);
                    setFinalSelection(null);
                    setAppointmentForm({ clientId: "", clientName: "", clientPhone: "", clientEmail: "", serviceId: "", staffId: "", startTime: "", endTime: "", notes: "", price: "", date: format(currentDate, 'yyyy-MM-dd'), requestedByClient: false, idempotencyKey: `booking-${Date.now()}-${Math.random().toString(36).slice(2)}` });
                    toast.success(tr("calendar.appointmentCreatedSuccessfully"));
                  } catch (error) {
                    toast.error(tr("calendar.failedToCreateAppointment"));
                  }
                }
              }}
            >
              {tr("calendar.yesCreateAnyway")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New / edit booking drawer (bz kit) */}
      {isNewAppointmentOpen && (
        <BookingDrawer
          editing={!!editingAppointmentId}
          editingVisit={editingVisit}
          form={appointmentForm}
          setForm={setAppointmentForm}
          onClose={closeBookingDrawer}
          onSubmit={submitBooking}
          submitting={isBatchSubmitting}
          canSubmit={!!appointmentForm.serviceId && !!appointmentForm.startTime
            && (!!(selectedPackage && !editingAppointmentId) || (!!appointmentForm.staffId && !!appointmentForm.endTime))}
          submitLabel={editingAppointmentId
            ? tr("common.saveChanges")
            : bookingMode === 'group'
              ? tr("calendar.bookGroup", { value: groupMembers.length + 1 })
              : bookingMode === 'recurring'
                ? tr("calendar.book", { count: computeRecurrenceDates(appointmentForm.date, recurrence).length })
                : extraServices.length > 0
                  ? tr("calendar.bookServices", { value: extraServices.length + 1 })
                  : tr("calendar.bookAppointment")}
          subtitle={format(parse(appointmentForm.date || format(currentDate, 'yyyy-MM-dd'), 'yyyy-MM-dd', new Date()), 'EEEE, d MMMM')}
          clients={clients}
          clientSearchOpen={clientSearchOpen}
          setClientSearchOpen={setClientSearchOpen}
          services={services}
          serviceQuery={serviceQuery}
          setServiceQuery={setServiceQuery}
          staff={staff}
          bookingMode={bookingMode}
          setBookingMode={setBookingMode}
          recurrence={recurrence}
          setRecurrence={setRecurrence}
          recurrenceDates={computeRecurrenceDates(appointmentForm.date, recurrence)}
          seriesPreview={seriesPreview}
          describeConflict={describeConflict}
          groupMembers={groupMembers}
          setGroupMembers={setGroupMembers}
          extraServices={extraServices}
          setExtraServices={setExtraServices}
          selectedPackage={selectedPackage}
          packageParty={packageParty}
          setPackageParty={setPackageParty}
          businessId={businessId}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          salonNow={() => salonNow(salonTz)}
          salonToday={salonToday}
          getBusinessHoursForDate={getBusinessHoursForDate}
          timeOptionsWith={timeOptionsWith}
          serviceDuration={serviceDuration}
          addMinutesToTime={addMinutesToTime}
          initialsOf={initialsOf}
          total={bookingTotal}
        />
      )}

      {/* Add Time Reservation Sheet */}
      <Sheet open={isAddReservationOpen} onOpenChange={(open) => {
        if (open && finalSelection) {
          setReservationForm(prev => ({
            ...prev,
            staffId: finalSelection.staffId || prev.staffId,
            startTime: finalSelection.startTime || prev.startTime,
            endTime: finalSelection.endTime || prev.endTime,
            date: format(currentDate, "yyyy-MM-dd"),
          }));
        }
        if (!open) {
          setReservationForm({ staffId: "", date: format(currentDate, "yyyy-MM-dd"), startTime: "10:00", endTime: "11:00", reason: "" });
        }
        setIsAddReservationOpen(open);
      }}>
        <SheetContent side="right" style={{ fontFamily: BRAND_FONT }} className={SHEET_FRAME}>
          {/* Header */}
          <div className={SHEET_HEAD}>
            <SheetTitle className={SHEET_TITLE}>{tr("calendar.blockTime")}</SheetTitle>
            <p className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">{tr("calendar.keepASlotFreeNo")}</p>
          </div>

          {/* Form Content */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">
            {/* Date */}
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>{tr("calendar.date2")}</Label>
              <input
                type="date"
                value={reservationForm.date}
                onChange={(e) => setReservationForm(prev => ({ ...prev, date: e.target.value }))}
                className={FIELD}
              />
            </div>

            {/* Start Time */}
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>{tr("calendar.start")}</Label>
              <Select
                value={reservationForm.startTime}
                onValueChange={(v) => setReservationForm(prev => ({ ...prev, startTime: v }))}
              >
                <SelectTrigger className={FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.filter(slot => slot.minute === 0 || slot.minute === 15 || slot.minute === 30 || slot.minute === 45).map((slot) => (
                    <SelectItem key={slot.time} value={slot.time}>
                      {slot.time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* End Time */}
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>{tr("calendar.end")}</Label>
              <Select
                value={reservationForm.endTime}
                onValueChange={(v) => setReservationForm(prev => ({ ...prev, endTime: v }))}
              >
                <SelectTrigger className={FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.filter(slot => slot.minute === 0 || slot.minute === 15 || slot.minute === 30 || slot.minute === 45).map((slot) => (
                    <SelectItem key={slot.time} value={slot.time}>
                      {slot.time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Staffer */}
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>{tr("calendar.staffer")}</Label>
              <Select
                value={reservationForm.staffId || (staff[0]?.id ?? "")}
                onValueChange={(v) => setReservationForm(prev => ({ ...prev, staffId: v }))}
              >
                <SelectTrigger className={FIELD}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>{tr("calendar.reason")}</Label>
              <Textarea
                placeholder={tr("calendar.reason")}
                value={reservationForm.reason}
                onChange={(e) => setReservationForm(prev => ({ ...prev, reason: e.target.value }))}
                className="min-h-[100px] text-sm resize-y"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className={SHEET_FOOT}>
            <Button
              variant="outline"
              className={SECONDARY_BTN}
              onClick={() => setIsAddReservationOpen(false)}
            >
              {tr("common.cancel")}
            </Button>
            <Button
              className={PRIMARY_BTN}
              disabled={!reservationForm.staffId && !staff[0]?.id}
              onClick={async () => {
                try {
                  const staffIdToUse = reservationForm.staffId || staff[0]?.id;
                  if (!staffIdToUse) { toast.error(tr("calendar.pleaseSelectAStaffMember")); return; }
                  await createTimeOff({
                    businessId,
                    staffId: staffIdToUse,
                    startDate: reservationForm.date,
                    endDate: reservationForm.date,
                    startTime: reservationForm.startTime,
                    endTime: reservationForm.endTime,
                    isFullDay: false,
                    isRecurring: false,
                    // A block the owner puts on the calendar is in force at once.
                    isApproved: true,
                    reason: reservationForm.reason || "Reservation",
                  });
                  toast.success(tr("calendar.timeReservationSavedSuccessfully"));
                  setIsAddReservationOpen(false);
                  setFinalSelection(null);
                } catch {
                  toast.error(tr("calendar.failedToSaveReservation"));
                }
              }}
            >
              {tr("common.save")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Time Off Sheet */}
      <Sheet open={isAddTimeOffOpen} onOpenChange={(open) => {
        setIsAddTimeOffOpen(open);
        if (!open) {
          // Reset form when closed
          setTimeOffForm({
            staffId: "",
            startDate: format(currentDate, "yyyy-MM-dd"),
            endDate: format(currentDate, "yyyy-MM-dd"),
            startTime: "",
            endTime: "",
            isFullDay: true,
            isRecurring: false,
            recurrencePattern: "",
            recurrenceEndDate: "",
            reason: "",
            isApproved: false,
          });
          // Clear final selection when closing
          setFinalSelection(null);
        }
      }}>
        <SheetContent side="right" style={{ fontFamily: BRAND_FONT }} className={SHEET_FRAME}>
          {/* Header */}
          <div className={SHEET_HEAD}>
            <SheetTitle className={SHEET_TITLE}>{tr("calendar.timeOff2")}</SheetTitle>
            <p className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">{tr("calendar.holidaySickDayOrA")}</p>
          </div>

          {/* Form Content */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">
            {/* Staff Selection */}
            <div className="space-y-2">
              <Label className={FIELD_LABEL}>{tr("calendar.selectStaff")}</Label>
              <Select
                value={timeOffForm.staffId}
                onValueChange={(value) => setTimeOffForm(prev => ({ ...prev, staffId: value }))}
              >
                <SelectTrigger className={FIELD}>
                  <SelectValue placeholder={tr("common.selectStaffMember")} />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Full Day / Hours Selection */}
            <div className="space-y-2">
              <Label className={FIELD_LABEL}>{tr("common.duration")}</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="full-day"
                    checked={timeOffForm.isFullDay}
                    onCheckedChange={(checked) => {
                      setTimeOffForm(prev => ({ ...prev, isFullDay: checked === true }));
                      if (checked) {
                        // When switching to full day, clear time fields
                        setTimeOffForm(prev => ({ ...prev, startTime: "", endTime: "" }));
                      } else if (finalSelection) {
                        // When switching from full day and we have a selection, restore times
                        setTimeOffForm(prev => ({
                          ...prev,
                          startTime: finalSelection.startTime,
                          endTime: finalSelection.endTime,
                        }));
                      }
                    }}
                  />
                  <Label htmlFor="full-day" className="text-sm font-normal cursor-pointer">
                    {tr("calendar.fullDay")}
                  </Label>
                </div>
              </div>
              {/* Show selected time info when opened from calendar selection */}
              {!timeOffForm.isFullDay && timeOffForm.startTime && timeOffForm.endTime && (
                <div className="rounded-xl bg-[rgb(var(--reg-brand)/0.08)] px-3 py-2 text-sm text-[rgb(var(--reg-ink)/0.8)]">
                  <span className="font-medium">{tr("calendar.selectedTime2")}</span> {timeOffForm.startTime} - {timeOffForm.endTime}
                </div>
              )}
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className={FIELD_LABEL}>{tr("calendar.startDate")}</Label>
                <Input
                  type="date"
                  value={timeOffForm.startDate}
                  onChange={(e) => setTimeOffForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className={FIELD}
                />
              </div>
              <div className="space-y-2">
                <Label className={FIELD_LABEL}>{tr("calendar.endDate")}</Label>
                <Input
                  type="date"
                  value={timeOffForm.endDate}
                  onChange={(e) => setTimeOffForm(prev => ({ ...prev, endDate: e.target.value }))}
                  className={FIELD}
                  min={timeOffForm.startDate}
                />
              </div>
            </div>

            {/* Time Range (if not full day) */}
            {!timeOffForm.isFullDay && (() => {
              // Get business hours for the selected date
              const selectedDate = timeOffForm.startDate ? parse(timeOffForm.startDate, "yyyy-MM-dd", new Date()) : currentDate;
              const { startHour: dayStartHour, endHour: dayEndHour, isEnabled: dayIsEnabled } = getBusinessHoursForDate(selectedDate);
              
              // Calculate min and max times based on business hours
              const minTime = dayIsEnabled ? `${dayStartHour.toString().padStart(2, "0")}:00` : "00:00";
              const maxTime = dayIsEnabled ? `${dayEndHour.toString().padStart(2, "0")}:00` : "23:59";
              
              return (
                <div className="space-y-3">
                  {!dayIsEnabled && (
                    <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
                      {tr("calendar.businessIsClosedOnThis")}
                    </div>
                  )}
                  {dayIsEnabled && (
                    <div className="rounded-xl bg-[rgb(var(--reg-brand)/0.08)] px-3 py-2 text-sm text-[rgb(var(--reg-ink)/0.8)]">
                      {tr("calendar.businessHours", { minTime, maxTime })}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className={FIELD_LABEL}>{tr("calendar.startTime2")}</Label>
                      <Input
                        type="time"
                        value={timeOffForm.startTime}
                        onChange={(e) => {
                          const newStartTime = e.target.value;
                          setTimeOffForm(prev => ({ ...prev, startTime: newStartTime }));
                          
                          // Validate start time is within business hours
                          if (dayIsEnabled && newStartTime) {
                            const startHour = parseInt(newStartTime.split(':')[0]);
                            if (startHour < dayStartHour || startHour >= dayEndHour) {
                              toast.error(tr("calendar.startTimeMustBeWithin", { minTime, maxTime }));
                            }
                          }
                        }}
                        min={minTime}
                        max={maxTime}
                        className={FIELD}
                        disabled={!dayIsEnabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className={FIELD_LABEL}>{tr("calendar.endTime2")}</Label>
                      <Input
                        type="time"
                        value={timeOffForm.endTime}
                        onChange={(e) => {
                          const newEndTime = e.target.value;
                          setTimeOffForm(prev => ({ ...prev, endTime: newEndTime }));
                          
                          // Validate end time is within business hours
                          if (dayIsEnabled && newEndTime) {
                            const endHour = parseInt(newEndTime.split(':')[0]);
                            if (endHour <= dayStartHour || endHour > dayEndHour) {
                              toast.error(tr("calendar.endTimeMustBeWithin", { minTime, maxTime }));
                            }
                          }
                        }}
                        min={minTime}
                        max={maxTime}
                        className={FIELD}
                        disabled={!dayIsEnabled}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Recurring */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recurring"
                  checked={timeOffForm.isRecurring}
                  onCheckedChange={(checked) => setTimeOffForm(prev => ({ ...prev, isRecurring: checked === true }))}
                />
                <Label htmlFor="recurring" className="text-sm font-normal cursor-pointer">
                  {tr("calendar.repeat")}
                </Label>
              </div>
              {timeOffForm.isRecurring && (
                <div className="space-y-2 pl-6">
                  <Select
                    value={timeOffForm.recurrencePattern}
                    onValueChange={(value) => setTimeOffForm(prev => ({ ...prev, recurrencePattern: value }))}
                  >
                    <SelectTrigger className={FIELD}>
                      <SelectValue placeholder={tr("calendar.selectPattern")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">{tr("common.daily")}</SelectItem>
                      <SelectItem value="WEEKLY">{tr("calendar.weekly")}</SelectItem>
                      <SelectItem value="MONTHLY">{tr("calendar.monthly")}</SelectItem>
                      <SelectItem value="YEARLY">{tr("calendar.yearly")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="space-y-2">
                    <Label className={FIELD_LABEL}>{tr("calendar.repeatUntil")}</Label>
                    <Input
                      type="date"
                      value={timeOffForm.recurrenceEndDate}
                      onChange={(e) => setTimeOffForm(prev => ({ ...prev, recurrenceEndDate: e.target.value }))}
                      className={FIELD}
                      min={timeOffForm.endDate}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label className={FIELD_LABEL}>{tr("calendar.reason2")}</Label>
              <Textarea
                value={timeOffForm.reason}
                onChange={(e) => setTimeOffForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder={tr("calendar.enterReasonForTimeOff")}
                className="text-sm min-h-[80px]"
              />
            </div>

            {/* Approval */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="approved"
                  checked={timeOffForm.isApproved}
                  onCheckedChange={(checked) => setTimeOffForm(prev => ({ ...prev, isApproved: checked === true }))}
                />
                <Label htmlFor="approved" className="text-sm font-normal cursor-pointer">
                  {tr("calendar.approved")}
                </Label>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {timeOffForm.isApproved 
                    ? tr("calendar.noManagerApprovalNeeded") 
                    : tr("calendar.requiresManagerApproval")}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className={SHEET_FOOT}>
            <Button
              variant="outline"
              className={SECONDARY_BTN}
              onClick={() => setIsAddTimeOffOpen(false)}
            >
              {tr("common.cancel")}
            </Button>
            <Button
              className={PRIMARY_BTN}
              disabled={!timeOffForm.staffId || !timeOffForm.startDate || !timeOffForm.endDate || !timeOffForm.reason}
              onClick={async () => {
                if (!timeOffForm.staffId || !timeOffForm.startDate || !timeOffForm.endDate || !timeOffForm.reason) {
                  toast.error(tr("common.pleaseFillInAllRequired"));
                  return;
                }

                // Get business hours for the time off start date
                const timeOffStartDate = parse(timeOffForm.startDate, "yyyy-MM-dd", new Date());
                const { startHour: timeOffDayStartHour, endHour: timeOffDayEndHour, isEnabled: timeOffDayEnabled } = getBusinessHoursForDate(timeOffStartDate);
                
                // If day is disabled, reject time off
                if (!timeOffDayEnabled) {
                  toast.error(tr("calendar.cannotCreateTimeOffOn"));
                  return;
                }
                
                // If not full day, validate that time is within business hours
                if (!timeOffForm.isFullDay && timeOffForm.startTime && timeOffForm.endTime) {
                  const startHour = parseInt(timeOffForm.startTime.split(':')[0]);
                  const startMinute = parseInt(timeOffForm.startTime.split(':')[1] || '0');
                  const endHour = parseInt(timeOffForm.endTime.split(':')[0]);
                  const endMinute = parseInt(timeOffForm.endTime.split(':')[1] || '0');
                  
                  // Check if start time is before business hours
                  if (startHour < timeOffDayStartHour || (startHour === timeOffDayStartHour && startMinute < 0)) {
                    toast.error(tr("calendar.startTimeMustBeWithin2", { value: timeOffDayStartHour.toString().padStart(2, "0"), value2: timeOffDayEndHour.toString().padStart(2, "0") }));
                    return;
                  }
                  
                  // Check if end time is after business hours
                  if (endHour > timeOffDayEndHour || (endHour === timeOffDayEndHour && endMinute > 0)) {
                    toast.error(tr("calendar.endTimeMustBeWithin2", { value: timeOffDayStartHour.toString().padStart(2, "0"), value2: timeOffDayEndHour.toString().padStart(2, "0") }));
                    return;
                  }
                  
                  // Check if start time is after end time
                  if (startHour > endHour || (startHour === endHour && startMinute >= endMinute)) {
                    toast.error(tr("calendar.startTimeMustBeBefore"));
                    return;
                  }
                }
                
                // If day is disabled, use 0-0 (no business hours) - but we already checked above
                const effectiveStartHour = timeOffDayEnabled ? timeOffDayStartHour : 0;
                const effectiveEndHour = timeOffDayEnabled ? timeOffDayEndHour : 0;
                
                // Check for conflicts with other time offs (NOT ALLOWED)
                const startTime = timeOffForm.isFullDay 
                  ? `${effectiveStartHour.toString().padStart(2, "0")}:00` 
                  : (timeOffForm.startTime || "00:00");
                const endTime = timeOffForm.isFullDay 
                  ? `${effectiveEndHour.toString().padStart(2, "0")}:00` 
                  : (timeOffForm.endTime || "23:59");
                
                const hasTimeOffConflictResult = hasTimeOffConflict(
                  timeOffs,
                  timeOffForm.staffId,
                  timeOffForm.startDate,
                  timeOffForm.endDate,
                  startTime,
                  endTime,
                  timeOffForm.isFullDay,
                  effectiveStartHour,
                  effectiveEndHour
                );
                
                if (hasTimeOffConflictResult) {
                  toast.error(tr("calendar.thisTimeOffConflictsWith"));
                  return;
                }
                
                // Check for conflicts with appointments (ALLOWED - will show side-by-side)
                const timeOffDate = parse(timeOffForm.startDate, "yyyy-MM-dd", new Date());
                const dayAppointments = appointments.filter((apt) =>
                  isSameDay(apt.date, timeOffDate)
                );
                
                const hasAppointmentConflict = hasTimeConflict(dayAppointments, timeOffForm.staffId, startTime, endTime);
                
                if (hasAppointmentConflict) {
                  // Show conflict dialog - appointments are allowed but will display side-by-side
                  setPendingTimeOffData({
                    staffId: timeOffForm.staffId,
                    startDate: timeOffForm.startDate,
                    endDate: timeOffForm.endDate,
                    startTime,
                    endTime,
                    isFullDay: timeOffForm.isFullDay,
                    reason: timeOffForm.reason,
                  });
                  setShowTimeOffConflictDialog(true);
                  return;
                }

                // No conflict, proceed with creation
                try {
                  await createTimeOff({
                    businessId: businessId,
                    staffId: timeOffForm.staffId,
                    startDate: timeOffForm.startDate,
                    endDate: timeOffForm.endDate,
                    startTime: timeOffForm.isFullDay ? undefined : timeOffForm.startTime || undefined,
                    endTime: timeOffForm.isFullDay ? undefined : timeOffForm.endTime || undefined,
                    isFullDay: timeOffForm.isFullDay,
                    isRecurring: timeOffForm.isRecurring,
                    recurrencePattern: timeOffForm.isRecurring ? timeOffForm.recurrencePattern : undefined,
                    recurrenceEndDate: timeOffForm.isRecurring && timeOffForm.recurrenceEndDate ? timeOffForm.recurrenceEndDate : undefined,
                    reason: timeOffForm.reason,
                    isApproved: timeOffForm.isApproved,
                  });
                  
                  setIsAddTimeOffOpen(false);
                  setTimeOffForm({
                    staffId: "",
                    startDate: format(currentDate, "yyyy-MM-dd"),
                    endDate: format(currentDate, "yyyy-MM-dd"),
                    startTime: "",
                    endTime: "",
                    isFullDay: true,
                    isRecurring: false,
                    recurrencePattern: "",
                    recurrenceEndDate: "",
                    reason: "",
                    isApproved: false,
                  });
                } catch (error) {
                  // Error creating time off - handled by toast
                }
              }}
            >
              {tr("common.save")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Time Off Conflict Confirmation Dialog */}
      <Dialog open={showTimeOffConflictDialog} onOpenChange={(open) => {
        if (!open) {
          setShowTimeOffConflictDialog(false);
          setPendingTimeOffData(null);
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{tr("calendar.appointmentConflictDetected")}</DialogTitle>
            <DialogDescription>
              {tr("calendar.thisTimeOffConflictsWith2")}
              <br />
              <br />
              {pendingTimeOffData && (
                <>
                  <strong>{tr("calendar.timeOff4")}</strong> {pendingTimeOffData.startTime} - {pendingTimeOffData.endTime}
                  <br />
                  <strong>{tr("calendar.date")}</strong> {format(parse(pendingTimeOffData.startDate, 'yyyy-MM-dd', new Date()), 'MMM dd, yyyy')}
                  {pendingTimeOffData.isFullDay && <span>{" "}{tr("calendar.fullDay2")}</span>}
                  <br />
                  <strong>{tr("calendar.reason3")}</strong> {pendingTimeOffData.reason}
                </>
              )}
              <br />
              <br />
              <strong>{tr("calendar.note")}</strong>{" "}{tr("calendar.timeOffsAndAppointmentsCan")}
              <br />
              <br />
              {tr("calendar.doYouWantToProceed3")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowTimeOffConflictDialog(false);
                setPendingTimeOffData(null);
              }}
            >
              {tr("common.cancel")}
            </Button>
            <Button
              className="flex-1 bg-gray-600 hover:bg-gray-700"
              onClick={async () => {
                setShowTimeOffConflictDialog(false);
                try {
                  await createTimeOff({
                    businessId: businessId,
                    staffId: timeOffForm.staffId,
                    startDate: timeOffForm.startDate,
                    endDate: timeOffForm.endDate,
                    startTime: timeOffForm.isFullDay ? undefined : timeOffForm.startTime || undefined,
                    endTime: timeOffForm.isFullDay ? undefined : timeOffForm.endTime || undefined,
                    isFullDay: timeOffForm.isFullDay,
                    isRecurring: timeOffForm.isRecurring,
                    recurrencePattern: timeOffForm.isRecurring ? timeOffForm.recurrencePattern : undefined,
                    recurrenceEndDate: timeOffForm.isRecurring && timeOffForm.recurrenceEndDate ? timeOffForm.recurrenceEndDate : undefined,
                    reason: timeOffForm.reason,
                    isApproved: timeOffForm.isApproved,
                  });
                  
                  setIsAddTimeOffOpen(false);
                  setTimeOffForm({
                    staffId: "",
                    startDate: format(currentDate, "yyyy-MM-dd"),
                    endDate: format(currentDate, "yyyy-MM-dd"),
                    startTime: "",
                    endTime: "",
                    isFullDay: true,
                    isRecurring: false,
                    recurrencePattern: "",
                    recurrenceEndDate: "",
                    reason: "",
                    isApproved: false,
                  });
                  setPendingTimeOffData(null);
                } catch (error) {
                  // Error creating time off - handled by toast
                }
              }}
            >
              {tr("calendar.createAnyway")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
          </>
          )}
        </div>
      </div>
    <WaitlistAddDialog
        open={addWaiterOpen}
        onOpenChange={setAddWaiterOpen}
        businessId={String(businessId)}
        date={format(currentDate, "yyyy-MM-dd")}
        services={services.map(sv => ({ id: String(sv.id), name: sv.name }))}
        masters={staff.map(st => ({ id: String(st.id), name: st.name }))}
        onAdded={reloadWaitlist}
      />
    </AppLayout>
  );
}
