import { useEffect, useState } from "react";

import type { Id } from "@/types/id";
import { sharedClientService, type OwnerVisitRow } from "@/services/sharedClientService";
import { t } from "@/i18n";

/**
 * FG-W5-08: this client's visits in the owner's OTHER salons (only when the owner shares clients).
 * Renders nothing for anyone who may not see it (a team member gets 403), when sharing is off, or
 * when there is nothing from the other salons.
 */
export function OtherSalonsVisits({ businessId, clientId }: { businessId: Id; clientId: Id }) {
  const [rows, setRows] = useState<OwnerVisitRow[]>([]);

  useEffect(() => {
    let live = true;
    sharedClientService
      .visits(businessId, clientId)
      .then((r) => live && setRows(r.filter((v) => String(v.salonId) !== String(businessId))))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [businessId, clientId]);

  if (rows.length === 0) return null;
  return (
    <section className="mt-4">
      <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{t("shc.otherSalonsVisits", { count: rows.length })}</p>
      <ul className="space-y-2">
        {rows.map((v, i) => (
          <li key={`${v.salonId}-${v.appointment_date}-${v.start_time}-${i}`} className="rounded-2xl bg-white p-3.5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
            <p className="text-[15px] font-semibold">
              {v.service_name || "—"}
              <span className="font-normal text-[rgb(var(--reg-muted))]"> · {v.salon_name}</span>
            </p>
            <p className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">
              {v.appointment_date} · {String(v.start_time).slice(0, 5)}
              {v.staff_name ? ` · ${v.staff_name}` : ""} · {v.status}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
