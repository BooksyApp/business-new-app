import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Package, ScanLine } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { cn } from "@/lib/utils";
import { LocationSelect, useInvalidateStock, useStockLocations } from "@/components/inventory/StockLocations";
import { productService, type Product } from "@/services/productService";
import { salonDayService } from "@/services/salonDayService";
import { t } from "@/i18n";

/** A typed count: null when empty, NaN when it is not a whole number of zero or more. */
function parseCount(raw: string | undefined): number | null {
  const v = (raw ?? "").trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

/**
 * FG-W5-04: stock count. A USB scanner types the SKU and Enter into the search field, which
 * jumps to that product's count box. Confirming writes the difference of each changed line
 * through the stock count API, so every change is a COUNT movement with its reason.
 */
export default function StockCountPage() {
  const businessId = useBusinessId();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { locations, locationId, setLocationId } = useStockLocations(businessId);
  const invalidateStock = useInvalidateStock(businessId);
  const levelsQ = useQuery({
    queryKey: ["stock-levels", businessId, locationId],
    queryFn: () => salonDayService.getStockLevels(businessId, locationId),
    enabled: !!locationId,
  });

  const load = async () => {
    setProducts(await productService.list(businessId).catch(() => []));
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const levels = new Map((levelsQ.data ?? []).map((l) => [String(l.id), l.quantity_on_hand]));
  const list = (products ?? [])
    .filter((p) => p.isActive)
    .map((p) => (levels.has(String(p.id)) ? { ...p, quantityOnHand: levels.get(String(p.id)) as number } : p));
  const shown = list
    .filter((p) => [p.name, p.sku].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const invalid = list.some((p) => Number.isNaN(parseCount(counts[p.id])));
  const changes = list.flatMap((p) => {
    const counted = parseCount(counts[p.id]);
    return counted !== null && !Number.isNaN(counted) && counted !== p.quantityOnHand ? [{ product: p, counted }] : [];
  });

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = query.trim().toLowerCase();
    const match = code ? list.find((p) => p.sku?.toLowerCase() === code) : undefined;
    if (match) document.getElementById(`count-${match.id}`)?.focus();
  };

  const onCountKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    searchRef.current?.focus();
    searchRef.current?.select();
  };

  const save = async () => {
    setSaving(true);
    let saved = 0;
    try {
      for (const change of changes) {
        await salonDayService.countStock(businessId, change.product.id, change.counted, undefined, locationId);
        saved += 1;
      }
      toast.success(t("inventory.countSaved", { count: saved }));
      setCounts({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inventory.countFailed"));
    } finally {
      setSaving(false);
      await load();
      await invalidateStock();
    }
  };

  const pickLocation = (id: typeof locationId) => {
    setLocationId(id as NonNullable<typeof id>);
    setCounts({});
  };

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("inventory.countTitle")} subtitle={t("inventory.countHint")} />

        <div className={pageBody}>
          {products === null ? (
            <div className="h-48 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : list.length === 0 ? (
            <EmptyState icon={Package} title={t("inventory.noProductsYet")} body={t("inventory.addWhatYouKeepOn")} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1 md:max-w-md">
                  <ScanLine size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
                  <input
                    ref={searchRef}
                    autoFocus
                    aria-label={t("inventory.countSearch")}
                    className={cn(fieldCls, "h-11 pl-10")}
                    placeholder={t("inventory.countSearch")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onSearchKey}
                  />
                </div>
                <LocationSelect locations={locations} value={locationId} onChange={pickLocation} />
                <Button className={primaryBtn} disabled={saving || invalid || changes.length === 0} onClick={() => void save()}>
                  {t("inventory.countSave", { count: changes.length })}
                </Button>
              </div>
              {invalid && <p className="text-sm text-rose-600">{t("inventory.countInvalid")}</p>}

              {shown.length === 0 ? (
                <p className="rounded-[20px] bg-white px-5 py-10 text-center text-sm text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  {t("common.nothingMatches", { query })}
                </p>
              ) : (
                <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  {shown.map((p, i) => {
                    const counted = parseCount(counts[p.id]);
                    const difference = counted === null || Number.isNaN(counted) ? null : counted - p.quantityOnHand;
                    return (
                      <li key={p.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 md:flex-nowrap md:px-5", i > 0 && "border-t border-[rgb(var(--reg-line)/0.6)]")}>
                        <div className="min-w-0 flex-1 basis-[50%]">
                          <p className="truncate text-[15px] font-semibold">{p.name}</p>
                          <p className="text-xs text-[rgb(var(--reg-muted))]">{p.sku}</p>
                        </div>
                        <p className="text-sm text-[rgb(var(--reg-muted))]">
                          {t("inventory.countInSystem")}{" "}<span className="tabular-nums text-[rgb(var(--reg-ink))]">{p.quantityOnHand}</span>
                        </p>
                        <input
                          id={`count-${p.id}`}
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          aria-label={t("inventory.countCountedFor", { name: p.name })}
                          placeholder={t("inventory.countCounted")}
                          className={cn(fieldCls, "h-10 w-28 text-right tabular-nums")}
                          value={counts[p.id] ?? ""}
                          onChange={(e) => setCounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          onKeyDown={onCountKey}
                        />
                        <span
                          title={t("inventory.countDifference")}
                          className={cn(
                            "w-16 text-right text-sm font-semibold tabular-nums",
                            difference && difference < 0 ? "text-rose-600" : difference && difference > 0 ? "text-emerald-600" : "text-[rgb(var(--reg-muted))]",
                          )}
                        >
                          {difference === null ? null : new Intl.NumberFormat(undefined, { signDisplay: "exceptZero" }).format(difference)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
