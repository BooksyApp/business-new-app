import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { businessService, type Business } from "@/services/businessService";
import { getCurrentBusinessId } from "@/config/api";

/**
 * Setup listed "Booking Rules", "Cancellation Policy" and "Tax Settings" as three items —
 * two with no path at all and one that redirected to the staff page. They are the same
 * handful of numbers on the business record, so they are one screen rather than three
 * labels that go nowhere.
 *
 * Every field here changes what a customer is charged, so each says what it does in plain
 * words rather than leaving an owner to guess from a label.
 */
export default function BookingRulesPage() {
  const businessId = getCurrentBusinessId();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    depositPercent: "",
    cancellationWindowHours: "",
    lateCancellationFee: "",
    currency: "",
    taxRate: "",
  });

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    businessService
      .getBusiness(businessId)
      .then(b => {
        setBusiness(b);
        setForm({
          depositPercent: b.depositPercent != null ? String(b.depositPercent) : "",
          cancellationWindowHours: b.cancellationWindowHours != null ? String(b.cancellationWindowHours) : "",
          lateCancellationFee: b.lateCancellationFee != null ? String(b.lateCancellationFee) : "",
          currency: b.currency ?? "",
          taxRate: b.taxRate != null ? String(b.taxRate) : "",
        });
      })
      .catch(() => toast.error("Could not load your booking settings"))
      .finally(() => setLoading(false));
  }, [businessId]);

  const save = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      // Blank means "leave as it was" — the backend COALESCEs nulls, so an empty field
      // must not be sent as 0 and quietly turn a 30% deposit into none.
      const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
      const updated = await businessService.updateBusiness(businessId, {
        depositPercent: num(form.depositPercent),
        cancellationWindowHours: num(form.cancellationWindowHours),
        lateCancellationFee: num(form.lateCancellationFee),
        currency: form.currency.trim() ? form.currency.trim().toUpperCase() : undefined,
        taxRate: num(form.taxRate),
      });
      setBusiness(updated);
      toast.success("Booking settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your settings");
    } finally {
      setSaving(false);
    }
  };

  const field = (
    key: keyof typeof form,
    label: string,
    hint: string,
    props: Record<string, unknown> = {}
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        {...props}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <AppLayout>
      <PageHeader title="Booking rules" subtitle="Deposits, cancellations, currency and tax" />

      <div className="p-6 space-y-6 max-w-3xl">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Deposits and cancellations</CardTitle></CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-3">
                {field("depositPercent", "Deposit %", "Taken up front. A booking stays unconfirmed until it is paid. Leave empty for no deposit.", { type: "number", min: 0, max: 100, placeholder: "0" })}
                {field("cancellationWindowHours", "Free cancellation (hours)", "How long before the appointment a customer can cancel without a fee.", { type: "number", min: 0, placeholder: "24" })}
                {field("lateCancellationFee", "Late cancellation fee", "Charged when they cancel inside that window.", { type: "number", min: 0, step: "0.01", placeholder: "0.00" })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Money</CardTitle></CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2">
                {field("currency", "Currency", "Three-letter code, e.g. PLN or EUR. Every price in both apps is shown in it.", { maxLength: 3, placeholder: "PLN" })}
                {field("taxRate", "Tax rate %", "Applied to sales on receipts.", { type: "number", min: 0, max: 100, step: "0.01", placeholder: "0" })}
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save settings"}
              </Button>
              {business?.currency ? (
                <p className="text-xs text-muted-foreground">
                  Currently showing prices in {business.currency}
                  {business.depositPercent ? ` · ${business.depositPercent}% deposit` : " · no deposit"}
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
