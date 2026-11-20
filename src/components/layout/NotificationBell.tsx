import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarPlus, CalendarX2, Hourglass, Star } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBusinessId } from "@/hooks/useBusinessId";
import { salonPath } from "@/lib/salonKey";
import { cn } from "@/lib/utils";
import { fmtDate, t } from "@/i18n";
import { hubEventService, type HubEvent } from "@/services/hubEventService";

const POLL_MS = 60_000;

function describe(e: HubEvent): { title: string; detail: string } {
  const who = e.who || t("bell.someone");
  const when = [e.date, e.time?.slice(0, 5)].filter(Boolean).join(" ");
  switch (e.type) {
    case "BOOKING_NEW": return { title: t("bell.bookingNew"), detail: `${who} · ${e.what ?? ""} · ${when}` };
    case "BOOKING_CANCELLED": return { title: t("bell.bookingCancelled"), detail: `${who} · ${e.what ?? ""} · ${when}` };
    case "WAITLIST": return { title: t("bell.waitlist"), detail: `${who} · ${e.what ?? ""} · ${e.date ?? ""}` };
    default: return { title: t("bell.review", { rating: e.rating ?? "" }), detail: e.what ?? "" };
  }
}

function Icon({ type }: { type: HubEvent["type"] }) {
  const cls = "h-4 w-4";
  if (type === "BOOKING_NEW") return <CalendarPlus className={cls} />;
  if (type === "BOOKING_CANCELLED") return <CalendarX2 className={cls} />;
  if (type === "WAITLIST") return <Hourglass className={cls} />;
  return <Star className={cls} />;
}

/** The hub's bell: unread count and the latest events. Polls every minute; no websocket. */
export function NotificationBell({ className, side = "bottom" }: { className?: string; side?: "bottom" | "right" }) {
  const businessId = useBusinessId();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const key = ["hub-events", businessId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => hubEventService.list(businessId),
    enabled: Boolean(businessId),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    retry: false,
  });
  const read = useMutation({
    mutationFn: () => hubEventService.markRead(businessId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const unread = data?.unread ?? 0;
  const events = data?.events ?? [];

  const go = (e: HubEvent) => {
    setOpen(false);
    navigate(salonPath(businessId, e.type === "REVIEW" ? "reviews" : "calendar"));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="bell"
          aria-label={unread > 0 ? t("bell.openUnread", { count: unread }) : t("bell.open")}
          className={cn("relative flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--reg-ink)/0.6)] hover:bg-[rgb(var(--reg-ink)/0.05)] hover:text-[rgb(var(--reg-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]", className)}
        >
          <Bell size={17} strokeWidth={1.9} />
          {unread > 0 && (
            <span data-testid="bell-count" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[rgb(var(--reg-brand))] px-1 text-[10px] font-bold leading-none text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align="start" className="w-[min(92vw,360px)] p-0" data-testid="bell-panel">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">{t("bell.title")}</p>
          <button
            type="button"
            data-testid="bell-mark-read"
            disabled={unread === 0 || read.isPending}
            onClick={() => read.mutate()}
            className="text-xs font-semibold text-[rgb(var(--reg-brand))] disabled:opacity-40"
          >
            {t("bell.markRead")}
          </button>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto">
          {events.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t("bell.empty")}</li>}
          {events.map((e) => {
            const d = describe(e);
            return (
              <li key={e.id}>
                <button type="button" onClick={() => go(e)} className={cn("flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/60", e.unread && "bg-[rgb(var(--reg-brand)/0.06)]")}>
                  <span className="mt-0.5 text-[rgb(var(--reg-muted))]"><Icon type={e.type} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold">{d.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{d.detail}</span>
                    <span className="block text-[11px] text-muted-foreground">{fmtDate(e.at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                  {e.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--reg-brand))]" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
