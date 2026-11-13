import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/stat-card";
import { useNavigation } from "@/utils/navigationUtils";
import { useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Percent, Ticket } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentBusinessId } from "@/config/api";
import { formatPrice } from "@/lib/currency";
import { promoService, type PromoCode } from "@/services/promoService";
import { giftCardService, packageService, type GiftCard, type ServicePackage } from "@/services/growthService";
import { useFeatureFlags } from "@/services/platformService";
import { campaignService, type Campaign, type AudiencePreview } from "@/services/campaignService";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Mail, 
  MessageSquare, 
  Gift, 
  Megaphone, 
  Users, 
  TrendingUp,
  Plus,
  Send,
  ArrowUpRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

// #46: the campaign list here was hardcoded — invented names, invented open rates,
// invented revenue — on a screen an owner reads as their real marketing performance.
// It comes from the API now.

/**
 * Four tiles that did nothing.
 *
 * Email, SMS and Loyalty had no onClick at all, and Referral navigated to a path with no
 * businessId in it, so it went nowhere too. Each one now does the thing its title says:
 * the two channels open the campaign form already set to that channel, and the other two
 * go to the page that owns them.
 */
const marketingTools = [
  {
    key: "EMAIL" as const,
    title: "Email campaign",
    description: "Write one message and send it to a segment of clients",
    icon: Mail,
    tone: "bg-sky-50 text-sky-600",
  },
  {
    key: "SMS" as const,
    title: "SMS campaign",
    description: "The same, by text. Only clients who agreed to SMS are included",
    icon: MessageSquare,
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    key: "LOYALTY" as const,
    title: "Loyalty",
    description: "Points per spend and the stamp card: come N times, one free",
    icon: Gift,
    tone: "bg-violet-50 text-violet-600",
    flag: "loyalty_cards",
  },
  {
    key: "REFERRAL" as const,
    title: "Referrals",
    description: "Your booqi code and the clients your clients bring in",
    icon: Users,
    tone: "bg-amber-50 text-amber-600",
    flag: "platform_referral",
  },
];

