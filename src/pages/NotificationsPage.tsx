import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  notificationSettingsService,
  type NotificationSettings,
} from "@/services/notificationSettingsService";
import { getCurrentBusinessId } from "@/config/api";

const EMAIL_ROWS: Array<{ key: keyof NotificationSettings; label: string; hint: string }> = [
  { key: "emailConfirmation", label: "Booking confirmed", hint: "Sent the moment a customer books." },
  { key: "emailReminder", label: "Reminder", hint: "Sent before the appointment." },
  { key: "emailCancellation", label: "Cancellation", hint: "Sent when a booking is called off." },
  { key: "emailReschedule", label: "Rescheduled", hint: "Sent when a booking moves." },
  { key: "emailWaitlist", label: "Waitlist slot opened", hint: "Sent when a cancellation frees a slot." },
  { key: "emailReviewRequest", label: "Review request", hint: "Sent when you ask a customer to review a visit." },
];

/**
 * What this salon actually wants sent. Every business used to get every email because
 * there was no way to say otherwise.
 */
export default function NotificationsPage() {
  const businessId = getCurrentBusinessId();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    notificationSettingsService
      .get(businessId)
      .then(setSettings)
      .catch(() => toast.error("Could not load your notification settings"))
      .finally(() => setLoading(false));
  }, [businessId]);

  const set = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) =>
    setSettings(s => (s ? { ...s, [key]: value } : s));

  const save = async () => {
    if (!businessId || !settings) return;
    setSaving(true);
    try {
      setSettings(await notificationSettingsService.save(businessId, settings));
      toast.success("Notification settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Notifications" subtitle="What your customers hear from you, and when" />

      <div className="p-6 space-y-6 max-w-3xl">
        {loading || !settings ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Email</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {EMAIL_ROWS.map(row => (
                  <div key={row.key} className="flex items-start justify-between gap-6">
                    <div>
                      <p className="text-sm font-medium">{row.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{row.hint}</p>
                    </div>
                    <Switch
                      checked={Boolean(settings[row.key])}
                      onCheckedChange={v => set(row.key, v as NotificationSettings[typeof row.key])}
                    />
                  </div>
                ))}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <Label>Reminder sent this many hours before</Label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    className="max-w-[140px]"
                    value={settings.reminderHoursBefore}
                    onChange={e => set("reminderHoursBefore", Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Between 1 and 168 (a week).</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Sender</CardTitle></CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>From name</Label>
                  <Input
                    value={settings.senderName ?? ""}
                    onChange={e => set("senderName", e.target.value)}
                    placeholder="Your salon's name"
                  />
                  <p className="text-xs text-muted-foreground">Shown as the sender. Empty uses your business name.</p>
                </div>
                <div className="space-y-2">
                  <Label>Reply-to address</Label>
                  <Input
                    type="email"
                    value={settings.replyTo ?? ""}
                    onChange={e => set("replyTo", e.target.value)}
                    placeholder="hello@yoursalon.com"
                  />
                  <p className="text-xs text-muted-foreground">Where replies land.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">SMS and push</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {/* Said plainly rather than shown as a switch that would do nothing: these
                    channels exist in the backend but need a provider configured. */}
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-sm font-medium">SMS</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {settings.smsAvailable
                        ? "Text messages alongside email."
                        : "No SMS provider is connected on this installation yet. Your choice is saved and applies as soon as one is."}
                    </p>
                  </div>
                  <Switch checked={settings.smsEnabled} onCheckedChange={v => set("smsEnabled", v)} />
                </div>
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-sm font-medium">Push</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {settings.pushAvailable
                        ? "Push notifications to the customer app."
                        : "No push provider is connected on this installation yet. Your choice is saved and applies as soon as one is."}
                    </p>
                  </div>
                  <Switch checked={settings.pushEnabled} onCheckedChange={v => set("pushEnabled", v)} />
                </div>
              </CardContent>
            </Card>

            <Button disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save notification settings"}
            </Button>
          </>
        )}
      </div>
    </AppLayout>
  );
}
