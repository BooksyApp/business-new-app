import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { appointmentTags, clientColorClasses } from "@/lib/appointmentVisuals";
import { currencySymbol } from "@/lib/currency";
import { ChevronLeft, ChevronRight, Bell, Search, Settings, Plus, ChevronDown, ChevronUp, Calendar as CalendarIcon, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek, isToday, getDay, parse } from "date-fns";
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
import { AppointmentBlock, StaffAvatar, type Appointment, type Staff } from "@/components/calendar/AppointmentBlock";
import { AppointmentModal } from "@/components/calendar/AppointmentModal";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, User, Users, Heart, HelpCircle, Clock, Check, ChevronsUpDown, Layers, Package, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppointments, type Appointment as AppointmentType } from "@/hooks/useAppointments";
import { useServices } from "@/hooks/useServices";
import { useTimeOff } from "@/hooks/useTimeOff";
import type { TimeOff } from "@/services/timeOffService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { categoryTint, type CategoryTint } from "@/lib/serviceCategoryColor";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useServiceOffers } from "@/hooks/useServiceOffers";
import { useFeatureFlags } from "@/services/platformService";
import { appointmentService } from "@/services/appointmentService";
import { waitlistService, type WaitlistEntry } from "@/services/waitlistService";
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
    service: apt.service,
    startTime: apt.startTime,
    endTime: apt.endTime,
    staffId: apt.staffId,
    color: apt.color,
    // Needed on the block itself: the "requested by client" flag lives in the notes, and
    // the badges are keyed off the client record rather than a name string.
    notes: apt.notes,
    clientId: (apt as { clientId?: number }).clientId,
    clientEmail: (apt as { clientEmail?: string }).clientEmail,
    date: apt.date,
    apiId: apt.apiId,
    status: apt.status,   // #30
    price: apt.price,
    serviceId: apt.serviceId,
    visitId: apt.visitId,
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

function parseTime(time: string): number {
  const parts = time.split(":");
  const hour = parseInt(parts[0]);
  const minute = parseInt(parts[1] || "0");
  return hour * 60 + minute; // Total minutes from 00:00
}

// Slot height for better readability (20px per 15-minute slot)
const SLOT_HEIGHT = 20;

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

type ConflictItem = { type: 'appointment'; item: Appointment } | { type: 'timeoff'; item: TimeOff };

