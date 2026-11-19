import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { currencySymbol } from "@/lib/currency";
import { t as tr } from "@/i18n";
import { appointmentService, type PackageSlots } from "@/services/appointmentService";
import type { Id } from "@/types/id";

interface Props {
  businessId: Id;
  /** The package service being booked. */
  serviceId: Id;
  date: string; // YYYY-MM-DD
  maxParty: number;
  partySize: number;
  onPartySize: (n: number) => void;
  /** HH:mm of the chosen start, "" when none. */
  startTime: string;
  onStartTime: (hhmm: string) => void;
}

/**
 * FG-W3-01: the salon picks how many people and a start time from the package slot finder (the
 * planner the customer site uses). The server decides who does which step when it books.
 */
export function PackageBookingPanel({ businessId, serviceId, date, maxParty, partySize, onPartySize, startTime, onStartTime }: Props) {
  const [data, setData] = useState<PackageSlots | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    appointmentService
      .getPackageSlots(businessId, serviceId, date, partySize)
      .then((r) => {
        if (cancelled) return;
        setData(r);
        if (startTime && !r.availableSlots.includes(startTime)) onStartTime("");
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setFailed(true);
        onStartTime("");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // startTime / onStartTime intentionally left out: only a new day, party or package reloads the times.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, serviceId, date, partySize]);

  const slots = data?.availableSlots ?? [];
  return (
    <section className="space-y-3" data-testid="package-booking-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{tr("calendar.packageParty")}</p>
          <p className="text-xs text-[rgb(var(--reg-muted))]">{tr("calendar.packagePartyHint", { max: maxParty })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="-"
            disabled={partySize <= 1}
            onClick={() => onPartySize(partySize - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-[rgb(var(--reg-line))] disabled:opacity-40"
          >
            <Minus size={14} />
          </button>
          <span className="w-6 text-center text-base font-bold" data-testid="package-party">{partySize}</span>
          <button
            type="button"
            aria-label="+"
            disabled={partySize >= maxParty}
            onClick={() => onPartySize(partySize + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-[rgb(var(--reg-line))] disabled:opacity-40"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">{tr("calendar.packageStartTimes")}</p>
        {data && (
          <p className="text-xs text-[rgb(var(--reg-muted))]">
            {tr("calendar.packageLength", { minutes: data.durationMinutes })} · {data.price.toFixed(2)} {currencySymbol()}
          </p>
        )}
        {failed && <p className="text-sm text-red-600">{tr("calendar.packageSlotsFailed")}</p>}
        {!failed && !loading && data && slots.length === 0 && (
          <p className="text-sm text-[rgb(var(--reg-muted))]">{tr("calendar.packageNoSlots", { count: partySize })}</p>
        )}
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tr("calendar.packageStartTimes")}>
          {slots.map((hhmm) => {
            const on = hhmm === startTime;
            return (
              <button
                key={hhmm}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onStartTime(hhmm)}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition",
                  on
                    ? "bg-[rgb(var(--reg-ink))] text-white ring-[rgb(var(--reg-ink))]"
                    : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]",
                )}
              >
                {hhmm}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
