import type { Id } from "@/types/id";
import { useEffect, useState } from "react";
import { AlertTriangle, Boxes, Coins, Minus, Package, Pencil, Plus, ScanLine, Search, Trash2, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, FormSheet, PageHeader, StatCard } from "@/components/page/booqi";
import { pageBody, primaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { ActionMenu, Field, FilterChips, Meter } from "@/components/page/kit";
import { fieldCls, money } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { productService, type Product } from "@/services/productService";
import { t } from "@/i18n";

const EMPTY = { name: "", sku: "", price: "", quantityOnHand: "0", lowStockThreshold: "5" };

/**
 * Stock: what is on the shelf, and what needs reordering. A count next to its reorder
 * level, so a number on its own never has to be interpreted.
 */
export default function InventoryPage() {
  const businessId = useBusinessId();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low">("all");
  const [sheet, setSheet] = useState<{ mode: "new" } | { mode: "edit"; product: Product } | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState<Id | null>(null);

  const load = async () => {
    setProducts(await productService.list(businessId).catch(() => []));
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const open = (p?: Product) => {
    if (p) {
      setForm({ name: p.name, sku: p.sku ?? "", price: String(p.price ?? ""), quantityOnHand: String(p.quantityOnHand), lowStockThreshold: String(p.lowStockThreshold) });
      setSheet({ mode: "edit", product: p });
    } else {
      setForm(EMPTY);
      setSheet({ mode: "new" });
    }
  };

  const save = async () => {
    if (!sheet) return;
    const name = form.name.trim();
    const price = Number(form.price || 0);
    const qty = Number(form.quantityOnHand);
    const low = Number(form.lowStockThreshold);
    if (!name) {
      toast.error(t("inventory.giveTheProductAName"));
      return;
    }
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(qty) || qty < 0 || !Number.isInteger(low) || low < 0) {
      toast.error(t("inventory.priceQuantityAndReorderLevel"));
      return;
    }
    setSaving(true);
    const input = { name, sku: form.sku.trim() || undefined, price, quantityOnHand: qty, lowStockThreshold: low };
    try {
      if (sheet.mode === "new") {
        await productService.create(businessId, input);
        toast.success(t("inventory.productAdded"));
      } else {
        await productService.update(businessId, sheet.product.id, { ...input, isActive: sheet.product.isActive });
        toast.success(t("inventory.productSaved"));
      }
      setSheet(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inventory.couldNotSaveIt"));
    } finally {
      setSaving(false);
    }
  };

  /** Counting a delivery in, or a bottle out. The server rejects a count below zero. */
  const move = async (product: Product, delta: number) => {
    const next = product.quantityOnHand + delta;
    if (next < 0) return;
    setMoving(product.id);
    try {
      await productService.update(businessId, product.id, {
        name: product.name,
        sku: product.sku ?? undefined,
        price: product.price,
        quantityOnHand: next,
        lowStockThreshold: product.lowStockThreshold,
        isActive: product.isActive,
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inventory.couldNotUpdateTheCount"));
    } finally {
      setMoving(null);
    }
  };

  const remove = async (product: Product) => {
    if (!confirm(t("inventory.deleteItsStockHistoryGoes", { name: product.name }))) return;
    try {
      await productService.remove(businessId, product.id);
      toast.success(`${product.name} deleted`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inventory.couldNotDeleteIt"));
    }
  };

  const list = products ?? [];
  const lowStock = list.filter((p) => p.lowStock && p.isActive);
  const stockValue = list.reduce((n, p) => n + Number(p.price ?? 0) * (p.quantityOnHand ?? 0), 0);
  const units = list.reduce((n, p) => n + (p.quantityOnHand ?? 0), 0);
  const sym = currencySymbol();
  const shown = list
    .filter((p) => filter === "all" || (p.lowStock && p.isActive))
    .filter((p) => [p.name, p.sku].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(b.lowStock) - Number(a.lowStock) || a.name.localeCompare(b.name));

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("inventory.inventory")}
          subtitle={t("inventory.whatYouBuyCountAnd")}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className={sheetSecondary} asChild>
                <Link to="count">
                  <ScanLine size={16} />{" "}{t("inventory.countButton")}
                </Link>
              </Button>
              <Button variant="outline" className={sheetSecondary} asChild>
                <Link to="suppliers">
                  <Truck size={16} />{" "}{t("inventory.suppliersAndOrders")}
                </Link>
              </Button>
              <Button className={primaryBtn} onClick={() => open()}>
                <Plus size={16} />{" "}{t("inventory.addProduct")}
              </Button>
            </div>
          }
        />

        <div className={pageBody}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Package} label={t("inventory.products")} value={list.length} tone="violet" />
            <StatCard icon={Boxes} label={t("inventory.unitsInStock")} value={units} tone="sky" />
            <StatCard icon={Coins} label={t("inventory.stockValue")} value={money(Math.round(stockValue), sym)} hint={t("inventory.atSalePrice")} tone="emerald" />
            <StatCard
              icon={AlertTriangle}
              label={t("inventory.runningOut")}
              value={lowStock.length}
              hint={lowStock.length ? lowStock.map((p) => p.name).slice(0, 2).join(", ") : t("inventory.nothingToReorder")}
              tone={lowStock.length ? "rose" : "slate"}
            />
          </div>

          {products === null ? (
            <div className="h-48 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : list.length === 0 ? (
            <EmptyState
              icon={Package}
              title={t("inventory.noProductsYet")}
              body={t("inventory.addWhatYouKeepOn")}
              action={<Button className={primaryBtn} onClick={() => open()}><Plus size={16} />{" "}{t("inventory.addProduct")}</Button>}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1 md:max-w-md">
                  <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
                  <input aria-label={t("inventory.searchProducts")} className={cn(fieldCls, "h-11 pl-10")} placeholder={t("inventory.searchByNameOrSku")} value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <FilterChips<"all" | "low">
                  label={t("inventory.filterProducts")}
                  value={filter}
                  onChange={setFilter}
                  options={[{ value: "all", label: t("common.all"), count: list.length }, { value: "low", label: t("inventory.runningOut"), count: lowStock.length }]}
                />
              </div>

              {shown.length === 0 ? (
                <p className="rounded-[20px] bg-white px-5 py-10 text-center text-sm text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  {query ? t("common.nothingMatches", { query }) : t("inventory.nothingIsRunningOut")}
                </p>
              ) : (
                <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  {shown.map((p, i) => {
                    const low = p.lowStock && p.isActive;
                    return (
                      <li key={p.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 md:flex-nowrap md:px-5", i > 0 && "border-t border-[rgb(var(--reg-line)/0.6)]", !p.isActive && "opacity-60")}>
                        <button type="button" onClick={() => open(p)} className="min-w-0 flex-1 basis-[60%] rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[15px] font-semibold">{p.name}</span>
                            {low && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800 ring-1 ring-inset ring-rose-200">{t("inventory.reorder")}</span>}
                            {!p.isActive && <span className="rounded-full bg-[rgb(var(--reg-ink)/0.05)] px-2 py-0.5 text-[11px] font-bold">{t("inventory.inactive")}</span>}
                          </span>
                          <span className="block truncate text-sm text-[rgb(var(--reg-muted))]">
                            {t("inventory.each", { value: p.sku ? t("inventory.sku", { sku: p.sku }) : t("inventory.noSku"), value2: money(p.price, sym) })}
                          </span>
                        </button>

                        {/* The count, with its reorder level under it. */}
                        <div className="w-[120px] shrink-0">
                          <p className="flex items-baseline gap-1">
                            <span className={cn("text-xl font-extrabold tabular-nums", low && "text-rose-700")}>{p.quantityOnHand}</span>
                            <span className="text-xs text-[rgb(var(--reg-muted))]">{t("inventory.inStock")}</span>
                          </p>
                          <Meter
                            className="mt-1"
                            tone={low ? "rose" : "brand"}
                            value={p.quantityOnHand}
                            max={Math.max(p.lowStockThreshold * 3, p.quantityOnHand, 1)}
                            label={t("inventory.inStockReorderAt", { name: p.name, quantityOnHand: p.quantityOnHand, lowStockThreshold: p.lowStockThreshold })}
                          />
                          <p className="mt-0.5 text-[11px] text-[rgb(var(--reg-muted))]">{t("inventory.reorderAt", { lowStockThreshold: p.lowStockThreshold })}</p>
                        </div>

                        <div className="ml-auto flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            aria-label={t("inventory.oneFewer", { name: p.name })}
                            disabled={moving === p.id || p.quantityOnHand <= 0}
                            onClick={() => void move(p, -1)}
                            className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset ring-[rgb(var(--reg-line))] hover:bg-[rgb(var(--reg-canvas))] disabled:opacity-40"
                          >
                            <Minus size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={t("inventory.oneMore", { name: p.name })}
                            disabled={moving === p.id}
                            onClick={() => void move(p, 1)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))] ring-1 ring-inset ring-[rgb(var(--reg-brand)/0.25)] hover:bg-[rgb(236_231_255)] disabled:opacity-40"
                          >
                            <Plus size={15} />
                          </button>
                          <ActionMenu
                            label={t("common.moreFor", { name: p.name })}
                            actions={[
                              { label: t("common.edit"), icon: Pencil, onSelect: () => open(p) },
                              { label: t("common.delete"), icon: Trash2, danger: true, onSelect: () => void remove(p) },
                            ]}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        <FormSheet
          open={!!sheet}
          onOpenChange={(o) => !o && setSheet(null)}
          title={sheet?.mode === "edit" ? t("inventory.editProduct") : t("inventory.addAProduct")}
          description={t("inventory.youLlBeWarnedWhen")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setSheet(null)}>{t("common.cancel")}</Button>
              <Button className={sheetPrimary} onClick={() => void save()} disabled={saving}>
                {saving ? t("common.saving") : sheet?.mode === "edit" ? t("common.save") : t("inventory.addProduct")}
              </Button>
            </>
          }
        >
          <Field label={t("common.name")} htmlFor="pr-name">
            <input id="pr-name" className={fieldCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("inventory.shampooMl")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("inventory.skuOptional")} htmlFor="pr-sku">
              <input id="pr-sku" className={fieldCls} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </Field>
            <Field label={t("inventory.price", { sym })} htmlFor="pr-price">
              <input id="pr-price" type="number" inputMode="decimal" min={0} step="0.01" className={fieldCls} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label={t("inventory.inStock2")} htmlFor="pr-qty">
              <input id="pr-qty" type="number" inputMode="numeric" min={0} className={fieldCls} value={form.quantityOnHand} onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })} />
            </Field>
            <Field label={t("inventory.reorderAt2")} htmlFor="pr-low">
              <input id="pr-low" type="number" inputMode="numeric" min={0} className={fieldCls} value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
            </Field>
          </div>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}
