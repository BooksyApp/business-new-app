import type { Id } from "@/types/id";
import { useEffect, useState } from "react";
import { CopyPlus, Gift, Minus, Palette, Plus, Search, Stamp, Trophy, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BooqiScope, EmptyState, FilterChips, PageHeader, StatCard, StatusChip, pageBody } from "@/components/bz/p4-compat";

import { AppLayout } from "@/components/layout/AppLayout";
import { FormSheet } from "@/components/page/booqi";
import { primaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { ActionMenu, ClientPreview, Field, RowAction } from "@/components/page/kit";
import { fieldCls, salonName, type Lifecycle } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useServices } from "@/hooks/useServices";
import { clientColorClasses } from "@/lib/appointmentVisuals";
import { cn } from "@/lib/utils";
import { loyaltyCardsService, type CardHolder, type LoyaltyCard } from "@/services/membershipService";
import { t as tr, fmtDate as formatLocaleDate } from "@/i18n";

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

const cardStatus = (c: LoyaltyCard): Lifecycle => (!c.active || c.expired ? "ended" : "active");
const fmtDate = (d: string) => formatLocaleDate(new Date(d.slice(0, 10) + "T12:00:00"), { day: "numeric", month: "short", year: "numeric" });

/**
 * Stamp cards: come N times before a date, one service is free.
 *
 * A card is a row, so a salon can run "5 cuts by June" and "3 colours before Christmas"
 * side by side and look back at both. Memberships are off for now; the plan editor that
 * used to live here stays in git.
 */
