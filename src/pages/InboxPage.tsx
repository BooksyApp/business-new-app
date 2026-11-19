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
import { messagingService, type InboxSummary, type InboxThread } from "@/services/messagingService";

/** Refresh interval for the inbox and the open thread. Polling, not a socket, on purpose. */
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
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportText, setReportText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

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
          setThread(th);
          void loadList();
        })
        .catch(() => undefined),
    [businessId, loadList],
  );

  useEffect(() => {
    void loadList();
    const timer = window.setInterval(() => void loadList(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadList]);

  useEffect(() => {
    if (!selected) {
      setThread(null);
      return;
    }
    void loadThread(selected);
    const timer = window.setInterval(() => void loadThread(selected), POLL_MS);
    return () => window.clearInterval(timer);
  }, [selected, loadThread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!selected || !body || sending) return;
    setSending(true);
    try {
      await messagingService.reply(businessId, selected, body);
      setDraft("");
      await loadThread(selected);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inbox.sendError"));
    } finally {
      setSending(false);
    }
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
                <p className="p-4 text-sm text-muted-foreground">{t("inbox.empty")}</p>
              ) : null}
              <ul className="divide-y">
                {list.map((c) => (
                  <li key={c.conversationId}>
                    <button
                      type="button"
                      onClick={() => setSelected(c.conversationId)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50",
                        selected === c.conversationId && "bg-muted",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.customerName || c.customerEmail}</span>
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
                  <p className="py-12 text-center text-sm text-muted-foreground">{t("inbox.selectPrompt")}</p>
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
                      <div className="flex flex-col gap-2 rounded-lg border p-3">
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

                    <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
                      {thread.messages.map((m) => (
                        <div
                          key={m.messageId}
                          className={cn(
                            "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                            m.fromSalon ? "ml-auto bg-primary text-primary-foreground" : "bg-muted",
                          )}
                        >
                          <div className="mb-0.5 text-[11px] opacity-70">
                            {m.fromSalon ? t("inbox.you") : thread.customerName || t("inbox.client")}
                          </div>
                          {m.body}
                          <div className="mt-1 text-[11px] opacity-70">{when(m.sentAt)}</div>
                        </div>
                      ))}
                      <div ref={endRef} />
                    </div>

                    <form
                      className="flex flex-col gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void send();
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
                        <Button type="submit" className={primaryBtn} disabled={sending || !draft.trim()}>
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
