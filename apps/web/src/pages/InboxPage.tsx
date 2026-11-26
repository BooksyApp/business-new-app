import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { MessageSquare, Send, Users } from "lucide-react";
import { pageBody } from "@/components/page/booqiStyles";
import { Btn, BzScope, Dialog, EmptyState, Field, PageHead } from "@/components/bz";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentBusinessId } from "@/config/api";
import { format } from "@/i18n/dateFns";
import { t } from "@/i18n";
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

  const initials = (name: string) => (name || "?").trim().slice(0, 2).toUpperCase();
  const convName = (c: { customerName?: string | null; customerEmail?: string | null }) => c.customerName || c.customerEmail || "";

  return (
    <AppLayout>
      <BzScope>
        <div className={pageBody}>
          <PageHead title={t("inbox.title")} sub={t("inbox.subtitle")} />

          <div className="a-two">
            <div className="l" style={{ width: 420 }}>
              {loaded && list.length === 0 ? (
                <EmptyState icon={<MessageSquare className="ic" />} title={t("inbox.empty")} />
              ) : (
                <div className="a-lst">
                  {list.map((c) => (
                    <div
                      key={c.conversationId}
                      className={selected === c.conversationId ? "on" : undefined}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(c.conversationId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelected(c.conversationId);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <span className="a-av">{initials(convName(c))}</span>
                      <div>
                        <b style={{ fontWeight: c.unread > 0 ? 800 : 600 }}>{convName(c)}</b>
                        {c.customerName && c.customerEmail ? <div className="sub">{c.customerEmail}</div> : null}
                      </div>
                      <span className="r">
                        {c.unread > 0 ? <span className="pill" aria-label={t("inbox.unread", { count: c.unread })}>{c.unread}</span> : null}
                        <div className="sub">{when(c.lastMessageAt)}</div>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="r">
              {!selected || !thread ? (
                <div className="a-card" style={{ flex: 1, justifyContent: "center" }}>
                  <EmptyState icon={<MessageSquare className="ic" />} title={t("inbox.selectPrompt")} />
                </div>
              ) : (
                <div className="a-card" style={{ flex: 1 }}>
                  <div className="row sp">
                    <div className="row gap12">
                      <span className="a-av">{initials(convName(thread))}</span>
                      <div style={{ minWidth: 0 }}>
                        <b style={{ fontSize: 18 }}>{thread.customerName || thread.customerEmail}</b>
                        {thread.customerName ? <div className="a-note">{thread.customerEmail}</div> : null}
                      </div>
                    </div>
                    <div className="a-chips">
                      <Link to="/clients" className="btn btn-ol s" style={{ height: 40 }}>
                        <Users className="ic" />
                        {t("inbox.openClients")}
                      </Link>
                      <Btn kind="dg" style={{ height: 40 }} onClick={() => setReporting((v) => !v)}>
                        {t("inbox.report")}
                      </Btn>
                    </div>
                  </div>

                  <div ref={scrollRef} style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, maxHeight: "55vh", overflowY: "auto" }}>
                    {thread.messages.map((m) => (
                      <div
                        key={m.messageId}
                        className={`a-msg${m.fromSalon ? " me" : ""}${m.status === "failed" ? " fail" : ""}`}
                        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", opacity: m.status === "sending" ? 0.7 : undefined }}
                      >
                        <small>
                          {m.fromSalon ? t("inbox.you") : thread.customerName || t("inbox.client")} {"\u00b7 "}
                          {m.status === "failed" ? t("inbox.failed") : when(m.sentAt)}
                        </small>
                        {m.body}
                        {m.status === "failed" ? (
                          <>
                            <br />
                            <b style={{ textDecoration: "underline", cursor: "pointer" }} role="button" tabIndex={0} onClick={() => retry(m)}>
                              {t("inbox.retry")}
                            </b>
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <form
                    className="a-card"
                    style={{ padding: "12px 16px" }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      send();
                    }}
                  >
                    <Field label={t("inbox.placeholder")} kind="ta" focused>
                      <Textarea value={draft} maxLength={MAX_BODY} rows={3} placeholder={t("inbox.placeholder")} onChange={(e) => setDraft(e.target.value)} />
                    </Field>
                    <div className="row sp">
                      <span className="a-note">{t("inbox.charCount", { count: draft.length, max: MAX_BODY })}</span>
                      <Btn kind="v" type="submit" disabled={!draft.trim()} icon={<Send className="ic" />}>
                        {t("inbox.send")}
                      </Btn>
                    </div>
                  </form>
                  <div className="a-note">{t("inbox.blockHint")}</div>
                </div>
              )}
            </div>
          </div>

          {reporting && selected && thread ? (
            <Dialog
              title={t("inbox.report")}
              onClose={() => setReporting(false)}
              width={560}
              footer={
                <>
                  <Btn kind="ol" onClick={() => setReporting(false)}>{t("inbox.reportCancel")}</Btn>
                  <Btn kind="v" onClick={() => void report()}>{t("inbox.reportSend")}</Btn>
                </>
              }
            >
              <Field label={t("inbox.reportPlaceholder")} kind="ta">
                <Textarea value={reportText} maxLength={500} rows={3} placeholder={t("inbox.reportPlaceholder")} onChange={(e) => setReportText(e.target.value)} />
              </Field>
            </Dialog>
          ) : null}
        </div>
      </BzScope>
    </AppLayout>
  );
}
