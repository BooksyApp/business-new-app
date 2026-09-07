import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import {
  membershipService,
  type Membership,
  type MembershipMember,
} from "@/services/membershipService";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const EMPTY = {
  name: "",
  description: "",
  price: 0,
  billingPeriodMonths: 1,
  discountPercent: 0,
  includedSessions: 0,
};

/**
 * Recurring plans, and who is on them.
 *
 * Packages and memberships shared a table and a page, which hid the difference that
 * matters for the books: a package is money already taken, a membership is money due
 * again on a date. The members tab is that date, per client.
 */
export default function MembershipsPage() {
  const businessId = useBusinessId();
  const [plans, setPlans] = useState<Membership[]>([]);
  const [members, setMembers] = useState<MembershipMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    try {
      setLoading(true);
      const [p, m] = await Promise.all([
        membershipService.list(businessId),
        membershipService.members(businessId).catch(() => []),
      ]);
      setPlans(p);
      setMembers(m);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const create = async () => {
    if (!form.name.trim()) {
      toast.error("Give the plan a name");
      return;
    }
    if (form.discountPercent === 0 && form.includedSessions === 0) {
      // A plan with no benefit is a charge with nothing behind it.
      toast.error("A membership needs a benefit: a discount, included sessions, or both");
      return;
    }
    setSaving(true);
    try {
      await membershipService.create(businessId, form);
      setForm(EMPTY);
      toast.success("Membership created");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the membership");
    } finally {
      setSaving(false);
    }
  };

  const retire = async (plan: Membership) => {
    try {
      await membershipService.deactivate(businessId, plan.id);
      toast.success(`${plan.name} is no longer sold. Existing members keep it.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not retire the plan");
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Memberships" subtitle="Recurring plans and the clients on them" />

      <div className="p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="plans">
            <TabsList>
              <TabsTrigger value="plans">Plans ({plans.length})</TabsTrigger>
              <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="plans" className="space-y-4 pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">New plan</CardTitle>
                  <CardDescription>
                    Billed every period. The benefit is what makes it worth paying for.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <Label htmlFor="m-name">Name</Label>
                    <Input
                      id="m-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Unlimited blow-dry"
                    />
                  </div>
                  <div>
                    <Label htmlFor="m-price">Price ({currencySymbol()})</Label>
                    <Input
                      id="m-price"
                      type="number"
                      min={0}
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="m-period">Billed every (months)</Label>
                    <Input
                      id="m-period"
                      type="number"
                      min={1}
                      value={form.billingPeriodMonths}
                      onChange={(e) =>
                        setForm({ ...form, billingPeriodMonths: Math.max(1, Number(e.target.value)) })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="m-discount">Discount on every visit (%)</Label>
                    <Input
                      id="m-discount"
                      type="number"
                      min={0}
                      max={100}
                      value={form.discountPercent}
                      onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="m-sessions">Sessions included each period</Label>
                    <Input
                      id="m-sessions"
                      type="number"
                      min={0}
                      value={form.includedSessions}
                      onChange={(e) => setForm({ ...form, includedSessions: Number(e.target.value) })}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Label htmlFor="m-desc">Description</Label>
                    <Input
                      id="m-desc"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="What the member gets, in their words"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Button onClick={create} disabled={saving} className="gap-2">
                      <Plus size={16} />
                      {saving ? "Creating…" : "Create membership"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {plans.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    No plans yet. A membership shows up in the customer app the moment you create it.
                  </CardContent>
                </Card>
              ) : (
                plans.map((plan) => (
                  <Card key={plan.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{plan.name}</p>
                          {!plan.active && <Badge variant="secondary">Retired</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {plan.price} {currencySymbol()} every{" "}
                          {plan.billing_period_months === 1
                            ? "month"
                            : `${plan.billing_period_months} months`}
                          {plan.discount_percent > 0 ? ` · ${plan.discount_percent}% off visits` : ""}
                          {plan.included_sessions > 0
                            ? ` · ${plan.included_sessions} sessions included`
                            : ""}
                        </p>
                      </div>
                      {plan.active && (
                        <Button variant="outline" onClick={() => retire(plan)}>
                          Stop selling
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="members" className="space-y-3 pt-4">
              {members.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Nobody has joined yet.
                  </CardContent>
                </Card>
              ) : (
                members.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div>
                        <p className="font-medium">{m.client_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {m.membership_name} · {m.client_email}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">
                          {m.status === "CANCELLING" ? "Ends" : "Renews"}{" "}
                          {String(m.renews_at).slice(0, 10)}
                        </p>
                        <p className="font-medium">
                          {m.price} {currencySymbol()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