export default function MarketingPage() {
  const [tab, setTab] = useState("promos");
  const flags = useFeatureFlags();
  const navigate = useNavigate();
  const { getPath } = useNavigation();
  const campaignFormRef = useRef<HTMLDivElement>(null);
  const businessId = getCurrentBusinessId();

  // #28: promo codes shipped complete on the backend (V24, PromoController) and were
  // unreachable from the manager app — a salon could not issue a discount code at all.
  // This is also the first thing on this page backed by real data rather than the
  // hardcoded campaign figures around it (#46).
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [promoForm, setPromoForm] = useState({ code: "", type: "PERCENT", value: "" });
  const [promoBusy, setPromoBusy] = useState(false);

  // #28: gift cards and packages, same story as promo codes — complete backends with no
  // way in. Gift cards have no list-by-business endpoint, only lookup by code, so the
  // UI offers issue + find rather than pretending a list exists.
  const [giftAmount, setGiftAmount] = useState("");
  const [giftEmail, setGiftEmail] = useState("");
  const [giftLookupCode, setGiftLookupCode] = useState("");
  const [foundCard, setFoundCard] = useState<GiftCard | null>(null);
  const [giftBusy, setGiftBusy] = useState(false);

  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [pkgForm, setPkgForm] = useState({ name: "", sessionsTotal: "5", price: "" });
  const [pkgBusy, setPkgBusy] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignForm, setCampaignForm] = useState({
    name: "", channel: "EMAIL", segment: "LAPSED_90D", subject: "", body: "",
  });
  const [audience, setAudience] = useState<AudiencePreview | null>(null);
  const [campaignBusy, setCampaignBusy] = useState(false);

  const loadCampaigns = useCallback(() => {
    if (!businessId) return;
    campaignService.list(businessId).then((d) => setCampaigns(d || [])).catch(() => setCampaigns([]));
  }, [businessId]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // Recheck the audience whenever the targeting changes, so the size is never stale
  // relative to the segment and channel actually selected.
  useEffect(() => {
    if (!businessId) return;
    campaignService
      .preview(businessId, campaignForm.segment, campaignForm.channel)
      .then(setAudience)
      .catch(() => setAudience(null));
  }, [businessId, campaignForm.segment, campaignForm.channel]);

  const createCampaign = async () => {
    const name = campaignForm.name.trim();
    const body = campaignForm.body.trim();
    if (!name || !body) {
      toast.error("A name and a message are required");
      return;
    }
    setCampaignBusy(true);
    try {
      await campaignService.create(businessId, {
        name, channel: campaignForm.channel, segment: campaignForm.segment,
        subject: campaignForm.channel === "EMAIL" ? campaignForm.subject.trim() || undefined : undefined,
        body,
      });
      setCampaignForm({ name: "", channel: "EMAIL", segment: "LAPSED_90D", subject: "", body: "" });
      loadCampaigns();
      toast.success("Campaign created as a draft");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not create the campaign");
    } finally {
      setCampaignBusy(false);
    }
  };

  const queueCampaign = async (id: number) => {
    setCampaignBusy(true);
    try {
      const c = await campaignService.queue(businessId, id);
      loadCampaigns();
      toast.success(`Queued for ${c.recipientCount} recipients`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not queue the campaign");
    } finally {
      setCampaignBusy(false);
    }
  };

  const loadPackages = useCallback(() => {
    if (!businessId) return;
    packageService.list(businessId).then((d) => setPackages(d || [])).catch(() => setPackages([]));
  }, [businessId]);

  useEffect(() => { loadPackages(); }, [loadPackages]);

  const issueGiftCard = async () => {
    const amount = Number(giftAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("A positive amount is required");
      return;
    }
    setGiftBusy(true);
    try {
      const card = await giftCardService.issue(businessId, amount, giftEmail.trim() || undefined);
      setFoundCard(card);
      setGiftAmount(""); setGiftEmail("");
      toast.success(`Gift card ${card.code} issued`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not issue the gift card");
    } finally {
      setGiftBusy(false);
    }
  };

  const lookupGiftCard = async () => {
    const code = giftLookupCode.trim();
    if (!code) return;
    setGiftBusy(true);
    try {
      setFoundCard(await giftCardService.lookup(code));
    } catch {
      setFoundCard(null);
      toast.error("No gift card with that code");
    } finally {
      setGiftBusy(false);
    }
  };

  const createPackage = async () => {
    const name = pkgForm.name.trim();
    const sessionsTotal = Number(pkgForm.sessionsTotal);
    const price = Number(pkgForm.price);
    if (!name || !Number.isFinite(sessionsTotal) || sessionsTotal < 1 || !Number.isFinite(price) || price < 0) {
      toast.error("Name, at least one session and a non-negative price are required");
      return;
    }
    setPkgBusy(true);
    try {
      await packageService.create(businessId, { name, sessionsTotal, price, active: true });
      setPkgForm({ name: "", sessionsTotal: "5", price: "" });
      loadPackages();
      toast.success("Package created");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not create the package");
    } finally {
      setPkgBusy(false);
    }
  };

  const loadPromos = useCallback(() => {
    if (!businessId) return;
    promoService.list(businessId).then((d) => setPromos(d || [])).catch(() => setPromos([]));
  }, [businessId]);

  useEffect(() => { loadPromos(); }, [loadPromos]);

  const createPromo = async () => {
    const code = promoForm.code.trim().toUpperCase();
    const value = Number(promoForm.value);
    if (!code || !Number.isFinite(value) || value < 0) {
      toast.error("A code and a non-negative value are required");
      return;
    }
    if (promoForm.type === "PERCENT" && value > 100) {
      toast.error("A percentage discount cannot exceed 100");
      return;
    }
    setPromoBusy(true);
    try {
      await promoService.create(businessId, { code, type: promoForm.type as "PERCENT" | "FIXED", value, active: true });
      setPromoForm({ code: "", type: "PERCENT", value: "" });
      loadPromos();
      toast.success("Promo code created");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not create the promo code");
    } finally {
      setPromoBusy(false);
    }
  };

  const deactivatePromo = async (id: number) => {
    setPromoBusy(true);
    try {
      await promoService.deactivate(businessId, id);
      loadPromos();
      toast.success("Promo code deactivated");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not deactivate the promo code");
    } finally {
      setPromoBusy(false);
    }
  };
  
  return (
    <AppLayout>
      <PageHeader
        title="Marketing"
        subtitle="Discount codes and messages to clients"
        actions={
          // It had no handler: clicking it did nothing. It opens the Campaigns tab, where
          // the form is.
          <Button
            onClick={() => setTab("campaigns")}
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm hover:shadow-md transition-all"
          >
            <Plus size={16} />
            New Campaign
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Three numbers, so the page opens with an answer rather than four forms. */}
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={Ticket} label="Active promo codes" value={promos.filter((c) => c.active).length} tone="violet" />
          <StatCard icon={Megaphone} label="Campaigns" value={campaigns.length} tone="sky" />
          <StatCard
            icon={Percent}
            label="Redemptions"
            value={promos.reduce((n, c) => n + (c.uses ?? 0), 0)}
            hint="Across every code"
            tone="emerald"
          />
        </div>

        {/* Two things live here, and they are different jobs: a code that discounts a
            bill, and a message sent to clients. Gift cards moved to the till, where they
            are actually sold. */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="promos" className="gap-2">
              <Ticket className="h-4 w-4" />
              Promo codes
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2">
              <Megaphone className="h-4 w-4" />
              Campaigns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="promos" className="pt-4">
        {/* #28: real promo codes, backed by PromoController. */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Promo codes</CardTitle>
            <CardDescription>
              Discount codes clients can redeem at checkout. Deactivating keeps redeemed
              history intact.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input
                  value={promoForm.code}
                  onChange={(e) => setPromoForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="SUMMER20"
                  className="h-9 w-44"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <select
                  value={promoForm.type}
                  onChange={(e) => setPromoForm((f) => ({ ...f, type: e.target.value }))}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="PERCENT">Percent</option>
                  <option value="FIXED">Fixed</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Value</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={promoForm.value}
                  onChange={(e) => setPromoForm((f) => ({ ...f, value: e.target.value }))}
                  className="h-9 w-28"
                />
              </div>
              <Button className="h-9" disabled={promoBusy} onClick={createPromo}>
                CREATE CODE
              </Button>
            </div>

            {promos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No promo codes yet.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {promos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">
                        {p.code}{" "}
                        <span className="text-muted-foreground font-normal">
                          {p.type === "PERCENT" ? `${p.value}%` : formatPrice(p.value)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Used {p.uses}{p.max_uses != null ? ` of ${p.max_uses}` : ""}
                        {p.active ? "" : " • inactive"}
                      </p>
                    </div>
                    {p.active && (
                      <Button variant="outline" size="sm" className="h-7 text-xs"
                        disabled={promoBusy} onClick={() => deactivatePromo(p.id)}>
                        Deactivate
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="campaigns" className="pt-4">
        {/* Enhanced Marketing Tools */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {marketingTools
            .filter((tool) => {
              // Only some tools need a flag, so the union has it optional.
              const flag = (tool as { flag?: string }).flag;
              return !flag || flags[flag] !== false;
            })
            .map((tool, index) => {
            const Icon = tool.icon;
            return (
              <Card
                key={tool.key}
                className="group cursor-pointer border bg-white transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => {
                  if (tool.key === "REFERRAL") {
                    navigate(getPath("/referral-program"));
                  } else if (tool.key === "LOYALTY") {
                    navigate(getPath("/loyalty"));
                  } else {
                    // Set the channel and put the cursor in the form, rather than leaving
                    // the owner to find the same choice again in a dropdown below.
                    setCampaignForm((f) => ({ ...f, channel: tool.key }));
                    campaignFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
              >
                <CardContent className="p-5">
                  <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${tool.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold">{tool.title}</h3>
                  <p className="mt-1 text-sm leading-snug text-muted-foreground">{tool.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* #46: real campaigns. */}
        <Card ref={campaignFormRef} className="mt-5 bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Campaigns</CardTitle>
            <CardDescription>
              Target a segment rather than a list — a copied list is stale the next day.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input className="h-9 w-52" value={campaignForm.name} placeholder="Win-back October"
                  onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Channel</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={campaignForm.channel}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, channel: e.target.value }))}>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Segment</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={campaignForm.segment}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, segment: e.target.value }))}>
                  <option value="LAPSED_90D">Not seen in 90 days</option>
                  <option value="TOP_SPENDERS">Top spenders</option>
                </select>
              </div>
            </div>

            {campaignForm.channel === "EMAIL" && (
              <div className="space-y-1">
                <Label className="text-xs">Subject</Label>
                <Input className="h-9" value={campaignForm.subject}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, subject: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Message</Label>
              <Textarea rows={3} value={campaignForm.body}
                onChange={(e) => setCampaignForm((f) => ({ ...f, body: e.target.value }))} />
            </div>

            {audience && (
              <p className="text-sm text-muted-foreground">
                {audience.segmentSize} in this segment • <span className="font-medium">{audience.reachable} reachable</span>
                {audience.reachable < audience.segmentSize && (
                  <> — the rest have no {campaignForm.channel === "EMAIL" ? "email address" : "phone number"} on
                  file, or have not consented to marketing.</>
                )}
              </p>
            )}

            <Button disabled={campaignBusy} onClick={createCampaign}>CREATE DRAFT</Button>

            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campaigns yet.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {campaigns.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.channel} • {c.segment === "LAPSED_90D" ? "Not seen in 90 days" : "Top spenders"} • {c.status}
                        {c.status !== "DRAFT" ? ` • ${c.recipientCount} recipients` : ""}
                      </p>
                    </div>
                    {c.status === "DRAFT" && (
                      <Button variant="outline" size="sm" className="h-7 text-xs"
                        disabled={campaignBusy} onClick={() => queueCampaign(c.id)}>
                        Queue
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