export default function LoyaltyPage() {
  const businessId = useBusinessId();
  const { services } = useServices(businessId);
  const [cards, setCards] = useState<LoyaltyCard[] | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "ended">("all");
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [openCard, setOpenCard] = useState<LoyaltyCard | null>(null);
  const [holders, setHolders] = useState<CardHolder[] | null>(null);
  const [query, setQuery] = useState("");
  const [stamping, setStamping] = useState<Id | null>(null);

  const [styleCard, setStyleCard] = useState<LoyaltyCard | null>(null);
  const [styleTheme, setStyleTheme] = useState(CARD_THEMES[0]);
  const [styling, setStyling] = useState(false);

  const load = async () => {
    setCards(await loyaltyCardsService.list(businessId).catch(() => []));
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const openHolders = async (card: LoyaltyCard) => {
    setOpenCard(card);
    setQuery("");
    setHolders(null);
    setHolders(await loyaltyCardsService.holders(businessId, card.id).catch(() => []));
  };

  const create = async () => {
    const visits = Number(form.visitsRequired);
    if (!form.name.trim()) {
      toast.error(tr("memberships.giveTheCardAName"));
      return;
    }
    if (!Number.isInteger(visits) || visits < 1) {
      toast.error(tr("memberships.visitsNeededMustBeA"));
      return;
    }
    setCreating(true);
    try {
      const created = await loyaltyCardsService.create(businessId, {
        name: form.name.trim(),
        visitsRequired: visits,
        rewardServiceId: form.rewardServiceId ? form.rewardServiceId : null,
        validUntil: form.validUntil || null,
        colorFrom: form.colorFrom,
        colorTo: form.colorTo,
      });
      setForm(EMPTY);
      setCreateOpen(false);
      toast.success(tr("memberships.cardCreatedAndGivenTo", { assignedTo: created.assignedTo }));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("memberships.couldNotCreateTheCard"));
    } finally {
      setCreating(false);
    }
  };

  const end = async (card: LoyaltyCard) => {
    if (!confirm(tr("memberships.endNobodyCollectsOnIt", { name: card.name }))) return;
    try {
      await loyaltyCardsService.deactivate(businessId, card.id);
      toast.success(tr("memberships.endedRewardsAlreadyEarnedStay", { name: card.name }));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("memberships.couldNotEndTheCard"));
    }
  };

  const duplicate = (card: LoyaltyCard) => {
    setForm({
      name: `${card.name} (new)`,
      visitsRequired: String(card.visits_required),
      rewardServiceId: card.reward_service_id ? String(card.reward_service_id) : "",
      validUntil: "",
      colorFrom: card.color_from ?? CARD_THEMES[0].from,
      colorTo: card.color_to ?? CARD_THEMES[0].to,
    });
    setCreateOpen(true);
  };

  const restyle = async () => {
    if (!styleCard) return;
    setStyling(true);
    try {
      await loyaltyCardsService.restyle(businessId, styleCard.id, styleTheme.from, styleTheme.to);
      toast.success(tr("memberships.cardColourUpdated"));
      setStyleCard(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("memberships.couldNotChangeTheColour"));
    } finally {
      setStyling(false);
    }
  };

  // It used to swallow a failed stamp silently, so the count simply did not move.
  const stamp = async (card: LoyaltyCard, clientId: Id, delta: number) => {
    setStamping(clientId);
    try {
      await loyaltyCardsService.stamp(businessId, card.id, clientId, delta);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("memberships.couldNotChangeTheStamps"));
    } finally {
      setHolders(await loyaltyCardsService.holders(businessId, card.id).catch(() => []));
      setStamping(null);
      await load();
    }
  };

  const list = cards ?? [];
  const live = list.filter((c) => cardStatus(c) === "active");
  const members = live.reduce((n, c) => n + (c.holders ?? 0), 0);
  const waiting = list.reduce((n, c) => n + (c.rewards_waiting ?? 0), 0);
  const given = list.reduce((n, c) => n + (c.rewards_used ?? 0), 0);
  const shown = list
    .filter((c) => filter === "all" || cardStatus(c) === filter)
    .sort((a, b) => Number(cardStatus(a) === "ended") - Number(cardStatus(b) === "ended"));

  const shownHolders = (holders ?? [])
    .filter((h) => !query.trim() || `${h.client_name} ${h.email ?? ""} ${h.phone ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.rewards_available - a.rewards_available || b.stamps - a.stamps);

  const rewardName = services.find((s) => String(s.id) === form.rewardServiceId)?.name ?? null;

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={tr("common.loyalty")}
          subtitle={tr("memberships.comeASetNumberOf")}
          actions={
            <Button className={primaryBtn} onClick={() => setCreateOpen(true)}>
              <Plus size={16} />{" "}{tr("memberships.newLoyaltyCard")}
            </Button>
          }
        />

        <div className={pageBody}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Stamp} label={tr("memberships.cardsRunning")} value={live.length} tone="violet" />
            <StatCard icon={Users} label={tr("memberships.cardHolders")} value={members} hint={tr("memberships.acrossRunningCards")} tone="sky" />
            <StatCard icon={Gift} label={tr("memberships.freeServicesEarned")} value={waiting} hint={tr("memberships.notUsedYet")} tone="emerald" />
            <StatCard icon={Trophy} label={tr("memberships.rewardsGiven")} value={given} tone="amber" />
          </div>

          {cards === null ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy>
              {[0, 1].map((i) => <div key={i} className="h-[300px] animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" />)}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={Stamp}
              title={tr("memberships.noLoyaltyCardsYet")}
              body={tr("memberships.giveRegularsAReasonTo")}
              action={<Button className={primaryBtn} onClick={() => setCreateOpen(true)}><Plus size={16} />{" "}{tr("memberships.newLoyaltyCard")}</Button>}
            />
          ) : (
            <>
              <FilterChips<"all" | "active" | "ended">
                label={tr("memberships.filterCards")}
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: tr("common.all"), count: list.length },
                  { value: "active", label: tr("common.active"), count: live.length },
                  { value: "ended", label: tr("common.ended"), count: list.length - live.length },
                ]}
              />
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {shown.map((card) => {
                  const status = cardStatus(card);
                  return (
                    <li key={card.id} className="flex flex-col rounded-[20px] bg-white p-3 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                      <StampCard
                        name={card.name}
                        salon={salonName()}
                        visits={card.visits_required}
                        stamps={0}
                        reward={card.reward_service_name}
                        from={card.color_from}
                        to={card.color_to}
                        faded={status === "ended"}
                        decorative
                      />
                      <div className="flex items-center justify-between gap-2 px-1.5 pt-3">
                        <StatusChip status={status} label={card.expired ? tr("memberships.expired") : undefined} />
                        <span className="text-xs text-[rgb(var(--reg-muted))]">{card.valid_until ? tr("memberships.until", { value: fmtDate(card.valid_until) }) : tr("memberships.noEndDate")}</span>
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 px-1.5">
                        {[
                          [tr("memberships.membersLabel"), card.holders],
                          [tr("memberships.earnedLabel"), card.rewards_waiting],
                          [tr("memberships.usedLabel"), card.rewards_used],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-xl bg-[rgb(var(--reg-canvas))] px-2.5 py-2">
                            <dt className="text-[11px] font-semibold text-[rgb(var(--reg-muted))]">{k}</dt>
                            <dd className="text-lg font-extrabold tabular-nums">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-3 flex items-center justify-between gap-2 px-1.5">
                        <RowAction icon={Users} onClick={() => void openHolders(card)}>{tr("memberships.members")}</RowAction>
                        <ActionMenu
                          label={tr("common.moreFor", { name: card.name })}
                          actions={[
                            ...(status === "active"
                              ? [{
                                  label: tr("memberships.changeColour"),
                                  icon: Palette,
                                  onSelect: () => {
                                    setStyleTheme(CARD_THEMES.find((t) => t.from === card.color_from) ?? CARD_THEMES[0]);
                                    setStyleCard(card);
                                  },
                                }]
                              : []),
                            { label: tr("common.duplicate"), icon: CopyPlus, onSelect: () => duplicate(card) },
                            ...(status === "active" ? [{ label: tr("memberships.endCard"), icon: XCircle, danger: true, onSelect: () => void end(card) }] : []),
                          ]}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* ── members ── */}
        <FormSheet
          open={!!openCard}
          onOpenChange={(o) => !o && setOpenCard(null)}
          title={openCard?.name ?? tr("memberships.membersLabel")}
          description={
            openCard
              ? tr("memberships.visitsForAFree", { visits_required: openCard.visits_required, value: openCard.reward_service_name ?? tr("memberships.service"), value2: openCard.valid_until ? tr("memberships.until2", { value: fmtDate(openCard.valid_until) }) : "" })
              : undefined
          }
        >
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
            <input aria-label={tr("memberships.searchMembers")} className={cn(fieldCls, "pl-10")} placeholder={tr("memberships.searchByNameOrPhone")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {holders === null ? (
            <p className="text-sm text-[rgb(var(--reg-muted))]">{tr("common.loading2")}</p>
          ) : shownHolders.length === 0 ? (
            <p className="py-6 text-center text-sm text-[rgb(var(--reg-muted))]">{holders.length ? tr("memberships.nobodyMatches") : tr("memberships.nobodyOnThisCardYet")}</p>
          ) : (
            <ul className="space-y-2">
              {shownHolders.map((h) => {
                const total = openCard?.visits_required ?? 0;
                return (
                  <li key={h.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold", clientColorClasses(h.client_name))}>
                      {(h.client_name || "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold">
                        <span className="truncate">{h.client_name || tr("common.client")}</span>
                        {h.rewards_available > 0 && (
                          <span className="shrink-0 rounded-full bg-[rgb(var(--reg-success-soft))] px-2 py-0.5 text-[11px] font-bold text-[rgb(var(--reg-success))] ring-1 ring-inset ring-[rgb(var(--reg-success)/0.25)]">
                            {tr("memberships.free", { rewards_available: h.rewards_available })}
                          </span>
                        )}
                      </p>
                      {/* The card, drawn. A count reads as data; stamps read as progress. */}
                      <div className="mt-1.5 flex items-center gap-1" aria-label={tr("memberships.ofStamps", { stamps: h.stamps, total })}>
                        {Array.from({ length: Math.min(total, 12) }).map((_, i) => (
                          <span key={i} className={cn("h-2.5 w-2.5 rounded-full", i < h.stamps ? "bg-[rgb(var(--reg-brand))]" : "bg-[rgb(var(--reg-ink)/0.1)]")} />
                        ))}
                        <span className="ml-1 text-xs tabular-nums text-[rgb(var(--reg-muted))]">{h.stamps}/{total}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        disabled={stamping === h.client_id || h.stamps <= 0}
                        onClick={() => openCard && void stamp(openCard, h.client_id, -1)}
                        aria-label={tr("memberships.removeAStampFrom", { client_name: h.client_name })}
                        className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset ring-[rgb(var(--reg-line))] transition hover:bg-[rgb(var(--reg-canvas))] disabled:opacity-40"
                      >
                        <Minus size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={stamping === h.client_id}
                        onClick={() => openCard && void stamp(openCard, h.client_id, 1)}
                        aria-label={tr("memberships.addAStampFor", { client_name: h.client_name })}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))] ring-1 ring-inset ring-[rgb(var(--reg-brand)/0.25)] transition hover:bg-[rgb(236_231_255)] disabled:opacity-40"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </FormSheet>

        {/* ── change colour ── */}
        <FormSheet
          open={!!styleCard}
          onOpenChange={(o) => !o && setStyleCard(null)}
          title={tr("memberships.cardColour")}
          description={tr("memberships.howTheCardLooksIn")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setStyleCard(null)}>{tr("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={styling} onClick={restyle}>{styling ? tr("common.saving") : tr("memberships.saveColour")}</Button>
            </>
          }
        >
          {styleCard && (
            <ClientPreview where={tr("memberships.theirRewards")}>
              <StampCard name={styleCard.name} salon={salonName()} visits={styleCard.visits_required} stamps={2} reward={styleCard.reward_service_name} from={styleTheme.from} to={styleTheme.to} validUntil={styleCard.valid_until} />
            </ClientPreview>
          )}
          <Swatches value={styleTheme.from} onPick={setStyleTheme} />
        </FormSheet>

        {/* ── new card ── */}
        <FormSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          title={tr("memberships.newLoyaltyCard")}
          description={tr("memberships.everyoneOnYourBooksGets")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setCreateOpen(false)}>{tr("common.cancel")}</Button>
              <Button className={sheetPrimary} onClick={create} disabled={creating}>
                {creating ? tr("common.creating") : tr("memberships.createCard")}
              </Button>
            </>
          }
        >
          <ClientPreview where={tr("memberships.theirRewards")}>
            <StampCard
              name={form.name.trim() || tr("memberships.yourCard")}
              salon={salonName()}
              visits={Math.max(1, Number(form.visitsRequired) || 1)}
              stamps={2}
              reward={rewardName}
              from={form.colorFrom}
              to={form.colorTo}
              validUntil={form.validUntil || null}
            />
          </ClientPreview>

          <Field label={tr("common.name")} htmlFor="lc-name" hint={tr("memberships.clientsSeeItSayWhat")}>
            <input id="lc-name" className={fieldCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={tr("memberships.cutsTheThFree")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("memberships.visitsNeeded")} htmlFor="lc-visits">
              <input id="lc-visits" type="number" inputMode="numeric" min={1} className={fieldCls} value={form.visitsRequired} onChange={(e) => setForm({ ...form, visitsRequired: e.target.value })} />
            </Field>
            {/* A card with no end date is one nobody hurries to fill. */}
            <Field label={tr("memberships.validUntil")} htmlFor="lc-until" hint={tr("memberships.emptyNoEnd")}>
              <input id="lc-until" type="date" className={fieldCls} value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            </Field>
          </div>
          <Field label={tr("memberships.freeService")} htmlFor="lc-reward">
            <select id="lc-reward" className={fieldCls} value={form.rewardServiceId} onChange={(e) => setForm({ ...form, rewardServiceId: e.target.value })}>
              <option value="">{tr("memberships.anyService")}</option>
              {services.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
          </Field>
          {/* Colours only — free-form styling would let a salon make its own card
              unreadable in an app it does not control. */}
          <Field label={tr("memberships.cardColour")}>
            <Swatches value={form.colorFrom} onPick={(t) => setForm({ ...form, colorFrom: t.from, colorTo: t.to })} />
          </Field>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}

function Swatches({ value, onPick }: { value: string; onPick: (t: (typeof CARD_THEMES)[number]) => void }) {
  return (
    <div role="radiogroup" aria-label={tr("memberships.cardColour")} className="grid grid-cols-6 gap-2">
      {CARD_THEMES.map((theme) => {
        const on = value === theme.from;
        return (
          <button
            key={theme.name}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={theme.name}
            title={theme.name}
            onClick={() => onPick(theme)}
            className={cn(
              "h-11 rounded-xl ring-offset-2 ring-offset-[rgb(var(--reg-canvas))] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand))]",
              on ? "ring-2 ring-[rgb(var(--reg-ink))]" : "hover:scale-[1.04]",
            )}
            style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}
          />
        );
      })}
    </div>
  );
}

/** The card as booqi-web's rewards page draws it. */
function StampCard({
  name,
  salon,
  visits,
  stamps,
  reward,
  from,
  to,
  validUntil,
  faded,
  decorative,
}: {
  name: string;
  salon: string;
  visits: number;
  stamps: number;
  reward: string | null;
  from: string | null;
  to: string | null;
  validUntil?: string | null;
  faded?: boolean;
  decorative?: boolean;
}) {
  return (
    <div
      aria-hidden={decorative}
      className={cn("rounded-[18px] p-5 text-white shadow-[0_12px_28px_-16px_rgb(var(--reg-ink)/0.45)]", faded && "opacity-55 grayscale-[0.4]")}
      style={{ background: `linear-gradient(135deg, ${from ?? "#7a3cff"}, ${to ?? "#b18cff"})` }}
    >
      <p className="text-xs text-white/85">{salon}</p>
      <p className="truncate text-lg font-bold">{name}</p>
      {decorative ? (
        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: Math.min(visits, 10) }).map((_, i) => (
            <span key={i} className="h-3 w-3 rounded-full border border-white/70" />
          ))}
        </div>
      ) : (
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/30">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (stamps / Math.max(1, visits)) * 100)}%` }} />
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/35 pt-3 text-sm">
        <span className="truncate">
          {tr("memberships.free2", { value: decorative ? tr("memberships.decorVisits", { value: visits }) : `${stamps}/${visits}`, value2: reward ?? tr("memberships.aService") })}
        </span>
        {!decorative && <span className="shrink-0 text-white/80">{validUntil ? tr("memberships.until", { value: fmtDate(validUntil) }) : tr("memberships.noEndDate")}</span>}
      </div>
    </div>
  );
}
