import { Skeleton } from "@/components/bz";
import { BooqiScope, EmptyState, FilterChips, PageHeader, StatCard, StatusChip, pageBody } from "@/components/bz/p4-compat";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarRange,
  Copy,
  CopyPlus,
  Gift,
  Mail,
  Megaphone,
  MessageSquare,
  Percent,
  Plus,
  Send,
  Shuffle,
  Ticket,
  Users,
  XCircle,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { FormSheet, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/page/booqi";
import { primaryBtn, secondaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { ActionMenu, ClientPreview, Field, Meter, RowAction, Segmented } from "@/components/page/kit";
import { GUAVA, dateRange, fieldCls, lifecycleOf, money, salonName, type Lifecycle } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentBusinessId } from "@/config/api";
import { currencySymbol, formatPrice } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useServices } from "@/hooks/useServices";
import { useNavigation } from "@/utils/navigationUtils";
import { promoService, type PromoCode } from "@/services/promoService";
import { useFeatureFlags } from "@/services/platformService";
import { clientTagService, type ClientTag } from "@/services/clientTagService";
import { campaignService, type Campaign, type CampaignResults, type AudiencePreview } from "@/services/campaignService";
import { channelMessagingService, type SmsEstimate } from "@/services/channelMessagingService";
import { t as tr, fmtDate as formatLocaleDate, getLocale } from "@/i18n";
import { AutomationCard } from "@/components/page/AutomationCard";
import { LoyaltyTiersCard } from "@/components/page/LoyaltyTiersCard";
import { BookingLinkCard } from "@/components/page/BookingLinkCard";
import { MarketplacePromotionCard } from "@/components/page/MarketplacePromotionCard";
import { CAMPAIGN_TEMPLATES, type CampaignTemplate } from "@/lib/campaignTemplates";

// #46: the campaign list here was hardcoded — invented names, invented open rates,
// invented revenue. Everything on this page comes from the API.

type PromoType = "PERCENT" | "FIXED";
type Channel = "EMAIL" | "SMS";
type BaseSegment = "LAPSED_60D" | "LAPSED_90D" | "TOP_SPENDERS" | "BIRTHDAY_THIS_MONTH" | "ALL_CLIENTS";
// FG-W2-05: "TAG:<tag id>" targets the clients the salon put that tag on.
type Segment = BaseSegment | `TAG:${string}`;

const SEGMENT_LABEL: Record<BaseSegment, string> = {
  get LAPSED_60D() { return tr("marketing.r02SegmentLapsed60"); },
  get LAPSED_90D() { return tr("marketing.segmentLapsed"); },
  get TOP_SPENDERS() { return tr("marketing.segmentTopSpenders"); },
  get BIRTHDAY_THIS_MONTH() { return tr("marketing.segmentBirthdayThisMonth"); },
  get ALL_CLIENTS() { return tr("marketing.segmentAllClients"); },
};

const EMPTY_PROMO = { code: "", type: "PERCENT" as PromoType, value: "", maxUses: "", from: "", to: "" };
const EMPTY_CAMPAIGN = { name: "", channel: "EMAIL" as Channel, segment: "LAPSED_90D" as Segment, subject: "", body: "" };

const promoStatus = (p: PromoCode): Lifecycle =>
  lifecycleOf({ active: p.active, from: p.valid_from, to: p.valid_to, exhausted: p.max_uses != null && p.uses >= p.max_uses });

const campaignStatus = (c: Campaign): Lifecycle =>
  c.status === "DRAFT" ? "draft" : c.status === "QUEUED" ? "queued" : c.status === "FAILED" ? "failed" : c.status === "SENT" ? "active" : "ended";

const campaignLabel = (c: Campaign) => (c.status === "QUEUED" && (c.sentCount ?? 0) > 0 && (c.queuedCount ?? 0) > 0 ? tr("marketing.campaignSending", { sent: c.sentCount, total: c.recipientCount }) : c.status === "SENT" ? tr("marketing.campaignSent") : c.status === "CANCELLED" ? tr("marketing.campaignCancelled") : undefined);

const valueLabel = (type: string, value: number | string) =>
  type === "PERCENT" ? tr("offers.off2", { value: Number(value) || 0 }) : tr("offers.moneyOff", { value: money(value, currencySymbol()) });

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * Campaigns & codes: a code that discounts a bill, and a message sent to a segment of
 * clients. Two jobs, two tabs; the header action follows the tab.
 */
