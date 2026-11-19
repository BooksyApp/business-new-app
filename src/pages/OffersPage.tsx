import { useEffect, useState } from "react";
import { salonToday } from "@/lib/salonClock";
import { useSalonTimeZone } from "@/hooks/useSalonTimeZone";
import { useNavigate } from "react-router-dom";
import { CalendarClock, CalendarRange, Pencil, Percent, Plus, Scissors, Tag, TrendingDown, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, FormSheet, PageHeader, StatCard } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { ActionMenu, ClientPreview, Field, RowAction, SectionTitle, StatusChip } from "@/components/page/kit";
import { GUAVA, dateRange, fieldCls, lifecycleOf, money, salonName, type Lifecycle } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { getCurrentBusinessId } from "@/config/api";
import { currencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/utils/navigationUtils";
import { discountService, type ServiceDiscount } from "@/services/discountService";
import { t as tr } from "@/i18n";

// LR-09: the salon's day (toISOString was UTC).
const today = () => salonToday();

/** The offer on a service, where it sits today (or null when it has none). */
const offerStatus = (row: ServiceDiscount): Lifecycle | null => {
  if (!row.discount_percent) return null;
  if (row.running) return "active";
  return lifecycleOf({ from: row.discount_starts_on, to: row.discount_ends_on });
};

const salePrice = (price: number, percent: number) => Math.round(price * (1 - percent / 100) * 100) / 100;

type Target = { kind: "all" } | { kind: "one"; row: ServiceDiscount };

/**
 * Cutting a price.
 *
 * The only discount this product had was a promo code, which a client has to already know
 * about — useless for filling a quiet Tuesday and invisible on your card. An offer set
 * here shows as a struck-through price on your services and as a badge on your card in the
 * app and on the web, which is the thing that makes somebody stop scrolling.
 */
export default function OffersPage() {
  const businessId = getCurrentBusinessId();
  useSalonTimeZone(businessId);
  const navigate = useNavigate();
  const { getPath } = useNavigation();
  const [rows, setRows] = useState<ServiceDiscount[] | null>(null);
  const [busy, setBusy] = useState(false);

  // One sheet for both jobs: the whole-menu sale (what most salons run) and one service.
  const [target, setTarget] = useState<Target | null>(null);
  const [percent, setPercent] = useState("");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState("");
  const [label, setLabel] = useState("");

  const load = () =>
    discountService
      .list(businessId)
      .then(setRows)
      .catch(() => setRows([]));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const all = rows ?? [];
  const onOffer = all.filter((r) => r.discount_percent);
  const rest = all.filter((r) => !r.discount_percent);
  const running = all.filter((r) => r.running);
  const scheduled = onOffer.filter((r) => offerStatus(r) === "scheduled");
  const best = running.length ? Math.max(...running.map((r) => Number(r.discount_percent ?? 0))) : 0;
  // What a client saves on the deepest offer, which is more persuasive to a salon owner
  // than the percentage — it is the number their client sees.
  const bestSaving = running.length
    ? Math.max(...running.map((r) => Number(r.price ?? 0) - Number(r.sale_price ?? 0)))
    : 0;

  const act = (run: Promise<unknown>, message: string, onDone?: () => void) => {
    setBusy(true);
    run
      .then(() => {
        toast.success(message);
        onDone?.();
        load();
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : tr("offers.couldNotSaveThat")))
      .finally(() => setBusy(false));
  };

  const openSheet = (t: Target) => {
    const row = t.kind === "one" ? t.row : null;
    setPercent(row?.discount_percent ? String(row.discount_percent) : "");
    setFrom(row?.discount_starts_on ?? today());
    setTo(row?.discount_ends_on ?? "");
    setLabel(row?.discount_label ?? "");
    setTarget(t);
  };

  const save = () => {
    if (!target) return;
    const pct = Number(percent);
    if (!percent.trim() || !Number.isFinite(pct) || pct <= 0 || pct >= 100) {
      toast.error(tr("offers.percentOffMustBeBetween"));
      return;
    }
    if (from && to && to < from) {
      toast.error(tr("offers.theEndDateIsBefore"));
      return;
    }
    const input = { percent: pct, startsOn: from || null, endsOn: to || null, label: label.trim() || null };
    if (target.kind === "all") {
      act(discountService.setForAll(businessId, input), tr("offers.theSaleIsOn"), () => setTarget(null));
    } else {
      act(discountService.setForService(businessId, target.row.id, input), tr("offers.offerSaved"), () => setTarget(null));
    }
  };

  const remove = (row: ServiceDiscount) =>
    act(discountService.setForService(businessId, row.id, { percent: null }), tr("offers.offerOnRemoved", { name: row.name }));

  const sym = currencySymbol();
  const previewRow = target?.kind === "one" ? target.row : all.find((r) => r.price > 0) ?? null;
  const pctNum = Math.min(99, Math.max(0, Number(percent) || 0));

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader helpSlug="endirim-ve-teklifler"
          title={tr("common.offers")}
          subtitle={tr("offers.aCutPriceShowsOn")}
          actions={
            <>
              {running.length > 0 && (
                <Button
                  variant="outline"
                  className={secondaryBtn}
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(tr("offers.endEveryOfferOnThe"))) return;
                    act(discountService.setForAll(businessId, { percent: null }), tr("offers.offersEnded"));
                  }}
                >
                  {tr("offers.endAllOffers")}
                </Button>
              )}
              <Button className={primaryBtn} disabled={all.length === 0} onClick={() => openSheet({ kind: "all" })}>
                <Percent size={16} />{" "}{tr("offers.runASale")}
              </Button>
            </>
          }
        />

        <div className={pageBody}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Tag} tone="rose" label={tr("offers.runningNow")} value={running.length} hint={running.length ? tr("offers.liveOnYourCard") : tr("offers.nothingOnOffer")} />
            <StatCard icon={CalendarClock} tone="sky" label={tr("common.scheduled")} value={scheduled.length} hint={scheduled.length ? tr("offers.startLater") : tr("offers.noneLinedUp")} />
            <StatCard icon={Percent} tone="violet" label={tr("offers.bestOffer")} value={best > 0 ? `${best}%` : "—"} hint={tr("offers.whatYourCardShows")} />
            <StatCard icon={TrendingDown} tone="emerald" label={tr("offers.biggestSaving")} value={bestSaving > 0 ? money(Math.round(bestSaving), sym) : "—"} hint={tr("offers.whatAClientSaves")} />
          </div>

          {rows === null ? (
            <div className="h-48 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : all.length === 0 ? (
            <EmptyState
              icon={Scissors}
              title={tr("offers.addServicesFirst")}
              body={tr("offers.anOfferIsACut")}
              action={<Button className={primaryBtn} onClick={() => navigate(getPath("/items-category"))}><Plus size={16} />{" "}{tr("offers.addServices")}</Button>}
            />
          ) : (
            <>
              <section>
                <SectionTitle>{tr("offers.onOffer")}</SectionTitle>
                {onOffer.length === 0 ? (
                  <div className="flex flex-col items-start gap-3 rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] sm:flex-row sm:items-center">
                    <span className={cn("inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold", GUAVA.badge)}>
                      <Percent size={14} />{" "}{tr("offers.off")}
                    </span>
                    <p className="flex-1 text-sm text-[rgb(var(--reg-muted))]">
                      {tr("offers.nothingOnOfferABadge")}
                    </p>
                    <RowAction onClick={() => openSheet({ kind: "all" })}>{tr("offers.runASale")}</RowAction>
                  </div>
                ) : (
                  <ServiceList rows={onOffer} sym={sym} busy={busy} onEdit={(row) => openSheet({ kind: "one", row })} onRemove={remove} />
                )}
              </section>

              {rest.length > 0 && (
                <section>
                  <SectionTitle>{tr("offers.restOfYourMenu")}</SectionTitle>
                  <ServiceList rows={rest} sym={sym} busy={busy} onEdit={(row) => openSheet({ kind: "one", row })} onRemove={remove} />
                </section>
              )}
            </>
          )}
        </div>

        <FormSheet
          open={!!target}
          onOpenChange={(o) => !o && setTarget(null)}
          title={target?.kind === "one" ? target.row.name : tr("offers.runASale")}
          description={
            target?.kind === "one"
              ? tr("offers.aCutPriceOnThis")
              : tr("offers.onePercentageAcrossTheWhole")
          }
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setTarget(null)}>{tr("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={busy || !percent.trim()} onClick={save}>
                {target?.kind === "one" ? tr("offers.saveOffer") : tr("offers.putEverythingOnOffer")}
              </Button>
            </>
          }
        >
          <ClientPreview where={target?.kind === "one" ? tr("common.yourSalonPage") : tr("offers.searchAndYourSalonPage")}>
            <div className="space-y-2.5">
              {target?.kind === "all" && (
                <div className="relative h-28 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,rgb(var(--reg-mesh-1)),rgb(var(--reg-mesh-2))_55%,rgb(var(--reg-mesh-3)))]">
                  <span className={cn("absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", GUAVA.badge)}>
                    <Percent size={13} /> {tr("offers.off2", { value: pctNum || "—" })}
                  </span>
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[rgb(var(--reg-ink))]">{salonName()}</span>
                </div>
              )}
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-inset ring-[rgb(var(--reg-line))]">
                <p className="truncate text-lg font-extrabold tracking-[-0.02em]">{salonName()}</p>
                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#ffe0e6] px-3 py-1 text-xs font-semibold text-[#c4294f]">
                  <Percent size={13} /> {label.trim() || `${pctNum || "—"}% off`}
                </span>
              </div>
              {previewRow && (
                <div className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-inset ring-[rgb(var(--reg-line))]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold">{previewRow.name}</span>
                    <span className="mt-0.5 block text-sm text-[rgb(var(--reg-muted))]">{tr("offers.min", { duration: previewRow.duration })}</span>
                    <span className="mt-1 block text-sm font-bold tabular-nums">
                      {pctNum > 0 ? (
                        <>
                          <span className={GUAVA.text}>{money(salePrice(previewRow.price, pctNum), sym)}</span>
                          <span className="ml-2 font-normal text-[rgb(var(--reg-muted))] line-through">{money(previewRow.price, sym)}</span>
                          <span className={cn("ml-1.5 text-[12px]", GUAVA.text)}>{tr("offers.off3", { pctNum })}</span>
                        </>
                      ) : (
                        money(previewRow.price, sym)
                      )}
                    </span>
                  </span>
                  <span className="inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-inset ring-[rgb(var(--reg-line))]">{tr("common.book")}</span>
                </div>
              )}
            </div>
          </ClientPreview>

          <Field label={tr("offers.percentOff")} htmlFor="offer-pct">
            <input id="offer-pct" className={fieldCls} value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))} inputMode="numeric" placeholder="20" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("common.from2")} htmlFor="offer-from">
              <input id="offer-from" className={fieldCls} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={tr("offers.until")} htmlFor="offer-to" hint={tr("offers.emptyUntilYouStopIt")}>
              <input id="offer-to" className={fieldCls} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <Field label={tr("offers.badgeTextOptional")} htmlFor="offer-label" hint={tr("offers.showsOnYourSalonPage")}>
            <input id="offer-label" className={fieldCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={tr("offers.newClientPrice")} maxLength={40} />
          </Field>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}

