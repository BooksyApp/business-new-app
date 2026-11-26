import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Copy, KeyRound, Plus, Send, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { myAccess } from "@/components/layout/navigation";
import { Btn, Card, Chip, EmptyState, Field, Note, PageHead, RowItem, StatusPill, Tabs } from "@/components/bz";
import { BzPage } from "@/components/bz/p3-Settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBusinessId } from "@/hooks/useBusinessId";
import { fmtDate, t, tDynamic } from "@/i18n";
import { CalendarTab, DomainTab, FeedsTab, MarketplaceTab, SocialTab, TrackingTab, type IntegrationTab } from "@/pages/integrations/MarketplaceTabs";
import { integrationService, type ApiKeyRow, type WebhookDelivery, type WebhookRow } from "@/services/integrationService";

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const when = (iso: string) => fmtDate(iso, { dateStyle: "medium", timeStyle: "short" });
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t("integrations.copied"));
  } catch {
    /* the text is on screen: the owner can select it */
  }
}

/** A secret shown once. */
function SecretBox({ title, secret, hint, onDone }: { title: string; secret: string; hint: string; onDone: () => void }) {
  return (
    <div role="alert" className="stk">
      <Note kind="wa"><b>{title}</b><br />{hint}</Note>
      <div className="cd" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <code style={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}>{secret}</code>
        <Btn kind="soft" icon={<Copy size={16} />} onClick={() => void copy(secret)}>{t("integrations.copy")}</Btn>
      </div>
      <div><Btn kind="v" onClick={onDone}>{t("integrations.done")}</Btn></div>
    </div>
  );
}

