import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { businessService, type Business } from "@/services/businessService";
import { getCurrentBusinessId } from "@/config/api";

/**
 * Setup listed "Logo & Colors", "Email Templates" and "Receipt Design" with nothing behind
 * any of them. These are the parts a salon can genuinely control: its logo, its colour and
 * the footer printed on receipts. Logos are URLs rather than uploads for the same reason
 * the cover photo is — this system has no file storage.
 */
export default function BrandingPage() {
  const businessId = getCurrentBusinessId();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ logoUrl: "", brandColor: "", receiptFooter: "", coverImageUrl: "" });

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    businessService
      .getBusiness(businessId)
      .then(b => {
        setBusiness(b);
        setForm({
          logoUrl: b.logoUrl ?? "",
          brandColor: b.brandColor ?? "",
          receiptFooter: b.receiptFooter ?? "",
          coverImageUrl: b.coverImageUrl ?? "",
        });
      })
      .catch(() => toast.error("Could not load your branding"))
      .finally(() => setLoading(false));
  }, [businessId]);

  const save = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      // Sent even when blank so clearing a field removes it; the backend maps '' to null.
      setBusiness(await businessService.updateBusiness(businessId, form));
      toast.success("Branding saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your branding");
    } finally {
      setSaving(false);
    }
  };

  const preview = (url: string, alt: string, className: string) =>
    url.trim() ? (
      <img
        src={url}
        alt={alt}
        className={className}
        // A typo should look like a broken link, not a broken layout.
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        onLoad={e => { (e.currentTarget as HTMLImageElement).style.display = "block"; }}
      />
    ) : null;

  return (
    <AppLayout>
      <PageHeader title="Branding" subtitle="How your salon looks to customers" />

      <div className="p-6 space-y-6 max-w-3xl">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Images</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    value={form.logoUrl}
                    onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground">
                    Square works best. Leave empty to show your salon's name instead.
                  </p>
                  {preview(form.logoUrl, "Logo preview", "h-16 w-16 rounded-lg border border-border/60 object-contain bg-white")}
                </div>
                <div className="space-y-2">
                  <Label>Cover photo URL</Label>
                  <Input
                    value={form.coverImageUrl}
                    onChange={e => setForm(f => ({ ...f, coverImageUrl: e.target.value }))}
                    placeholder="https://example.com/salon.jpg"
                  />
                  <p className="text-xs text-muted-foreground">
                    The photo customers see in the app. Empty shows a tile with your initials.
                  </p>
                  {preview(form.coverImageUrl, "Cover preview", "h-32 w-full rounded-lg border border-border/60 object-cover")}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Colour</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Label>Brand colour</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    className="h-10 w-16 p-1"
                    value={/^#[0-9a-fA-F]{6}$/.test(form.brandColor) ? form.brandColor : "#6d4df2"}
                    onChange={e => setForm(f => ({ ...f, brandColor: e.target.value }))}
                  />
                  <Input
                    className="max-w-[160px]"
                    value={form.brandColor}
                    onChange={e => setForm(f => ({ ...f, brandColor: e.target.value }))}
                    placeholder="#6d4df2"
                    maxLength={9}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used on your salon profile. Leave empty for the default.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Receipts</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Label>Receipt footer</Label>
                <Textarea
                  rows={3}
                  value={form.receiptFooter}
                  onChange={e => setForm(f => ({ ...f, receiptFooter: e.target.value }))}
                  placeholder="Thank you for visiting. Returns within 14 days with this receipt."
                />
                <p className="text-xs text-muted-foreground">
                  Printed at the bottom of every receipt — opening hours, a thank-you, your VAT number.
                </p>
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save branding"}
              </Button>
              {business?.name ? (
                <p className="text-xs text-muted-foreground">Applies to {business.name}</p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
