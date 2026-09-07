import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
    minBookingNoticeMinutes: "",
    maxBookingDaysAhead: "",
  });
  const [onlineBooking, setOnlineBooking] = useState(true);
  const [methods, setMethods] = useState<string[]>(["CASH", "CARD"]);

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
          minBookingNoticeMinutes: b.minBookingNoticeMinutes != null ? String(b.minBookingNoticeMinutes) : "",
          maxBookingDaysAhead: b.maxBookingDaysAhead != null ? String(b.maxBookingDaysAhead) : "",
        });
        setOnlineBooking(b.onlineBookingEnabled !== false);
        setMethods((b.acceptedPaymentMethods ?? "CASH,CARD").split(",").map(m => m.trim()).filter(Boolean));
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
        onlineBookingEnabled: onlineBooking,
        minBookingNoticeMinutes: num(form.minBookingNoticeMinutes),
        maxBookingDaysAhead: num(form.maxBookingDaysAhead),
        // Always sent: an empty list is a real choice (a salon that takes no payment in
        // the app), so it must not be read as "unchanged".
        acceptedPaymentMethods: methods.join(","),
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
      <PageHeader title="Booking policy" subtitle="Online booking, deposits, cancellations, payment and tax" />

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
              <CardHeader><CardTitle className="text-base">Online booking</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-sm font-medium">Accept bookings from the app</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Turn this off while you are closed or fully booked. Customers are told to
                      call instead, and your salon stays visible.
                    </p>
                  </div>
                  <Switch checked={onlineBooking} onCheckedChange={setOnlineBooking} />
                </div>
                <div className="grid gap-5 md:grid-cols-2 pt-2 border-t border-border/60">
                  {field("minBookingNoticeMinutes", "Minimum notice (minutes)", "How soon from now someone may book. 0 lets them book the next free slot.", { type: "number", min: 0, placeholder: "30" })}
                  {field("maxBookingDaysAhead", "Book up to (days ahead)", "How far into the future the calendar goes.", { type: "number", min: 1, max: 365, placeholder: "180" })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Payment methods</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  What the till offers when you take payment.
                </p>
                {[
                  { key: "CASH", label: "Cash" },
                  { key: "CARD", label: "Card in the salon" },
                  { key: "ONLINE", label: "Paid online" },
                ].map(m => (
                  <div key={m.key} className="flex items-center justify-between gap-6">
                    <p className="text-sm font-medium">{m.label}</p>
                    <Switch
                      checked={methods.includes(m.key)}
                      onCheckedChange={v =>
                        setMethods(prev => (v ? [...prev, m.key] : prev.filter(x => x !== m.key)))
                      }
                    />
                  </div>
                ))}
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
