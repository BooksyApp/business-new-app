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
import { productService, type Product } from "@/services/productService";
import {
  AlertTriangle,
  Boxes,
  Coins,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const EMPTY = { name: "", sku: "", price: "", quantityOnHand: "0", lowStockThreshold: "5" };

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
        price: Number(form.price) || 0,
        quantityOnHand: Number(form.quantityOnHand) || 0,
        lowStockThreshold: Number(form.lowStockThreshold) || 0,
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

  /** Counting a delivery in, or a bottle out. The server rejects a count below zero. */
  const move = async (product: Product, delta: number) => {
    const next = product.quantityOnHand + delta;
    if (next < 0) return;
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


  const filtered = products.filter((p) =>
    [p.name, p.sku].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase())
  );
  const lowStock = products.filter((p) => p.lowStock && p.isActive);
  const stockValue = products.reduce((n, p) => n + Number(p.price ?? 0) * (p.quantityOnHand ?? 0), 0);
  const units = products.reduce((n, p) => n + (p.quantityOnHand ?? 0), 0);

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
            hint="At sale price"
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
            placeholder="Search by name or SKU..."
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
                ? "Search runs over name and SKU."
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
                  !p.isActive ? "border-l-slate-300 opacity-60" : p.lowStock ? "border-l-rose-500" : "border-l-emerald-500"
                }`}
              >
                <div className="min-w-[180px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{p.name}</p>
                    {p.lowStock && p.isActive && (
                      <Badge className="bg-rose-600 text-[10px] text-white hover:bg-rose-600">Reorder</Badge>
                    )}
                    {!p.isActive && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.sku ? `SKU ${p.sku}` : "No SKU"}
                  </p>
                </div>

                {/* The count, big, with the reorder level beside it — a number on its own
                    does not say whether it is a problem. */}
                <div className="text-center">
                  <p className={`text-2xl font-semibold ${p.lowStock ? "text-rose-600" : ""}`}>
                    {p.quantityOnHand}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    in stock · reorder at {p.lowStockThreshold}
                  </p>
                </div>

                <div className="min-w-[110px] text-right text-sm">
                  <p className="font-medium">
                    {Number(p.price).toFixed(2)} {currencySymbol()}
                  </p>
                  <p className="text-xs text-muted-foreground">each</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => void move(p, -1)}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => void move(p, 1)}>
                    <Plus className="h-3.5 w-3.5" />
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
            <DialogDescription>You will be warned when the count drops to the reorder level.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shampoo 500ml" />
            </div>
            <div>
              <Label className="text-xs">SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Price</Label>
              <Input type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Quantity</Label>
              <Input type="number" min={0} value={form.quantityOnHand} onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Reorder at</Label>
              <Input type="number" min={0} value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? "Adding…" : "Add product"}</Button>
          </div>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