export default function MarketingPage() {
  const [tab, setTab] = useState<"promos" | "campaigns">("promos");
  const flags = useFeatureFlags();
  const navigate = useNavigate();
  const { getPath } = useNavigation();
  const businessId = getCurrentBusinessId();
  const { services } = useServices(businessId);

  // #28: promo codes shipped complete on the backend (V24, PromoController) and were
  // unreachable from the manager app.
  const [promos, setPromos] = useState<PromoCode[] | null>(null);
  const [promoForm, setPromoForm] = useState(EMPTY_PROMO);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoFilter, setPromoFilter] = useState<"all" | Lifecycle>("all");
  const [promoSheetOpen, setPromoSheetOpen] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [campaignResults, setCampaignResults] = useState<Record<string, CampaignResults>>({});
  useEffect(() => {
    if (!businessId || !campaigns) return;
    campaigns.filter((c) => c.status === "SENT").forEach((c) => {
      campaignService.results(businessId, c.id)
        .then((r) => setCampaignResults((prev) => ({ ...prev, [String(c.id)]: r })))
        .catch(() => undefined);
    });
  }, [businessId, campaigns]);
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN);
  const [audience, setAudience] = useState<AudiencePreview | null>(null);
  const [smsEstimate, setSmsEstimate] = useState<SmsEstimate | null>(null);
  const [clientTags, setClientTags] = useState<ClientTag[]>([]);
  const segmentLabel = (seg: string) =>
    seg.startsWith("TAG:")
      ? tr("marketing.segmentTagNamed", { name: clientTags.find((x) => String(x.id) === seg.slice(4))?.name ?? "?" })
      : SEGMENT_LABEL[seg as BaseSegment] ?? seg;
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [campaignSheetOpen, setCampaignSheetOpen] = useState(false);

  const loadCampaigns = useCallback(() => {
    if (!businessId) return;
    campaignService.list(businessId).then((d) => setCampaigns(d || [])).catch(() => setCampaigns([]));
  }, [businessId]);

  const loadPromos = useCallback(() => {
    if (!businessId) return;
    promoService.list(businessId).then((d) => setPromos(d || [])).catch(() => setPromos([]));
  }, [businessId]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);
  useEffect(() => {
    if (!businessId) return;
    clientTagService.tags(businessId).then(setClientTags).catch(() => setClientTags([]));
  }, [businessId]);
  useEffect(() => { loadPromos(); }, [loadPromos]);

  // Recheck the audience whenever the targeting changes, so the size is never stale
  // relative to the segment and channel actually selected.
  useEffect(() => {
    if (!businessId || !campaignSheetOpen) return;
    campaignService
      .preview(businessId, campaignForm.segment, campaignForm.channel)
      .then(setAudience)
      .catch(() => setAudience(null));
  }, [businessId, campaignForm.segment, campaignForm.channel, campaignSheetOpen]);

  // SMS length and cost: segments (GSM-7 vs Unicode), recipients who can be reached, and the balance after.
  const smsReachable = audience?.reachable ?? 0;
  useEffect(() => {
    if (!businessId || !campaignSheetOpen || campaignForm.channel !== "SMS") { setSmsEstimate(null); return; }
    const timer = setTimeout(() => {
      channelMessagingService.estimate(businessId, campaignForm.body, smsReachable).then(setSmsEstimate).catch(() => setSmsEstimate(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [businessId, campaignSheetOpen, campaignForm.channel, campaignForm.body, smsReachable]);

  /* ── promo codes ── */

  const createPromo = async () => {
    const code = promoForm.code.trim().toUpperCase();
    const value = Number(promoForm.value);
    const maxUses = promoForm.maxUses.trim() ? Number(promoForm.maxUses) : undefined;
    if (!code || !promoForm.value.trim() || !Number.isFinite(value) || value < 0) {
      toast.error(tr("marketing.aCodeAndANon"));
      return;
    }
    if (promoForm.type === "PERCENT" && value > 100) {
      toast.error(tr("marketing.aPercentageDiscountCannotExceed"));
      return;
    }
    if (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 1)) {
      toast.error(tr("marketing.theUseLimitMustBe"));
      return;
    }
    if (promoForm.from && promoForm.to && promoForm.to < promoForm.from) {
      toast.error(tr("marketing.theEndDateIsBefore"));
      return;
    }
    setPromoBusy(true);
    try {
      await promoService.create(businessId, {
        code,
        type: promoForm.type,
        value,
        maxUses,
        validFrom: promoForm.from ? `${promoForm.from}T00:00:00` : undefined,
        validTo: promoForm.to ? `${promoForm.to}T23:59:59` : undefined,
        active: true,
      });
      setPromoForm(EMPTY_PROMO);
      setPromoSheetOpen(false);
      loadPromos();
      toast.success(tr("marketing.isLive", { code }));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : tr("marketing.couldNotCreateThePromo"));
    } finally {
      setPromoBusy(false);
    }
  };

  const deactivatePromo = async (p: PromoCode) => {
    if (!confirm(tr("marketing.endClientsWillNotBe", { code: p.code }))) return;
    setPromoBusy(true);
    try {
      await promoService.deactivate(businessId, p.id);
      loadPromos();
      toast.success(`${p.code} ended`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : tr("marketing.couldNotDeactivateThePromo"));
    } finally {
      setPromoBusy(false);
    }
  };

  const duplicatePromo = (p: PromoCode) => {
    setPromoForm({
      code: `${p.code.slice(0, 34)}2`,
      type: (p.type === "FIXED" ? "FIXED" : "PERCENT") as PromoType,
      value: String(p.value),
      maxUses: p.max_uses != null ? String(p.max_uses) : "",
      from: "",
      to: "",
    });
    setPromoSheetOpen(true);
  };

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success(`${text} copied`);
  };

  /* ── campaigns ── */

  const createCampaign = async () => {
    const name = campaignForm.name.trim();
    const body = campaignForm.body.trim();
    if (!name || !body) {
      toast.error(tr("marketing.aNameAndAMessage"));
      return;
    }
    setCampaignBusy(true);
    try {
      await campaignService.create(businessId, {
        name,
        channel: campaignForm.channel,
        segment: campaignForm.segment,
        subject: campaignForm.channel === "EMAIL" ? campaignForm.subject.trim() || undefined : undefined,
        body,
      });
      setCampaignForm(EMPTY_CAMPAIGN);
      setCampaignSheetOpen(false);
      loadCampaigns();
      toast.success(tr("marketing.campaignSavedAsADraft"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : tr("marketing.couldNotCreateTheCampaign"));
    } finally {
      setCampaignBusy(false);
    }
  };

  const queueCampaign = async (c: Campaign) => {
    if (!confirm(tr("marketing.queueTheRecipientListIs", { name: c.name }))) return;
    setCampaignBusy(true);
    try {
      const queued = await campaignService.queue(businessId, c.id);
      loadCampaigns();
      toast.success(tr("marketing.queuedForRecipients", { recipientCount: queued.recipientCount }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : tr("marketing.couldNotQueueTheCampaign"));
    } finally {
      setCampaignBusy(false);
    }
  };

  /** W2-51: fills the form from a template and pre-selects its segment; the text stays editable. */
  const applyCampaignTemplate = (tpl: CampaignTemplate) => {
    const loc = getLocale();
    setCampaignForm((f) => ({ ...f, name: f.name || tpl.name[loc], segment: tpl.segment, subject: tpl.subject[loc], body: tpl.body[loc] }));
  };

  const duplicateCampaign = (c: Campaign) => {
    setCampaignForm({
      name: `${c.name} (copy)`,
      channel: c.channel,
      segment: c.segment,
      subject: c.subject ?? "",
      body: c.body,
    });
    setCampaignSheetOpen(true);
  };

  const openNewCampaign = (channel?: Channel) => {
    if (channel) setCampaignForm((f) => ({ ...f, channel }));
    setTab("campaigns");
    setCampaignSheetOpen(true);
  };

  /* ── numbers ── */

  const promoList = promos ?? [];
  const byStatus: Record<string, number> = {};
  promoList.forEach((p) => { const s = promoStatus(p); byStatus[s] = (byStatus[s] ?? 0) + 1; });
  const shownPromos = promoList
    .filter((p) => promoFilter === "all" || promoStatus(p) === promoFilter)
    .sort((a, b) => order(promoStatus(a)) - order(promoStatus(b)) || b.uses - a.uses);
  const redemptions = promoList.reduce((n, c) => n + (c.uses ?? 0), 0);
  const campaignList = campaigns ?? [];
  const drafts = campaignList.filter((c) => c.status === "DRAFT").length;
  const reached = campaignList.filter((c) => c.status !== "DRAFT").reduce((n, c) => n + (c.recipientCount ?? 0), 0);

  const shortcuts = [
    { key: "EMAIL", title: tr("common.email"), body: tr("marketing.oneMessageToASegment"), icon: Mail, tone: "bg-sky-50 text-sky-700", run: () => openNewCampaign("EMAIL") },
    { key: "SMS", title: "SMS", body: tr("marketing.onlyClientsWhoAgreedTo"), icon: MessageSquare, tone: "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]", run: () => openNewCampaign("SMS") },
    { key: "LOYALTY", title: tr("common.loyalty"), body: tr("marketing.comeNTimesOneFree"), icon: Gift, tone: "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]", flag: "loyalty_cards", run: () => navigate(getPath("/loyalty")) },
    { key: "REFERRAL", title: tr("common.referrals"), body: tr("marketing.clientsBringClients"), icon: Users, tone: "bg-amber-50 text-amber-700", flag: "platform_referral", run: () => navigate(getPath("/referral-program")) },
  ].filter((t) => !t.flag || flags[t.flag] !== false);

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader helpSlug="kampaniya-gondermek"
          title={tr("marketing.campaignsCodes")}
          subtitle={tr("marketing.discountCodesForCheckoutAnd")}
          actions={
            tab === "promos" ? (
              <>
                <Button variant="outline" className={cn(secondaryBtn, "hidden sm:inline-flex")} onClick={() => openNewCampaign()}>
                  <Megaphone size={16} />{" "}{tr("marketing.newCampaign")}
                </Button>
                <Button className={primaryBtn} onClick={() => setPromoSheetOpen(true)}>
                  <Plus size={16} />{" "}{tr("marketing.newPromoCode")}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className={cn(secondaryBtn, "hidden sm:inline-flex")} onClick={() => { setTab("promos"); setPromoSheetOpen(true); }}>
                  <Ticket size={16} />{" "}{tr("marketing.newPromoCode")}
                </Button>
                <Button className={primaryBtn} onClick={() => openNewCampaign()}>
                  <Plus size={16} />{" "}{tr("marketing.newCampaign")}
                </Button>
              </>
            )
          }
        />

        <div className={pageBody}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Ticket} label={tr("marketing.liveCodes")} value={byStatus.active ?? 0} hint={byStatus.scheduled ? `${byStatus.scheduled} scheduled` : tr("marketing.usableAtCheckoutToday")} tone="violet" />
            <StatCard icon={Percent} label={tr("marketing.redemptions")} value={redemptions} hint={tr("marketing.acrossEveryCode")} tone="emerald" />
            <StatCard icon={Megaphone} label={tr("marketing.campaigns")} value={campaignList.length} hint={drafts ? tr("marketing.draftCount", { count: drafts }) : tr("marketing.noneWaiting")} tone="sky" />
            <StatCard icon={Send} label={tr("marketing.clientsReached")} value={reached} hint={tr("marketing.queuedOrSent")} tone="amber" />
          </div>

          {businessId && <BookingLinkCard businessId={businessId} />}

          <Tabs value={tab} onValueChange={(v) => setTab(v as "promos" | "campaigns")}>
            <TabsList>
              <TabsTrigger value="promos"><Ticket className="h-4 w-4" />{" "}{tr("marketing.promoCodes")}</TabsTrigger>
              <TabsTrigger value="campaigns"><Megaphone className="h-4 w-4" />{" "}{tr("marketing.campaigns")}</TabsTrigger>
            </TabsList>

            {/* ── promo codes ── */}
            <TabsContent value="promos" className="space-y-4">
              {promos === null ? (
                <SkeletonGrid />
              ) : promoList.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title={tr("marketing.noPromoCodesYet")}
                  body={tr("marketing.aCodeTurnsAPost")}
                  action={<Button className={primaryBtn} onClick={() => setPromoSheetOpen(true)}><Plus size={16} />{" "}{tr("marketing.newPromoCode")}</Button>}
                />
              ) : (
                <>
                  <FilterChips<"all" | Lifecycle>
                    label={tr("marketing.filterPromoCodes")}
                    value={promoFilter}
                    onChange={setPromoFilter}
                    options={[
                      { value: "all", label: tr("common.all"), count: promoList.length },
                      { value: "active", label: tr("common.active"), count: byStatus.active ?? 0 },
                      { value: "scheduled", label: tr("common.scheduled"), count: byStatus.scheduled ?? 0 },
                      { value: "ended", label: tr("common.ended"), count: byStatus.ended ?? 0 },
                    ]}
                  />
                  {shownPromos.length === 0 ? (
                    <p className="rounded-[20px] bg-white px-5 py-8 text-center text-sm text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                      {tr("marketing.nothingHere")}
                    </p>
                  ) : (
                    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {shownPromos.map((p) => (
                        <PromoCard
                          key={p.id}
                          promo={p}
                          busy={promoBusy}
                          onCopy={() => copy(p.code)}
                          onDuplicate={() => duplicatePromo(p)}
                          onEnd={() => void deactivatePromo(p)}
                        />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </TabsContent>

            {/* ── campaigns ── */}
            <TabsContent value="campaigns" className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {shortcuts.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={t.run}
                      className="group flex items-center gap-3 rounded-[18px] bg-white p-3.5 text-left ring-1 ring-[rgb(var(--reg-line)/0.8)] transition hover:-translate-y-0.5 hover:ring-[rgb(var(--reg-brand)/0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.6)]"
                    >
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", t.tone)}>
                        <Icon size={18} strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{t.title}</span>
                        <span className="block truncate text-xs text-[rgb(var(--reg-muted))]">{t.body}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {businessId && <AutomationCard businessId={businessId} />}
              {businessId && <LoyaltyTiersCard businessId={businessId} />}
              {businessId && <MarketplacePromotionCard businessId={businessId} />}

              {campaigns === null ? (
                <SkeletonGrid />
              ) : campaignList.length === 0 ? (
                <EmptyState
                  icon={Megaphone}
                  title={tr("marketing.noCampaignsYet")}
                  body={tr("marketing.bringBackClientsYouHave")}
                  action={<Button className={primaryBtn} onClick={() => openNewCampaign()}><Plus size={16} />{" "}{tr("marketing.newCampaign")}</Button>}
                />
              ) : (
                <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  {campaignList.map((c, i) => {
                    const Icon = c.channel === "SMS" ? MessageSquare : Mail;
                    return (
                      <li key={c.id} className={cn("flex items-center gap-3 px-4 py-3.5 md:px-5", i > 0 && "border-t border-[rgb(var(--reg-line)/0.6)]")}>
                        <span className={cn("hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex", c.channel === "SMS" ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]" : "bg-sky-50 text-sky-700")}>
                          <Icon size={18} strokeWidth={1.9} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="truncate text-[15px] font-semibold">{c.name}</p>
                            <StatusChip status={campaignStatus(c)} label={campaignLabel(c)} />
                          </div>
                          <p className="mt-0.5 truncate text-sm text-[rgb(var(--reg-muted))]">
                            {c.channel === "SMS" ? "SMS" : tr("common.email")} · {segmentLabel(c.segment)}
                            {c.status !== "DRAFT" ? " " + tr("marketing.recipientCount", { count: c.recipientCount }) : ""}
                            {c.createdAt ? ` · ${formatLocaleDate(new Date(c.createdAt), { day: "numeric", month: "short" })}` : ""}
                          </p>
                          {campaignResults[String(c.id)] && (
                            <p className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">
                              {tr("marketing.campaignResults", {
                                bookings: campaignResults[String(c.id)].bookings,
                                revenue: money(campaignResults[String(c.id)].revenue, currencySymbol()),
                              })}
                              {campaignResults[String(c.id)].clicked !== undefined &&
                                ` · ${tr("marketing.campaignClicks", { clicked: campaignResults[String(c.id)].clicked ?? 0, clicks: campaignResults[String(c.id)].clicks ?? 0 })}`}
                            </p>
                          )}
                        </div>
                        {c.status === "DRAFT" && (
                          <RowAction icon={Send} disabled={campaignBusy} onClick={() => void queueCampaign(c)}>
                            {tr("marketing.queue")}
                          </RowAction>
                        )}
                        <ActionMenu
                          label={tr("common.moreFor", { name: c.name })}
                          actions={[{ label: tr("common.duplicate"), icon: CopyPlus, onSelect: () => duplicateCampaign(c) }]}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* ── new campaign ── */}
        <FormSheet
          open={campaignSheetOpen}
          onOpenChange={setCampaignSheetOpen}
          title={tr("marketing.newCampaign")}
          description={tr("marketing.targetASegmentRatherThan")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setCampaignSheetOpen(false)}>{tr("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={campaignBusy} onClick={createCampaign}>
                {campaignBusy ? tr("common.saving") : tr("marketing.saveAsDraft")}
              </Button>
            </>
          }
        >
          <CampaignPreview form={campaignForm} />

          <Field label={tr("marketing.startFromTemplate")}>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_TEMPLATES.map((tpl) => (
                <Button key={tpl.id} type="button" variant="outline" className={secondaryBtn} onClick={() => applyCampaignTemplate(tpl)}>
                  {tpl.name[getLocale()]}
                </Button>
              ))}
            </div>
          </Field>

          <Field label={tr("common.name")} htmlFor="cmp-name" hint={tr("marketing.onlyYouSeeThis")}>
            <input id="cmp-name" className={fieldCls} value={campaignForm.name} placeholder={tr("marketing.winBackNovember")}
              onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label={tr("marketing.channel")}>
            <Segmented
              label={tr("marketing.channel")}
              value={campaignForm.channel}
              onChange={(channel) => setCampaignForm((f) => ({ ...f, channel }))}
              options={[{ value: "EMAIL", label: tr("common.email"), icon: Mail }, { value: "SMS", label: "SMS", icon: MessageSquare }]}
            />
          </Field>
          <Field
            label={tr("marketing.whoGetsIt")}
            hint={
              audience ? (
                <>
                  <span className="font-semibold text-[rgb(var(--reg-ink))]">{tr("marketing.reachable", { reachable: audience.reachable })}</span>{" "}{tr("marketing.ofInThisSegment", { segmentSize: audience.segmentSize })}
                  {audience.reachable < audience.segmentSize &&
                    tr("marketing.theRestHaveNoOn", { value: campaignForm.channel === "EMAIL" ? tr("marketing.emailAddress") : tr("marketing.phoneNumber") })}
                </>
              ) : undefined
            }
          >
            <Segmented
              label={tr("marketing.segment")}
              value={campaignForm.segment}
              onChange={(segment) =>
                setCampaignForm((f) =>
                  // R02 L-10: the 60-day win-back starts from a ready message (only into empty fields).
                  segment === "LAPSED_60D"
                    ? { ...f, segment, subject: f.subject || tr("marketing.r02Lapsed60Subject"), body: f.body || tr("marketing.r02Lapsed60Body") }
                    : { ...f, segment },
                )
              }
              options={[
                { value: "LAPSED_60D", label: tr("marketing.r02Lapsed60"), hint: tr("marketing.r02Lapsed60Hint") },
                { value: "LAPSED_90D", label: tr("marketing.lapsed"), hint: tr("marketing.notSeenInDays") },
                { value: "TOP_SPENDERS", label: tr("marketing.topSpenders"), hint: tr("marketing.yourBestClients") },
                { value: "BIRTHDAY_THIS_MONTH", label: tr("marketing.segmentBirthdayThisMonth"), hint: tr("marketing.segmentBirthdayThisMonthHint") },
                { value: "ALL_CLIENTS", label: tr("marketing.segmentAllClients"), hint: tr("marketing.segmentAllClientsHint") },
              ]}
            />
            {clientTags.length > 0 && (
              <select
                className={cn(fieldCls, "mt-2")}
                aria-label={tr("marketing.segmentByTag")}
                value={campaignForm.segment.startsWith("TAG:") ? campaignForm.segment : ""}
                onChange={(e) => setCampaignForm((f) => ({ ...f, segment: (e.target.value || "LAPSED_90D") as Segment }))}
              >
                <option value="">{tr("marketing.segmentByTagNone")}</option>
                {clientTags.map((x) => <option key={x.id} value={`TAG:${x.id}`}>{tr("marketing.segmentTagNamed", { name: x.name })}</option>)}
              </select>
            )}
          </Field>
          {campaignForm.channel === "EMAIL" && (
            <Field label={tr("marketing.subject")} htmlFor="cmp-subject">
              <input id="cmp-subject" className={fieldCls} value={campaignForm.subject} placeholder={tr("marketing.itSBeenAWhile")}
                onChange={(e) => setCampaignForm((f) => ({ ...f, subject: e.target.value }))} />
            </Field>
          )}
          <Field
            label={tr("marketing.message")}
            htmlFor="cmp-body"
            hint={campaignForm.channel === "SMS" ? tr("marketing.charactersSms", { count: campaignForm.body.length, value: smsEstimate?.segmentsOfText ?? Math.max(1, Math.ceil(campaignForm.body.length / 160)) }) : undefined}
          >
            <Textarea id="cmp-body" rows={5} className="rounded-[14px] border-[rgb(var(--reg-line))] bg-white text-base"
              value={campaignForm.body} placeholder={tr("marketing.yourChairIsWaitingBook")}
              onChange={(e) => setCampaignForm((f) => ({ ...f, body: e.target.value }))} />
          </Field>
          {campaignForm.channel === "SMS" && smsEstimate && (
            <div className="space-y-1 rounded-2xl bg-[rgb(var(--reg-brand-soft)/0.5)] px-4 py-3 text-sm" aria-live="polite">
              <p className="font-semibold">{tr("channels.estimateLine", { characters: smsEstimate.characters, segments: smsEstimate.segmentsPerMessage, encoding: smsEstimate.fullEncoding === "UCS2" ? "Unicode" : "GSM-7" })}</p>
              <p>{tr("channels.estimateTotal", { recipients: smsEstimate.recipients, segments: smsEstimate.segmentsPerMessage, total: smsEstimate.totalSegments })}</p>
              <p className={smsEstimate.enough ? "" : "font-bold text-red-700"}>{tr("channels.estimateBalance", { balance: smsEstimate.balance, after: smsEstimate.balanceAfter })}</p>
              {smsEstimate.estimatedCost != null && <p>{tr("channels.estimateCost", { cost: smsEstimate.estimatedCost.toFixed(2), currency: smsEstimate.currency ?? "" })}</p>}
              {!smsEstimate.enough && <p className="font-bold text-red-700">{tr("channels.estimateShort")}</p>}
              {smsEstimate.fullEncoding === "UCS2" && <p className="text-xs text-[rgb(var(--reg-muted))]">{tr("channels.ucs2Warn")}</p>}
              <p className="text-xs text-[rgb(var(--reg-muted))]">{tr("channels.stopNote")}</p>
            </div>
          )}
        </FormSheet>

        {/* ── new promo code ── */}
        <FormSheet
          open={promoSheetOpen}
          onOpenChange={setPromoSheetOpen}
          title={tr("marketing.newPromoCode")}
          description={tr("marketing.clientsTypeItWhenThey")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setPromoSheetOpen(false)}>{tr("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={promoBusy} onClick={createPromo}>
                {promoBusy ? tr("common.creating") : tr("marketing.createCode")}
              </Button>
            </>
          }
        >
          <PromoPreview form={promoForm} price={Number(services.find((s) => (s.price ?? 0) > 0)?.price ?? 40)} serviceName={services.find((s) => (s.price ?? 0) > 0)?.name ?? "Haircut"} />

          <Field label={tr("marketing.code")} htmlFor="promo-code" hint={tr("marketing.lettersAndNumbersClientsType")}>
            <div className="flex gap-2">
              <input
                id="promo-code"
                className={cn(fieldCls, "font-mono uppercase tracking-[0.12em]")}
                value={promoForm.code}
                maxLength={40}
                onChange={(e) => setPromoForm((f) => ({ ...f, code: e.target.value.replace(/\s+/g, "").toUpperCase() }))}
                placeholder={tr("marketing.summer20")}
              />
              <Button type="button" variant="outline" className={cn(secondaryBtn, "h-12 shrink-0 px-4")} onClick={() => setPromoForm((f) => ({ ...f, code: randomCode() }))}>
                <Shuffle size={16} /> <span className="sr-only sm:not-sr-only">{tr("marketing.generate")}</span>
              </Button>
            </div>
          </Field>
          <Field label={tr("common.discount")}>
            <Segmented
              label={tr("marketing.discountType")}
              value={promoForm.type}
              onChange={(type) => setPromoForm((f) => ({ ...f, type }))}
              options={[{ value: "PERCENT", label: tr("marketing.percent"), icon: Percent }, { value: "FIXED", label: tr("common.amount", { value: currencySymbol() }) }]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={promoForm.type === "PERCENT" ? tr("marketing.percentOff") : tr("marketing.amountOff")} htmlFor="promo-value">
              <input id="promo-value" type="number" inputMode="decimal" min="0" step="0.01" className={fieldCls}
                value={promoForm.value} placeholder={promoForm.type === "PERCENT" ? "15" : "10"}
                onChange={(e) => setPromoForm((f) => ({ ...f, value: e.target.value }))} />
            </Field>
            <Field label={tr("marketing.useLimit")} htmlFor="promo-max" hint={tr("marketing.emptyUnlimited")}>
              <input id="promo-max" type="number" inputMode="numeric" min="1" step="1" className={fieldCls}
                value={promoForm.maxUses} placeholder="∞"
                onChange={(e) => setPromoForm((f) => ({ ...f, maxUses: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("marketing.starts")} htmlFor="promo-from" hint={tr("marketing.emptyNow")}>
              <input id="promo-from" type="date" className={fieldCls} value={promoForm.from}
                onChange={(e) => setPromoForm((f) => ({ ...f, from: e.target.value }))} />
            </Field>
            <Field label={tr("common.ends")} htmlFor="promo-to" hint={tr("marketing.emptyNoEnd")}>
              <input id="promo-to" type="date" className={fieldCls} value={promoForm.to} min={promoForm.from || undefined}
                onChange={(e) => setPromoForm((f) => ({ ...f, to: e.target.value }))} />
            </Field>
          </div>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}

const order = (s: Lifecycle) => ({ active: 0, scheduled: 1, draft: 2, queued: 2, paused: 3, failed: 4, ended: 5 })[s];

function SkeletonGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} lines={[100, 80, 60]} />
      ))}
    </div>
  );
}

/** A code as a coupon: the code itself is the hero, then value, use and dates. */
function PromoCard({
  promo: p,
  busy,
  onCopy,
  onDuplicate,
  onEnd,
}: {
  promo: PromoCode;
  busy: boolean;
  onCopy: () => void;
  onDuplicate: () => void;
  onEnd: () => void;
}) {
  const status = promoStatus(p);
  const dead = status === "ended";
  const exhausted = p.max_uses != null && p.uses >= p.max_uses;
  return (
    <li className={cn("flex flex-col rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]", dead && "bg-white/70")}>
      <div className="flex items-start justify-between gap-2 p-4 pb-3">
        <button
          type="button"
          onClick={onCopy}
          title={tr("marketing.copyCode")}
          className={cn(
            "group inline-flex min-w-0 items-center gap-2 rounded-xl border border-dashed px-3 py-1.5 font-mono text-[17px] font-bold tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
            dead
              ? "border-[rgb(var(--reg-line))] text-[rgb(var(--reg-ink)/0.55)] line-through decoration-1"
              : "border-[rgb(var(--reg-brand)/0.45)] bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))] hover:bg-[rgb(236_231_255)]",
          )}
        >
          <span className="truncate">{p.code}</span>
          <Copy size={14} className="shrink-0 opacity-60 group-hover:opacity-100" aria-hidden />
          <span className="sr-only">{tr("common.copy")}</span>
        </button>
        <StatusChip status={status} label={exhausted && p.active ? tr("marketing.usedUp") : undefined} />
      </div>
      <div className="px-4">
        <p className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{valueLabel(p.type, p.value)}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[rgb(var(--reg-muted))]">
          <CalendarRange size={14} aria-hidden />
          {dateRange(p.valid_from, p.valid_to)}
        </p>
      </div>
      <div className="mt-auto px-4 pb-1 pt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold tabular-nums">
            {tr("marketing.useCount", { count: p.uses })}
          </span>
          <span className="text-xs text-[rgb(var(--reg-muted))]">{p.max_uses != null ? tr("marketing.of", { max_uses: p.max_uses }) : tr("marketing.noLimit")}</span>
        </div>
        {p.max_uses != null && <Meter className="mt-1.5" value={p.uses} max={p.max_uses} label={tr("marketing.ofUses", { code: p.code, uses: p.uses, max_uses: p.max_uses })} />}
      </div>
      <div className="flex items-center justify-end gap-1 border-t border-[rgb(var(--reg-line)/0.6)] px-3 py-2 mt-3">
        <RowAction tone="ink" icon={CopyPlus} onClick={onDuplicate}>{tr("common.duplicate")}</RowAction>
        {p.active && (
          <ActionMenu
            label={tr("marketing.moreFor", { code: p.code })}
            actions={[
              { label: tr("marketing.copyCode"), icon: Copy, onSelect: onCopy },
              { label: tr("marketing.endCode"), icon: XCircle, onSelect: onEnd, danger: true, disabled: busy },
            ]}
          />
        )}
      </div>
    </li>
  );
}

/** The booking summary on booqi-web, with the code applied. Pay at the salon (v1). */
function PromoPreview({ form, price, serviceName }: { form: typeof EMPTY_PROMO; price: number; serviceName: string }) {
  const v = Math.max(0, Number(form.value) || 0);
  const off = form.type === "PERCENT" ? Math.min(price, (price * Math.min(v, 100)) / 100) : Math.min(price, v);
  const code = form.code.trim() || tr("marketing.sampleCode");
  return (
    <ClientPreview where={tr("marketing.bookingSummary")}>
      <div className="rounded-2xl bg-white p-4 text-[rgb(var(--reg-ink))] shadow-[0_8px_24px_-16px_rgb(var(--reg-ink)/0.25)]">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{serviceName}</span>
          <span className="tabular-nums">{formatPrice(price)}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[rgb(var(--reg-canvas))] px-3 py-2 ring-1 ring-inset ring-[rgb(var(--reg-line))]">
          <Ticket size={15} className="text-[rgb(var(--reg-muted))]" aria-hidden />
          <span className="font-mono text-sm font-bold tracking-[0.1em]">{code}</span>
          <span className="ml-auto text-xs font-semibold text-[rgb(var(--reg-success))]">{tr("marketing.applied")}</span>
        </div>
        <div className={cn("mt-3 flex items-center justify-between text-sm font-semibold", GUAVA.text)}>
          <span>{tr("marketing.promoCode")}</span>
          <span className="tabular-nums">−{formatPrice(off)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[rgb(var(--reg-line))] pt-2.5">
          <span className="text-sm font-bold">{tr("marketing.payAtTheSalon")}</span>
          <span className="text-lg font-extrabold tabular-nums">{formatPrice(price - off)}</span>
        </div>
      </div>
    </ClientPreview>
  );
}

/** The inbox: an email card or a text bubble, from the salon. */
function CampaignPreview({ form }: { form: typeof EMPTY_CAMPAIGN }) {
  const name = salonName();
  const body = form.body.trim() || tr("marketing.yourMessageAppearsHere");
  return (
    <ClientPreview where={form.channel === "SMS" ? tr("marketing.theirPhone") : tr("marketing.theirInbox")}>
      {form.channel === "SMS" ? (
        <div className="rounded-2xl bg-white p-4">
          <p className="text-center text-[11px] font-semibold text-[rgb(var(--reg-muted))]">{name}</p>
          <div className="mt-2 max-w-[85%] whitespace-pre-wrap break-words rounded-[18px] rounded-bl-md bg-[rgb(var(--reg-ink)/0.07)] px-3.5 py-2.5 text-sm leading-snug">
            {body}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white">
          <div className="flex items-center gap-3 border-b border-[rgb(var(--reg-line)/0.7)] px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-sm font-bold text-[rgb(var(--reg-brand-strong))]">
              {name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{name}</p>
              <p className="truncate text-sm">{form.subject.trim() || tr("marketing.subject")}</p>
            </div>
          </div>
          <p className="line-clamp-5 whitespace-pre-wrap break-words px-4 py-3 text-sm leading-relaxed text-[rgb(var(--reg-ink)/0.85)]">{body}</p>
        </div>
      )}
    </ClientPreview>
  );
}
