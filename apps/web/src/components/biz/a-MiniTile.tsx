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
  placed,
}: {
  appointment: Appointment;
  visits?: number | null;
  flagCtx?: FlagContext;
  onClick: () => void;
  className?: string;
  /** Week grid: the tile is the absolutely placed element itself (BF40 week frame). */
  placed?: { top: number; height: number; left: number; width: number };
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
        ["--bz-sc" as string]: s.dot,
        ["--bz-so" as string]: 1,
        opacity: statusKey === "COMPLETED" ? 0.82 : undefined,
        ...(placed ? { position: "absolute" as const, top: placed.top, height: placed.height, left: placed.left, width: placed.width, zIndex: 3 } : { height: "auto", minHeight: 44 }),
      }}
      className={cn("tile tw cursor-pointer focus-visible:outline-none", !placed && "in", cancelled && "a-x", className)}
    >
      <div className="hr2">
        <b style={cancelled ? { textDecoration: "line-through" } : undefined}>{appointment.clientName}</b>
        <span className="nb">
          <FlagIcons bare keys={keys} max={3} size={13} />
        </span>
      </div>
      {placed ? <span>{start}</span> : (
        <span>
          {start}–{end} · {appointmentServiceLabel(appointment)}
        </span>
      )}
    </div>
  );
}
