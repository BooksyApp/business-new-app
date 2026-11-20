import type { Id } from "@/types/id";
import { appointmentTags, clientColorClasses } from "@/lib/appointmentVisuals";
import { visitAccent } from "@/lib/servicePackage";
import { cn } from "@/lib/utils";
import { Link2, Package, TriangleAlert } from "lucide-react";
import { appointmentStatusStyle } from "@/lib/appointmentStatus";
import { categoryTint } from "@/lib/serviceCategoryColor";
import "@/components/auth/auth-tokens.css";
import { t } from "@/i18n";

export type AppointmentColor = 
  | "pink" 
  | "yellow" 
  | "blue" 
  | "green" 
  | "coral" 
  | "purple" 
  | "teal" 
  | "orange";

export interface Appointment {
  id: string;
  clientName: string;
  clientAlert?: boolean;
  service: string;
  startTime: string;
  endTime: string;
  staffId: string;
  staffName?: string; // Master/staff name
  color: AppointmentColor | string; // Can be a color name or hex color
  // Additional fields from API
  /** The day it is on — set by useAppointments; the modal and edit form read it. */
  date?: Date;
  clientId?: Id;
  clientPhone?: string;
  clientEmail?: string;
  notes?: string;
  price?: number;
  apiId?: string;
  // #30: needed to decide which lifecycle actions apply. Optional because older
  // call sites build these without it; the footer simply shows fewer buttons then.
  status?: string;
  serviceId?: Id;
  /** The service's category, so the block can take the category's colour. */
  categoryId?: Id;
  categoryName?: string;
  visitId?: string | null;
  seriesId?: string | null;
  /** The system picked this master ("any master" booking). */
  staffAutoAssigned?: boolean;
  /** Number of active services in the visit (multi-service group badge). */
  groupSize?: number;
  /** Part of a package service: the step number, and which party member it is for. */
  isPackage?: boolean;
  packageStep?: number | null;
  packageParty?: number | null;
  packageLead?: boolean;
  guestName?: string | null;
  /** FG-W1-12: one block for a class session; the names of everyone booked into it. */
  isClass?: boolean;
  participants?: string[];
  /**
   * Every appointment of the same multi-service visit (this one included), earliest
   * first. Empty/absent for a single-service booking.
   */
  visitMates?: { id: string; service: string; startTime: string; endTime: string; price?: number; status?: string; staffId?: string; staffName?: string; serviceId?: string; packageStep?: number | null; guestName?: string | null; cancelledBy?: string | null; cancellationNote?: string | null }[];
  cancelledBy?: string | null;
  cancellationNote?: string | null;
  /** Saved despite schedule conflicts after a manager's confirm: the block carries a marker. */
  overrideApplied?: boolean;
  overrideReason?: string | null;
  overrideByName?: string | null;
  /** The customer's answers to the service questions, all services of the visit together. */
  answers?: { question: string; answer: string }[];
  /** Services of the visit that sit in THIS block (one staff member), in time order. */
  groupServices?: string[];
  /** The visit also has services with other staff: its other blocks are linked to this one. */
  linked?: boolean;
}

/** "Haircut + Beard trim" for a multi-service visit, else just the service. */
export function appointmentServiceLabel(a: Pick<Appointment, "service" | "groupServices">): string {
  const g = a.groupServices;
  return g && g.length > 1 ? g.join(" + ") : a.service;
}

export interface Staff {
  id: string;
  name: string;
  avatar: string;
  initials?: string;
  workingHours?: string;
}

interface AppointmentBlockProps {
  appointment: Appointment;
  onClick?: (e?: React.MouseEvent) => void;
  /** Total visits this client has had, so the block can mark new and regular clients. */
  visits?: number | null;
  /** The block's rendered height in px, so it can pick a density (1, 2 or 3 lines). */
  height?: number;
}

// Check if a color is a hex color
const isHexColor = (color: string): boolean => {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
};

// Convert hex to RGB for calculating text color
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Determine if text should be white or dark based on background color
const shouldUseWhiteText = (hexColor: string): boolean => {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return false;
  // Calculate luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance < 0.5; // Use white text if background is dark
};

