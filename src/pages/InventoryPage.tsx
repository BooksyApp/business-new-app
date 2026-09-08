import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { currencySymbol } from "@/lib/currency";
import {
  productService,
  type Product,
  type StockMovement,
} from "@/services/productService";
import {
  AlertTriangle,
  Boxes,
  Coins,
  History,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const EMPTY = { name: "", sku: "", brand: "", costPrice: "", salePrice: "", quantity: "0", reorderLevel: "0", unit: "" };

/**
 * Stock.
 *
 * This page used to be the add-on editor under a different title, so a salon opening
 * Inventory to see how much shampoo was left got a list of upgrades it could add to a
 * haircut. Add-ons still live on their own page; this counts things.
 */
export default function InventoryPage() {
  const businessId = useBusinessId();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [historyOf, setHistoryOf] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[] | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setProducts(await productService.list(businessId).catch(() => []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const create = async () => {
    if (!form.name.trim()) {
      toast.error("Give the product a name");
      return;
    }
    setSaving(true);
    try {
      await productService.create(businessId, {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        brand: form.brand.trim() || undefined,
        costPrice: Number(form.costPrice) || 0,
        salePrice: Number(form.salePrice) || 0,
        quantity: Number(form.quantity) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        unit: form.unit.trim() || undefined,
      });
      setForm(EMPTY);
      setAddOpen(false);
      toast.success("Product added");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add it");
    } finally {
      setSaving(false);
    }
  };

  const move = async (product: Product, delta: number) => {
    try {
      await productService.move(businessId, product.id, delta, delta > 0 ? "DELIVERY" : "USED");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the count");
    }
  };

  const remove = async (product: Product) => {
    if (!confirm(`Delete ${product.name}? Its stock history goes with it.`)) return;
    try {
      await productService.remove(businessId, product.id);
      toast.success(`${product.name} deleted`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete it");
    }
  };

  const openHistory = async (product: Product) => {
    setHistoryOf(product);
    setMovements(null);
    setMovements(await productService.movements(businessId, product.id).catch(() => []));
  };

  const filtered = products.filter((p) =>
    [p.name, p.sku, p.brand].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase())
  );
  const lowStock = products.filter((p) => p.low_stock && p.active);
  const stockValue = products.reduce((n, p) => n + Number(p.cost_price ?? 0) * (p.quantity ?? 0), 0);
  const units = products.reduce((n, p) => n + (p.quantity ?? 0), 0);

  return (
    <AppLayout>
      <PageHeader
        title="Inventory"
        subtitle="What you buy, count and sell"
        actions={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus size={16} />
            Add product
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Package} label="Products" value={products.length} tone="violet" />
          <StatCard icon={Boxes} label="Units in stock" value={units} tone="sky" />
          <StatCard
            icon={Coins}
            label="Stock value"
            value={`${stockValue.toFixed(0)} ${currencySymbol()}`}
            hint="At cost price"
            tone="emerald"
          />
          <StatCard
            icon={AlertTriangle}
            label="Running out"
            value={lowStock.length}
            hint={lowStock.length ? lowStock.map((p) => p.name).slice(0, 2).join(", ") : "Nothing to reorder"}
            tone={lowStock.length ? "rose" : "slate"}
          />
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search by name, SKU or brand..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={query ? `Nothing matches "${query}"` : "No products yet"}
            body={
              query
                ? "Search runs over name, SKU and brand."
                : "Add what you keep on the shelf. You will be told when something drops to its reorder level."
            }
            action={
              query ? null : (
                <Button className="gap-2" onClick={() => setAddOpen(true)}>
                  <Plus size={16} />
                  Add product
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div
                key={p.id}
                className={`flex flex-wrap items-center gap-4 rounded-xl border border-l-4 bg-white p-4 ${
                  !p.active ? "border-l-slate-300 opacity-60" : p.low_stock ? "border-l-rose-500" : "border-l-emerald-500"
                }`}
              >
                <div className="min-w-[180px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{p.name}</p>
                    {p.low_stock && p.active && (
                      <Badge className="bg-rose-600 text-[10px] text-white hover:bg-rose-600">Reorder</Badge>
                    )}
                    {!p.active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[p.brand, p.sku ? `SKU ${p.sku}` : null].filter(Boolean).join(" · ") || "No SKU"}
                  </p>
                </div>

                {/* The count, big, with the reorder level beside it — a number on its own
                    does not say whether it is a problem. */}
                <div className="text-center">
                  <p className={`text-2xl font-semibold ${p.low_stock ? "text-rose-600" : ""}`}>{p.quantity}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.unit || "in stock"} · reorder at {p.reorder_level}
                  </p>
                </div>

                <div className="min-w-[110px] text-right text-sm">
                  <p className="font-medium">
                    {Number(p.sale_price).toFixed(2)} {currencySymbol()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    cost {Number(p.cost_price).toFixed(2)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => void move(p, -1)}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => void move(p, 1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void openHistory(p)}>
                    <History className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600"
                    onClick={() => void remove(p)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Add a product</DialogTitle>
            <DialogDescription>The opening count is recorded as a delivery.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shampoo 500ml" />
            </div>
            <div>
              <Label className="text-xs">Brand</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Cost price</Label>
              <Input type="number" min={0} step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Sale price</Label>
              <Input type="number" min={0} step="0.01" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Quantity</Label>
              <Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Reorder at</Label>
              <Input type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Unit</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="bottles" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? "Adding…" : "Add product"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyOf} onOpenChange={(o) => !o && setHistoryOf(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{historyOf?.name}</DialogTitle>
            <DialogDescription>Where the count came from, newest first.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {movements === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No movements recorded.</p>
            ) : (
              movements.map((m, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{m.reason}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {String(m.created_at).slice(0, 16).replace("T", " ")}
                      {m.note ? ` · ${m.note}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 font-semibold ${m.delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