// Group appointments and time offs by conflicts
function groupConflictingItems(
  appointments: Appointment[], 
  timeOffs: TimeOff[],
  businessStartHour: number,
  businessEndHour: number
): ConflictItem[][] {
  const groups: ConflictItem[][] = [];
  const processedApts = new Set<string>();
  const processedTimeOffs = new Set<number>();
  
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const businessId = useBusinessId();
  
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
        linked: new Set(sortedActive.map((m) => m.staffId)).size > 1,
        visitMates: sorted.map((m) => ({
          id: m.id, service: m.service, startTime: m.startTime, endTime: m.endTime, price: m.price,
          status: m.status, staffId: m.staffId, serviceId: String(m.serviceId ?? ""), staffName: apiStaff?.find((st) => String(st.id) === m.staffId)?.name,
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const flags = useFeatureFlags();
  const offers = useServiceOffers(businessId);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);

  const reloadWaitlist = useCallback(() => {
    if (!businessId) return;
    waitlistService
      .listForBusiness(businessId)
      .then(rows => setWaitlist(rows.filter(w => w.status !== "CANCELLED")))
      // A failed waitlist fetch must not take the calendar down with it.
      .catch(() => setWaitlist([]));
  }, [businessId]);

  useEffect(reloadWaitlist, [reloadWaitlist]);

  /** Which waiting client this booking is for, so the card leaves the column when it is booked. */
  const [placingEntryId, setPlacingEntryId] = useState<number | null>(null);
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
  const [draggingEntry, setDraggingEntry] = useState<WaitlistEntry | null>(null);

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
    setDraggingEntry(null);
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
    original: { staffId: number; serviceId: number; startTime: string; endTime: string; price?: number }[];
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

  const visitsFor = (who?: { clientId?: number; clientName?: string; clientEmail?: string } | string) => {
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

  const blockVisuals = (apt: {
    clientName?: string;
    notes?: string;
    clientId?: number;
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
          staffId: parseInt(m.staffId),
          serviceId: parseInt(base.serviceId),
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
      for (const d of dates) {
        // H-01: 2+ services on one date are ONE visit — the same visit_id grouping a web
        // cart gets, so the calendar card, details, till (one ticket) and partial cancel
        // treat them as a single booking. A lone service stays a standalone booking.
        const filled = lines.filter((l) => l.serviceId && l.staffId && l.startTime && l.endTime);
        const visitId = filled.length > 1 ? crypto.randomUUID() : undefined;
        for (const l of filled) {
          reqs.push({
            staffId: parseInt(l.staffId),
            serviceId: parseInt(l.serviceId),
            appointmentDate: d,
            startTime: l.startTime,
            endTime: l.endTime,
            clientName: base.clientName || undefined,
            clientPhone: base.clientPhone || undefined,
            clientEmail: base.clientEmail || undefined,
            price: servicePrice(l.serviceId),
            notes,
            ...(visitId ? { visitId } : {}),
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
    for (const r of reqs) {
      try {
        await createAppointmentAPI(r, { silent: true });
        created++;
      } catch {
        skipped++;
      }
    }
    setIsBatchSubmitting(false);

    if (created > 0 && skipped === 0) {
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
    setCurrentDate(new Date());
    setMonthViewDate(new Date());
    setWeekViewDate(new Date());
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
    return appointments.filter(
      apt => isSameDay(apt.date, date) && apt.staffId === staffId && matchesSearch(apt)
    );
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
    const items: { label: string; detail: string; tone: string; onClick: () => void }[] = [];

    for (const apt of todays.filter(a => a.status === "PENDING")) {
      items.push({
        label: tr("calendar.confirm2", { value: apt.clientName || tr("calendar.confirmBookingGeneric") }),
        detail: `${apt.startTime} · ${apt.service}`,
        tone: "bg-amber-500",
        onClick: () => handleAppointmentClick(apt),
      });
    }
    for (const apt of todays.filter(a => a.status === "COMPLETED")) {
      items.push({
        label: tr("calendar.takePayment3", { value: apt.clientName || tr("common.client") }),
        detail: `${apt.startTime} · ${apt.service}`,
        tone: "bg-emerald-500",
        onClick: () => handleAppointmentClick(apt),
      });
    }
    for (const w of waitlist) {
      items.push({
        label: tr("calendar.isWaiting", { value: w.clientName || w.clientEmail || tr("common.client") }),
        detail: [w.serviceName, w.preferredDate || "any date"].filter(Boolean).join(" · "),
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
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Note: useAppointments and useTimeOff hooks already handle loading data
  // when currentDate changes and on mount. WebSocket handles all real-time updates.
  // No need for additional refresh logic here.

  // Check if current date is being viewed
  const isCurrentDate = isToday(currentDate);

  // Open the day at the salon's opening hour (or an hour before now, today) instead of
  // midnight: the grid used to start with nine hours of closed, hatched rows.
  const dayGridRef = useRef<HTMLDivElement>(null);
  const openingHour = getBusinessHoursForDate(currentDate).startHour;
  useEffect(() => {
    if (viewType !== "Day" || loading || !dayGridRef.current) return;
    const nowHour = new Date().getHours();
    const target = isCurrentDate ? Math.max(openingHour, Math.min(nowHour - 1, 23)) : openingHour;
    dayGridRef.current.scrollTop = Math.max(0, target) * 4 * SLOT_HEIGHT;
  }, [viewType, loading, openingHour, isCurrentDate, currentDate]);

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
          staffId: Number(m.staffId), serviceId: Number(m.serviceId),
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
          {/* Loading State */}
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[rgb(var(--reg-brand))] border-t-transparent"></div>
                <p className="text-sm text-muted-foreground">{tr("calendar.loadingCalendar")}</p>
              </div>
            </div>
          )}

          {/* No Staff State */}
          {!loading && (!apiStaff || apiStaff.length === 0) && (
            <div className="flex flex-1 items-center justify-center px-6">
              <div className="mx-auto max-w-sm text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-mesh-1)),rgb(var(--reg-mesh-2))_55%,rgb(var(--reg-mesh-3)))]">
                  <Users className="h-7 w-7 text-[rgb(var(--reg-ink))]" strokeWidth={1.75} aria-hidden />
                </span>
                <h2 className="mt-6 text-2xl font-extrabold tracking-[-0.02em]">{tr("calendar.addYourTeamToStart")}</h2>
                <p className="mt-2 text-base leading-relaxed text-[rgb(var(--reg-muted))]">
                  {tr("calendar.eachPersonGetsTheirOwn")}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(getPath("staff"))}
                  className="mt-7 inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] px-7 text-base font-semibold text-white shadow-[0_10px_24px_-8px_rgb(var(--reg-brand-strong)/0.6)] transition hover:brightness-110"
                >
                  <Plus size={18} aria-hidden />
                  {tr("common.addTeamMember")}
                </button>
              </div>
            </div>
          )}
          
          {/* Top Navigation Bar - Only show when staff exists */}
          {!loading && apiStaff && apiStaff.length > 0 && (
          <>
          <div className="z-30 border-b border-[rgb(var(--reg-line)/0.8)] bg-[rgb(var(--reg-canvas)/0.92)] px-3 pb-3 pt-3 backdrop-blur-xl md:px-6">
            {/* Row 1 — where am I: ‹ Today ›, the date (with the picker), the day's hours; actions on the right. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 md:flex-nowrap md:gap-3">
              <div className="flex shrink-0 items-center rounded-full bg-white p-1 shadow-[0_1px_2px_rgb(var(--reg-ink)/0.05)] ring-1 ring-[rgb(var(--reg-line))]">
                <button
                  type="button"
                  aria-label={viewType === "Day" ? tr("calendar.previousDay") : viewType === "Weekly" ? tr("calendar.previousWeek") : tr("calendar.previousMonth")}
                  onClick={viewType === "Day" ? goToPrevDay : viewType === "Weekly" ? goToPrevWeek : goToPrevMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[rgb(var(--reg-ink)/0.75)] hover:bg-[rgb(var(--reg-canvas))]"
                >
                  <ChevronLeft size={18} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  className={cn(
                    "h-8 rounded-full px-3 text-sm font-semibold transition-colors",
                    isCurrentDate && viewType === "Day" ? "text-[rgb(var(--reg-muted))]" : "text-[rgb(var(--reg-ink))] hover:bg-[rgb(var(--reg-canvas))]",
                  )}
                >
                  {tr("common.today")}
                </button>
                <button
                  type="button"
                  aria-label={viewType === "Day" ? tr("calendar.nextDay") : viewType === "Weekly" ? tr("calendar.nextWeek") : tr("calendar.nextMonth")}
                  onClick={viewType === "Day" ? goToNextDay : viewType === "Weekly" ? goToNextWeek : goToNextMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[rgb(var(--reg-ink)/0.75)] hover:bg-[rgb(var(--reg-canvas))]"
                >
                  <ChevronRight size={18} strokeWidth={1.75} />
                </button>
              </div>

              {legendEntries.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={tr("calendar.colourLegend")}
                      className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold ring-1 ring-[rgb(var(--reg-line))] hover:bg-[rgb(var(--reg-canvas))]"
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

              {viewType === "Day" ? (
                <Popover onOpenChange={(open) => { if (open) setDatePickerMonth(currentDate); }}>
                  <PopoverTrigger asChild>
                    <button type="button" className="order-last flex min-w-0 basis-full items-center gap-1.5 rounded-full py-1 text-left hover:bg-white/70 md:order-none md:basis-auto md:px-2">
                      <span className="truncate text-lg font-extrabold tracking-[-0.02em] md:text-xl">
                        <span className="md:hidden">{format(currentDate, "EEE, d MMM")}</span>
                        <span className="hidden md:inline">{format(currentDate, "EEEE, d MMMM")}</span>
                      </span>
                      <ChevronDown size={16} className="shrink-0 text-[rgb(var(--reg-muted))]" />
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
                              const isTodayDate = isToday(day);
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
                <p className="order-last min-w-0 basis-full truncate text-lg font-extrabold tracking-[-0.02em] md:order-none md:basis-auto md:px-2 md:text-xl">
                  {viewType === "Weekly"
                    ? (() => {
                        const weekStart = startOfWeek(weekViewDate, { weekStartsOn: 1 });
                        const weekEnd = endOfWeek(weekViewDate, { weekStartsOn: 1 });
                        return `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM")}`;
                      })()
                    : format(monthViewDate, "MMMM yyyy")}
                </p>
              )}

              <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
                <div className="hidden h-10 items-center gap-2 rounded-full bg-white px-3.5 ring-1 ring-[rgb(var(--reg-line))] focus-within:ring-2 focus-within:ring-[rgb(var(--reg-brand)/0.5)] lg:flex">
                  <Search size={16} strokeWidth={1.75} className="text-[rgb(var(--reg-muted))]" />
                  <input
                    type="text"
                    value={calendarSearch}
                    onChange={(e) => setCalendarSearch(e.target.value)}
                    placeholder={tr("calendar.findAClient")}
                    aria-label={tr("calendar.findAClient2")}
                    className="w-40 border-0 bg-transparent text-sm outline-none placeholder:text-[rgb(var(--reg-muted))]"
                  />
                  {calendarSearch && (
                    <button onClick={() => setCalendarSearch("")} aria-label={tr("calendar.clearSearch")} className="text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <Button
                  aria-label={tr("calendar.findAClient2")}
                  aria-expanded={mobileSearchOpen}
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-[rgb(var(--reg-ink)/0.75)] hover:bg-white lg:hidden"
                  onClick={() => setMobileSearchOpen((v) => !v)}
                >
                  <Search size={18} strokeWidth={1.75} />
                </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button aria-label={tr("calendar.needsAttention")} variant="ghost" size="icon" className="relative h-10 w-10 rounded-full text-[rgb(var(--reg-ink)/0.75)] hover:bg-white hover:text-[rgb(var(--reg-ink))]">
                <Bell size={18} strokeWidth={1.75} />
                {attention.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                    {attention.length}
                  </span>
                )}
              </Button>
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
                <Button
                  aria-label={tr("calendar.calendarSettings")}
                  variant="ghost"
                  size="icon"
                  className="hidden h-10 w-10 rounded-full text-[rgb(var(--reg-ink)/0.75)] hover:bg-white hover:text-[rgb(var(--reg-ink))] sm:inline-flex"
                  onClick={() => navigate(getPath("/booking-rules"))}
                >
                  <Settings size={18} strokeWidth={1.75} />
                </Button>
                <button
                  type="button"
                  onClick={() => setIsNewAppointmentOpen(true)}
                  className="ml-1 hidden h-10 items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgb(var(--reg-brand-strong)/0.7)] transition hover:brightness-110 active:scale-[0.98] md:inline-flex"
                >
                  <Plus size={16} strokeWidth={2.25} />
                  {tr("common.newBooking")}
                </button>
              </div>
            </div>

            {mobileSearchOpen && (
              <div className="mt-3 flex h-11 items-center gap-2 rounded-full bg-white px-4 ring-1 ring-[rgb(var(--reg-line))] lg:hidden">
                <Search size={16} strokeWidth={1.75} className="text-[rgb(var(--reg-muted))]" />
                <input
                  autoFocus
                  type="text"
                  value={calendarSearch}
                  onChange={(e) => setCalendarSearch(e.target.value)}
                  placeholder={tr("calendar.findAClient")}
                  aria-label={tr("calendar.findAClient2")}
                  className="min-w-0 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-[rgb(var(--reg-muted))]"
                />
                {calendarSearch && (
                  <button onClick={() => setCalendarSearch("")} aria-label={tr("calendar.clearSearch")} className="text-[rgb(var(--reg-muted))]">
                    <X size={16} />
                  </button>
                )}
              </div>
            )}

            {/* Row 2 — how am I looking: view switch, who, and the day's hours. */}
            <div className="mt-3 flex items-center gap-2">
              <div role="tablist" aria-label={tr("calendar.calendarView")} className="flex shrink-0 rounded-full bg-[rgb(var(--reg-ink)/0.05)] p-1">
                {([["Day", tr("calendar.viewDay")], ["Weekly", tr("calendar.viewWeek")], ["Month", tr("calendar.viewMonth")]] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={viewType === v}
                    onClick={() => setViewType(v)}
                    className={cn(
                      "h-8 rounded-full px-3 text-sm font-semibold transition-colors md:px-3.5",
                      viewType === v
                        ? "bg-white text-[rgb(var(--reg-ink))] shadow-[0_1px_2px_rgb(var(--reg-ink)/0.06),0_4px_12px_-6px_rgb(var(--reg-ink)/0.15)]"
                        : "text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {viewType === "Day" && !isMobile && staff.length > 1 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3.5 text-sm font-semibold ring-1 ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]">
                      <Users size={16} strokeWidth={1.75} className="text-[rgb(var(--reg-muted))]" />
                      {visibleStaff.length === staff.length ? tr("calendar.allTeam") : tr("calendar.of", { count: visibleStaff.length, count2: staff.length })}
                      <ChevronDown size={14} className="text-[rgb(var(--reg-muted))]" />
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

              {viewType === "Day" && getAppointmentsForDate(currentDate).length === 0 && (
                <p className="ml-auto hidden text-sm text-[rgb(var(--reg-muted))] lg:block">
                  {tr("calendar.noBookingsYetClickA")}
                </p>
              )}
              {viewType === "Day" && (() => {
                const { startHour, endHour, isEnabled } = getBusinessHoursForDate(currentDate);
                return (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                      getAppointmentsForDate(currentDate).length === 0 ? "ml-auto lg:ml-3" : "ml-auto",
                      isEnabled ? "bg-white text-[rgb(var(--reg-ink)/0.8)] ring-1 ring-[rgb(var(--reg-line))]" : "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-muted))]",
                    )}
                  >
                    <Clock size={13} strokeWidth={1.75} aria-hidden />
                    {isEnabled
                      ? `${startHour.toString().padStart(2, "0")}:00–${endHour.toString().padStart(2, "0")}:00`
                      : <><span className="md:hidden">{tr("common.closed")}</span><span className="hidden md:inline">{tr("calendar.closedToday")}</span></>}
                  </span>
                );
              })()}
            </div>

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
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-sm font-semibold ring-1 transition",
                        on ? "bg-[rgb(var(--reg-ink))] text-white ring-[rgb(var(--reg-ink))]" : "bg-white text-[rgb(var(--reg-ink))] ring-[rgb(var(--reg-line))]",
                      )}
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
          <div ref={dayGridRef} className="relative flex flex-1 overflow-auto bg-white md:mx-4 md:mb-4 md:mt-3 md:rounded-[20px] md:shadow-[0_1px_2px_rgb(var(--reg-ink)/0.04),0_12px_32px_-16px_rgb(var(--reg-ink)/0.12)] md:ring-1 md:ring-[rgb(var(--reg-line)/0.8)]">
            {/* Current Time Indicator - Full horizontal line across all columns */}
            {isCurrentDate && (() => {
              const timePosition = getCurrentTimePosition();
              if (timePosition === null) return null;
              
              return (
                <div
                  className="pointer-events-none absolute left-14 right-0 z-30 md:left-16"
                  style={{
                    top: `${timePosition + 64}px`, // 64px for header height
                    height: '2px',
                  }}
                >
                  <div className="h-full w-full bg-[rgb(var(--reg-brand))]" />
                  <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[rgb(var(--reg-brand))] ring-2 ring-white" />
            </div>
              );
            })()}
            
            {/* Time Column */}
            <div className="sticky left-0 z-20 w-14 shrink-0 self-start border-r border-[rgb(var(--reg-line)/0.7)] bg-white md:w-16">
              <div className="sticky top-0 z-20 h-16 border-b border-[rgb(var(--reg-line)/0.7)] bg-white"></div>
              
              {/* Current Time Indicator in Time Column - Time badge */}
              {isCurrentDate && (() => {
                const timePosition = getCurrentTimePosition();
                if (timePosition === null) return null;
                
                return (
                  <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-30 pointer-events-none"
                    style={{
                      top: `${timePosition + 64}px`, // 64px for header height
                    }}
                  >
                    <div className="rounded-full bg-[rgb(var(--reg-brand))] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white shadow-sm">
                      {format(currentTime, "HH:mm")}
        </div>
                  </div>
                );
              })()}
              
          {/* Hour rows - one row per hour */}
          {Array.from({ length: 24 }, (_, hour) => {
            // Use business hours for current date
            const { startHour, endHour, isEnabled } = getBusinessHoursForDate(currentDate);
            // If day is disabled (business closed), no hours are business hours
            const isBusiness = isEnabled && isBusinessHour(hour, startHour, endHour);
            const timeString = `${hour.toString().padStart(2, "0")}:00`;
            const hourHeight = 4 * SLOT_HEIGHT; // 4 slots per hour
            
            return (
            <div
              key={timeString}
              className="relative bg-white"
              style={{ height: `${hourHeight}px` }}
            >
              {hour > 0 && (
                <span className={`absolute -top-2 right-2 text-[11px] font-medium tabular-nums ${isBusiness ? "text-[rgb(var(--reg-ink)/0.7)]" : "text-[rgb(var(--reg-muted)/0.6)]"}`}>
                  {timeString}
                </span>
              )}
            </div>
          );
          })}
          
          {/* "Closed today" is said once, in the bar above, not over the hour labels. */}
        </div>

            {/* Staff Columns */}
        {/* self-start: as a stretched flex item this row was only as tall as the viewport,
            so the sticky staff headers scrolled away with it once the day opened at 09:00. */}
        <div className="flex flex-1 self-start">
              {/* The waiting list, as the first column of the calendar. It sat above the
                  grid as a strip, which is the wrong shape for the job: a salon looks at a
                  gap in a staff member's day and wants to drag somebody into it, and the
                  people who could fill it belong beside the gaps, not over them. */}
              {flags.waitlist !== false && waitlist.length > 0 && (
                <div className="w-[210px] shrink-0 border-r border-amber-200 bg-amber-50/60">
                  <div className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                      {tr("calendar.waiting", { count: waitlist.length })}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-amber-800/70">
                      {tr("calendar.dragOntoAGapTo")}
                    </p>
                  </div>
                  <div className="space-y-2 p-2">
                    {waitlist.map((w) => (
                      <div
                        key={w.id}
                        draggable
                        onDragStart={() => setDraggingEntry(w)}
                        onDragEnd={() => setDraggingEntry(null)}
                        onClick={() => placeFromWaitlist(w)}
                        title={tr("calendar.dragOntoASlotOr")}
                        className={`cursor-grab rounded-xl border bg-white p-2.5 shadow-sm transition-all active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-md ${
                          draggingEntry?.id === w.id ? "opacity-50" : "border-amber-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${clientColorClasses(
                              w.clientName || w.clientEmail || "client"
                            )}`}
                          >
                            {(w.clientName || w.clientEmail || "C").charAt(0).toUpperCase()}
                          </span>
                          <p className="min-w-0 flex-1 truncate text-xs font-medium">
                            {w.clientName || w.clientEmail || tr("common.client")}
                          </p>
                          {w.status === "NOTIFIED" && (
                            <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-800">
                              {tr("calendar.told")}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                          {w.serviceName || tr("calendar.anyService")}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {[w.staffName ? tr("calendar.withStaff", { name: w.staffName }) : null, w.preferredDate || tr("calendar.anyDate")]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {visibleStaff.map((staff) => {
                const dayAppointments = getAppointmentsForDate(currentDate);
                const staffAppointments = getAppointmentsForStaff(dayAppointments, staff.id);
                const staffTimeOffs = getTimeOffsForStaffAndDate(timeOffs, staff.id, currentDate);
                const [startHour, endHour] = (staff.workingHours || "10:00-19:00").split("-").map((h) => parseInt(h.split(":")[0]));
                
                // Get business hours for current date
                const { startHour: dayBusinessStartHour, endHour: dayBusinessEndHour, isEnabled: dayIsEnabled } = getBusinessHoursForDate(currentDate);
                
                return (
            <div
              key={staff.id}
                    className="min-w-0 flex-1 border-r border-[rgb(var(--reg-line)/0.7)] bg-white last:border-r-0 md:min-w-[220px]"
                  >
                    {/* Staff Header */}
                    <div className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-[rgb(var(--reg-line)/0.7)] bg-white/95 px-4 backdrop-blur">
                      {staff.avatar ? (
                        <img src={staff.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white" />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-xs font-bold text-[rgb(var(--reg-brand-strong))]">
                          {staff.initials || initialsOf(staff.name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{staff.name}</p>
                        <p className="truncate text-xs text-[rgb(var(--reg-muted))]">
                          {(() => {
                            const n = new Set(staffAppointments.map((a) => a.apiId ?? a.id)).size;
                            return n ? tr("common.bookingCount", { count: n }) : staff.workingHours || tr("calendar.noBookings");
                          })()}
                        </p>
                      </div>
                    </div>

                    {/* Appointments Area */}
                    <div 
                      className="relative select-none" 
                      style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}
                      onDragOver={(e) => {
                        // Only while a waiting client is in hand; otherwise the grid's own
                        // drag behaviour is untouched.
                        if (draggingEntry) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        if (!draggingEntry) return;
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        dropOnSlot(draggingEntry, staff.id, getTimeFromPosition(e.clientY - rect.top, SLOT_HEIGHT));
                      }}
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
                      {/* Non-business hours overlay - calculated from actual business hours */}
                      {(() => {
                        // If day is disabled, show entire day as non-business
                        if (!dayIsEnabled) {
                  return (
                    <div
                              className="absolute left-0 right-0 bg-[rgb(var(--reg-ink)/0.025)]"
                      style={{
                                top: 0, 
                                height: `${24 * 4 * SLOT_HEIGHT}px`, // Entire day
                                backgroundImage: "repeating-linear-gradient(135deg, transparent 0 7px, rgb(var(--reg-ink) / 0.045) 7px 8px)"
                              }}
                            />
                          );
                        }
                        
                        // Show non-business hours before start time
                        const beforeStart = dayBusinessStartHour > 0 ? (
                          <div 
                            key="before"
                            className="absolute left-0 right-0 bg-[rgb(var(--reg-ink)/0.025)]"
                            style={{ 
                              top: 0, 
                              height: `${dayBusinessStartHour * 4 * SLOT_HEIGHT}px`,
                              backgroundImage: "repeating-linear-gradient(135deg, transparent 0 7px, rgb(var(--reg-ink) / 0.045) 7px 8px)"
                            }}
                          />
                        ) : null;
                        
                        // Show non-business hours after end time
                        const afterEnd = dayBusinessEndHour < 24 ? (
                          <div 
                            key="after"
                            className="absolute left-0 right-0 bg-[rgb(var(--reg-ink)/0.025)]"
                            style={{ 
                              top: `${dayBusinessEndHour * 4 * SLOT_HEIGHT}px`,
                              height: `${(24 - dayBusinessEndHour) * 4 * SLOT_HEIGHT}px`,
                              backgroundImage: "repeating-linear-gradient(135deg, transparent 0 7px, rgb(var(--reg-ink) / 0.045) 7px 8px)"
                            }}
                          />
                        ) : null;
                        
                        return [beforeStart, afterEnd].filter(Boolean);
                      })()}

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

                      {/* Appointments and Time Offs - Grouped by conflicts */}
                      {(() => {
                        const conflictGroups = groupConflictingItems(staffAppointments, staffTimeOffs, dayBusinessStartHour, dayBusinessEndHour);
                        const isDragging = dragSelection?.isDragging && dragSelection.staffId === staff.id;
                        
                        return conflictGroups.flatMap((group) => {
                          const groupSize = group.length;
                          
                          // For each item in the group, render it with calculated width/position
                          return group.map((item, itemIndex) => {
                            let top = 0;
                            let height = 0;
                            
                            if (item.type === 'appointment') {
                              const aptStartTime = normalizeTime(item.item.startTime);
                              const aptEndTime = normalizeTime(item.item.endTime);
                              const pos = getTimePosition(aptStartTime, aptEndTime, SLOT_HEIGHT);
                              top = pos.top;
                              height = pos.height;
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
                            
                            // Calculate position: each item gets equal share of width
                            // Use percentage-based positioning with small gaps
                            const gapPercent = groupSize > 1 ? 0.3 : 0; // Small gap between items
                            const totalGapPercent = (groupSize - 1) * gapPercent;
                            const widthPercent = (100 - totalGapPercent) / groupSize;
                            const leftPercent = itemIndex * (widthPercent + gapPercent);

                            if (item.type === 'appointment') {
                              return (
                                <div
                                  key={item.item.id}
                                  className="absolute z-15"
                                  data-appointment-block="true"
                                  style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    left: groupSize === 1 
                                      ? '0.25rem' 
                                      : `calc(0.25rem + ${leftPercent}%)`,
                                    width: groupSize === 1 
                                      ? 'calc(100% - 0.5rem)' 
                                      : `calc(${widthPercent}% - ${gapPercent * 0.5}%)`,
                                    marginRight: itemIndex < groupSize - 1 ? `${gapPercent}%` : '0.5rem',
                                    pointerEvents: isDragging ? "none" : "auto",
                                  }}
                                  onClick={(e) => {
                                    // Only handle click if not dragging
                                    if (!isDragging) {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleAppointmentClick(item.item);
                                    }
                                  }}
                                  onMouseDown={(e) => {
                                    // Only stop propagation if not dragging
                                    if (!isDragging) {
                                      e.stopPropagation();
                                    }
                                  }}
                                  onMouseUp={(e) => {
                                    // Only stop propagation if not dragging
                                    if (!isDragging) {
                                      e.stopPropagation();
                                    }
                      }}
                    >
                      <AppointmentBlock
                                    visits={visitsFor(item.item)}
                                    height={height}
                                    appointment={item.item} 
                                    onClick={(e) => {
                                      // Only handle click if not dragging
                                      if (!isDragging) {
                                        e?.stopPropagation?.();
                                        handleAppointmentClick(item.item);
                                      }
                                    }}
                      />
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
                                  className="absolute z-15 pointer-events-auto cursor-pointer overflow-hidden rounded-[10px] bg-[rgb(var(--reg-ink)/0.04)] ring-1 ring-inset ring-[rgb(var(--reg-ink)/0.1)] transition-colors hover:bg-[rgb(var(--reg-ink)/0.07)]"
                                  style={{
                                    top: `${top}px`,
                                    height: `${minHeight}px`,
                                    left: groupSize === 1 
                                      ? '0.25rem' 
                                      : `calc(0.25rem + ${leftPercent}%)`,
                                    width: groupSize === 1 
                                      ? 'calc(100% - 0.5rem)' 
                                      : `calc(${widthPercent}% - ${gapPercent * 0.5}%)`,
                                    marginRight: itemIndex < groupSize - 1 ? `${gapPercent}%` : '0.5rem',
                                    backgroundImage: "repeating-linear-gradient(135deg, transparent 0 6px, rgb(var(--reg-ink) / 0.06) 6px 7px)"
                                  }}
                                  title={tr("calendar.timeOff", { dateStr, timeStr, value: timeOff.reason || tr("calendar.noReason") })}
                                >
                                  <div className="flex h-full flex-col px-2.5 py-1.5 text-[12px] leading-tight">
                                    <p className="truncate font-bold text-[rgb(var(--reg-ink)/0.8)]">
                                      {timeOff.reason || tr("calendar.timeOff2")}
                                    </p>
                                    <p className="mt-0.5 truncate text-[rgb(var(--reg-muted))]">
                                      {timeOff.reason ? tr("calendar.timeOff3") : ""}{timeStr}
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                          });
                        });
                      })()}

                      {/* Time grid lines - after each hour's 4 slots (after 00:45, 01:45, etc.) */}
                {Array.from({ length: 24 }, (_, i) => {
                  const isBusiness = dayIsEnabled && isBusinessHour(i, dayBusinessStartHour, dayBusinessEndHour);
                  return (
                  <div key={i}>
                    <div
                      className={`pointer-events-none absolute left-0 right-0 border-b border-dashed ${isBusiness ? "border-[rgb(var(--reg-line)/0.55)]" : "border-[rgb(var(--reg-line)/0.35)]"}`}
                      style={{ top: `${(i * 4 + 2) * SLOT_HEIGHT}px` }}
                    />
                    <div
                      className={`pointer-events-none absolute left-0 right-0 border-b ${isBusiness ? "border-[rgb(var(--reg-line))]" : "border-[rgb(var(--reg-line)/0.6)]"}`}
                      style={{ top: `${(i + 1) * 4 * SLOT_HEIGHT}px` }}
                    />
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

          {viewType === "Month" && (
            <div className="flex flex-1 overflow-auto bg-white p-6">
              <div className="w-full">
                {/* Month Calendar Grid */}
                <div className="bg-white rounded-lg border border-gray-200">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 border-b border-gray-200">
                    {[tr("common.dayMon"), tr("common.dayTue"), tr("common.dayWed"), tr("common.dayThu"), tr("common.dayFri"), tr("common.daySat"), tr("common.daySun")].map((day) => (
                      <div
                        key={day}
                        className="p-3 text-center text-xs font-medium text-muted-foreground border-r border-gray-200 last:border-r-0"
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
                        const isCurrentDay = isToday(day);

                        return (
                          <div
                            key={idx}
                            className={`
                              min-h-[120px] border-r border-b border-gray-200 last:border-r-0
                              ${isCurrentMonth ? "bg-white" : "bg-gray-50"}
                              ${isCurrentDay ? "bg-blue-50" : ""}
                              p-2
                            `}
                          >
                            {/* Date Number */}
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`
                                  text-sm font-medium
                                  ${isCurrentDay ? "bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center" : ""}
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
                                <div
                                  key={apt.id}
                                  onClick={() => handleAppointmentClick(apt)}
                                  className={`text-xs p-1.5 rounded cursor-pointer truncate border-l-4 hover:opacity-80 ${
                                    blockVisuals(apt).colorClasses
                                  }`}
                                  title={`${apt.startTime} - ${apt.endTime}: ${apt.service}`}
                                >
                                  <div className="text-[10px] font-medium">
                                    {apt.startTime} - {apt.endTime}
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] font-semibold">
                                    <span className="truncate">{apt.clientName}</span>
                                    {blockVisuals(apt).tags.map(({ Icon, label, className }) => (
                                      <span
                                        key={label}
                                        title={label}
                                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${className}`}
                                      >
                                        <Icon size={10} strokeWidth={2.5} />
                                      </span>
                                    ))}
                                  </div>
                                  <div className="text-[10px] truncate">
                                    {apt.service}
              </div>
            </div>
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
            <div className="flex flex-1 overflow-auto bg-white">
              {/* Staff Column */}
              <div className="w-64 shrink-0 border-r border-gray-200 bg-white sticky left-0 z-10">
                <div className="h-16 border-b border-gray-200 bg-white"></div>
                <div className="divide-y divide-gray-200">
                  {staff.map((staff) => {
                    // All rows should have the same height to fit 3 blocks + "+X more" row
                    // Height: 3 blocks (~180px with spacing) + "+X more" row (~40px) + padding (~16px) = ~250px
                    const rowHeight = "h-[250px]";
                    
                    return (
                      <div
                        key={staff.id}
                        className={`${rowHeight} border-b border-gray-200 px-4 py-3 bg-white flex items-center gap-3`}
                      >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
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
                  const isCurrentDay = isToday(day);
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className="min-w-[200px] flex-1 border-r border-gray-200 last:border-r-0 bg-white"
                    >
                      {/* Day Header */}
                      <div className={`h-16 border-b border-gray-200 flex flex-col items-center justify-center px-2 bg-white sticky top-0 z-10 ${isCurrentDay ? "bg-blue-50" : ""}`}>
                        <div className="text-xs font-medium text-muted-foreground">
                          {format(day, "EEE")}
                        </div>
                        <div className={`text-sm font-semibold ${isCurrentDay ? "text-blue-600" : ""}`}>
                          {format(day, "d")}
                        </div>
                        {dayAppointments.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {dayAppointments.length} {dayAppointments.length === 1 ? tr("calendar.reservation") : tr("calendar.reservations")}
                          </div>
                        )}
                      </div>

                      {/* Staff Rows with Appointments */}
                      <div className="divide-y divide-gray-200">
                        {staff.map((staff) => {
                          const staffAppointments = getAppointmentsForDateAndStaff(day, staff.id);
                          // All rows should have the same height to fit 3 blocks + "+X more" row
                          // Height: 3 blocks (~180px with spacing) + "+X more" row (~40px) + padding (~16px) = ~250px
                          const rowHeight = "h-[250px]";
                          
                          return (
                            <div
                              key={staff.id}
                              className={`${rowHeight} p-2 flex flex-col border-b border-gray-200`}
                            >
                              {staffAppointments.length > 0 ? (
                                <div className="flex flex-col h-full justify-between">
                                  {/* Appointment Blocks - Maximum 3 */}
                                  <div className="space-y-1">
                                    {staffAppointments.slice(0, 3).map((apt) => (
                                      <div
                                        key={apt.id}
                                        onClick={() => handleAppointmentClick(apt)}
                                        className={`text-xs p-1.5 rounded cursor-pointer border-l-4 hover:opacity-80 ${
                                          blockVisuals(apt).colorClasses
                                        }`}
                                        title={`${apt.startTime} - ${apt.endTime}: ${apt.service}`}
                                      >
                                        <div className="text-[10px] font-medium truncate">
                                          {apt.startTime} - {apt.endTime}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-semibold">
                                          <span className="truncate">{apt.clientName}</span>
                                          {blockVisuals(apt).tags.map(({ Icon, label, className }) => (
                                            <span
                                              key={label}
                                              title={label}
                                              className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${className}`}
                                            >
                                              <Icon size={10} strokeWidth={2.5} />
                                            </span>
                                          ))}
                                        </div>
                                        <div className="text-[10px] truncate">
                                          {apt.service}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {/* "+X more" on separate row - Only show if more than 3 */}
                                  {staffAppointments.length > 3 && (
                                    <div 
                                      className="text-xs text-muted-foreground text-center pt-2 mt-auto cursor-pointer hover:text-foreground hover:font-medium transition-colors border-t border-gray-200"
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
                                  <span className="text-xs text-muted-foreground/50">{tr("calendar.noAppointments")}</span>
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
      <AppointmentModal
        appointment={selectedAppointment}
        staff={selectedStaff}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onEdit={handleEditAppointment}
        onDelete={handleDeleteAppointment}
        onCancelled={() => { handleCloseModal(); }}
      />

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
                    appointment={apt} 
                    onClick={() => {
                      handleAppointmentClick(apt);
                      setIsWeeklyPopupOpen(false);
                    }}
                  />
                  {staff && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                      <span>{tr("calendar.time")}</span>
                      <span className="font-medium">{apt.startTime} - {apt.endTime}</span>
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

      {/* New Appointment Form - Slides in from right */}
      <Sheet open={isNewAppointmentOpen} onOpenChange={(open) => {
        setIsNewAppointmentOpen(open);
        if (!open) {
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
        }
      }}>
        <SheetContent side="right" style={{ fontFamily: BRAND_FONT }} className={SHEET_FRAME}>
          {/* Header */}
          <div className={SHEET_HEAD}>
            <SheetTitle className={SHEET_TITLE}>{editingAppointmentId ? tr("calendar.editBooking") : tr("common.newBooking")}</SheetTitle>
            <p className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">{format(parse(appointmentForm.date || format(currentDate, 'yyyy-MM-dd'), 'yyyy-MM-dd', new Date()), 'EEEE, d MMMM')}</p>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 md:px-6">
          {/* Client Selection */}
          <section className="space-y-2">
            <div className="space-y-2">
              <p className={SECTION_LABEL}>{tr("common.client")}{" "}<span className="font-normal normal-case tracking-normal text-[rgb(var(--reg-muted))]">{tr("calendar.optionalEmptyWalkIn")}</span></p>
              <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientSearchOpen}
                    className={cn(FIELD, "justify-between gap-3 font-semibold")}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-[11px] font-bold text-[rgb(var(--reg-brand-strong))]">
                        {appointmentForm.clientName ? initialsOf(appointmentForm.clientName) : <User className="h-4 w-4" />}
                      </span>
                      <span className="truncate">
                    {appointmentForm.clientId
                      ? (() => {
                          const selected = clients.find(c => c.id.toString() === appointmentForm.clientId);
                          return selected ? `${selected.firstName} ${selected.lastName || ""}`.trim() : tr("calendar.selectClient");
                        })()
                      : appointmentForm.clientName || tr("calendar.searchClientsOrAddNew")}
                      </span>
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] rounded-2xl p-0" align="start">
                  <Command shouldFilter={true}>
                    <CommandInput placeholder={tr("calendar.searchClients")} />
                    <CommandList>
                      <CommandEmpty>{tr("calendar.noClientFound")}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="new-client"
                          onSelect={() => {
                            setAppointmentForm(prev => ({ ...prev, clientId: "", clientName: "", clientPhone: "", clientEmail: "" }));
                            setClientSearchOpen(false);
                          }}
                        >
                          <User className="mr-2 h-4 w-4" />
                          {tr("calendar.newClientEnterManually")}
                        </CommandItem>
                        {clients.map((client, idx) => {
                          const isSelected = appointmentForm.clientId === client.id.toString();
                          return (
                            <CommandItem
                              // Clients built from walk-in bookings come back with id 0, so the id alone repeats.
                              key={`${client.id}-${idx}`}
                              value={`${client.firstName} ${client.lastName || ""} ${client.email || ""} ${client.phone || ""}`}
                              onSelect={() => {
                                setAppointmentForm(prev => ({
                                  ...prev,
                                  clientId: client.id.toString(),
                                  clientName: `${client.firstName} ${client.lastName || ""}`.trim(),
                                  clientPhone: client.phone || "",
                                  clientEmail: client.email || "",
                                }));
                                setClientSearchOpen(false);
                              }}
                              className={cn("flex items-center justify-between", isSelected && "bg-accent")}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-[11px] font-bold text-[rgb(var(--reg-brand-strong))]">
                                  {initialsOf(`${client.firstName} ${client.lastName || ""}`)}
                                </span>
                                <div className="flex min-w-0 flex-col">
                                <span className="truncate font-semibold">{`${client.firstName} ${client.lastName || ""}`.trim()}</span>
                                {(client.email || client.phone) && (
                                  <span className="truncate text-xs text-muted-foreground">
                                    {client.email || client.phone}
                                  </span>
                                )}
                                </div>
                              </div>
                              {isSelected && <Check className="h-4 w-4" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {!appointmentForm.clientId && (
                <>
                  <Input
                    placeholder={tr("calendar.clientName")}
                    value={appointmentForm.clientName}
                    onChange={(e) => setAppointmentForm(prev => ({ ...prev, clientName: e.target.value }))}
                    className={FIELD}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder={tr("common.phone")}
                      value={appointmentForm.clientPhone}
                      onChange={(e) => setAppointmentForm(prev => ({ ...prev, clientPhone: e.target.value }))}
                      className={FIELD}
                    />
                    <Input
                      placeholder={tr("common.email")}
                      type="email"
                      value={appointmentForm.clientEmail}
                      onChange={(e) => setAppointmentForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                      className={FIELD}
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* The two "tabs" that sat here had no handlers; notes are further down. */}
          <div className="space-y-6">
            {/* Date picker — drives the appointment's date (and syncs the
                viewed day so conflict detection matches the chosen date). */}
            <section className="space-y-2">
              <p className={SECTION_LABEL}>{tr("calendar.date2")}</p>
              {(() => {
                const pick = (v: string) => {
                  setAppointmentForm(prev => ({ ...prev, date: v }));
                  const parsed = parse(v, 'yyyy-MM-dd', new Date());
                  if (!isNaN(parsed.getTime())) setCurrentDate(parsed);
                };
                const days = Array.from({ length: 21 }, (_, i) => addDays(new Date(), i));
                return (
                  <>
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label={tr("calendar.date2")}>
                      {days.map((d) => {
                        const v = format(d, 'yyyy-MM-dd');
                        const on = appointmentForm.date === v;
                        const open = getBusinessHoursForDate(d).isEnabled;
                        return (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => pick(v)}
                            className={cn(
                              "flex w-14 shrink-0 flex-col items-center rounded-2xl py-2 ring-1 transition",
                              on ? "bg-[rgb(var(--reg-ink))] text-white ring-[rgb(var(--reg-ink))]" : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]",
                              !open && !on && "opacity-50",
                            )}
                          >
                            <span className={cn("text-[11px] font-semibold uppercase", on ? "text-white/70" : "text-[rgb(var(--reg-muted))]")}>{isToday(d) ? tr("common.today") : format(d, 'EEE')}</span>
                            <span className="text-lg font-extrabold leading-tight">{format(d, 'd')}</span>
                            <span className={cn("text-[10px]", on ? "text-white/70" : "text-[rgb(var(--reg-muted))]")}>{format(d, 'MMM')}</span>
                          </button>
                        );
                      })}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[rgb(var(--reg-muted))]">
                      {tr("calendar.otherDate")}
                      <Input
                        type="date"
                        value={appointmentForm.date}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        onChange={(e) => { if (e.target.value) pick(e.target.value); }}
                        aria-label={tr("calendar.date2")}
                        className="h-10 w-auto rounded-xl border-[rgb(var(--reg-line))] text-sm"
                      />
                    </label>
                  </>
                );
              })()}
            </section>

            {/* Booking mode: single / group / recurring */}
            {/* Group and recurring are off for now. The machinery below stays — turning
                either back on is putting its tab back, not rebuilding the flow. With one mode
                there is nothing to choose, so the switch stays hidden until a second returns. */}
            <div className="hidden">
              {([
                { key: "single", get label() { return tr("calendar.single"); }, Icon: User },
              ] as const).map((m) => (
                <Button
                  key={m.key}
                  type="button"
                  variant={bookingMode === m.key ? "default" : "outline"}
                  className="h-8 text-xs px-2"
                  onClick={() => {
                    setBookingMode(m.key);
                    // Only "single" is offered for now (group/recurring stay off), kept for when they return.
                    if ((m.key as string) === "group") setExtraServices([]);
                  }}
                >
                  <m.Icon className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">{m.label}</span>
                </Button>
              ))}
            </div>

            {/* Recurrence config */}
            {bookingMode === "recurring" && (
              <div className="space-y-2 rounded-md border border-gray-200 p-2">
                <Label className={FIELD_LABEL}>{tr("calendar.repeat")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-gray-500">{tr("calendar.frequency")}</Label>
                    <Select
                      value={recurrence.frequency}
                      onValueChange={(v) => setRecurrence(prev => ({ ...prev, frequency: v as "DAILY" | "WEEKLY" | "MONTHLY" }))}
                    >
                      <SelectTrigger className={FIELD}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">{tr("common.daily")}</SelectItem>
                        <SelectItem value="WEEKLY">{tr("calendar.weekly")}</SelectItem>
                        <SelectItem value="MONTHLY">{tr("calendar.monthly")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-gray-500">{tr("calendar.every")}</Label>
                    <Input
                      type="number" min={1} max={12} value={recurrence.interval}
                      onChange={(e) => setRecurrence(prev => ({ ...prev, interval: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className={FIELD}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-gray-500">{tr("calendar.occurrences")}</Label>
                    <Input
                      type="number" min={1} max={52} value={recurrence.count}
                      onChange={(e) => setRecurrence(prev => ({ ...prev, count: Math.max(1, Math.min(52, parseInt(e.target.value) || 1)) }))}
                      className={FIELD}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500">
                  {(() => {
                    const ds = computeRecurrenceDates(appointmentForm.date, recurrence);
                    return `${ds.length} date${ds.length > 1 ? "s" : ""}: ${ds.slice(0, 3).join(", ")}${ds.length > 3 ? "…" : ""}`;
                  })()}
                </p>
              </div>
            )}

            {/* Service Selection — tidy rows: name, duration, price. */}
            <section className="space-y-2">
              <p className={SECTION_LABEL}>{bookingMode === "group" ? tr("calendar.serviceAllMembers") : tr("common.service")}</p>
              {services.length > 6 && (
                <div className="flex h-11 items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-[rgb(var(--reg-line))] focus-within:ring-2 focus-within:ring-[rgb(var(--reg-brand)/0.5)]">
                  <Search size={16} className="text-[rgb(var(--reg-muted))]" />
                  <input
                    value={serviceQuery}
                    onChange={(e) => setServiceQuery(e.target.value)}
                    placeholder={tr("common.searchServices")}
                    aria-label={tr("calendar.searchServices")}
                    className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[rgb(var(--reg-muted))]"
                  />
                </div>
              )}
              <div className="max-h-[264px] overflow-y-auto rounded-2xl bg-white ring-1 ring-[rgb(var(--reg-line))]" role="radiogroup" aria-label={tr("common.service")}>
                {services
                  .filter((sv) => !serviceQuery || sv.name.toLowerCase().includes(serviceQuery.toLowerCase()))
                  .map((service) => {
                    const isSelected = appointmentForm.serviceId === service.id.toString();
                    const isCombo = service.serviceType === 'COMBO';
                    return (
                      <button
                        key={service.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setAppointmentForm(prev => ({ ...prev, serviceId: service.id.toString() }))}
                        className={cn(
                          "flex w-full items-center gap-3 border-b border-[rgb(var(--reg-line)/0.6)] px-4 py-3 text-left transition-colors last:border-0",
                          isSelected ? "bg-[rgb(var(--reg-brand-soft))]" : "hover:bg-[rgb(var(--reg-canvas))]",
                        )}
                      >
                        <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", isSelected ? "border-[rgb(var(--reg-brand))]" : "border-[rgb(var(--reg-line))]")}>
                          {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--reg-brand))]" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-semibold">{service.name}</span>
                            {isCombo && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[rgb(var(--reg-brand)/0.12)] px-2 py-0.5 text-[10px] font-bold uppercase text-[rgb(var(--reg-brand-strong))]">
                                <Package size={10} />{" "}{tr("common.combo")}
                              </span>
                            )}
                          </span>
                          {service.durationMinutes ? (
                            <span className="block text-sm text-[rgb(var(--reg-muted))]">{tr("calendar.min3", { durationMinutes: service.durationMinutes })}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-sm font-semibold">
                          {service.price ? `${service.price.toFixed(2)} ${currencySymbol()}` : tr("calendar.free")}
                        </span>
                      </button>
                    );
                  })}
                {services.length === 0 && (
                  <p className="px-4 py-4 text-sm text-[rgb(var(--reg-muted))]">{tr("calendar.noServicesYetAddThem")}</p>
                )}
              </div>
            </section>

            {/* Time — start as a grid of slots within the day's opening hours; end follows the service. */}
            <section className="space-y-2">
              <p className={SECTION_LABEL}>{tr("calendar.time2")}</p>
              {(() => {
                const day = parse(appointmentForm.date || format(currentDate, 'yyyy-MM-dd'), 'yyyy-MM-dd', new Date());
                const { startHour, endHour, isEnabled } = getBusinessHoursForDate(isNaN(day.getTime()) ? currentDate : day);
                const lo = isEnabled ? startHour : 8;
                const hi = isEnabled ? endHour : 20;
                // Today, a new booking cannot start in the past (the API refuses it with
                // "Cannot create bookings in the past"), so those times are not offered.
                const nowHm = !editingAppointmentId && isToday(day) ? format(new Date(), 'HH:mm') : null;
                const slots = timeOptionsWith(appointmentForm.startTime).filter((t) => {
                  const h = parseInt(t.slice(0, 2), 10);
                  if (nowHm && t < nowHm && t !== appointmentForm.startTime) return false;
                  return (h >= lo && h < hi) || t === appointmentForm.startTime;
                });
                return (
                  <>
                    {!isEnabled && (
                      <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">{tr("calendar.closedThisDayYouCan")}</p>
                    )}
                    <div className="grid max-h-[208px] grid-cols-4 gap-2 overflow-y-auto pr-0.5" role="radiogroup" aria-label={tr("calendar.startTime")}>
                      {slots.map((t) => {
                        const on = appointmentForm.startTime === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setAppointmentForm(prev => ({ ...prev, startTime: t }))}
                            className={cn(
                              "h-11 rounded-xl text-sm font-semibold tabular-nums ring-1 transition",
                              on
                                ? "bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] text-white ring-transparent shadow-[0_8px_18px_-8px_rgb(var(--reg-brand-strong)/0.7)]"
                                : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.5)]",
                            )}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-sm font-semibold">{tr("common.ends")}</span>
                      <Select
                        value={appointmentForm.endTime}
                        onValueChange={(value) => setAppointmentForm(prev => ({ ...prev, endTime: value }))}
                      >
                        <SelectTrigger aria-label={tr("calendar.endTime")} className="h-11 w-32 rounded-xl border-[rgb(var(--reg-line))] text-sm font-semibold">
                          <SelectValue placeholder={tr("calendar.endTime")} />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptionsWith(appointmentForm.endTime).map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {appointmentForm.serviceId && appointmentForm.startTime && (
                        <span className="text-xs text-[rgb(var(--reg-muted))]">{tr("calendar.fromTheServiceLength")}</span>
                      )}
                    </div>
                  </>
                );
              })()}
            </section>

            {/* Staff Selection (in group mode this is member 1's staff) */}
            <section className="space-y-2">
              <p className={SECTION_LABEL}>{bookingMode === "group" ? tr("calendar.withMember") : tr("calendar.with2")}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tr("common.staff")}>
                {staff.map((staffMember) => {
                  const on = appointmentForm.staffId === staffMember.id;
                  return (
                    <button
                      key={staffMember.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setAppointmentForm(prev => ({ ...prev, staffId: staffMember.id }))}
                      className={cn(
                        "flex items-center gap-2 rounded-full py-1 pl-1 pr-4 text-sm font-semibold ring-1 transition",
                        on ? "bg-[rgb(var(--reg-ink))] text-white ring-[rgb(var(--reg-ink))]" : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]",
                      )}
                    >
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold", on ? "bg-white/15" : "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]")}>
                        {initialsOf(staffMember.name)}
                      </span>
                      {staffMember.name}
                    </button>
                  );
                })}
              </div>
            </section>
            
            {/* Group members — each gets their own staff + time. The primary
                client above is member 1; add the rest here. */}
            {bookingMode === "group" && (
              <div className="space-y-2 rounded-md border border-gray-200 p-2">
                <div className="flex items-center justify-between">
                  <Label className={FIELD_LABEL}>{tr("calendar.groupMembers")}</Label>
                  <span className="text-[10px] text-gray-500">{tr("calendar.primaryClientMember")}</span>
                </div>
                {groupMembers.map((m, i) => (
                  <div key={i} className="space-y-1 border-t border-gray-100 pt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-500 w-16 shrink-0">{tr("calendar.member", { value: i + 2 })}</span>
                      <Input
                        placeholder={tr("common.name")}
                        value={m.clientName}
                        onChange={(e) => setGroupMembers(prev => prev.map((x, j) => j === i ? { ...x, clientName: e.target.value } : x))}
                        className={cn(FIELD, "flex-1")}
                      />
                      <Button
                        type="button" variant="ghost" size="icon" aria-label={tr("calendar.removeMember")} className="h-7 w-7 shrink-0"
                        onClick={() => setGroupMembers(prev => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pl-16">
                      <Select value={m.staffId} onValueChange={(v) => setGroupMembers(prev => prev.map((x, j) => j === i ? { ...x, staffId: v } : x))}>
                        <SelectTrigger className={FIELD}><SelectValue placeholder={tr("common.staff")} /></SelectTrigger>
                        <SelectContent>
                          {staff.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <Select value={m.startTime} onValueChange={(v) => setGroupMembers(prev => prev.map((x, j) => j === i ? { ...x, startTime: v } : x))}>
                        <SelectTrigger className={FIELD}><SelectValue placeholder={tr("calendar.start")} /></SelectTrigger>
                        <SelectContent>
                          {timeOptionsWith(m.startTime).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="pl-16">
                      <Input
                        placeholder={tr("calendar.phoneOptional")}
                        value={m.clientPhone}
                        onChange={(e) => setGroupMembers(prev => prev.map((x, j) => j === i ? { ...x, clientPhone: e.target.value } : x))}
                        className={FIELD}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button" variant="outline" className="w-full h-8 text-xs"
                  onClick={() => setGroupMembers(prev => {
                    // Default the new member to start right after the previous one
                    // on the same staff (sequential → no auto-conflict). The user
                    // can switch to a different staff to run them at the same time.
                    const last = prev[prev.length - 1];
                    const prevStart = last?.startTime || appointmentForm.startTime;
                    const nextStart = prevStart ? addMinutesToTime(prevStart, serviceDuration(appointmentForm.serviceId)) : appointmentForm.endTime;
                    return [...prev, { clientName: "", clientPhone: "", clientEmail: "", staffId: appointmentForm.staffId, startTime: nextStart }];
                  })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />{" "}{tr("calendar.addMember")}
                </Button>
              </div>
            )}

            {/* Extra services (multi-service) — appended after the primary service.
                Not available in group mode. */}
            {bookingMode !== "group" && (
              <div className="space-y-2">
                {extraServices.map((es, i) => (
                  <div key={i} className="space-y-1 rounded-md border border-gray-200 p-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-gray-500">{editingVisit ? tr("calendar.service", { value: i + 2 }) : tr("calendar.extraService", { value: i + 1 })}</Label>
                      <Button
                        type="button" variant="ghost" size="icon" aria-label={tr("calendar.removeService")} className={`h-7 w-7 ${editingAppointmentId ? "hidden" : ""}`}
                        onClick={() => setExtraServices(prev => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                      </Button>
                    </div>
                    <Select
                      value={es.serviceId}
                      onValueChange={(v) => setExtraServices(prev => prev.map((x, j) => {
                        if (j !== i) return x;
                        const start = x.startTime || appointmentForm.endTime;
                        return { ...x, serviceId: v, endTime: start ? addMinutesToTime(start, serviceDuration(v)) : x.endTime };
                      }))}
                    >
                      <SelectTrigger className={FIELD}><SelectValue placeholder={tr("common.service")} /></SelectTrigger>
                      <SelectContent>
                        {services.map((s) => (<SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-3 gap-2">
                      <Select value={es.staffId} onValueChange={(v) => setExtraServices(prev => prev.map((x, j) => j === i ? { ...x, staffId: v } : x))}>
                        <SelectTrigger className={FIELD}><SelectValue placeholder={tr("common.staff")} /></SelectTrigger>
                        <SelectContent>
                          {staff.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <Select value={es.startTime} onValueChange={(v) => setExtraServices(prev => prev.map((x, j) => j === i ? { ...x, startTime: v, endTime: addMinutesToTime(v, serviceDuration(x.serviceId)) } : x))}>
                        <SelectTrigger className={FIELD}><SelectValue placeholder={tr("calendar.start")} /></SelectTrigger>
                        <SelectContent>
                          {timeOptionsWith(es.startTime).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <Select value={es.endTime} onValueChange={(v) => setExtraServices(prev => prev.map((x, j) => j === i ? { ...x, endTime: v } : x))}>
                        <SelectTrigger className={FIELD}><SelectValue placeholder={tr("calendar.end")} /></SelectTrigger>
                        <SelectContent>
                          {timeOptionsWith(es.endTime).map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                {editingVisit && (
                  <p className="text-xs text-gray-500">
                    {tr("calendar.thisBookingHasServicesYou", { count: editingVisit.ids.length })}
                  </p>
                )}
                <Button
                  type="button" variant="outline" className={`w-full h-8 text-xs ${editingAppointmentId ? "hidden" : ""}`}
                  onClick={() => {
                    const start = appointmentForm.endTime || appointmentForm.startTime;
                    setExtraServices(prev => [...prev, { serviceId: "", staffId: appointmentForm.staffId, startTime: start, endTime: start ? addMinutesToTime(start, 30) : "" }]);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />{" "}{tr("calendar.addAnotherService")}
                </Button>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <Label className={FIELD_LABEL}>{tr("calendar.notesOptional")}</Label>
              <Textarea
                placeholder={tr("calendar.addNotes")}
                value={appointmentForm.notes}
                onChange={(e) => setAppointmentForm(prev => ({ ...prev, notes: e.target.value }))}
                className="h-16 text-xs resize-none"
              />
            </div>

            {/* Requested by client */}
            <div className="flex items-center gap-1.5 py-0.5">
              <Button
                type="button" variant="ghost" size="icon" className="h-6 w-6"
                aria-label={tr("calendar.requestedByClient")}
                aria-pressed={appointmentForm.requestedByClient}
                onClick={() => setAppointmentForm(prev => ({ ...prev, requestedByClient: !prev.requestedByClient }))}
              >
                <Heart className={cn("h-3.5 w-3.5", appointmentForm.requestedByClient ? "fill-red-500 text-red-500" : "text-gray-400")} />
              </Button>
              <span className="text-xs text-gray-700">{tr("calendar.requestedByClient")}</span>
            </div>

            {/* Financial Summary — reflects group members / extra services / occurrences */}
            <div className="space-y-1.5 rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line))]">
              {(() => {
                const primary = servicePrice(appointmentForm.serviceId) || 0;
                let total = 0;
                if (bookingMode === "group") {
                  total = primary * (groupMembers.length + 1);
                } else {
                  const perVisit = primary + extraServices.reduce((sum, es) => sum + (servicePrice(es.serviceId) || 0), 0);
                  const occurrences = bookingMode === "recurring" ? computeRecurrenceDates(appointmentForm.date, recurrence).length : 1;
                  total = perVisit * occurrences;
                }
                const label = `${total.toFixed(2)} ${currencySymbol()}`;
                return (
                  <>
                    <div className="flex justify-between items-center">
                      <Label className={FIELD_LABEL}>{tr("common.total")}</Label>
                      <span className="text-xs font-semibold">{label}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <Label className={FIELD_LABEL}>{tr("calendar.toBePaid")}</Label>
                      <span className="text-xs font-semibold">{label}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
          </div>

          {/* Footer Actions */}
          <div className={SHEET_FOOT}>
            <Button
              variant="outline"
              className={SECONDARY_BTN}
              onClick={() => setIsNewAppointmentOpen(false)}
            >
              {tr("common.cancel")}
            </Button>
            <Button
              className={PRIMARY_BTN}
              disabled={isBatchSubmitting || !appointmentForm.serviceId || !appointmentForm.staffId || !appointmentForm.startTime || !appointmentForm.endTime}
              onClick={async () => {
                try {
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
                  const appointmentDate = new Date(appointmentForm.date || format(currentDate, 'yyyy-MM-dd'));
                  const today = new Date();
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
                      clientId: appointmentForm.clientId ? parseInt(appointmentForm.clientId) : undefined,
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
                          staffId: parseInt(l.staffId),
                          serviceId: parseInt(l.serviceId),
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
                    staffId: parseInt(appointmentForm.staffId),
                    serviceId: parseInt(appointmentForm.serviceId),
                    appointmentDate: appointmentForm.date || format(currentDate, 'yyyy-MM-dd'),
                    startTime: appointmentForm.startTime,
                    endTime: appointmentForm.endTime,
                    clientId: appointmentForm.clientId ? parseInt(appointmentForm.clientId) : undefined,
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
              }}
            >
              {isBatchSubmitting
                ? tr("common.saving")
                : editingAppointmentId
                  ? tr("common.saveChanges")
                  : bookingMode === 'group'
                    ? tr("calendar.bookGroup", { value: groupMembers.length + 1 })
                    : bookingMode === 'recurring'
                      ? tr("calendar.book", { count: computeRecurrenceDates(appointmentForm.date, recurrence).length })
                      : extraServices.length > 0
                        ? tr("calendar.bookServices", { value: extraServices.length + 1 })
                        : tr("calendar.bookAppointment")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
                    staffId: Number(staffIdToUse),
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
                <HelpCircle className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">
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
                    staffId: parseInt(timeOffForm.staffId),
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
                    staffId: parseInt(timeOffForm.staffId),
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
    </AppLayout>
  );
}
