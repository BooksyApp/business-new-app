import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentBusinessId } from "@/config/api";
import { formatPrice } from "@/lib/currency";
import { promoService, type PromoCode } from "@/services/promoService";
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

const campaigns = [
  { 
    id: "1", 
    name: "Summer Sale - 20% Off", 
    type: "Email", 
    status: "active", 
    sent: 847, 
    opened: 423, 
    clicked: 156,
    openRate: "50%",
    clickRate: "18%"
  },
  { 
    id: "2", 
    name: "New Client Welcome", 
    type: "SMS", 
    status: "active", 
    sent: 156, 
    opened: null, 
    clicked: null,
    openRate: null,
    clickRate: null
  },
  { 
    id: "3", 
    name: "Birthday Discount", 
    type: "Email", 
    status: "scheduled", 
    sent: 0, 
    opened: 0, 
    clicked: 0,
    openRate: "0%",
    clickRate: "0%"
  },
];

const marketingTools = [
  { 
    title: "Email Campaigns", 
    description: "Send promotional emails to clients", 
    icon: Mail,
    color: "bg-appointment-blue/10 text-appointment-blue",
    borderColor: "border-appointment-blue/20"
  },
  { 
    title: "SMS Marketing", 
    description: "Reach clients via text messages", 
    icon: MessageSquare,
    color: "bg-appointment-green/10 text-appointment-green",
    borderColor: "border-appointment-green/20"
  },
  { 
    title: "Loyalty Program", 
    description: "Reward returning customers", 
    icon: Gift,
    color: "bg-appointment-purple/10 text-appointment-purple",
    borderColor: "border-appointment-purple/20"
  },
  { 
    title: "Referral System", 
    description: "Encourage client referrals", 
    icon: Users,
    color: "bg-appointment-coral/10 text-appointment-coral",
    borderColor: "border-appointment-coral/20"
  },
];

export default function MarketingPage() {
  const navigate = useNavigate();
  const businessId = getCurrentBusinessId();

  // #28: promo codes shipped complete on the backend (V24, PromoController) and were
  // unreachable from the manager app — a salon could not issue a discount code at all.
  // This is also the first thing on this page backed by real data rather than the
  // hardcoded campaign figures around it (#46).
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [promoForm, setPromoForm] = useState({ code: "", type: "PERCENT", value: "" });
  const [promoBusy, setPromoBusy] = useState(false);

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
        subtitle="Grow your business with campaigns and promotions"
        actions={
          <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm hover:shadow-md transition-all">
            <Plus size={16} />
            New Campaign
          </Button>
        }
      />

      <div className="p-6 space-y-6">
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

        {/* Enhanced Marketing Tools */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {marketingTools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <Card 
                key={tool.title} 
                className={`border-border/60 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer bg-gradient-to-br from-card to-card/95 backdrop-blur-sm group card-interactive ${tool.borderColor} hover:border-2`}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => {
                  if (tool.title === "Referral System") {
                    navigate("/referral-program");
                  }
                }}
              >
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${tool.color} group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-base mb-1.5">{tool.title}</h3>
                  <p className="text-sm text-muted-foreground font-medium">{tool.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Enhanced Active Campaigns */}
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Active Campaigns</CardTitle>
                <CardDescription className="mt-1">Your running and scheduled campaigns</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-border/60 hover:border-accent/30 hover:bg-accent/5 transition-all"
              >
                <TrendingUp size={14} />
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {campaigns.map((campaign, index) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-5 rounded-xl border border-border/60 hover:border-accent/30 hover:bg-gradient-to-r hover:from-muted/30 hover:to-muted/10 transition-all duration-300 group cursor-pointer"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${campaign.type === "Email" ? "bg-appointment-blue/10" : "bg-appointment-green/10"} group-hover:scale-110 transition-transform`}>
                      {campaign.type === "Email" ? (
                        <Mail className="h-5 w-5 text-appointment-blue" />
                      ) : (
                        <MessageSquare className="h-5 w-5 text-appointment-green" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{campaign.name}</h4>
                        <Badge 
                          variant="secondary" 
                          className={campaign.status === "active" 
                            ? "bg-status-completed/10 text-status-completed border-status-completed/20 text-[10px] px-2 py-0.5" 
                            : "bg-status-pending/10 text-status-pending border-status-pending/20 text-[10px] px-2 py-0.5"
                          }
                        >
                          {campaign.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">{campaign.type} Campaign</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-base">{campaign.sent}</p>
                      <p className="text-xs text-muted-foreground font-medium">Sent</p>
                    </div>
                    {campaign.opened !== null && (
                      <div className="text-center">
                        <p className="font-bold text-base">{campaign.opened}</p>
                        <p className="text-xs text-muted-foreground font-medium">Opened</p>
                        <p className="text-xs text-status-completed font-semibold mt-0.5">{campaign.openRate}</p>
                      </div>
                    )}
                    {campaign.clicked !== null && (
                      <div className="text-center">
                        <p className="font-bold text-base">{campaign.clicked}</p>
                        <p className="text-xs text-muted-foreground font-medium">Clicked</p>
                        <p className="text-xs text-status-completed font-semibold mt-0.5">{campaign.clickRate}</p>
                      </div>
                    )}
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
