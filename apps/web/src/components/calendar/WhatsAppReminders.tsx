import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { appointmentService, type WhatsAppReminderRow } from "@/services/appointmentService";
import { t } from "@/i18n";
import type { Id } from "@/types/id";

/**
 * FG-W1-01: tomorrow's clients with a one-tap WhatsApp reminder (wa.me, text ready in the
 * client's language). The salon sends it from its own phone; "sent" is remembered per booking.
 */
export function WhatsAppReminders({ businessId }: { businessId: Id }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<WhatsAppReminderRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!businessId) return;
    setFailed(false);
    appointmentService.getWhatsAppReminders(businessId)
      .then((r) => setRows(r.rows))
      .catch(() => setFailed(true));
  }, [businessId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const mark = async (row: WhatsAppReminderRow, sent: boolean) => {
    setRows((prev) => prev?.map((r) => (r.id === row.id ? { ...r, sentAt: sent ? new Date().toISOString() : null } : r)) ?? null);
    try {
      await appointmentService.markWhatsAppReminder(businessId, row.id, sent);
    } catch {
      load();
    }
  };

  return (
    <>
      <Button aria-label={t("reminders.open")} title={t("reminders.open")} variant="ghost" size="icon"
        className="h-10 w-10 rounded-full text-[rgb(var(--reg-ink)/0.75)] hover:bg-white hover:text-[rgb(var(--reg-ink))]"
        onClick={() => setOpen(true)}>
        <MessageCircle size={18} strokeWidth={1.75} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("reminders.title")}</DialogTitle>
            <DialogDescription>{t("reminders.subtitle")}</DialogDescription>
          </DialogHeader>
          {failed && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{t("reminders.error")}</p>}
          {!failed && rows === null && <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">{t("reminders.loading")}</p>}
          {rows !== null && rows.length === 0 && <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">{t("reminders.empty")}</p>}
          <ul className="space-y-2">
            {rows?.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.startTime} · {r.clientName || "—"}</p>
                  <p className="truncate text-sm opacity-70">{r.serviceName}{r.staffName ? ` · ${r.staffName}` : ""}</p>
                </div>
                {r.waUrl ? (
                  <a href={r.waUrl} target="_blank" rel="noopener noreferrer" onClick={() => mark(r, true)}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                    <MessageCircle className="h-4 w-4" aria-hidden />{t("reminders.send")}
                  </a>
                ) : (
                  <span className="text-sm opacity-60">{t("reminders.noPhone")}</span>
                )}
                {r.waUrl && (
                  <button type="button" onClick={() => mark(r, !r.sentAt)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${r.sentAt ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}
                    aria-pressed={!!r.sentAt}>
                    <Check className="h-3.5 w-3.5" aria-hidden />{r.sentAt ? t("reminders.sent") : t("reminders.markSent")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
