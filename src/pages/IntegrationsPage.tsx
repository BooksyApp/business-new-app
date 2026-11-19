import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Copy, KeyRound, Plus, Send, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { myAccess } from "@/components/layout/navigation";
import { BooqiScope, EmptyState, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
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
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { fmtDate, t, tDynamic } from "@/i18n";
import { CalendarTab, DomainTab, FeedsTab, MarketplaceTab, SocialTab, TrackingTab, type IntegrationTab } from "@/pages/integrations/MarketplaceTabs";
import { integrationService, type ApiKeyRow, type WebhookDelivery, type WebhookRow } from "@/services/integrationService";

const card = "rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]";
const chip = (on: boolean) =>
  `inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition ${
    on ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))] ring-[rgb(var(--reg-brand)/0.4)]" : "bg-white text-[rgb(var(--reg-muted))] ring-[rgb(var(--reg-line))]"
  }`;
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
    <div role="alert" className="space-y-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="font-bold">{title}</p>
      <p className="text-sm">{hint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-amber-200">{secret}</code>
        <Button className={secondaryBtn} onClick={() => void copy(secret)}>
          <Copy size={16} /> {t("integrations.copy")}
        </Button>
      </div>
      <Button className={primaryBtn} onClick={onDone}>
        {t("integrations.done")}
      </Button>
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
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--reg-muted))]">{t("integrations.keysIntro")}</p>
      {secret && <SecretBox title={t("integrations.copyNow")} secret={secret} hint={t("integrations.secretOnce")} onDone={() => setSecret(null)} />}

      {open ? (
        <section className={`${card} space-y-4`}>
          <Field label={t("integrations.keyName")} htmlFor="ak-name">
            <input id="ak-name" className={fieldCls} maxLength={120} placeholder={t("integrations.keyNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div>
            <p className="mb-2 text-sm font-semibold">{t("integrations.scopes")}</p>
            <div className="flex flex-wrap gap-2">
              {scopes.map((s) => (
                <button key={s} type="button" className={chip(picked.includes(s))} aria-pressed={picked.includes(s)} onClick={() => setPicked(toggle(picked, s))}>
                  {tDynamic(`integrations.scope.${s}`, s)}
                  <code className="text-xs opacity-70">{s}</code>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button className={primaryBtn} disabled={busy || !name.trim() || picked.length === 0} onClick={() => void create()}>
              {t("integrations.create")}
            </Button>
            <Button className={secondaryBtn} onClick={() => setOpen(false)}>
              {t("integrations.cancel")}
            </Button>
          </div>
        </section>
      ) : (
        <Button className={primaryBtn} onClick={() => setOpen(true)}>
          <Plus size={16} /> {t("integrations.newKey")}
        </Button>
      )}

      {keys.length === 0 ? (
        <EmptyState icon={KeyRound} title={t("integrations.keysEmpty")} />
      ) : (
        <ul className={`${card} divide-y divide-[rgb(var(--reg-line)/0.8)] py-1`}>
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {k.name} {k.revokedAt && <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-800 ring-1 ring-rose-200">{t("integrations.revoked")}</span>}
                </p>
                <p className="text-xs text-[rgb(var(--reg-muted))]">
                  <code>{k.prefix}…</code> · {k.scopes.join(", ")} · {k.lastUsedAt ? t("integrations.lastUsed", { when: when(k.lastUsedAt) }) : t("integrations.neverUsed")}
                </p>
              </div>
              {!k.revokedAt && (
                <Button className={secondaryBtn} onClick={() => setToRevoke(k)}>
                  <Trash2 size={16} /> {t("integrations.revoke")}
                </Button>
              )}
            </li>
          ))}
        </ul>
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
  if (rows.length === 0) return <p className="text-sm text-[rgb(var(--reg-muted))]">{t("integrations.logEmpty")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-[rgb(var(--reg-line)/0.8)]">
              <td className="py-2 pr-3 font-mono text-xs">{d.event}</td>
              <td className="py-2 pr-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${d.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : d.status === "FAILED" ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>
                  {t(`integrations.delivery.${d.status}`)}
                </span>
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
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--reg-muted))]">{t("integrations.hooksIntro")}</p>
      <p className="text-sm text-[rgb(var(--reg-muted))]">{t("marketplace.card.zapier_make.desc")}</p>
      {secret && <SecretBox title={t("integrations.hookSecret")} secret={secret} hint={t("integrations.hookSecretOnce")} onDone={() => setSecret(null)} />}

      {open ? (
        <section className={`${card} space-y-4`}>
          <Field label={t("integrations.hookUrl")} htmlFor="wh-url">
            <input id="wh-url" type="url" className={fieldCls} placeholder="https://example.com/booqi-webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <div>
            <p className="mb-2 text-sm font-semibold">{t("integrations.hookEvents")}</p>
            <div className="flex flex-wrap gap-2">
              {events.map((ev) => (
                <button key={ev} type="button" className={chip(picked.includes(ev))} aria-pressed={picked.includes(ev)} onClick={() => setPicked(toggle(picked, ev))}>
                  {tDynamic(`integrations.event.${ev}`, ev)}
                  <code className="text-xs opacity-70">{ev}</code>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button className={primaryBtn} disabled={busy || !url.trim() || picked.length === 0} onClick={() => void create()}>
              {t("integrations.create")}
            </Button>
            <Button className={secondaryBtn} onClick={() => setOpen(false)}>
              {t("integrations.cancel")}
            </Button>
          </div>
        </section>
      ) : (
        <Button className={primaryBtn} onClick={() => setOpen(true)}>
          <Plus size={16} /> {t("integrations.newHook")}
        </Button>
      )}

      {hooks.length === 0 ? (
        <EmptyState icon={Webhook} title={t("integrations.hooksEmpty")} />
      ) : (
        <ul className="space-y-3">
          {hooks.map((h) => (
            <li key={h.id} className={`${card} space-y-3`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all font-semibold">{h.url}</p>
                  <p className="text-xs text-[rgb(var(--reg-muted))]">
                    {h.events.join(", ")} · {h.active ? t("integrations.active") : t("integrations.paused")}
                    {h.failedDeliveries > 0 && <span className="text-rose-700"> · {t("integrations.failedCount", { count: h.failedDeliveries })}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className={secondaryBtn} onClick={() => void act(() => integrationService.testWebhook(businessId, h.id), t("integrations.testQueued"))}>
                    <Send size={16} /> {t("integrations.sendTest")}
                  </Button>
                  <Button className={secondaryBtn} onClick={() => void act(() => integrationService.updateWebhook(businessId, h.id, { events: h.events, active: !h.active }))}>
                    {h.active ? t("integrations.pause") : t("integrations.resume")}
                  </Button>
                  <Button className={secondaryBtn} onClick={() => setLogFor(logFor === h.id ? null : h.id)}>
                    {logFor === h.id ? t("integrations.hideLog") : t("integrations.showLog")}
                  </Button>
                  <Button className={secondaryBtn} onClick={() => setToDelete(h)} aria-label={t("integrations.delete")}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              {logFor === h.id && <DeliveryLog businessId={businessId} hookId={h.id} />}
            </li>
          ))}
        </ul>
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

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("marketplace.title")}
          subtitle={t("marketplace.subtitle")}
          actions={
            isOwner ? (
              <Link to={`/${salonKey ?? ""}/api-docs`} className={`${secondaryBtn} inline-flex items-center`}>
                <BookOpen size={16} /> {t("integrations.docsLink")}
              </Link>
            ) : undefined
          }
        />
        <div className={pageBody}>
          {!isOwner || !businessId ? (
            <EmptyState icon={KeyRound} title={t("integrations.ownerOnly")} />
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as IntegrationTab)}>
              <TabsList>
                <TabsTrigger value="market">{t("marketplace.tabMarketplace")}</TabsTrigger>
                <TabsTrigger value="keys">{t("integrations.tabKeys")}</TabsTrigger>
                <TabsTrigger value="hooks">{t("integrations.tabHooks")}</TabsTrigger>
                <TabsTrigger value="feeds">{t("marketplace.tabFeeds")}</TabsTrigger>
                <TabsTrigger value="calendar">{t("marketplace.tabCalendar")}</TabsTrigger>
                <TabsTrigger value="tracking">{t("marketplace.tabTracking")}</TabsTrigger>
                <TabsTrigger value="social">{t("marketplace.tabSocial")}</TabsTrigger>
                <TabsTrigger value="domain">{t("marketplace.tabDomain")}</TabsTrigger>
              </TabsList>
              <TabsContent value="market">
                <MarketplaceTab businessId={businessId} onOpen={setTab} />
              </TabsContent>
              <TabsContent value="keys">
                <KeysTab businessId={businessId} />
              </TabsContent>
              <TabsContent value="hooks">
                <HooksTab businessId={businessId} />
              </TabsContent>
              <TabsContent value="feeds">
                <FeedsTab onOpen={setTab} />
              </TabsContent>
              <TabsContent value="calendar">
                <CalendarTab businessId={businessId} />
              </TabsContent>
              <TabsContent value="tracking">
                <TrackingTab businessId={businessId} />
              </TabsContent>
              <TabsContent value="social">
                <SocialTab businessId={businessId} />
              </TabsContent>
              <TabsContent value="domain">
                <DomainTab businessId={businessId} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
