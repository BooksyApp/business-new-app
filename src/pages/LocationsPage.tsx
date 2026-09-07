import { useEffect, useState } from "react";
import { MapPin, Plus, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { businessService, type Branch, type Business } from "@/services/businessService";
import { getCurrentBusinessId } from "@/config/api";

/**
 * Setup listed "Locations" with no path — the item did nothing at all, while the backend
 * has had branch create and list since the endpoint shipped and nothing had ever called
 * the list. A salon with two shops could not see or add the second.
 */
export default function LocationsPage() {
  const businessId = getCurrentBusinessId();
  const [main, setMain] = useState<Business | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", city: "", country: "", phone: "", email: "" });

  const load = () => {
    if (!businessId) { setLoading(false); return; }
    setError(false);
    Promise.all([
      businessService.getBusiness(businessId),
      businessService.getBranches(businessId).catch(() => [] as Branch[]),
    ])
      .then(([b, list]) => { setMain(b); setBranches(list); })
      // An empty list must not stand in for a failed load — a salon would think its
      // second location had vanished.
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, [businessId]);

  const submit = async () => {
    if (!businessId || !form.name.trim()) return;
    setSaving(true);
    try {
      await businessService.createBranch({ businessId, ...form });
      toast.success(`${form.name} added`);
      setForm({ name: "", address: "", city: "", country: "", phone: "", email: "" });
      setAdding(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add this location");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Locations"
        subtitle="Your salon and any other shops you run"
        action={
          <Button className="gap-2" onClick={() => setAdding(v => !v)}>
            <Plus size={16} />
            {adding ? "Cancel" : "Add location"}
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {adding && (
          <Card>
            <CardContent className="p-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                       placeholder="Downtown branch" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Button disabled={saving || !form.name.trim()} onClick={() => void submit()}>
                  {saving ? "Adding…" : "Add location"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading locations…</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            Could not load your locations. This is not the same as having none — check your
            connection and reload.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {main && (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="mt-0.5 text-accent" />
                    <div className="min-w-0">
                      <p className="font-semibold">{main.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Main location</p>
                      <p className="text-sm text-muted-foreground mt-2">{main.address || "No address set"}</p>
                      {main.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                          <Phone size={13} /> {main.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {branches.map(branch => (
              <Card key={branch.id}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="mt-0.5 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-semibold">{branch.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Branch</p>
                      <p className="text-sm text-muted-foreground mt-2">{branch.address || "No address set"}</p>
                      {branch.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                          <Phone size={13} /> {branch.phone}
                        </p>
                      )}
                      {branch.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                          <Mail size={13} /> {branch.email}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {branches.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-5 text-sm text-muted-foreground">
                  One location so far. Add a branch if you run more than one shop — staff,
                  services and bookings stay separate per location.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