export function AppointmentBlock({ appointment, onClick, visits, height }: AppointmentBlockProps) {
  // Colour is the status now (accent + tint). It used to be a colour per client, which told
  // a receptionist nothing she could act on; the client's name is right there in bold.
  const s = appointmentStatusStyle(appointment.status);
  // Colour is the service category; the status shows as a dot and in the block's outline.
  const tint = categoryTint(appointment.categoryId, appointment.serviceId);
  const statusKey = (appointment.status || "CONFIRMED").toUpperCase();
  const grouped = appointment.groupServices;
  const serviceLabel = appointmentServiceLabel(appointment);
  // A short block only has room for the first service and a count.
  const shortLabel = grouped && grouped.length > 1 ? `${grouped[0]} +${grouped.length - 1}` : appointment.service;
  // A package (or any multi-service visit) shares one accent per visitId across columns.
  const accent = appointment.isPackage || appointment.linked ? visitAccent(appointment.visitId) : null;
  const tags = appointmentTags({ notes: appointment.notes, visits });
  const start = appointment.startTime?.slice(0, 5);
  const end = appointment.endTime?.slice(0, 5);
  // Three densities, by the block's height in px: a 15-minute block gets one line, a
  // half hour two, anything longer the full card. Unknown height → the full card.
  const size = height == null ? "lg" : height < 34 ? "sm" : height < 58 ? "md" : "lg";
  const cancelled = statusKey === "CANCELLED";
  const noShow = statusKey === "NO_SHOW";
  const completed = statusKey === "COMPLETED";

  const stop = (e: React.MouseEvent) => {
    // Check if parent is dragging - if so, let the event through
    const isDragging = (e.currentTarget.closest("[data-appointment-block]") as HTMLElement)?.dataset?.isDragging === "true";
    if (!isDragging) e.stopPropagation();
    return isDragging;
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${appointment.clientName || t("common.client")}, ${serviceLabel}, ${start}–${end}, ${s.label}`}
      onClick={(e) => {
        if (!stop(e)) onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      onMouseDown={stop}
      onMouseUp={stop}
      title={appointment.participants && appointment.participants.length > 1
        ? appointment.participants.join("\n")
        : `${s.label}${appointment.categoryName ? ` · ${appointment.categoryName}` : ""}`}
      style={{
        backgroundColor: tint.fill,
        color: tint.ink,
        // Cancelled: hatched and faded. No-show: dashed outline. Completed: a little muted.
        backgroundImage: cancelled
          ? "repeating-linear-gradient(135deg, transparent 0 6px, rgba(30,27,46,0.09) 6px 8px)"
          : undefined,
        boxShadow: accent ? `inset 0 0 0 2px ${accent}` : undefined,
        outline: noShow ? `1.5px dashed ${s.dot}` : undefined,
        outlineOffset: noShow ? "-4px" : undefined,
        opacity: cancelled ? 0.6 : completed ? 0.82 : 1,
      }}
      className={cn(
        // The white 2px border is the gap that keeps back-to-back blocks apart.
        "group relative flex h-full cursor-pointer overflow-hidden rounded-[10px] border-2 border-white pl-[3px] transition-[filter]",
        "hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand))]",
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: tint.accent }} />
      {accent && <span aria-hidden className="absolute inset-y-0 right-0 w-[4px]" style={{ backgroundColor: accent }} />}
      {appointment.linked && (
        <span
          aria-label={appointment.groupSize ? t("calendar.groupBadge", { count: appointment.groupSize }) : t("calendar.linkedToTheSameVisit")}
          title={[
            appointment.groupSize ? t("calendar.groupBadge", { count: appointment.groupSize }) : t("calendar.linkedToTheSameVisit"),
            appointment.staffAutoAssigned ? t("calendar.autoAssigned") : "",
          ].filter(Boolean).join(" · ")}
          className="absolute bottom-1 right-1.5 text-[rgb(var(--reg-muted))]"
        >
          <Link2 size={12} strokeWidth={2.5} />
        </span>
      )}
      {appointment.overrideApplied && (
        <span
          data-testid="override-marker"
          aria-label={t("bookingConflict.markerTitle")}
          title={t("bookingConflict.markerTitle")}
          className="absolute right-[22px] top-[3px] text-amber-700"
        >
          <TriangleAlert size={12} strokeWidth={2.5} />
        </span>
      )}
      {/* Status, apart from the category colour. */}
      <span
        aria-hidden
        title={s.label}
        className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-white"
        style={{ backgroundColor: s.dot }}
      />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          size === "sm" ? "justify-center px-2" : size === "md" ? "justify-center px-2.5 py-[3px]" : "px-2.5 py-1.5",
        )}
      >
        {size === "sm" ? (
          <p className="truncate text-[12px] leading-none">
            <span className={cn("font-bold", cancelled && "line-through")}>{appointment.clientName}</span>
            <span style={{ color: tint.muted }}> · {start} {shortLabel}</span>
          </p>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-1">
              <p className={cn("min-w-0 flex-1 truncate text-[13px] font-bold leading-tight", appointment.overrideApplied ? "pr-8" : "pr-3", cancelled && "line-through")}>
                {appointment.clientName}
              </p>
              {appointment.clientAlert && (
                <TriangleAlert aria-label={t("calendar.clientAlert")} role="img" className="h-3.5 w-3.5 shrink-0 text-amber-700" />
              )}
              {appointment.isPackage && (
                <span
                  title={appointment.guestName ? t("calendar.packageGuest", { name: appointment.guestName }) : t("calendar.packageStepTitle", { step: appointment.packageStep ?? 1 })}
                  className="inline-flex h-4 shrink-0 items-center gap-0.5 rounded-full bg-white/80 px-1 text-[10px] font-bold"
                  style={{ color: accent ?? undefined }}
                >
                  <Package size={10} strokeWidth={2.5} />{appointment.packageStep ?? ""}
                </span>
              )}
              {/* Did they ask for this person, is it their first visit, are they a regular. */}
              {tags.map(({ Icon, label, className }) => (
                <span key={label} title={label} className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full", className)}>
                  <Icon size={10} strokeWidth={2.5} />
                </span>
              ))}
            </div>
            {size === "md" ? (
              <p className="mt-0.5 truncate text-[12px] leading-tight" style={{ color: tint.muted }}>
                {start}–{end} · {serviceLabel}
              </p>
            ) : (
              <>
                <p className="mt-0.5 truncate text-[12px] leading-tight" style={{ color: tint.ink }}>
                  {serviceLabel}
                  {appointment.isPackage && appointment.guestName ? ` · ${t("calendar.packageGuest", { name: appointment.guestName })}` : ""}
                </p>
                <p className="mt-0.5 truncate text-[12px] leading-tight" style={{ color: tint.muted }}>
                  {start}–{end}
                  {appointment.staffName ? ` · ${appointment.staffName}` : ""}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface StaffAvatarProps {
  staff: Staff;
  size?: "sm" | "md" | "lg";
}

const avatarColors = [
  "from-rose-400 to-pink-500",
  "from-amber-400 to-orange-500", 
  "from-slate-400 to-slate-600",
  "from-blue-400 to-indigo-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-sky-500",
];

export function StaffAvatar({ staff, size = "md" }: StaffAvatarProps) {
  const sizeClasses = {
    sm: "w-10 h-10 text-xs",
    md: "w-14 h-14 text-sm",
    lg: "w-20 h-20 text-lg",
  };

  // Get consistent color based on staff id
  const colorIndex = [...String(staff.id)].reduce((h, c) => h + c.charCodeAt(0), 0) % avatarColors.length;
  const gradientClass = avatarColors[colorIndex];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "rounded-full flex items-center justify-center overflow-hidden ring-2 ring-background shadow-md",
          `bg-gradient-to-br ${gradientClass}`,
          sizeClasses[size]
        )}
      >
        {staff.avatar ? (
          <img
            src={staff.avatar}
            alt={staff.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-semibold text-white drop-shadow-sm">
            {(staff.name || "").split(" ").map((n) => n[0]).join("")}
          </span>
        )}
      </div>
      <span className="text-xs font-medium text-foreground">{staff.name}</span>
    </div>
  );
}
