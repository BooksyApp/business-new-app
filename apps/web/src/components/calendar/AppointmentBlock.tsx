import type { Id } from "@/types/id";
import { appointmentFlagKeys, type FlagContext } from "@/lib/appointmentFlags";
import { FlagIcons, type CalendarDensity } from "@/components/calendar/AppointmentFlags";
import { visitAccent } from "@/lib/servicePackage";
import { cn } from "@/lib/utils";
import { Check, CircleDashed, Link2, Package, TriangleAlert, UserX, X, type LucideIcon } from "lucide-react";
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
  lateMinutes?: number | null;
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
  paymentStatus?: string | null;
  depositPaid?: boolean | null;
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
  /** What the page knows about the client (birthday, VIP) for the small icons. */
  flagCtx?: FlagContext;
  /** "comfy" (default) or "compact": shorter text rows, fewer icons, for busy days. */
  density?: CalendarDensity;
}

/** At most one small status icon; confirmed is the plain stripe. */
const STATUS_ICON: Record<string, LucideIcon> = {
  PENDING: CircleDashed,
  COMPLETED: Check,
  NO_SHOW: UserX,
  CANCELLED: X,
};

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

export function AppointmentBlock({ appointment, onClick, visits, height, flagCtx, density = "comfy" }: AppointmentBlockProps) {
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
  const flagKeys = appointmentFlagKeys(appointment, { visits, ...flagCtx });
  const compact = density === "compact";
  const StatusIcon = STATUS_ICON[statusKey];
  const start = appointment.startTime?.slice(0, 5);
  const end = appointment.endTime?.slice(0, 5);
  // Three densities, by the block's height in px: a 15-minute block gets one line, a
  // half hour two, anything longer the full card. Unknown height → the full card.
  const size = height == null ? "lg" : compact ? (height < 46 ? "sm" : height < 72 ? "md" : "lg") : height < 34 ? "sm" : height < 58 ? "md" : "lg";
  const cancelled = statusKey === "CANCELLED";
  const noShow = statusKey === "NO_SHOW";
  const completed = statusKey === "COMPLETED";

  const stop = (e: React.MouseEvent) => {
    // Check if parent is dragging - if so, let the event through
    const isDragging = (e.currentTarget.closest("[data-appointment-block]") as HTMLElement)?.dataset?.isDragging === "true";
    if (!isDragging) e.stopPropagation();
    return isDragging;
  };

  // Artifact tile (BF02): `.tile` with a status stripe (::before, --bz-sc), name in <b>, a quiet line,
  // small icons in `.nb`. The category tint stays real data (fill + ink), so the colour legend still holds.
  const tileSize = size === "sm" ? "cp" : size === "md" ? "md" : "";
  const icons = (
    <span className="nb">
      {appointment.clientAlert && (
        <i className="ni" title={t("calendar.clientAlert")} style={{ color: "#a05a00" }}>
          <TriangleAlert aria-label={t("calendar.clientAlert")} role="img" size={14} strokeWidth={2} />
        </i>
      )}
      {appointment.isPackage && (
        <i
          className="ni"
          title={appointment.guestName ? t("calendar.packageGuest", { name: appointment.guestName }) : t("calendar.packageStepTitle", { step: appointment.packageStep ?? 1 })}
          style={{ color: accent ?? undefined, width: "auto", gap: 2, fontSize: 11, fontWeight: 800 }}
        >
          <Package size={13} strokeWidth={2.2} />{appointment.packageStep ?? ""}
        </i>
      )}
      <FlagIcons keys={flagKeys} max={size === "sm" ? (compact ? 2 : 3) : compact ? 3 : 5} size={14} />
      {StatusIcon && (
        <i className="ni" style={{ color: s.dot }}>
          <StatusIcon size={14} strokeWidth={2.5} aria-label={s.label} role="img" />
        </i>
      )}
    </span>
  );

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
        ["--bz-sc" as string]: s.dot,
        ["--bz-so" as string]: 1,
        boxShadow: accent ? `inset 0 0 0 2px ${accent}` : undefined,
        opacity: cancelled ? undefined : completed ? 0.82 : 1,
      }}
      className={cn("tile in group cursor-pointer focus-visible:outline-none", tileSize, cancelled && "a-x", noShow && "a-n")}
    >
      {accent && <span aria-hidden className="absolute inset-y-0 right-0 w-[4px]" style={{ backgroundColor: accent }} />}
      {appointment.linked && (
        <span
          aria-label={appointment.groupSize ? t("calendar.groupBadge", { count: appointment.groupSize }) : t("calendar.linkedToTheSameVisit")}
          title={[
            appointment.groupSize ? t("calendar.groupBadge", { count: appointment.groupSize }) : t("calendar.linkedToTheSameVisit"),
            appointment.staffAutoAssigned ? t("calendar.autoAssigned") : "",
          ].filter(Boolean).join(" · ")}
          style={{ position: "absolute", bottom: 4, right: 6, opacity: 0.7 }}
        >
          <Link2 size={12} strokeWidth={2.5} />
        </span>
      )}
      {appointment.overrideApplied && (
        <span
          data-testid="override-marker"
          aria-label={t("bookingConflict.markerTitle")}
          title={t("bookingConflict.markerTitle")}
          style={{ position: "absolute", bottom: 4, right: 22, color: "#a05a00" }}
        >
          <TriangleAlert size={12} strokeWidth={2.5} />
        </span>
      )}
      {size === "sm" ? (
        <>
          <b style={cancelled ? { textDecoration: "line-through" } : undefined}>{appointment.clientName}</b>
          <span>{start} · {shortLabel}</span>
          {icons}
        </>
      ) : size === "md" ? (
        <>
          <div className="hr2">
            <b style={cancelled ? { textDecoration: "line-through" } : undefined}>{appointment.clientName}</b>
            {icons}
          </div>
          <span>{serviceLabel} · {start}</span>
        </>
      ) : (
        <>
          <b style={cancelled ? { textDecoration: "line-through" } : undefined}>{appointment.clientName}</b>
          <span>
            {serviceLabel}
            {appointment.isPackage && appointment.guestName ? ` · ${t("calendar.packageGuest", { name: appointment.guestName })}` : ""}
          </span>
          <span>
            {start}–{end}
            {!compact && appointment.staffName ? ` · ${appointment.staffName}` : ""}
          </span>
          {icons}
        </>
      )}
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
