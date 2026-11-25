import { useCallback, useEffect, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLocale, t, fmtDate } from "@/i18n";
import {
  supportService,
  TICKET_CATEGORIES,
  type SupportThread,
  type SupportTicket,
  type TicketCategory,
  type TicketStatus,
} from "@/services/supportService";

const CHIP: Record<TicketStatus, string> = {
  NEW: "bg-sky-50 text-sky-800",
  OPEN: "bg-sky-50 text-sky-800",
  WAITING_ON_USER: "bg-amber-50 text-amber-800",
  RESOLVED: "bg-[rgb(var(--reg-success-soft))] text-[rgb(var(--reg-success))]",
  CLOSED: "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-ink)/0.7)]",
};

const statusLabel = (s: TicketStatus) => t(`support.status${s}` as "support.statusNEW");
const categoryLabel = (c: TicketCategory) => t(`support.category${c}` as "support.categoryBOOKING");

function StatusChip({ status }: { status: TicketStatus }) {
  return <span className={cn("inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", CHIP[status])}>{statusLabel(status)}</span>;
}

/** Dəstək: an owner or team member writes to Booqi support and follows the answer. */
export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [open, setOpen] = useState<SupportThread | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    supportService.list().then(setTickets).catch(() => setTickets([]));
  }, []);
  useEffect(load, [load]);

  const openTicket = (ref: string) =>
    supportService.get(ref).then((th) => { setOpen(th); setCreating(false); }).catch((e) => toast.error(e instanceof Error ? e.message : t("support.genericError")));

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("support.title")}
          subtitle={t("support.subtitle")}
          actions={<Button className={primaryBtn} onClick={() => { setCreating(true); setOpen(null); }}>{t("support.newRequest")}</Button>}
        />
        <div className={cn(pageBody, "grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]")}>
          <section className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
            <h2 className="px-5 pt-4 text-base font-extrabold">{t("support.myRequests")}</h2>
            {tickets === null ? (
              <p className="px-5 py-4 text-sm text-[rgb(var(--reg-muted))]">{t("support.loading")}</p>
            ) : tickets.length === 0 ? (
              <p className="px-5 py-4 text-sm text-[rgb(var(--reg-muted))]">{t("support.none")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-[rgb(var(--reg-line)/0.6)]">
                {tickets.map((x) => (
                  <li key={x.ref}>
                    <button
                      type="button"
                      onClick={() => void openTicket(x.ref)}
                      className={cn("flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-[rgb(var(--reg-ink)/0.03)]", open?.ticket.ref === x.ref && "bg-[rgb(var(--reg-brand-soft))]")}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{x.subject}</span>
                        <span className="block text-xs text-[rgb(var(--reg-muted))]">{x.ref} · {fmtDate(x.lastMessageAt, { dateStyle: "medium" })}</span>
                      </span>
                      <StatusChip status={x.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {creating || !open ? (
            <NewRequest
              onCreated={(made) => { load(); void openTicket(made.ref); toast.success(t("support.sent", { ref: made.ref })); }}
            />
          ) : (
            <Thread
              thread={open}
              onReply={async (body) => { setOpen(await supportService.reply(open.ticket.ref, body)); load(); }}
            />
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}

function NewRequest({ onCreated }: { onCreated: (t: SupportTicket) => void }) {
  const [category, setCategory] = useState<TicketCategory>("OTHER");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = subject.trim().length > 0 && message.trim().length > 0;

  const submit = async () => {
    setBusy(true);
    try {
      const made = await supportService.create({ category, subject: subject.trim(), message: message.trim(), locale: getLocale() });
      setSubject(""); setMessage("");
      onCreated(made);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("support.genericError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]"><LifeBuoy size={18} /></span>
        <div>
          <h2 className="text-base font-extrabold">{t("support.newRequest")}</h2>
          <p className="text-sm text-[rgb(var(--reg-muted))]">{t("support.replyByEmail")}</p>
        </div>
      </div>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (ready && !busy) void submit(); }}>
        <Field label={t("support.topic")} htmlFor="sp-category">
          <select id="sp-category" className={fieldCls} value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
            {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
        </Field>
        <Field label={t("support.subject")} htmlFor="sp-subject">
          <input id="sp-subject" className={fieldCls} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label={t("support.message")} htmlFor="sp-message">
          <textarea id="sp-message" rows={6} maxLength={5000} className={cn(fieldCls, "h-auto py-3")} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <Button type="submit" className={primaryBtn} disabled={!ready || busy}>{busy ? t("support.sending") : t("support.submit")}</Button>
      </form>
    </section>
  );
}

function Thread({ thread, onReply }: { thread: SupportThread; onReply: (body: string) => Promise<void> }) {
  const { ticket, messages } = thread;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onReply(text.trim());
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("support.genericError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-[rgb(var(--reg-muted))]">{ticket.ref}</span>
          <StatusChip status={ticket.status} />
          <span className="text-[rgb(var(--reg-muted))]">{categoryLabel(ticket.category)}</span>
        </div>
        <h2 className="mt-2 text-lg font-extrabold">{ticket.subject}</h2>
      </div>
      <ul className="space-y-3">
        {messages.map((m) => {
          const mine = m.authorType === "USER";
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed", mine ? "bg-[rgb(var(--reg-brand))] text-white" : "bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]")}>
                <p className={cn("mb-1 text-xs font-semibold", mine ? "text-white/80" : "text-[rgb(var(--reg-muted))]")}>
                  {mine ? t("support.you") : t("support.team")} · {fmtDate(m.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {ticket.status === "CLOSED" ? (
        <p className="rounded-2xl bg-[rgb(var(--reg-ink)/0.04)] px-4 py-3 text-sm text-[rgb(var(--reg-muted))]">{t("support.closedNote")}</p>
      ) : (
        <form className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]" onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) void submit(); }}>
          <Field label={ticket.status === "RESOLVED" ? t("support.replyResolved") : t("support.reply")} htmlFor="sp-reply">
            <textarea id="sp-reply" rows={4} maxLength={5000} className={cn(fieldCls, "h-auto py-3")} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Button type="submit" className={cn(primaryBtn, "mt-3")} disabled={!text.trim() || busy}>{busy ? t("support.sending") : t("support.send")}</Button>
        </form>
      )}
    </section>
  );
}
