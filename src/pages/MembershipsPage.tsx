import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, StatCard } from "@/components/ui/stat-card";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useServices } from "@/hooks/useServices";
import { clientColorClasses } from "@/lib/appointmentVisuals";
import {
  loyaltyCardsService,
  type CardHolder,
  type LoyaltyCard,
} from "@/services/membershipService";
import { CalendarClock, Gift, Loader2, Minus, Plus, Stamp, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Two-colour gradients the card is drawn with, kept in the app's own palette. */
const CARD_THEMES = [
  { name: "Purple", from: "#7a3cff", to: "#b18cff" },
  { name: "Ocean", from: "#0ea5e9", to: "#67d3f8" },
  { name: "Forest", from: "#059669", to: "#5eddb0" },
  { name: "Sunset", from: "#f59e0b", to: "#fcd34d" },
  { name: "Rose", from: "#e11d48", to: "#fb7185" },
  { name: "Ink", from: "#1f2937", to: "#6b7280" },
];

const EMPTY = {
  name: "",
  visitsRequired: "5",
  rewardServiceId: "",
  validUntil: "",
  colorFrom: CARD_THEMES[0].from,
  colorTo: CARD_THEMES[0].to,
};

/**
 * Stamp cards: come N times before a date, one service is free.
 *
 * This used to be two columns on the business — one nameless card, no closing date, and
 * no way to see what had been run before. A card is a row now, so a salon can run "5 cuts
 * by June" and "3 colours before Christmas" side by side and look back at both.
 *
 * Memberships are off for now; the plan editor that used to live here stays in git.
 */
export default function LoyaltyPage() {
  const businessId = useBusinessId();
  const { services } = useServices(businessId);
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [openCard, setOpenCard] = useState<LoyaltyCard | null>(null);
  const [holders, setHolders] = useState<CardHolder[] | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setCards(await loyaltyCardsService.list(businessId).catch(() => []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const openHolders = async (card: LoyaltyCard) => {
    setOpenCard(card);
    setHolders(null);
    setHolders(await loyaltyCardsService.holders(businessId, card.id).catch(() => []));
  };

  const create = async () => {
    if (!form.name.trim()) {
      toast.error("Give the card a name");
      return;
    }
    setCreating(true);
    try {
      const created = await loyaltyCardsService.create(businessId, {
        name: form.name.trim(),
        visitsRequired: Number(form.visitsRequired) || 0,
        rewardServiceId: form.rewardServiceId ? Number(form.rewardServiceId) : null,
        validUntil: form.validUntil || null,
        colorFrom: form.colorFrom,
        colorTo: form.colorTo,
      });
      setForm(EMPTY);
      toast.success(`Card created and given to ${created.assignedTo} clients`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the card");
    } finally {
      setCreating(false);
    }
  };

  const end = async (card: LoyaltyCard) => {
    try {
      await loyaltyCardsService.deactivate(businessId, card.id);
      toast.success(`${card.name} ended. Rewards already earned stay valid.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not end the card");
    }
  };

  const stamp = async (card: LoyaltyCard, clientId: number, delta: number) => {
    await loyaltyCardsService.stamp(businessId, card.id, clientId, delta).catch(() => null);
    setHolders(await loyaltyCardsService.holders(businessId, card.id).catch(() => []));
    await load();
  };

  const live = cards.filter((c) => c.active && !c.expired);
  const waiting = cards.reduce((n, c) => n + (c.rewards_waiting ?? 0), 0);
  const given = cards.reduce((n, c) => n + (c.rewards_used ?? 0), 0);

  return (
    <AppLayout>
      <PageHeader title="Loyalty cards" subtitle="Come a set number of times, one service is free" />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={Stamp} label="Cards running" value={live.length} tone="violet" />
          <StatCard icon={Gift} label="Free services earned" value={waiting} hint="Not used yet" tone="emerald" />
          <StatCard icon={Trophy} label="Rewards given" value={given} tone="amber" />
        </div>

        <Card className="overflow-hidden border-l-4 border-l-violet-500 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">New card</CardTitle>
            <CardDescription>
              Everyone on your books gets it the moment you create it — nobody has to opt in.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label htmlFor="name" className="text-xs">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="5 cuts by June"
              />
            </div>
            <div>
              <Label htmlFor="visits" className="text-xs">Visits needed</Label>
              <Input
                id="visits"
                type="number"
                min={1}
                value={form.visitsRequired}
                onChange={(e) => setForm({ ...form, visitsRequired: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="until" className="text-xs">Valid until</Label>
              {/* A card with no end date is one nobody hurries to fill. */}
              <Input
                id="until"
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="reward" className="text-xs">Free service</Label>
              <select
                id="reward"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.rewardServiceId}
                onChange={(e) => setForm({ ...form, rewardServiceId: e.target.value })}
              >
                <option value="">Any service</option>
                {services.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
            {/* The card carries the salon's name in the customer's app, so the salon
                picks how it looks. Colours only — free-form styling would let a salon make
                its own card unreadable in an app it does not control. */}
            <div className="md:col-span-4">
              <Label className="text-xs">Card colour</Label>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                {CARD_THEMES.map((theme) => {
                  const on = form.colorFrom === theme.from;
                  return (
                    <button
                      key={theme.name}
                      type="button"
                      title={theme.name}
                      onClick={() => setForm({ ...form, colorFrom: theme.from, colorTo: theme.to })}
                      className={`h-9 w-14 rounded-lg ring-offset-2 transition-all ${
                        on ? "ring-2 ring-violet-500" : "hover:scale-105"
                      }`}
                      style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}
                    />
                  );
                })}
                <div
                  className="ml-auto flex h-16 w-48 flex-col justify-between rounded-xl p-3 text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${form.colorFrom}, ${form.colorTo})` }}
                >
                  <span className="truncate text-xs font-semibold">
                    {form.name || "Your card"}
                  </span>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(Number(form.visitsRequired) || 5, 8) }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-2.5 w-2.5 rounded-full ${i < 2 ? "bg-white" : "border border-white/60"}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-4 flex justify-end">
              <Button className="gap-2" onClick={create} disabled={creating}>
                <Plus size={16} />
                {creating ? "Creating…" : "Create card"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div>
          <p className="mb-3 text-sm font-medium">Your cards</p>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : cards.length === 0 ? (
            <EmptyState
              icon={Stamp}
              title="No cards yet"
              body="Create one above. Every client gets it immediately, and a stamp lands on each paid visit."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => {
                const dead = !card.active || card.expired;
                return (
                  <div
                    key={card.id}
                    className={`overflow-hidden rounded-xl border bg-white ${dead ? "opacity-70" : ""}`}
                  >
                    <div
                      className="h-1.5 w-full"
                      style={{
                        background: `linear-gradient(90deg, ${card.color_from ?? "#7a3cff"}, ${
                          card.color_to ?? "#b18cff"
                        })`,
                      }}
                    />
                    <div className="flex items-start justify-between gap-2 p-4 pb-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{card.name}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {card.visits_required} visits · {card.reward_service_name ?? "any service"} free
                        </p>
                      </div>
                      {dead ? (
                        <Badge variant="secondary" className="shrink-0">
                          {card.expired ? "Expired" : "Ended"}
                        </Badge>
                      ) : (
                        <Badge className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-600">Running</Badge>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 px-4 text-xs text-muted-foreground">
                      <CalendarClock size={14} />
                      {card.valid_until ? `Until ${card.valid_until}` : "No end date"}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 px-4 text-xs">
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 font-medium text-violet-700">
                        {card.holders} holders
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                        {card.rewards_waiting} earned
                      </span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                        {card.rewards_used} used
                      </span>
                    </div>

                    <div className="mt-3 flex gap-2 p-4 pt-0">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => void openHolders(card)}>
                        Who is collecting
                      </Button>
                      {!dead && (
                        <Button variant="outline" size="sm" className="text-red-600" onClick={() => void end(card)}>
                          End
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!openCard} onOpenChange={(o) => !o && setOpenCard(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{openCard?.name}</DialogTitle>
            <DialogDescription>
              {openCard?.visits_required} visits for a free {openCard?.reward_service_name ?? "service"}
              {openCard?.valid_until ? ` · until ${openCard.valid_until}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {holders === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : holders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody on this card yet.</p>
            ) : (
              holders.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${clientColorClasses(
                      h.client_name
                    )}`}
                  >
                    {(h.client_name || "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{h.client_name || "Client"}</p>
                    <p className="truncate text-xs text-muted-foreground">{h.email || h.phone || ""}</p>
                  </div>
                  {/* The card, drawn. A count reads as data; stamps read as progress. */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(openCard?.visits_required ?? 0, 12) }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-3.5 w-3.5 rounded-full ${i < h.stamps ? "bg-violet-500" : "bg-muted"}`}
                      />
                    ))}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {h.stamps}/{openCard?.visits_required}
                    </span>
                  </div>
                  {h.rewards_available > 0 && (
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                      {h.rewards_available} free
                    </Badge>
                  )}
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openCard && void stamp(openCard, h.client_id, -1)}
                      aria-label="Remove a stamp"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openCard && void stamp(openCard, h.client_id, 1)}
                      aria-label="Add a stamp"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
