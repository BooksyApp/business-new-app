import { useCallback, useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, PageHeader } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import { fmtDate, t } from "@/i18n";
import { onlineSalesService, type ShopOrder, type ShopProduct } from "@/services/onlineSalesService";

const box = "rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]";

const statusLabel = (s: ShopOrder["status"]) => t(`onlineSales.status.${s}`);

/** Online shop, "order and pick up": the orders customers paid for, and which products are on sale online. */
export default function ShopOrdersPage() {
  const businessId = useBusinessId();
  const sym = currencySymbol();
  const [orders, setOrders] = useState<ShopOrder[] | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!businessId) return;
    onlineSalesService.orders(businessId).then(setOrders).catch(() => {
      setOrders([]);
      toast.error(t("onlineSales.loadFailed"));
    });
    onlineSalesService.products(businessId).then(setProducts).catch(() => setProducts([]));
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (o: ShopOrder, kind: "ready" | "pickedUp" | "cancel") => {
    if (!businessId) return;
    if (kind === "cancel" && !window.confirm(t("onlineSales.confirmCancel", { value: o.ref }))) return;
    setBusyId(o.id);
    try {
      await onlineSalesService[kind](businessId, o.id);
      load();
    } catch {
      toast.error(t("onlineSales.actionFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (p: ShopProduct, on: boolean) => {
    if (!businessId) return;
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, sellOnline: on } : x)));
    try {
      await onlineSalesService.setSellOnline(businessId, p.id, on);
    } catch {
      toast.error(t("onlineSales.actionFailed"));
      load();
    }
  };

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("onlineSales.ordersTitle")} subtitle={t("onlineSales.ordersSubtitle")} />
        <div className={pageBody}>
          {orders && orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title={t("onlineSales.noOrders")} body={t("onlineSales.noOrdersBody")} />
          ) : (
            <div className="space-y-3">
              {(orders ?? []).map((o) => (
                <section key={o.id} className={`${box} p-4`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        #{o.ref} · {statusLabel(o.status)}
                      </p>
                      <p className="text-sm text-[rgb(var(--reg-muted))]">
                        {o.buyer_name || o.buyer_email} · {fmtDate(o.created_at)}
                      </p>
                      <ul className="mt-2 text-sm">
                        {o.items.map((i, k) => (
                          <li key={k}>
                            {i.quantity} × {i.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums">
                        {o.total.toFixed(2)} {sym}
                      </p>
                      {o.wallet_amount > 0 && (
                        <p className="text-xs text-[rgb(var(--reg-muted))]">
                          {t("onlineSales.fromWallet", { value: o.wallet_amount.toFixed(2) })}
                        </p>
                      )}
                    </div>
                  </div>
                  {(o.status === "PAID" || o.status === "READY") && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {o.status === "PAID" && (
                        <Button size="sm" disabled={busyId === o.id} onClick={() => void act(o, "ready")}>
                          {t("onlineSales.markReady")}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" disabled={busyId === o.id} onClick={() => void act(o, "pickedUp")}>
                        {t("onlineSales.markPickedUp")}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busyId === o.id} onClick={() => void act(o, "cancel")}>
                        {t("onlineSales.cancelRefund")}
                      </Button>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}

          <section className={`${box} p-5`}>
            <h2 className="font-semibold">{t("onlineSales.productsTitle")}</h2>
            <p className="mb-3 text-sm text-[rgb(var(--reg-muted))]">{t("onlineSales.productsHint")}</p>
            {products.length === 0 ? (
              <p className="text-sm text-[rgb(var(--reg-muted))]">{t("onlineSales.noProducts")}</p>
            ) : (
              <ul className="divide-y divide-[rgb(var(--reg-line)/0.8)]">
                {products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="block font-medium">{p.name}</span>
                      <span className="text-xs text-[rgb(var(--reg-muted))]">
                        {p.price.toFixed(2)} {sym} · {t("onlineSales.stock", { value: p.quantityOnHand, value2: p.reserved })}
                      </span>
                    </span>
                    <Switch checked={p.sellOnline} onCheckedChange={(v) => void toggle(p, v)} aria-label={t("onlineSales.sellOnline")} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
