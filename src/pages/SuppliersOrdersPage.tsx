import type { Id } from "@/types/id";
import { useEffect, useState } from "react";
import { ClipboardList, PackageCheck, Plus, Sparkles, Truck } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, FormSheet, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { Field, FilterChips } from "@/components/page/kit";
import { fieldCls, money } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { productService, type Product } from "@/services/productService";
import { salonDayService, type PurchaseOrder, type Supplier, type SupplierInput } from "@/services/salonDayService";
import { t, type TKey } from "@/i18n";

const SUPPLIER_EMPTY = { name: "", contactName: "", email: "", phone: "", accountNumber: "" };
const ORDER_EMPTY = { supplierId: "", reference: "", expectedOn: "" };

type Tab = "orders" | "suppliers";
type LineForm = { productId: string; quantity: string; unitCost: string };

const STATUS_LABEL: Record<PurchaseOrder["status"], TKey> = {
  DRAFT: "inventory.orderDraft",
  ORDERED: "inventory.orderOrdered",
  PARTIAL: "inventory.orderPartial",
  RECEIVED: "inventory.orderReceived",
  CANCELLED: "inventory.orderCancelled",
};

const STATUS_TONE: Record<PurchaseOrder["status"], string> = {
  DRAFT: "bg-[rgb(var(--reg-ink)/0.05)] text-[rgb(var(--reg-ink))] ring-[rgb(var(--reg-line))]",
  ORDERED: "bg-sky-50 text-sky-800 ring-sky-200",
  PARTIAL: "bg-amber-50 text-amber-800 ring-amber-200",
  RECEIVED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-[rgb(var(--reg-ink)/0.05)] text-[rgb(var(--reg-muted))] ring-[rgb(var(--reg-line))]",
};

/**
 * Suppliers, and the orders placed with them. "Suggest" fills a new order with everything at
 * or under its reorder level; "receive" books the delivery in and that adds it to stock.
 */
