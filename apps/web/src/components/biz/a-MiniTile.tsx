import type { Appointment } from "@/components/calendar/AppointmentBlock";
import { appointmentServiceLabel } from "@/components/calendar/AppointmentBlock";
import { appointmentFlagKeys, type FlagContext } from "@/lib/appointmentFlags";
import { FlagIcons } from "@/components/calendar/AppointmentFlags";
import { appointmentStatusStyle } from "@/lib/appointmentStatus";
import { categoryTint } from "@/lib/serviceCategoryColor";
import { cn } from "@/lib/utils";

/**
 * Week/Month tile in the day-view style: category tint, status stripe on the left,
 * small icon markers instead of text tags. Area A (calendar).
 */
export function MiniTile({
  appointment,
  visits,
  flagCtx,
  onClick,
  className,
}: {
  appointment: Appointment;
  visits?: number | null;
  flagCtx?: FlagContext;
  onClick: () => void;
  className?: string;
}) {
  const s = appointmentStatusStyle(appointment.status);
  const tint = categoryTint(appointment.categoryId, appointment.serviceId);
  const statusKey = (appointment.status || "CONFIRMED").toUpperCase();
  const cancelled = statusKey === "CANCELLED";
  const start = appointment.startTime?.slice(0, 5);
  const end = appointment.endTime?.slice(0, 5);
  const keys = appointmentFlagKeys(appointment, { visits, ...flagCtx });
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      title={`${start} - ${end}: ${appointmentServiceLabel(appointment)}`}
      style={{
        backgroundColor: tint.fill,
        color: tint.ink,
        opacity: cancelled ? 0.6 : statusKey === "COMPLETED" ? 0.82 : 1,
      }}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-[10px] border-2 border-white py-1 pl-3 pr-2 text-xs transition-[filter] hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand))]",
        className,
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[4px]" style={{ backgroundColor: s.dot }} />
      <div className="flex min-w-0 items-center gap-1">
        <span className={cn("min-w-0 flex-1 truncate text-[12px] font-bold leading-tight", cancelled && "line-through")}>
          {appointment.clientName}
        </span>
        <FlagIcons keys={keys} max={3} size={12} />
      </div>
      <div className="truncate text-[11px] leading-tight" style={{ color: tint.muted }}>
        {start}–{end} · {appointmentServiceLabel(appointment)}
      </div>
    </div>
  );
}