function ServiceList({
  rows,
  sym,
  busy,
  onEdit,
  onRemove,
}: {
  rows: ServiceDiscount[];
  sym: string;
  busy: boolean;
  onEdit: (row: ServiceDiscount) => void;
  onRemove: (row: ServiceDiscount) => void;
}) {
  return (
    <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
      {rows.map((row, i) => {
        const status = offerStatus(row);
        const pct = Number(row.discount_percent ?? 0);
        return (
          <li key={row.id} className={cn("flex items-center gap-3 px-4 py-3.5 md:px-5", i > 0 && "border-t border-[rgb(var(--reg-line)/0.6)]")}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate text-[15px] font-semibold">{row.name}</p>
                {status && <StatusChip status={status} />}
              </div>
              <p className="mt-0.5 text-sm tabular-nums text-[rgb(var(--reg-muted))]">
                {pct > 0 ? (
                  <>
                    <span className={cn("font-bold", status === "active" ? GUAVA.text : "text-[rgb(var(--reg-ink))]")}>
                      {money(row.sale_price ?? salePrice(row.price, pct), sym)}
                    </span>{" "}
                    <span className="line-through">{money(row.price, sym)}</span>
                    <span className="font-semibold"> · {row.discount_label || `${pct}% off`}</span>
                  </>
                ) : (
                  <span className="font-semibold text-[rgb(var(--reg-ink))]">{money(row.price, sym)}</span>
                )}
                {" · "}
                {tr("offers.min", { duration: row.duration })}
              </p>
              {pct > 0 && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[rgb(var(--reg-muted))]">
                  <CalendarRange size={12} aria-hidden /> {dateRange(row.discount_starts_on, row.discount_ends_on, tr("offers.untilYouStopIt"))}
                </p>
              )}
            </div>
            {pct > 0 ? (
              <>
                <RowAction tone="ink" icon={Pencil} onClick={() => onEdit(row)}>{tr("common.edit")}</RowAction>
                <ActionMenu
                  label={tr("common.moreFor", { name: row.name })}
                  actions={[{ label: tr("offers.removeOffer"), icon: XCircle, danger: true, disabled: busy, onSelect: () => onRemove(row) }]}
                />
              </>
            ) : (
              <RowAction icon={Percent} onClick={() => onEdit(row)}>{tr("offers.putOnOffer")}</RowAction>
            )}
          </li>
        );
      })}
    </ul>
  );
}