export default function SuppliersOrdersPage() {
  const businessId = useBusinessId();
  const sym = currencySymbol();
  const [tab, setTab] = useState<Tab>("orders");
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierSheet, setSupplierSheet] = useState<{ mode: "new" } | { mode: "edit"; supplier: Supplier } | null>(null);
  const [supplierForm, setSupplierForm] = useState(SUPPLIER_EMPTY);
  const [orderSheet, setOrderSheet] = useState(false);
  const [orderForm, setOrderForm] = useState(ORDER_EMPTY);
  const [lines, setLines] = useState<LineForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [acting, setActing] = useState<Id | null>(null);

  const loadSuppliers = async () => {
    setSuppliers(await salonDayService.getSuppliers(businessId).catch(() => []));
  };

  const loadOrders = async () => {
    setOrders(await salonDayService.getOrders(businessId).catch(() => []));
  };

  useEffect(() => {
    void loadSuppliers();
    void loadOrders();
    void productService.list(businessId).then(setProducts).catch(() => setProducts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const openSupplier = (s?: Supplier) => {
    if (s) {
      setSupplierForm({
        name: s.name,
        contactName: s.contact_name ?? "",
        email: s.email ?? "",
        phone: s.phone ?? "",
        accountNumber: s.account_number ?? "",
      });
      setSupplierSheet({ mode: "edit", supplier: s });
    } else {
      setSupplierForm(SUPPLIER_EMPTY);
      setSupplierSheet({ mode: "new" });
    }
  };

  const saveSupplier = async () => {
    if (!supplierSheet) return;
    const name = supplierForm.name.trim();
    if (!name) {
      toast.error(t("inventory.supplierNameRequired"));
      return;
    }
    const body: SupplierInput = {
      name,
      contactName: supplierForm.contactName.trim(),
      email: supplierForm.email.trim(),
      phone: supplierForm.phone.trim(),
      accountNumber: supplierForm.accountNumber.trim(),
    };
    setSaving(true);
    try {
      if (supplierSheet.mode === "new") {
        await salonDayService.createSupplier(businessId, body);
      } else {
        await salonDayService.updateSupplier(businessId, supplierSheet.supplier.id, { ...body, isActive: supplierSheet.supplier.is_active });
      }
      toast.success(t("inventory.supplierSaved"));
      setSupplierSheet(null);
      await loadSuppliers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inventory.couldNotSaveSupplier"));
    } finally {
      setSaving(false);
    }
  };

  const newOrder = () => {
    setOrderForm(ORDER_EMPTY);
    setLines([{ productId: "", quantity: "1", unitCost: "0" }]);
    setOrderSheet(true);
  };

  /** Everything at or under its reorder level, pre-filled into a new order. */
  const suggest = async () => {
    setSuggesting(true);
    try {
      const items = await salonDayService.suggestOrder(businessId);
      if (items.length === 0) {
        toast.info(t("inventory.noSuggestions"));
        return;
      }
      setOrderForm(ORDER_EMPTY);
      setLines(items.map((i) => ({ productId: i.product_id, quantity: String(i.suggested), unitCost: "0" })));
      setOrderSheet(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inventory.couldNotCreateOrder"));
    } finally {
      setSuggesting(false);
    }
  };

  const setLine = (i: number, patch: Partial<LineForm>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const saveOrder = async () => {
    const valid = lines.filter((l) => l.productId && Number(l.quantity) > 0);
    if (valid.length === 0) {
      toast.error(t("inventory.addLinesFirst"));
      return;
    }
    setSaving(true);
    try {
      await salonDayService.createOrder(businessId, {
        supplierId: orderForm.supplierId || null,
        reference: orderForm.reference.trim() || undefined,
        expectedOn: orderForm.expectedOn || undefined,
        lines: valid.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost || 0) })),
      });
      toast.success(t("inventory.orderCreated"));
      setOrderSheet(false);
      await loadOrders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inventory.couldNotCreateOrder"));
    } finally {
      setSaving(false);
    }
  };

  const markOrdered = async (o: PurchaseOrder) => {
    setActing(o.id);
    try {
      await salonDayService.markOrdered(businessId, o.id);
      toast.success(t("inventory.orderMarked"));
      await loadOrders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inventory.couldNotUpdateOrder"));
    } finally {
      setActing(null);
    }
  };

  /** Books the whole order in. Each unit received becomes a stock movement, so the shelf goes up. */
  const receive = async (o: PurchaseOrder) => {
    setActing(o.id);
    try {
      const full = await salonDayService.getOrder(businessId, o.id);
      const outstanding = (full.lines ?? [])
        .filter((l) => l.quantity > l.received)
        .map((l) => ({ lineId: l.id, quantity: l.quantity - l.received }));
      await salonDayService.receiveOrder(businessId, o.id, outstanding);
      toast.success(t("inventory.orderReceivedToast"));
      await loadOrders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("inventory.couldNotUpdateOrder"));
    } finally {
      setActing(null);
    }
  };

  const list = orders ?? [];
  const supplierList = suppliers ?? [];
  const orderTotal = lines.reduce((n, l) => n + Number(l.quantity || 0) * Number(l.unitCost || 0), 0);
  const isOpen = (o: PurchaseOrder) => o.status === "DRAFT" || o.status === "ORDERED" || o.status === "PARTIAL";

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("inventory.suppliersAndOrders")}
          subtitle={t("inventory.suppliersAndOrdersSubtitle")}
          actions={
            tab === "orders" ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className={sheetSecondary} onClick={() => void suggest()} disabled={suggesting}>
                  <Sparkles size={16} />{" "}{t("inventory.suggestOrder")}
                </Button>
                <Button className={primaryBtn} onClick={newOrder}>
                  <Plus size={16} />{" "}{t("inventory.newOrder")}
                </Button>
              </div>
            ) : (
              <Button className={primaryBtn} onClick={() => openSupplier()}>
                <Plus size={16} />{" "}{t("inventory.addSupplier")}
              </Button>
            )
          }
        />

        <div className={pageBody}>
          <FilterChips<Tab>
            label={t("inventory.suppliersAndOrders")}
            value={tab}
            onChange={setTab}
            options={[
              { value: "orders", label: t("inventory.tabOrders"), count: list.length },
              { value: "suppliers", label: t("inventory.tabSuppliers"), count: supplierList.length },
            ]}
          />

          {tab === "suppliers" ? (
            suppliers === null ? (
              <div className="h-48 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
            ) : supplierList.length === 0 ? (
              <EmptyState
                icon={Truck}
                title={t("inventory.noSuppliersYet")}
                body={t("inventory.addSupplierHint")}
                action={<Button className={primaryBtn} onClick={() => openSupplier()}><Plus size={16} />{" "}{t("inventory.addSupplier")}</Button>}
              />
            ) : (
              <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                {supplierList.map((s, i) => (
                  <li key={s.id} className={cn(i > 0 && "border-t border-[rgb(var(--reg-line)/0.6)]", !s.is_active && "opacity-60")}>
                    <button
                      type="button"
                      onClick={() => openSupplier(s)}
                      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-4 py-3.5 text-left hover:bg-[rgb(var(--reg-canvas))] focus-visible:outline-none focus-visible:ring-2 md:px-5"
                    >
                      <span className="flex min-w-0 flex-1 basis-[60%] flex-col">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[15px] font-semibold">{s.name}</span>
                          {!s.is_active && <span className="rounded-full bg-[rgb(var(--reg-ink)/0.05)] px-2 py-0.5 text-[11px] font-bold">{t("inventory.inactive")}</span>}
                        </span>
                        <span className="truncate text-sm text-[rgb(var(--reg-muted))]">
                          {[s.contact_name, s.phone, s.email].filter(Boolean).join(" · ") || t("inventory.noContactDetails")}
                        </span>
                      </span>
                      <span className="text-sm text-[rgb(var(--reg-muted))]">{t("common.edit")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : orders === null ? (
            <div className="h-48 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : list.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t("inventory.noOrdersYet")}
              body={t("inventory.noOrdersHint")}
              action={
                <Button className={primaryBtn} onClick={() => void suggest()} disabled={suggesting}>
                  <Sparkles size={16} />{" "}{t("inventory.suggestOrder")}
                </Button>
              }
            />
          ) : (
            <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              {list.map((o, i) => (
                <li key={o.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 md:flex-nowrap md:px-5", i > 0 && "border-t border-[rgb(var(--reg-line)/0.6)]")}>
                  <div className="min-w-0 flex-1 basis-[50%]">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{o.reference || t("inventory.noReference")}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset", STATUS_TONE[o.status])}>
                        {t(STATUS_LABEL[o.status])}
                      </span>
                    </p>
                    <p className="truncate text-sm text-[rgb(var(--reg-muted))]">
                      {o.supplier_name || t("inventory.noSupplier")}
                      {" · "}
                      {t("inventory.expectedOn")}: {o.expected_on ? o.expected_on.slice(0, 10) : "—"}
                    </p>
                  </div>

                  <p className="w-[110px] shrink-0 text-right text-[15px] font-bold tabular-nums">{money(o.total_amount, sym)}</p>

                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    {o.status === "DRAFT" && (
                      <Button variant="outline" className={sheetSecondary} disabled={acting === o.id} onClick={() => void markOrdered(o)}>
                        {t("inventory.markOrdered")}
                      </Button>
                    )}
                    {isOpen(o) && (
                      <Button className={primaryBtn} disabled={acting === o.id} onClick={() => void receive(o)}>
                        <PackageCheck size={16} />{" "}{t("inventory.receiveOrder")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <FormSheet
          open={!!supplierSheet}
          onOpenChange={(o) => !o && setSupplierSheet(null)}
          title={supplierSheet?.mode === "edit" ? t("inventory.editSupplier") : t("inventory.newSupplier")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setSupplierSheet(null)}>{t("common.cancel")}</Button>
              <Button className={sheetPrimary} onClick={() => void saveSupplier()} disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </>
          }
        >
          <Field label={t("common.name")} htmlFor="sup-name">
            <input id="sup-name" className={fieldCls} value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
          </Field>
          <Field label={t("inventory.supplierContact")} htmlFor="sup-contact">
            <input id="sup-contact" className={fieldCls} value={supplierForm.contactName} onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("inventory.supplierPhone")} htmlFor="sup-phone">
              <input id="sup-phone" type="tel" className={fieldCls} value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
            </Field>
            <Field label={t("inventory.supplierEmail")} htmlFor="sup-email">
              <input id="sup-email" type="email" className={fieldCls} value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
            </Field>
          </div>
          <Field label={t("inventory.supplierAccount")} htmlFor="sup-account">
            <input id="sup-account" className={fieldCls} value={supplierForm.accountNumber} onChange={(e) => setSupplierForm({ ...supplierForm, accountNumber: e.target.value })} />
          </Field>
        </FormSheet>

        <FormSheet
          open={orderSheet}
          onOpenChange={(o) => !o && setOrderSheet(false)}
          title={t("inventory.newOrderTitle")}
          description={t("inventory.newOrderDescription")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setOrderSheet(false)}>{t("common.cancel")}</Button>
              <Button className={sheetPrimary} onClick={() => void saveOrder()} disabled={saving}>
                {saving ? t("common.saving") : t("inventory.newOrder")}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("inventory.orderSupplier")} htmlFor="ord-supplier">
              <select id="ord-supplier" className={fieldCls} value={orderForm.supplierId} onChange={(e) => setOrderForm({ ...orderForm, supplierId: e.target.value })}>
                <option value="">{t("inventory.noSupplier")}</option>
                {supplierList.filter((s) => s.is_active).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("inventory.expectedOn")} htmlFor="ord-expected">
              <input id="ord-expected" type="date" className={fieldCls} value={orderForm.expectedOn} onChange={(e) => setOrderForm({ ...orderForm, expectedOn: e.target.value })} />
            </Field>
          </div>
          <Field label={t("inventory.orderReference")} htmlFor="ord-ref">
            <input id="ord-ref" className={fieldCls} value={orderForm.reference} onChange={(e) => setOrderForm({ ...orderForm, reference: e.target.value })} />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-semibold">{t("inventory.orderLines")}</p>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_72px_96px_auto] items-end gap-2">
                <select aria-label={t("inventory.orderLines")} className={fieldCls} value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value })}>
                  <option value="">{t("inventory.pickProduct")}</option>
                  {products.filter((p) => p.isActive || p.id === l.productId).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input aria-label={t("inventory.quantity")} type="number" min={1} inputMode="numeric" className={fieldCls} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                <input aria-label={t("inventory.unitCost")} type="number" min={0} step="0.01" inputMode="decimal" className={fieldCls} value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} />
                <Button variant="ghost" className={sheetSecondary} aria-label={t("inventory.removeLine")} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                  ×
                </Button>
              </div>
            ))}
            <Button variant="outline" className={sheetSecondary} onClick={() => setLines([...lines, { productId: "", quantity: "1", unitCost: "0" }])}>
              <Plus size={16} />{" "}{t("inventory.addLine")}
            </Button>
          </div>

          <p className="flex justify-between text-sm font-semibold">
            <span>{t("inventory.orderTotal")}</span>
            <span className="tabular-nums">{money(orderTotal, sym)}</span>
          </p>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}
