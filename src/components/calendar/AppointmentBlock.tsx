import { appointmentTags, clientColorClasses } from "@/lib/appointmentVisuals";
import { cn } from "@/lib/utils";

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
  service: string;
  startTime: string;
  endTime: string;
  staffId: string;
  staffName?: string; // Master/staff name
  color: AppointmentColor | string; // Can be a color name or hex color
  // Additional fields from API
  clientId?: number;
  clientPhone?: string;
  clientEmail?: string;
  notes?: string;
  price?: number;
  apiId?: number;
  // #30: needed to decide which lifecycle actions apply. Optional because older
  // call sites build these without it; the footer simply shows fewer buttons then.
  status?: string;
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

export function AppointmentBlock({ appointment, onClick, visits }: AppointmentBlockProps) {
  // Colour is the client's, always. It used to come from the backend's `color` field —
  // a hex per service or staff member — so every appointment for the same service looked
  // identical and you could not tell two clients apart at a glance. A hex is only used
  // when there is no client to colour by at all.
  const hasClient = Boolean(appointment.clientName?.trim());
  const isHex = !hasClient && isHexColor(appointment.color);
  const clientColors = clientColorClasses(appointment.clientName);
  const useWhiteText = isHex ? shouldUseWhiteText(appointment.color) : false;
  const tags = appointmentTags({ notes: appointment.notes, visits });
  
  return (
    <div
      onClick={(e) => {
        // Check if parent is dragging - if so, don't stop propagation
        const isDragging = (e.currentTarget.closest('[data-appointment-block]') as HTMLElement)?.dataset?.isDragging === 'true';
        if (!isDragging) {
          e.stopPropagation();
          onClick?.();
        }
      }}
      onMouseDown={(e) => {
        // Don't stop propagation during drag - let it pass through
        const isDragging = (e.currentTarget.closest('[data-appointment-block]') as HTMLElement)?.dataset?.isDragging === 'true';
        if (!isDragging) {
          e.stopPropagation();
        }
      }}
      onMouseUp={(e) => {
        // Don't stop propagation during drag - let it pass through
        const isDragging = (e.currentTarget.closest('[data-appointment-block]') as HTMLElement)?.dataset?.isDragging === 'true';
        if (!isDragging) {
          e.stopPropagation();
        }
      }}
      className={cn(
        "h-full rounded-lg cursor-pointer border-l-4 shadow-sm",
        "overflow-hidden",
        "group relative backdrop-blur-sm",
        "flex items-center",
        !isHex && clientColors
      )}
      style={isHex ? {
        backgroundColor: appointment.color,
        borderLeftColor: appointment.color,
      } : undefined}
    >
      <div className="px-2 py-0.5 flex items-center gap-1.5 w-full min-w-0 h-full">
        {/* Time - inline */}
        <span className={cn(
          "text-[10px] font-semibold whitespace-nowrap flex-shrink-0",
          useWhiteText ? "text-white" : "text-foreground/90"
        )}>
          {appointment.startTime}
        </span>
        
        {/* Separator */}
        <span className={cn(
          "text-[8px] flex-shrink-0",
          useWhiteText ? "text-white/70" : "text-foreground/60"
        )}>
          •
        </span>
        
        {/* Client name - inline, priority */}
        <span className={cn(
          "font-bold text-[11px] leading-tight truncate flex-1 min-w-0",
          useWhiteText ? "text-white" : "drop-shadow-sm"
        )}>
          {appointment.clientName}
        </span>

        {/* Three facts worth having without opening the appointment: did they ask for this
            person, is it their first visit, are they a regular. */}
        {tags.map(({ Icon, label, className }) => (
          <span
            key={label}
            title={label}
            className={cn(
              "inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full",
              className
            )}
          >
            <Icon size={10} strokeWidth={2.5} />
          </span>
        ))}
        
        {/* Master/Staff name - inline */}
        {appointment.staffName && (
          <>
            <span className={cn(
              "text-[8px] flex-shrink-0",
              useWhiteText ? "text-white/70" : "text-foreground/60"
            )}>
              •
            </span>
            <span className={cn(
              "text-[10px] leading-tight truncate flex-shrink-0 max-w-[25%]",
              useWhiteText ? "text-white/85" : "text-foreground/70"
            )}>
              {appointment.staffName}
            </span>
          </>
        )}
        
        {/* Service - inline, can truncate */}
        <span className={cn(
          "text-[8px] flex-shrink-0",
          useWhiteText ? "text-white/70" : "text-foreground/60"
        )}>
          •
        </span>
        <span className={cn(
          "text-[10px] leading-tight truncate flex-shrink max-w-[30%]",
          useWhiteText ? "text-white/85" : "text-foreground/70"
        )}>
          {appointment.service}
        </span>
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
  "from-emerald-400 to-teal-500",
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
  const colorIndex = parseInt(staff.id) % avatarColors.length;
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
