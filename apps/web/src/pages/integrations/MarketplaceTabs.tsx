import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  Copy,
  Globe,
  Instagram,
  KeyRound,
  LineChart,
  Plug,
  RefreshCw,
  Webhook,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/page/booqi";
import { primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { publicSiteUrl, salonShareUrl } from "@/config/api";
import { fmtDate, t, tDynamic } from "@/i18n";
import { businessService } from "@/services/businessService";
import { calendarFeedService } from "@/services/calendarFeedService";
import { integrationService, type DomainView, type MarketplaceCard, type TrackingIds } from "@/services/integrationService";
import { staffService, type Staff } from "@/services/staffService";

const card = "rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]";
const pre = "overflow-x-auto rounded-xl bg-[rgb(var(--reg-ink))] p-4 text-xs leading-relaxed text-white";
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    /* the text is on screen: the owner can select it */
  }
}

export type IntegrationTab = "market" | "keys" | "hooks" | "feeds" | "calendar" | "tracking" | "social" | "domain";

const ICONS: Record<string, React.ElementType> = {
  google_calendar: CalendarDays,
  apple_calendar: CalendarDays,
  webhooks: Webhook,
  zapier_make: Zap,
  api_keys: KeyRound,
  data_feeds: BarChart3,
  tracking: LineChart,
  social_book: Instagram,
  custom_domain: Globe,
};

const TARGET: Record<string, IntegrationTab> = {
  google_calendar: "calendar",
  apple_calendar: "calendar",
  webhooks: "hooks",
  zapier_make: "hooks",
  api_keys: "keys",
  data_feeds: "feeds",
  tracking: "tracking",
  social_book: "social",
  custom_domain: "domain",
};

