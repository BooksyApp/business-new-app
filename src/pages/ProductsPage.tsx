import { useCallback, useEffect, useState } from "react";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { getCurrentBusinessId } from "@/config/api";
import { formatPrice } from "@/lib/currency";
import { productService, type Product } from "@/services/productService";

/**
 * #26/#44: real retail stock. The sidebar's "Inventory" link used to open add-on service
 * management — no SKU, no quantity, no reorder threshold, nothing an owner would expect
 * from something called Inventory — while ProductController served exactly that data
 * with no caller.
 */
export default function ProductsPage() {
  const businessId = getCurrentBusinessId();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", sku: "", price: "", quantityOnHand: "0", lowStockThreshold: "5" });

  const load = useCallback(() => {
    if (!businessId) { setLoading(false); return; }
    productService
      .list(businessId)
      .then((d) => setProducts(d || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const name = form.name.trim();
    const price = Number(form.price);
    const quantityOnHand = Number(form.quantityOnHand);
    const lowStockThreshold = Number(form.lowStockThreshold);
    if (!name || !Number.isFinite(price) || price < 0
        || !Number.isFinite(quantityOnHand) || quantityOnHand < 0
        || !Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      toast.error("Name, and non-negative price, quantity and threshold are required");
      return;
    }
    setBusy(true);
    try {
      await productService.create(businessId, {
        name, sku: form.sku.trim() || undefined, price, quantityOnHand, lowStockThreshold, isActive: true,
      });
      setForm({ name: "", sku: "", price: "", quantityOnHand: "0", lowStockThreshold: "5" });
      load();
      toast.success("Product added");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not add the product");
    } finally {
      setBusy(false);
    }
  };

  /** Adjust stock by a delta. Never below zero — the backend rejects a negative quantity. */
  const adjustStock = async (p: Product, delta: number) => {
    const next = p.quantityOnHand + delta;
    if (next < 0) return;
    setBusy(true);
    try {
      await productService.update(p.id, businessId, { quantityOnHand: next });
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update stock");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Product) => {
    setBusy(true);
    try {
      await productService.remove(p.id, businessId);
      load();
      toast.success("Product removed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not remove the product");
    } finally {
      setBusy(false);
    }
  };

  const lowStockCount = products.filter((p) => p.lowStock).length;

  return (
    <AppLayout>
      <PageHeader title="Inventory" subtitle="Retail products and stock levels" />

      <div className="p-6 space-y-6">
        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={16} />
            {lowStockCount} {lowStockCount === 1 ? "product is" : "products are"} at or below the
            reorder threshold.
          </div>
        )}

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Add a product</CardTitle>
            <CardDescription>
              Selling a product on a sale decrements its stock automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input className="h-9 w-52" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Shampoo 500ml" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SKU</Label>
                <Input className="h-9 w-32" value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="SH-500" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Price</Label>
                <Input className="h-9 w-28" type="number" min="0" step="0.01" value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">In stock</Label>
                <Input className="h-9 w-24" type="number" min="0" value={form.quantityOnHand}
                  onChange={(e) => setForm((f) => ({ ...f, quantityOnHand: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reorder at</Label>
                <Input className="h-9 w-24" type="number" min="0" value={form.lowStockThreshold}
                  onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))} />
              </div>
              <Button className="h-9 gap-2" disabled={busy} onClick={create}>
                <Plus size={16} /> ADD
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Stock</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading products…</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No products yet. Add the retail items you sell alongside services.
              </p>
            ) : (
              <div className="divide-y divide-border/40">
                {products.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {p.name}
                        {p.lowStock && (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                            Low stock
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.sku ? `${p.sku} • ` : ""}{formatPrice(p.price)} • reorder at {p.lowStockThreshold}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={busy || p.quantityOnHand === 0}
                        onClick={() => adjustStock(p, -1)}>−</Button>
                      <span className="w-10 text-center text-sm font-medium">{p.quantityOnHand}</span>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={busy}
                        onClick={() => adjustStock(p, 1)}>+</Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" disabled={busy}
                        onClick={() => remove(p)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
