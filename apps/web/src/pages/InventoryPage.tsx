import type { Id } from "@/types/id";
import { useEffect, useState } from "react";
import { ArrowRightLeft, MapPin, Minus, Package, Plus, ScanLine, Search, Truck, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Btn, Drawer, EmptyState, Field, FormGrid, PageHead, Skeleton, Tabs } from "@/components/bz";
import { BzPage } from "@/components/bz/p2-page";
import { Meter } from "@/components/page/kit";
import { money } from "@/components/page/kitStyles";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import { LocationSelect, LocationsSheet, QuickTransferSheet, RecentTransfers, TransferSheet, useInvalidateStock, useStockLocations } from "@/components/inventory/StockLocations";
import { productService, type Product } from "@/services/productService";
import { salonDayService } from "@/services/salonDayService";
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
  const { locations, location, locationId, setLocationId } = useStockLocations(businessId);
  const [transferring, setTransferring] = useState<Product | null>(null);
  const [managing, setManaging] = useState(false);
  const [quickTransfer, setQuickTransfer] = useState(false);
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

  const open = (picked?: Product) => {
    // The edit form works on the product's own record, not the per-location overlay.
    const p = picked ? (products ?? []).find((x) => x.id === picked.id) ?? picked : undefined;
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
      if (location && !location.is_default) {
        await salonDayService.adjustStock(businessId, product.id, delta, "ADJUSTMENT", undefined, location.id);
      } else {
        await productService.update(businessId, product.id, {
          name: product.name,
          sku: product.sku ?? undefined,
          price: product.price,
          quantityOnHand: next,
          lowStockThreshold: product.lowStockThreshold,
          isActive: product.isActive,
        });
      }
      await load();
      await invalidateStock();
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

  // Quantities and the reorder flag come from the picked location's levels.
  const levels = new Map((levelsQ.data ?? []).map((l) => [String(l.id), l]));
  const list = (products ?? []).map((p) => {
    const lv = levels.get(String(p.id));
    return lv ? { ...p, quantityOnHand: lv.quantity_on_hand, lowStock: lv.low } : p;
  });
  const lowStock = list.filter((p) => p.lowStock && p.isActive);
  const stockValue = list.reduce((n, p) => n + Number(p.price ?? 0) * (p.quantityOnHand ?? 0), 0);
  const units = list.reduce((n, p) => n + (p.quantityOnHand ?? 0), 0);
  const sym = currencySymbol();
  const shown = list
    .filter((p) => filter === "all" || (p.lowStock && p.isActive))
    .filter((p) => [p.name, p.sku].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(b.lowStock) - Number(a.lowStock) || a.name.localeCompare(b.name));

  const drawer = sheet ? (
    <Drawer
      narrow
      title={sheet.mode === "edit" ? t("inventory.editProduct") : t("inventory.addAProduct")}
      sub={t("inventory.youLlBeWarnedWhen")}
      onClose={() => setSheet(null)}
      closeIcon={<X className="ic" />}
      footer={
        <>
          <Btn kind="ol" onClick={() => setSheet(null)}>{t("common.cancel")}</Btn>
          <Btn kind="v" onClick={() => void save()} disabled={saving}>
            {saving ? t("common.saving") : sheet.mode === "edit" ? t("common.save") : t("inventory.addProduct")}
          </Btn>
        </>
      }
    >
      <div className="g1">
        <Field label={t("common.name")} required>
          <input id="pr-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("inventory.shampooMl")} />
        </Field>
        <FormGrid cols={2}>
          <Field label={t("inventory.skuOptional")}>
            <input id="pr-sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </Field>
          <Field label={t("inventory.price", { sym })}>
            <input id="pr-price" type="number" inputMode="decimal" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label={t("inventory.inStock2")}>
            <input id="pr-qty" type="number" inputMode="numeric" min={0} value={form.quantityOnHand} onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })} />
          </Field>
          <Field label={t("inventory.reorderAt2")}>
            <input id="pr-low" type="number" inputMode="numeric" min={0} value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
          </Field>
        </FormGrid>
      </div>
    </Drawer>
  ) : null;

  return (
    <BzPage overlay={drawer}>
      <PageHead
        title={t("inventory.inventory")}
        sub={t("inventory.whatYouBuyCountAnd")}
        right={
          <>
            <Link to="count" className="btn btn-ol s">
              <ScanLine className="ic" />
              {t("inventory.countButton")}
            </Link>
            <Link to="suppliers" className="btn btn-ol s">
              <Truck className="ic" />
              {t("inventory.suppliersAndOrders")}
            </Link>
            <Btn kind="ol" icon={<ArrowRightLeft className="ic" />} onClick={() => (locations.length > 1 ? setQuickTransfer(true) : (toast.info(t("inventory.transferNeedTwo")), setManaging(true)))}>
              {t("inventory.transfer")}
            </Btn>
            <Btn kind="ol" icon={<MapPin className="ic" />} onClick={() => setManaging(true)}>{t("inventory.manageLocations")}</Btn>
            <Btn kind="v" icon={<Plus className="ic" />} onClick={() => open()}>{t("inventory.addProduct")}</Btn>
          </>
        }
      />

      <div className="kp">
        <div className="k"><small>{t("inventory.products")}</small><b>{list.length}</b><span /></div>
        <div className="k"><small>{t("inventory.unitsInStock")}</small><b>{units}</b><span /></div>
        <div className="k"><small>{t("inventory.stockValue")}</small><b>{money(Math.round(stockValue), sym)}</b><span>{t("inventory.atSalePrice")}</span></div>
        <div className="k">
          <small>{t("inventory.runningOut")}</small>
          <b>{lowStock.length}</b>
          <span>{lowStock.length ? lowStock.map((p) => p.name).slice(0, 2).join(", ") : t("inventory.nothingToReorder")}</span>
        </div>
      </div>
      <div style={{ height: 14 }} />

      {products === null ? (
        <Skeleton />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Package className="ic" />}
          title={t("inventory.noProductsYet")}
          text={t("inventory.addWhatYouKeepOn")}
          action={<Btn kind="v" icon={<Plus className="ic" />} onClick={() => open()}>{t("inventory.addProduct")}</Btn>}
        />
      ) : (
        <>
          <Tabs
            pill
            value={filter}
            onChange={(k) => setFilter(k as "all" | "low")}
            items={[
              { key: "all", label: `${t("common.all")} ${list.length}` },
              { key: "low", label: `${t("inventory.runningOut")} ${lowStock.length}` },
            ]}
          />
          <div style={{ height: 12 }} />
          <div className="row gap8" style={{ flexWrap: "wrap", marginBottom: 14 }}>
            <div className="srch" style={{ height: 52, maxWidth: 520, flex: 1, marginBottom: 0 }}>
              <Search className="ic" aria-hidden />
              <input
                aria-label={t("inventory.searchProducts")}
                placeholder={t("inventory.searchByNameOrSku")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ border: 0, background: "transparent", outline: 0, font: "inherit", flex: 1, color: "inherit" }}
              />
            </div>
            <LocationSelect locations={locations} value={locationId} onChange={setLocationId} />
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={<Search className="ic" />} title={query ? t("common.nothingMatches", { query }) : t("inventory.nothingIsRunningOut")} />
          ) : (
            <div className="tbx">
              {shown.map((p) => {
                const low = p.lowStock && p.isActive;
                return (
                  <div key={p.id} className="lr" style={p.isActive ? undefined : { opacity: 0.6 }}>
                    <span className="mn" style={{ background: "var(--bz-vsoft)", color: "var(--bz-vtext)" }}>
                      <Package className="ic" />
                    </span>
                    <div className="tx" onClick={() => open(p)} role="button" tabIndex={0}>
                      <b>{p.name}</b>
                      <span>{t("inventory.each", { value: p.sku ? t("inventory.sku", { sku: p.sku }) : t("inventory.noSku"), value2: money(p.price, sym) })}</span>
                    </div>
                    {low && <span className="tag2 a">{t("inventory.reorder")}</span>}
                    {low && <span className="tag2">{t("inventory.reorderAt", { lowStockThreshold: p.lowStockThreshold })}</span>}
                    {!p.isActive && <span className="tag2">{t("inventory.inactive")}</span>}
                    <div style={{ width: 120, flex: "none" }}>
                      <Meter
                        tone={low ? "rose" : "brand"}
                        value={p.quantityOnHand}
                        max={Math.max(p.lowStockThreshold * 3, p.quantityOnHand, 1)}
                        label={t("inventory.inStockReorderAt", { name: p.name, quantityOnHand: p.quantityOnHand, lowStockThreshold: p.lowStockThreshold })}
                      />
                      <small>{t("inventory.reorderAt", { lowStockThreshold: p.lowStockThreshold })}</small>
                    </div>
                    <span className="acts">
                      <button type="button" className="tbtn" aria-label={t("inventory.oneFewer", { name: p.name })} disabled={moving === p.id || p.quantityOnHand <= 0} onClick={() => void move(p, -1)}>
                        <Minus className="ic" />
                      </button>
                      <b style={{ minWidth: 30, textAlign: "center", ...(low ? { color: "var(--bz-gink)" } : {}) }} aria-label={t("inventory.inStockReorderAt", { name: p.name, quantityOnHand: p.quantityOnHand, lowStockThreshold: p.lowStockThreshold })}>{p.quantityOnHand}</b>
                      <button type="button" className="tbtn" aria-label={t("inventory.oneMore", { name: p.name })} disabled={moving === p.id} onClick={() => void move(p, 1)}>
                        <Plus className="ic" />
                      </button>
                      <Btn kind="ol" onClick={() => open(p)}>{t("common.edit")}</Btn>
                      {locations.length > 1 && <Btn kind="ol" icon={<ArrowRightLeft className="ic" />} onClick={() => setTransferring(p)}>{t("inventory.transfer")}</Btn>}
                      <Btn kind="dg" onClick={() => void remove(p)} aria-label={t("common.moreFor", { name: p.name })}>{t("common.delete")}</Btn>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      <RecentTransfers businessId={businessId} />
      <TransferSheet
          key={String(transferring?.id ?? "none")}
          businessId={businessId}
          product={transferring}
          from={location}
          locations={locations}
          onClose={() => setTransferring(null)}
        />
      <QuickTransferSheet businessId={businessId} products={products ?? []} locations={locations} open={quickTransfer} onClose={() => setQuickTransfer(false)} />
      <LocationsSheet businessId={businessId} open={managing} locations={locations} onClose={() => setManaging(false)} />

    </BzPage>
  );
}
