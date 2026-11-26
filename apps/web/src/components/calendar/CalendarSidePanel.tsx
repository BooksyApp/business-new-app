import { Check } from "lucide-react";
import { Avatar } from "@/components/bz";
import { t as tr } from "@/i18n";
import type { Appointment, Staff } from "@/components/calendar/AppointmentBlock";

export interface AttentionItem { label: string; detail?: string; tone?: string; name?: string; chip?: string; onClick: () => void }

/**
 * Right rail of the day view (BF02 `.side`): the next client (dark `.live` card), what needs attention,
 * and the team. Real data only; each row opens the same flows as the grid.
 */
export function CalendarSidePanel({
  next,
  attention,
  team,
  onOpenAppointment,
  initialsOf,
}: {
  next: Appointment | null;
  attention: AttentionItem[];
  team: Staff[];
  onOpenAppointment: (a: Appointment) => void;
  initialsOf: (name: string) => string;
}) {
  return (
    <aside className="side" aria-label={tr("common.team")}>
      <div className="live" style={{ padding: 22 }}>
        <div className="k">{tr("calendar.nextClient").toUpperCase()}</div>
        {next ? (
          <>
            <div className="row gap12" style={{ marginTop: 14 }}>
              <Avatar ring initials={initialsOf(next.clientName || "")} size={56} />
              <div style={{ minWidth: 0 }}>
                <div className="t" style={{ fontSize: 26 }}>{next.clientName}</div>
                <div style={{ fontSize: 14.5, opacity: 0.85, fontWeight: 600 }}>
                  {next.startTime?.slice(0, 5)} · {next.service}
                  {next.staffName ? ` · ${next.staffName}` : ""}
                </div>
              </div>
            </div>
            <div className="row gap8" style={{ marginTop: 18 }}>
              <button type="button" className="btn btn-wh s" style={{ flex: 1, border: 0, cursor: "pointer" }} onClick={() => onOpenAppointment(next)}>
                <Check className="ic" aria-hidden />
                {tr("calendar.openBooking")}
              </button>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 14, fontSize: 14.5, opacity: 0.85, fontWeight: 600 }}>{tr("calendar.noBookings")}</div>
        )}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="row sp">
          <b style={{ fontSize: 17 }}>{tr("calendar.needsAttention")}</b>
        </div>
        {attention.length === 0 ? (
          <p className="sm t-m b7" style={{ marginTop: 10 }}>{tr("calendar.nothingWaitingOnYou")}</p>
        ) : (
          <>
            {attention.slice(0, 5).map((item, i) => (
              <div key={i}>
                {i > 0 && <div className="hr" style={{ margin: "14px 0" }} />}
                <button type="button" onClick={item.onClick} className="row gap12" style={{ border: 0, background: "none", font: "inherit", textAlign: "left", cursor: "pointer", color: "inherit", padding: 0, marginTop: i === 0 ? 14 : 0, width: "100%" }}>
                  <Avatar ring initials={initialsOf(item.name || item.label)} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: "block", fontSize: 15.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name || item.label}</b>
                    {item.chip ? (
                      <span className="st w" style={{ marginTop: 4 }}>{item.chip}</span>
                    ) : item.detail ? (
                      <span className="sm t-m b7" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.detail}</span>
                    ) : null}
                  </div>
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <b style={{ fontSize: 17 }}>{tr("common.team")}</b>
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {team.map((m) => (
            <div key={m.id} className="row gap12">
              {m.avatar ? <img className="av" src={m.avatar} alt="" style={{ width: 36, height: 36 }} /> : <Avatar initials={m.initials || initialsOf(m.name)} size={36} />}
              <b style={{ fontSize: 15.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</b>
              <span className="dotg" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
