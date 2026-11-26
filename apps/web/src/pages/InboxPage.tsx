import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, Card, CardContent, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn } from "@/components/page/booqiStyles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentBusinessId } from "@/config/api";
import { format } from "@/i18n/dateFns";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { applyIncoming, localMessage, markStatus, mergeServer, resolveSent } from "@/lib/messageThread";
import { messagingService, type InboxMessage, type InboxSummary, type InboxThread } from "@/services/messagingService";
import { websocketService, type InboxMessageEvent } from "@/services/websocketService";

/** Fallback refresh for the inbox and the open thread, used only while the live socket is down. */
const POLL_MS = 20000;
const MAX_BODY = 1000;

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : format(d, "d MMM HH:mm");
}

export default function InboxPage() {
  const businessId = getCurrentBusinessId();
  const [list, setList] = useState<InboxSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<InboxThread | null>(null);
  const [draft, setDraft] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportText, setReportText] = useState("");
  const [live, setLive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<string | null>(null);
  const localSeq = useRef(0);
  selectedRef.current = selected;

  const loadList = useCallback(
    () => messagingService.list(businessId).then(setList).catch(() => undefined).finally(() => setLoaded(true)),
    [businessId],
  );

  // Opening a thread marks it read on the server, so the list is refreshed right after.
  const loadThread = useCallback(
    (id: string) =>
      messagingService
        .get(businessId, id)
        .then((th) => {
          if (selectedRef.current !== id) return;
          setThread((cur) =>
            cur && cur.conversationId === th.conversationId
              ? { ...th, messages: mergeServer(cur.messages, th.messages) }
              : th,
          );
          void loadList();
        })
        .catch(() => undefined),
    [businessId, loadList],
  );

  // Live: a pushed message lands in the open thread, bumps its row to the top and counts as unread
  // unless that thread is open (opening it marks it read on the server).
  const onPush = useCallback(
    (ev: InboxMessageEvent) => {
      const open = selectedRef.current === ev.conversationId;
      if (open) {
        setThread((cur) =>
          cur && cur.conversationId === ev.conversationId
            ? { ...cur, messages: applyIncoming(cur.messages, ev.message) }
            : cur,
        );
        if (!ev.message.fromSalon) void messagingService.get(businessId, ev.conversationId).catch(() => undefined);
      }
      setList((cur) => {
        const row = cur.find((c) => c.conversationId === ev.conversationId);
        if (!row) {
          void loadList(); // a first message from someone new: the row needs the server's name
          return cur;
        }
        const unread = open || ev.message.fromSalon ? row.unread : row.unread + 1;
        const next = { ...row, unread: open ? 0 : unread, lastMessageAt: ev.message.sentAt };
        return [next, ...cur.filter((c) => c.conversationId !== ev.conversationId)];
      });
    },
    [businessId, loadList],
  );

  useEffect(() => {
    const stop = websocketService.subscribeToMessages(businessId, onPush, (up) => {
      setLive(up);
      if (up) {
        void loadList(); // catch up on anything sent while the socket was down
        if (selectedRef.current) void loadThread(selectedRef.current);
      }
    });
    return () => {
      stop();
      setLive(false);
    };
  }, [businessId, onPush, loadList, loadThread]);

  useEffect(() => {
    void loadList();
    if (live) return;
    const timer = window.setInterval(() => void loadList(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadList, live]);

  useEffect(() => {
    if (!selected) {
      setThread(null);
      return;
    }
    setThread(null);
    void loadThread(selected);
    if (live) return;
    const timer = window.setInterval(() => void loadThread(selected), POLL_MS);
    return () => window.clearInterval(timer);
  }, [selected, loadThread, live]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.conversationId, thread?.messages.length]);

  const deliver = async (conversationId: string, localId: string, body: string) => {
    const patch = (fn: (m: InboxMessage[]) => InboxMessage[]) =>
      setThread((cur) => (cur && cur.conversationId === conversationId ? { ...cur, messages: fn(cur.messages) } : cur));
    patch((m) => markStatus(m, localId, "sending"));
    try {
      const sent = await messagingService.reply(businessId, conversationId, body);
      patch((m) => resolveSent(m, localId, sent));
      setList((cur) => {
        const row = cur.find((c) => c.conversationId === conversationId);
        return row
          ? [{ ...row, lastMessageAt: sent.sentAt }, ...cur.filter((c) => c.conversationId !== conversationId)]
          : cur;
      });
    } catch (e) {
      patch((m) => markStatus(m, localId, "failed"));
      toast.error(e instanceof Error ? e.message : t("inbox.sendError"));
    }
  };

  const send = () => {
    const body = draft.trim();
    if (!selected || !thread || !body) return;
    const local = localMessage<InboxMessage>(String(++localSeq.current), true, body);
    setThread({ ...thread, messages: [...thread.messages, local] });
    setDraft("");
    void deliver(selected, local.messageId, body);
  };

  const retry = (m: InboxMessage) => {
    if (selected) void deliver(selected, m.messageId, m.body);
  };

  const report = async () => {
    if (!selected) return;
    try {
      await messagingService.report(businessId, selected, reportText.trim());
      toast.success(t("inbox.reportSent"));
      setReporting(false);
      setReportText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inbox.reportError"));
    }
  };

  return (
    <AppLayout>
      <BooqiScope>
        <div className={pageBody}>
          <PageHeader title={t("inbox.title")} subtitle={t("inbox.subtitle")} />

          <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="overflow-hidden">
              {loaded && list.length === 0 ? (
                <p className="m-3 rounded-2xl bg-muted p-6 text-center text-sm text-muted-foreground">{t("inbox.empty")}</p>
              ) : null}
              <ul className="divide-y">
                {list.map((c) => (
                  <li key={c.conversationId}>
                    <button
                      type="button"
                      onClick={() => setSelected(c.conversationId)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-muted/50",
                        selected === c.conversationId && "bg-[rgb(var(--reg-brand-soft))]",
                      )}
                    >
                      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-guava text-sm font-bold text-white">
                        {(c.customerName || c.customerEmail || "?").trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate", c.unread > 0 ? "font-bold" : "font-medium")}>{c.customerName || c.customerEmail}</span>
                        <span className="block text-xs text-muted-foreground">{when(c.lastMessageAt)}</span>
                      </span>
                      {c.unread > 0 ? (
                        <span
                          className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
                          aria-label={t("inbox.unread", { count: c.unread })}
                        >
                          {c.unread}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-4 p-4">
                {!selected || !thread ? (
                  <p className="mx-auto my-8 max-w-sm rounded-2xl bg-muted px-6 py-12 text-center text-sm text-muted-foreground">{t("inbox.selectPrompt")}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{thread.customerName || thread.customerEmail}</div>
                        <div className="truncate text-xs text-muted-foreground">{thread.customerEmail}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/clients">{t("inbox.openClients")}</Link>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setReporting((v) => !v)}>
                          {t("inbox.report")}
                        </Button>
                      </div>
                    </div>

                    {reporting ? (
                      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-3">
                        <Textarea
                          value={reportText}
                          maxLength={500}
                          rows={2}
                          placeholder={t("inbox.reportPlaceholder")}
                          onChange={(e) => setReportText(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setReporting(false)}>
                            {t("inbox.reportCancel")}
                          </Button>
                          <Button size="sm" onClick={() => void report()}>
                            {t("inbox.reportSend")}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div ref={scrollRef} className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
                      {thread.messages.map((m) => (
                        <div
                          key={m.messageId}
                          className={cn(
                            "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
                            m.fromSalon ? "ml-auto rounded-br-md bg-gradient-to-br from-primary to-[#5b3fd6] text-primary-foreground" : "rounded-bl-md bg-muted",
                            m.status === "sending" && "opacity-70",
                            m.status === "failed" && "ring-2 ring-destructive",
                          )}
                        >
                          <div className="mb-0.5 text-[11px] opacity-70">
                            {m.fromSalon ? t("inbox.you") : thread.customerName || t("inbox.client")}
                          </div>
                          {m.body}
                          <div className="mt-1 flex items-center gap-2 text-[11px] opacity-70">
                            {m.status === "failed" ? (
                              <>
                                <span>{t("inbox.failed")}</span>
                                <button type="button" className="underline" onClick={() => retry(m)}>
                                  {t("inbox.retry")}
                                </button>
                              </>
                            ) : (
                              when(m.sentAt)
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <form
                      className="flex flex-col gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        send();
                      }}
                    >
                      <Textarea
                        value={draft}
                        maxLength={MAX_BODY}
                        rows={3}
                        placeholder={t("inbox.placeholder")}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {t("inbox.charCount", { count: draft.length, max: MAX_BODY })}
                        </span>
                        <Button type="submit" className={primaryBtn} disabled={!draft.trim()}>
                          {t("inbox.send")}
                        </Button>
                      </div>
                    </form>
                    <p className="text-xs text-muted-foreground">{t("inbox.blockHint")}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
