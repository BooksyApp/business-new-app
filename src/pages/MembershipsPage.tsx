import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState, StatCard } from "@/components/ui/stat-card";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useServices } from "@/hooks/useServices";
import { clientColorClasses } from "@/lib/appointmentVisuals";
import { clientService, type ClientWithStats } from "@/services/clientService";
import {
  loyaltyCardService,
  loyaltySettingsService,
  type LoyaltyCardHolder,
} from "@/services/membershipService";
import { Gift, Loader2, Minus, Plus, Stamp, Trophy, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * The loyalty card.
 *
 * It used to be a single number in a settings box — "visits for a reward" — with no way
 * to say what the reward actually was, no way to see who was collecting, and no way to
 * put someone on the card. A scheme you cannot look at is a scheme nobody runs, which is
 * why this page now shows the card itself, the people holding one, and how full each is.
 *
 * Memberships are off for now; the plan editor that used to live here stays in git.
 */
export default function LoyaltyPage() {
  const businessId = useBusinessId();
  const { services } = useServices(businessId);
  const [visits, setVisits] = useState("");
  const [rewardServiceId, setRewardServiceId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [holders, setHolders] = useState<LoyaltyCardHolder[]>([]);
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [settings, rows, everyone] = await Promise.all([
        loyaltySettingsService.get(businessId).catch(() => null),
        loyaltyCardService.holders(businessId).catch(() => []),
        clientService.getClientsByBusiness(businessId).catch(() => []),
      ]);
      setVisits(settings?.visitsForReward ? String(settings.visitsForReward) : "");
      setRewardServiceId(settings?.rewardServiceId ? String(settings.rewardServiceId) : "");
      setHolders(rows);
      setClients(everyone);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const saveCard = async () => {
    setSaving(true);
    try {
      await loyaltySettingsService.update(businessId, {
        visitsForReward: visits ? Number(visits) : null,
        rewardServiceId: rewardServiceId ? Number(rewardServiceId) : null,
      });
      toast.success(visits ? "Loyalty card saved" : "Loyalty card turned off");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const addHolder = async (client: ClientWithStats) => {
    try {
      await loyaltyCardService.add(businessId, client.id);
      setPickerOpen(false);
      toast.success(`${client.firstName} is on the card`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add them");
    }
  };

  const stamp = async (clientId: number, delta: number) => {
    try {
      await loyaltyCardService.stamp(businessId, clientId, delta);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the card");
    }
  };

  const target = Number(visits) || 0;
  const rewardName = services.find((s) => String(s.id) === rewardServiceId)?.name;
  const onCard = holders.length;
  const readyToClaim = holders.filter((h) => h.rewards_available > 0).length;
  const claimed = holders.reduce((n, h) => n + (h.rewards_used ?? 0), 0);

  const notOnCard = clients.filter((c) => !holders.some((h) => h.client_id === c.id));

  return (
    <AppLayout>
      <PageHeader
        title="Loyalty"
        subtitle="Come a set number of times, one service is free"
        actions={
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button className="gap-2" disabled={!target}>
                <UserPlus size={16} />
                Add a client
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search clients..." />
                <CommandList>
                  <CommandEmpty>Everyone is already on the card.</CommandEmpty>
                  <CommandGroup>
                    {notOnCard.map((client) => (
                      <CommandItem
                        key={client.id}
                        value={`${client.firstName} ${client.lastName || ""} ${client.email || ""}`}
                        onSelect={() => void addHolder(client)}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">
                            {client.firstName} {client.lastName}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {client.phone || client.email || ""}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={Stamp} label="On the card" value={onCard} tone="violet" />
          <StatCard
            icon={Gift}
            label="Free service earned"
            value={readyToClaim}
            hint="Waiting to be used"
            tone="emerald"
          />
          <StatCard icon={Trophy} label="Rewards given" value={claimed} tone="amber" />
        </div>

        {/* The card itself, said in one sentence rather than two number boxes. */}
        <Card className="overflow-hidden border-l-4 border-l-violet-500 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">The card</CardTitle>
            <CardDescription>
              {target > 0
                ? `Come ${target} times, and ${rewardName ?? "a service"} is free.`
                : "Not running yet. Set how many visits it takes and what the client gets."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div>
              <Label htmlFor="visits" className="text-xs">
                Visits needed
              </Label>
              <Input
                id="visits"
                type="number"
                min={0}
                value={visits}
                onChange={(e) => setVisits(e.target.value)}
                placeholder="5"
                className="w-28"
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="reward" className="text-xs">
                Free service
              </Label>
              {/* A number with no service attached was the whole problem: "5 visits" and
                  then what? */}
              <select
                id="reward"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={rewardServiceId}
                onChange={(e) => setRewardServiceId(e.target.value)}
              >
                <option value="">Any service</option>
                {services.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={saveCard} disabled={saving}>
              {saving ? "Saving…" : "Save card"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Who is collecting</CardTitle>
            <CardDescription>
              A stamp is added automatically on every paid visit. Add one by hand for a
              visit taken on paper.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : holders.length === 0 ? (
              <EmptyState
                icon={Stamp}
                title="Nobody is on the card yet"
                body={
                  target
                    ? "Anyone who pays for a visit joins automatically. You can also add someone now."
                    : "Set the card up above first, then clients start collecting."
                }
              />
            ) : (
              <div className="space-y-2">
                {holders.map((h) => {
                  const filled = target ? Math.min(h.visits_count, target) : h.visits_count;
                  return (
                    <div
                      key={h.client_id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${clientColorClasses(
                          h.client_name
                        )}`}
                      >
                        {(h.client_name || "?").charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{h.client_name || "Client"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {h.email || h.phone || ""}
                        </p>
                      </div>

                      {/* The card, drawn. A count reads as data; stamps read as progress. */}
                      {target > 0 && (
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(target, 12) }).map((_, i) => (
                            <span
                              key={i}
                              className={`h-3.5 w-3.5 rounded-full ${
                                i < filled ? "bg-violet-500" : "bg-muted"
                              }`}
                            />
                          ))}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {filled}/{target}
                          </span>
                        </div>
                      )}

                      {h.rewards_available > 0 && (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                          {h.rewards_available} free {h.rewards_available === 1 ? "service" : "services"}
                        </Badge>
                      )}

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => void stamp(h.client_id, -1)}
                          aria-label="Remove a stamp"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => void stamp(h.client_id, 1)}
                          aria-label="Add a stamp"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