/** The marketplace: one card per integration with its state; a card opens the screen that manages it. */
export function MarketplaceTab({ businessId, onOpen }: { businessId: string; onOpen: (tab: IntegrationTab) => void }) {
  const [cards, setCards] = useState<MarketplaceCard[] | null>(null);
  const [domain, setDomain] = useState<DomainView | null>(null);

  useEffect(() => {
    let live = true;
    integrationService.catalog(businessId).then((r) => live && setCards(r.integrations)).catch(() => {
      if (live) {
        setCards([]);
        toast.error(t("integrations.loadFailed"));
      }
    });
    integrationService.getDomain(businessId).then((d) => live && setDomain(d)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [businessId]);

  if (cards === null) return null;
  const all: MarketplaceCard[] = [
    ...cards,
    { key: "custom_domain", category: "branding", enabled: true, connected: domain?.status === "VERIFIED", count: domain?.domain ? 1 : 0 },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--reg-muted))]">{t("marketplace.intro")}</p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {all.map((c) => {
          const Icon = ICONS[c.key] ?? Plug;
          const off = !c.enabled;
          const paid = c.key === "custom_domain" && domain && !domain.available;
          return (
            <li key={c.key} className={`${card} flex flex-col gap-3 ${off ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--reg-brand)/0.1)] text-[rgb(var(--reg-brand-strong))]">
                  <Icon size={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold">{tDynamic(`marketplace.card.${c.key}.title`, c.key)}</h3>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${
                      off
                        ? "bg-zinc-100 text-zinc-700 ring-zinc-200"
                        : c.connected
                          ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                          : "bg-white text-[rgb(var(--reg-muted))] ring-[rgb(var(--reg-line))]"
                    }`}
                  >
                    {off ? t("marketplace.switchedOff") : c.connected ? t("marketplace.connected") : paid ? t("marketplace.paidPlan") : t("marketplace.notConnected")}
                  </span>
                </div>
              </div>
              <p className="flex-1 text-sm text-[rgb(var(--reg-muted))]">{tDynamic(`marketplace.card.${c.key}.desc`, "")}</p>
              {c.count > 0 && !off && <p className="text-xs text-[rgb(var(--reg-muted))]">{t("marketplace.usedBy", { count: c.count })}</p>}
              <Button className={c.connected ? secondaryBtn : primaryBtn} disabled={off} onClick={() => onOpen(TARGET[c.key] ?? "market")}>
                {c.connected ? t("marketplace.manage") : t("marketplace.setUp")}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Per-person private calendar links (Google and Apple Calendar subscribe to the same one). */
export function CalendarTab({ businessId }: { businessId: string }) {
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [paths, setPaths] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    staffService.getStaffByBusiness(businessId).then((s) => live && setStaff(s)).catch(() => {
      if (live) setStaff([]);
    });
    return () => {
      live = false;
    };
  }, [businessId]);

  const show = async (id: string, renew: boolean) => {
    setBusy(id);
    try {
      const p = renew ? await calendarFeedService.regenerateFeedPath(id) : await calendarFeedService.getFeedPath(id);
      setPaths((m) => ({ ...m, [id]: p }));
      if (renew) toast.success(t("marketplace.calendar.regenerated"));
    } catch {
      toast.error(t("marketplace.calendar.failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--reg-muted))]">{t("marketplace.calendar.intro")}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <h3 className="font-bold">{t("marketplace.calendar.googleTitle")}</h3>
          <p className="mt-1 text-sm">{t("marketplace.calendar.googleSteps")}</p>
        </section>
        <section className={card}>
          <h3 className="font-bold">{t("marketplace.calendar.appleTitle")}</h3>
          <p className="mt-1 text-sm">{t("marketplace.calendar.appleSteps")}</p>
        </section>
      </div>
      {staff === null ? null : staff.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t("marketplace.calendar.noTeam")} />
      ) : (
        <ul className={`${card} divide-y divide-[rgb(var(--reg-line)/0.8)] py-1`}>
          {staff.map((s) => {
            const url = paths[s.id] ? `${window.location.origin}${paths[s.id]}` : "";
            return (
              <li key={s.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{s.name}</p>
                  {!url && (
                    <Button className={secondaryBtn} disabled={busy === s.id} onClick={() => void show(s.id, false)}>
                      {t("marketplace.calendar.getLink")}
                    </Button>
                  )}
                </div>
                {url && (
                  <div className="flex flex-wrap gap-2">
                    <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={`${fieldCls} min-w-0 flex-1 text-xs`} />
                    <Button className={secondaryBtn} onClick={() => void copyText(url, t("marketplace.calendar.copied"))}>
                      <Copy size={16} /> {t("marketplace.calendar.copy")}
                    </Button>
                    <Button className={secondaryBtn} disabled={busy === s.id} onClick={() => void show(s.id, true)}>
                      <RefreshCw size={16} /> {t("marketplace.calendar.regenerate")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The salon's own Meta Pixel / Google Analytics ids (the public page asks visitors for cookie consent first). */
export function TrackingTab({ businessId }: { businessId: string }) {
  const [ids, setIds] = useState<TrackingIds | null>(null);
  const [pixel, setPixel] = useState("");
  const [ga, setGa] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    integrationService.catalog(businessId).then((r) => {
      if (!live) return;
      setIds(r.tracking);
      setPixel(r.tracking.metaPixelId ?? "");
      setGa(r.tracking.gaMeasurementId ?? "");
    }).catch(() => live && setIds({ metaPixelId: null, gaMeasurementId: null }));
    return () => {
      live = false;
    };
  }, [businessId]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await integrationService.saveTracking(businessId, { metaPixelId: pixel.trim(), gaMeasurementId: ga.trim() });
      setIds(r);
      toast.success(t("marketplace.tracking.saved"));
    } catch (e) {
      toast.error(errText(e, t("marketplace.tracking.failed")));
    } finally {
      setBusy(false);
    }
  };

  if (ids === null) return null;
  return (
    <section className={`${card} max-w-xl space-y-4`}>
      <p className="text-sm text-[rgb(var(--reg-muted))]">{t("marketplace.tracking.intro")}</p>
      <Field label={t("marketplace.tracking.pixel")} htmlFor="trk-pixel" hint={t("marketplace.tracking.pixelHint")}>
        <input id="trk-pixel" className={fieldCls} inputMode="numeric" maxLength={20} value={pixel} onChange={(e) => setPixel(e.target.value)} />
      </Field>
      <Field label={t("marketplace.tracking.ga")} htmlFor="trk-ga" hint={t("marketplace.tracking.gaHint")}>
        <input id="trk-ga" className={fieldCls} maxLength={24} placeholder="G-XXXXXXXXXX" value={ga} onChange={(e) => setGa(e.target.value)} />
      </Field>
      <p className="text-xs text-[rgb(var(--reg-muted))]">{t("marketplace.tracking.clear")}</p>
      <Button className={primaryBtn} disabled={busy} onClick={() => void save()}>
        {t("marketplace.tracking.save")}
      </Button>
    </section>
  );
}

/** Tagged links for the Instagram / Facebook "Book" button and the salon's own site. */
export function SocialTab({ businessId }: { businessId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    businessService.getBusiness(businessId).then((b) => {
      if (live) setUrl(b?.id ? `${publicSiteUrl()}/salon/${b.slug ?? b.id}` : "");
    }).catch(() => live && setUrl(""));
    return () => {
      live = false;
    };
  }, [businessId]);

  if (url === null) return null;
  if (!url) return <EmptyState icon={Instagram} title={t("marketplace.social.noSalon")} />;
  const rows: [string, string][] = [
    [t("marketplace.social.instagram"), salonShareUrl(url, "instagram")],
    [t("marketplace.social.facebook"), salonShareUrl(url, "facebook")],
    [t("marketplace.social.website"), salonShareUrl(url, "link")],
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--reg-muted))]">{t("marketplace.social.intro")}</p>
      <ul className={`${card} space-y-4`}>
        {rows.map(([label, link]) => (
          <li key={label} className="space-y-1">
            <p className="text-sm font-semibold">{label}</p>
            <div className="flex flex-wrap gap-2">
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${fieldCls} min-w-0 flex-1 text-xs`} />
              <Button className={secondaryBtn} onClick={() => void copyText(link, t("marketplace.social.copied"))}>
                <Copy size={16} /> {t("marketplace.social.copy")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Own domain: enter it, see the DNS record to create, check it, see the status. */
export function DomainTab({ businessId }: { businessId: string }) {
  const [view, setView] = useState<DomainView | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    integrationService.getDomain(businessId).then((v) => {
      setView(v);
      setInput(v.domain ?? "");
    }).catch(() => toast.error(t("integrations.loadFailed")));
  }, [businessId]);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<DomainView | void>, fail: string) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r) setView(r);
    } catch (e) {
      toast.error(errText(e, fail));
    } finally {
      setBusy(false);
    }
  };

  if (!view) return null;
  if (!view.available) {
    return (
      <section className={`${card} max-w-xl space-y-2`}>
        <h3 className="font-bold">{t("marketplace.domain.planTitle")}</h3>
        <p className="text-sm">{t("marketplace.domain.planBody")}</p>
        <p className="text-sm text-[rgb(var(--reg-muted))]">{t("marketplace.domain.intro")}</p>
      </section>
    );
  }
  const host = view.domain ?? "";
  const labels = host.split(".");
  const recordName = labels.length > 2 ? labels[0] : "@";
  const status = view.status;
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-[rgb(var(--reg-muted))]">{t("marketplace.domain.intro")}</p>
      <section className={`${card} space-y-3`}>
        <Field label={t("marketplace.domain.domainLabel")} htmlFor="wl-domain">
          <input id="wl-domain" className={fieldCls} maxLength={253} placeholder={t("marketplace.domain.domainPlaceholder")} value={input} onChange={(e) => setInput(e.target.value)} />
        </Field>
        <Button
          className={primaryBtn}
          disabled={busy || !input.trim() || input.trim().toLowerCase() === host}
          onClick={() => void run(() => integrationService.setDomain(businessId, input.trim()), t("marketplace.domain.saveFailed"))}
        >
          {t("marketplace.domain.save")}
        </Button>
      </section>

      {host && (
        <section className={`${card} space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">{host}</h3>
            {status && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${
                  status === "VERIFIED" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : status === "FAILED" ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-amber-50 text-amber-900 ring-amber-200"
                }`}
              >
                {t(`marketplace.domain.status.${status}`)}
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold">{t("marketplace.domain.dnsTitle")}</h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-xs font-semibold text-[rgb(var(--reg-muted))]">
                <tr>
                  <th className="py-1 pr-3">{t("marketplace.domain.dnsType")}</th>
                  <th className="py-1 pr-3">{t("marketplace.domain.dnsName")}</th>
                  <th className="py-1">{t("marketplace.domain.dnsValue")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[rgb(var(--reg-line)/0.8)]">
                  <td className="py-2 pr-3 font-mono text-xs font-bold">CNAME</td>
                  <td className="py-2 pr-3 font-mono text-xs">{recordName}</td>
                  <td className="py-2 font-mono text-xs">
                    {view.cnameTarget}{" "}
                    <button type="button" className="ml-1 align-middle" aria-label={t("marketplace.social.copy")} onClick={() => void copyText(view.cnameTarget, t("marketplace.social.copied"))}>
                      <Copy size={14} />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[rgb(var(--reg-muted))]">{t("marketplace.domain.dnsNote")}</p>
          {view.lastError && status !== "VERIFIED" && <p className="text-sm text-rose-800">{view.lastError}</p>}
          {view.lastCheckedAt && (
            <p className="text-xs text-[rgb(var(--reg-muted))]">
              {t("marketplace.domain.lastChecked", { when: fmtDate(view.lastCheckedAt, { dateStyle: "medium", timeStyle: "short" }) })}
            </p>
          )}
          {status === "VERIFIED" && (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Check size={16} className="text-emerald-700" /> {t("marketplace.domain.live")}{" "}
              <a className="font-semibold underline" href={`https://${host}`} target="_blank" rel="noopener noreferrer">
                https://{host}
              </a>
            </p>
          )}
          {status === "VERIFIED" && <p className="text-xs text-[rgb(var(--reg-muted))]">{t("marketplace.domain.secureNote")}</p>}
          <div className="flex flex-wrap gap-2">
            <Button className={primaryBtn} disabled={busy} onClick={() => void run(() => integrationService.verifyDomain(businessId), t("marketplace.domain.saveFailed"))}>
              {busy ? t("marketplace.domain.verifying") : t("marketplace.domain.verify")}
            </Button>
            <Button
              className={secondaryBtn}
              disabled={busy}
              onClick={() => {
                if (!window.confirm(t("marketplace.domain.removeAsk"))) return;
                void run(async () => {
                  await integrationService.removeDomain(businessId);
                  toast.success(t("marketplace.domain.removed"));
                  setInput("");
                  return { ...view, domain: null, status: undefined, lastError: null, lastCheckedAt: null };
                }, t("marketplace.domain.saveFailed"));
              }}
            >
              {t("marketplace.domain.remove")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

const ENTITIES = ["bookings", "clients", "sales", "staff", "services"] as const;

/** Power BI / Google Sheets / CRM how-to for the read-only feeds. */
export function FeedsTab({ onOpen }: { onOpen: (tab: IntegrationTab) => void }) {
  const base = `${window.location.origin}/api/v1/ext/feed`;
  const sheets = `=IMPORTDATA("${base}/bookings.csv?from=2026-11-01&api_key=bqk_YOUR_KEY")`;
  const powerbi = `${base}/sales.csv?updated_since=2026-11-01T00:00:00Z\nAuthorization: Bearer bqk_YOUR_KEY`;
  return (
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--reg-muted))]">{t("marketplace.feeds.intro")}</p>
      <Button className={primaryBtn} onClick={() => onOpen("keys")}>
        <KeyRound size={16} /> {t("marketplace.feeds.createKey")}
      </Button>
      <section className={`${card} space-y-2`}>
        <h3 className="font-bold">{t("marketplace.feeds.baseUrl")}</h3>
        <pre className={pre}>{`${base}/{bookings|clients|sales|staff|services}[.csv|.json]`}</pre>
        <h3 className="pt-2 font-bold">{t("marketplace.feeds.entities")}</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {ENTITIES.map((e) => (
            <li key={e}>
              <code className="text-xs">{e}</code> - {tDynamic(`marketplace.feeds.entity.${e}`, e)}
            </li>
          ))}
        </ul>
        <h3 className="pt-2 font-bold">{t("marketplace.feeds.params")}</h3>
        <p className="text-sm">{t("marketplace.feeds.paramsBody")}</p>
        <h3 className="pt-2 font-bold">{t("marketplace.feeds.incremental")}</h3>
        <p className="text-sm">{t("marketplace.feeds.incrementalBody")}</p>
      </section>
      <section className={`${card} space-y-2`}>
        <h3 className="font-bold">{t("marketplace.feeds.powerbi")}</h3>
        <p className="text-sm">{t("marketplace.feeds.powerbiSteps")}</p>
        <pre className={pre}>{powerbi}</pre>
      </section>
      <section className={`${card} space-y-2`}>
        <h3 className="font-bold">{t("marketplace.feeds.sheets")}</h3>
        <pre className={pre}>{sheets}</pre>
        <p className="text-sm">{t("marketplace.feeds.sheetsBody")}</p>
      </section>
      <section className={`${card} space-y-2`}>
        <h3 className="font-bold">{t("marketplace.feeds.crm")}</h3>
        <p className="text-sm">{t("marketplace.feeds.crmBody")}</p>
        <Button className={secondaryBtn} onClick={() => onOpen("hooks")}>
          <Webhook size={16} /> {t("integrations.tabHooks")}
        </Button>
      </section>
    </div>
  );
}