function KeysTab({ businessId }: { businessId: string }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [toRevoke, setToRevoke] = useState<ApiKeyRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    integrationService
      .listKeys(businessId)
      .then((r) => {
        setKeys(r.keys);
        setScopes(r.scopes);
      })
      .catch(() => toast.error(t("integrations.loadFailed")));
  }, [businessId]);
  useEffect(load, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const r = await integrationService.createKey(businessId, name.trim(), picked);
      setSecret(r.key);
      setOpen(false);
      setName("");
      setPicked([]);
      toast.success(t("integrations.created"));
      load();
    } catch (e) {
      toast.error(errText(e, t("integrations.createFailed")));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (k: ApiKeyRow) => {
    try {
      await integrationService.revokeKey(businessId, k.id);
      toast.success(t("integrations.revokedOk"));
      load();
    } catch (e) {
      toast.error(errText(e, t("integrations.loadFailed")));
    }
  };

  return (
    <div className="stk">
      <span className="hint">{t("integrations.keysIntro")}</span>
      {secret && <SecretBox title={t("integrations.copyNow")} secret={secret} hint={t("integrations.secretOnce")} onDone={() => setSecret(null)} />}

      {open ? (
        <Card>
          <Field label={t("integrations.keyName")}>
            <input id="ak-name" maxLength={120} placeholder={t("integrations.keyNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="lbl2">{t("integrations.scopes")}</div>
          <div className="row gap8" style={{ flexWrap: "wrap" }}>
            {scopes.map((s) => (
              <span key={s} aria-pressed={picked.includes(s)}>
                <Chip on={picked.includes(s)} onClick={() => setPicked(toggle(picked, s))}>
                  {tDynamic(`integrations.scope.${s}`, s)}
                  <code style={{ fontSize: 12, opacity: 0.7 }}>{s}</code>
                </Chip>
              </span>
            ))}
          </div>
          <div className="row gap8">
            <Btn kind="v" disabled={busy || !name.trim() || picked.length === 0} onClick={() => void create()}>{t("integrations.create")}</Btn>
            <Btn kind="ol" onClick={() => setOpen(false)}>{t("integrations.cancel")}</Btn>
          </div>
        </Card>
      ) : (
        <div><Btn kind="v" icon={<Plus size={16} />} onClick={() => setOpen(true)}>{t("integrations.newKey")}</Btn></div>
      )}

      {keys.length === 0 ? (
        <EmptyState icon={<KeyRound />} title={t("integrations.keysEmpty")} />
      ) : (
        <div className="stk">
          {keys.map((k) => (
            <RowItem
              key={k.id}
              title={<>{k.name} {k.revokedAt && <StatusPill kind="x">{t("integrations.revoked")}</StatusPill>}</>}
              sub={<><code>{k.prefix}…</code> · {k.scopes.join(", ")} · {k.lastUsedAt ? t("integrations.lastUsed", { when: when(k.lastUsedAt) }) : t("integrations.neverUsed")}</>}
              right={!k.revokedAt ? <Btn kind="dg" icon={<Trash2 size={16} />} onClick={() => setToRevoke(k)}>{t("integrations.revoke")}</Btn> : undefined}
            />
          ))}
        </div>
      )}

      <AlertDialog open={toRevoke !== null} onOpenChange={(o) => { if (!o) setToRevoke(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toRevoke?.name}</AlertDialogTitle>
            <AlertDialogDescription>{t("integrations.revokeAsk")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("integrations.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (toRevoke) void revoke(toRevoke); setToRevoke(null); }}>
              {t("integrations.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeliveryLog({ businessId, hookId }: { businessId: string; hookId: string }) {
  const [rows, setRows] = useState<WebhookDelivery[] | null>(null);
  useEffect(() => {
    let live = true;
    integrationService.deliveries(businessId, hookId).then((r) => live && setRows(r)).catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [businessId, hookId]);
  if (rows === null) return null;
  if (rows.length === 0) return <span className="hint">{t("integrations.logEmpty")}</span>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-[rgb(var(--reg-line)/0.8)]">
              <td className="py-2 pr-3 font-mono text-xs">{d.event}</td>
              <td className="py-2 pr-3">
                <StatusPill kind={d.status === "SUCCESS" ? "c" : d.status === "FAILED" ? "x" : "w"}>
                  {t(`integrations.delivery.${d.status}`)}
                </StatusPill>
              </td>
              <td className="py-2 pr-3 text-xs">{d.statusCode ?? ""} {d.error ?? ""}</td>
              <td className="py-2 pr-3 text-xs">{t("integrations.attempts", { count: d.attempts })}</td>
              <td className="py-2 text-xs text-[rgb(var(--reg-muted))]">{when(d.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HooksTab({ businessId }: { businessId: string }) {
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<WebhookRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    integrationService
      .listWebhooks(businessId)
      .then((r) => {
        setHooks(r.webhooks);
        setEvents(r.events);
      })
      .catch(() => toast.error(t("integrations.loadFailed")));
  }, [businessId]);
  useEffect(load, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const r = await integrationService.createWebhook(businessId, url.trim(), picked);
      setSecret(r.secret);
      setOpen(false);
      setUrl("");
      setPicked([]);
      toast.success(t("integrations.created"));
      load();
    } catch (e) {
      toast.error(errText(e, t("integrations.createFailed")));
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<void>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      load();
    } catch (e) {
      toast.error(errText(e, t("integrations.loadFailed")));
    }
  };

  return (
    <div className="stk">
      <span className="hint">{t("integrations.hooksIntro")}</span>
      <span className="hint">{t("marketplace.card.zapier_make.desc")}</span>
      {secret && <SecretBox title={t("integrations.hookSecret")} secret={secret} hint={t("integrations.hookSecretOnce")} onDone={() => setSecret(null)} />}

      {open ? (
        <Card>
          <Field label={t("integrations.hookUrl")}>
            <input id="wh-url" type="url" placeholder="https://example.com/booqi-webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <div className="lbl2">{t("integrations.hookEvents")}</div>
          <div className="row gap8" style={{ flexWrap: "wrap" }}>
            {events.map((ev) => (
              <span key={ev} aria-pressed={picked.includes(ev)}>
                <Chip on={picked.includes(ev)} onClick={() => setPicked(toggle(picked, ev))}>
                  {tDynamic(`integrations.event.${ev}`, ev)}
                  <code style={{ fontSize: 12, opacity: 0.7 }}>{ev}</code>
                </Chip>
              </span>
            ))}
          </div>
          <div className="row gap8">
            <Btn kind="v" disabled={busy || !url.trim() || picked.length === 0} onClick={() => void create()}>{t("integrations.create")}</Btn>
            <Btn kind="ol" onClick={() => setOpen(false)}>{t("integrations.cancel")}</Btn>
          </div>
        </Card>
      ) : (
        <div><Btn kind="v" icon={<Plus size={16} />} onClick={() => setOpen(true)}>{t("integrations.newHook")}</Btn></div>
      )}

      {hooks.length === 0 ? (
        <EmptyState icon={<Webhook />} title={t("integrations.hooksEmpty")} />
      ) : (
        <div className="stk">
          {hooks.map((h) => (
            <Card key={h.id}>
              <div className="row sp" style={{ flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <b style={{ wordBreak: "break-all" }}>{h.url}</b>
                  <div className="hint">
                    {h.events.join(", ")} · {h.active ? t("integrations.active") : t("integrations.paused")}
                    {h.failedDeliveries > 0 && <span style={{ color: "var(--bz-gink)" }}> · {t("integrations.failedCount", { count: h.failedDeliveries })}</span>}
                  </div>
                </div>
                <div className="row gap8" style={{ flexWrap: "wrap" }}>
                  <Btn kind="ol" icon={<Send size={16} />} onClick={() => void act(() => integrationService.testWebhook(businessId, h.id), t("integrations.testQueued"))}>{t("integrations.sendTest")}</Btn>
                  <Btn kind="ol" onClick={() => void act(() => integrationService.updateWebhook(businessId, h.id, { events: h.events, active: !h.active }))}>
                    {h.active ? t("integrations.pause") : t("integrations.resume")}
                  </Btn>
                  <Btn kind="ol" onClick={() => setLogFor(logFor === h.id ? null : h.id)}>
                    {logFor === h.id ? t("integrations.hideLog") : t("integrations.showLog")}
                  </Btn>
                  <Btn kind="dg" onClick={() => setToDelete(h)} aria-label={t("integrations.delete")} icon={<Trash2 size={16} />} />
                </div>
              </div>
              {logFor === h.id && <DeliveryLog businessId={businessId} hookId={h.id} />}
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-all">{toDelete?.url}</AlertDialogTitle>
            <AlertDialogDescription>{t("integrations.deleteHookAsk")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("integrations.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (toDelete) void act(() => integrationService.deleteWebhook(businessId, toDelete.id)); setToDelete(null); }}>
              {t("integrations.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Settings > Integrations (owner only): API keys, webhooks and their delivery log. */
export default function IntegrationsPage() {
  const businessId = useBusinessId();
  const { salonKey } = useParams<{ salonKey?: string }>();
  const isOwner = myAccess().isOwner;
  const [tab, setTab] = useState<IntegrationTab>("market");

  const tabItems: Array<{ key: IntegrationTab; label: string }> = [
    { key: "market", label: t("marketplace.tabMarketplace") },
    { key: "keys", label: t("integrations.tabKeys") },
    { key: "hooks", label: t("integrations.tabHooks") },
    { key: "feeds", label: t("marketplace.tabFeeds") },
    { key: "calendar", label: t("marketplace.tabCalendar") },
    { key: "tracking", label: t("marketplace.tabTracking") },
    { key: "social", label: t("marketplace.tabSocial") },
    { key: "domain", label: t("marketplace.tabDomain") },
  ];

  return (
    <AppLayout>
      <BzPage>
        <PageHead
          title={t("marketplace.title")}
          sub={t("marketplace.subtitle")}
          right={
            isOwner ? (
              <Link to={`/${salonKey ?? ""}/api-docs`} className="btn btn-ol s" style={{ textDecoration: "none" }}>
                <BookOpen size={16} /> {t("integrations.docsLink")}
              </Link>
            ) : undefined
          }
        />
        {!isOwner || !businessId ? (
          <EmptyState icon={<KeyRound />} title={t("integrations.ownerOnly")} />
        ) : (
          <div className="stk">
            <Tabs items={tabItems} value={tab} onChange={(k) => setTab(k as IntegrationTab)} />
            {tab === "market" && <MarketplaceTab businessId={businessId} onOpen={setTab} />}
            {tab === "keys" && <KeysTab businessId={businessId} />}
            {tab === "hooks" && <HooksTab businessId={businessId} />}
            {tab === "feeds" && <FeedsTab onOpen={setTab} />}
            {tab === "calendar" && <CalendarTab businessId={businessId} />}
            {tab === "tracking" && <TrackingTab businessId={businessId} />}
            {tab === "social" && <SocialTab businessId={businessId} />}
            {tab === "domain" && <DomainTab businessId={businessId} />}
          </div>
        )}
      </BzPage>
    </AppLayout>
  );
}
