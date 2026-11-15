import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn } from "@/components/page/booqiStyles";
import { ClientPreview, Field } from "@/components/page/kit";
import { fieldCls, salonName } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  notificationSettingsService,
  type NotificationSettings,
} from "@/services/notificationSettingsService";
import { getCurrentBusinessId } from "@/config/api";
import { BackToSettings, SaveBar } from "@/components/page/SettingsChrome";
import { t } from "@/i18n";

const EMAIL_ROWS: Array<{ key: keyof NotificationSettings; label: string; hint: string }> = [
  { key: "emailConfirmation", get label() { return t("notifications.bookingConfirmed"); }, get hint() { return t("notifications.sentTheMomentACustomer"); } },
  { key: "emailReminder", get label() { return t("notifications.reminder"); }, get hint() { return t("notifications.sentBeforeTheAppointment"); } },
  { key: "emailCancellation", get label() { return t("notifications.cancellation"); }, get hint() { return t("notifications.sentWhenABookingIs"); } },
  { key: "emailReschedule", get label() { return t("notifications.rescheduled"); }, get hint() { return t("notifications.sentWhenABookingMoves"); } },
  { key: "emailWaitlist", get label() { return t("notifications.waitlistSlotOpened"); }, get hint() { return t("notifications.sentWhenACancellationFrees"); } },
  { key: "emailReviewRequest", get label() { return t("notifications.reviewRequest"); }, get hint() { return t("notifications.sentWhenYouAskA"); } },
];

/**
 * What this salon actually wants sent. Every business used to get every email because
 * there was no way to say otherwise.
 */
export default function NotificationsPage({ section }: { section?: "email" | "sms-push" } = {}) {
  const businessId = getCurrentBusinessId();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedJson, setSavedJson] = useState("");

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    notificationSettingsService
      .get(businessId)
      .then((v) => { setSettings(v); setSavedJson(JSON.stringify(v)); })
      .catch(() => toast.error(t("notifications.couldNotLoadYourNotification")))
      .finally(() => setLoading(false));
  }, [businessId]);

  const set = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) =>
    setSettings(s => (s ? { ...s, [key]: value } : s));

  const save = async () => {
    if (!businessId || !settings) return;
    setSaving(true);
    try {
      const v = await notificationSettingsService.save(businessId, settings);
      setSettings(v);
      setSavedJson(JSON.stringify(v));
      toast.success(t("notifications.notificationSettingsSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("notifications.couldNotSaveYourSettings"));
    } finally {
      setSaving(false);
    }
  };

  const dirty = !!settings && JSON.stringify(settings) !== savedJson;
  const showEmail = !section || section === "email";
  const showSms = !section || section === "sms-push";
  const sw = "data-[state=checked]:bg-[rgb(var(--reg-brand))]";
  const row = (label: string, hint: string, control: React.ReactNode, id: string) => (
    <li key={id} className="flex items-start justify-between gap-4 border-t border-[rgb(var(--reg-line)/0.6)] px-4 py-3.5 first:border-t-0 md:px-5">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="mt-0.5 block text-sm text-[rgb(var(--reg-muted))]">{hint}</span>
      </label>
      {control}
    </li>
  );
  const card = (title: string, children: React.ReactNode) => (
    <section className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
      {title && <h2 className="px-4 pb-1 pt-4 text-base font-extrabold md:px-5">{title}</h2>}
      <ul>{children}</ul>
    </section>
  );

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={section === "email" ? t("setup.emailReminders") : section === "sms-push" ? t("setup.smsPush") : t("notifications.notifications")}
          subtitle={section === "email" ? t("setup.emailSub") : section === "sms-push" ? t("setup.smsPushSub") : t("notifications.whatYourCustomersHearFrom")}
          actions={
            <Button className={cn(primaryBtn, "hidden md:inline-flex")} disabled={saving || !dirty} onClick={() => void save()}>
              {saving ? t("common.saving") : dirty ? t("common.saveChanges") : t("common.saved")}
            </Button>
          }
        />
        <div className={pageBody}>
          {section && <BackToSettings />}
          {loading || !settings ? (
            <div className="h-64 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : (
            <div className={cn("grid gap-6", showEmail ? "lg:grid-cols-[minmax(0,1fr)_340px]" : "max-w-3xl")}>
              <div className="min-w-0 space-y-6">
                {showEmail && card(t("common.email"), (
                  <>
                    {EMAIL_ROWS.map((r) =>
                      row(r.label, r.hint, (
                        <Switch id={`n-${r.key}`} className={sw} checked={Boolean(settings[r.key])} onCheckedChange={(v) => set(r.key, v as NotificationSettings[typeof r.key])} />
                      ), `n-${r.key}`),
                    )}
                    <li className="border-t border-[rgb(var(--reg-line)/0.6)] px-4 py-4 md:px-5">
                      <Field label={t("notifications.reminderSentThisManyHours")} htmlFor="n-hours" hint={t("notifications.betweenAndAWeek")}>
                        <input id="n-hours" type="number" min={1} max={168} className={cn(fieldCls, "max-w-[140px]")} value={settings.reminderHoursBefore} onChange={(e) => set("reminderHoursBefore", Number(e.target.value))} />
                      </Field>
                    </li>
                  </>
                ))}

                {showEmail && <section className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
                  <h2 className="mb-3 text-base font-extrabold">{t("notifications.sender")}</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t("notifications.fromName")} htmlFor="n-from" hint={t("notifications.emptyUsesYourBusinessName")}>
                      <input id="n-from" className={fieldCls} value={settings.senderName ?? ""} onChange={(e) => set("senderName", e.target.value)} placeholder={t("notifications.yourSalonSName")} />
                    </Field>
                    <Field label={t("notifications.replyToAddress")} htmlFor="n-reply" hint={t("notifications.whereRepliesLand")}>
                      <input id="n-reply" type="email" className={fieldCls} value={settings.replyTo ?? ""} onChange={(e) => set("replyTo", e.target.value)} placeholder={t("notifications.helloYoursalonCom")} />
                    </Field>
                  </div>
                </section>}

                {/* Said plainly rather than shown as a switch that would do nothing: these
                    channels exist in the backend but need a provider configured. */}
                {showSms && card(section ? "" : t("notifications.smsAndPush"), (
                  <>
                    {row("SMS", settings.smsAvailable ? t("notifications.textMessagesAlongsideEmail") : t("notifications.noSmsProviderIsConnected"), (
                      <Switch id="n-sms" className={sw} checked={settings.smsEnabled} onCheckedChange={(v) => set("smsEnabled", v)} />
                    ), "n-sms")}
                    {row(t("notifications.push"), settings.pushAvailable ? t("notifications.pushNotificationsToTheCustomer") : t("notifications.noPushProviderIsConnected"), (
                      <Switch id="n-push" className={sw} checked={settings.pushEnabled} onCheckedChange={(v) => set("pushEnabled", v)} />
                    ), "n-push")}
                  </>
                ))}
              </div>

              {showEmail && <aside className="min-w-0 lg:sticky lg:top-[132px] lg:self-start">
                <ClientPreview where={t("notifications.theirInbox")}>
                  <div className="overflow-hidden rounded-2xl bg-white">
                    <div className="border-b border-[rgb(var(--reg-line)/0.7)] px-4 py-3 text-sm">
                      <p><span className="text-[rgb(var(--reg-muted))]">{t("common.from2")}{" "}</span><span className="font-bold">{settings.senderName?.trim() || salonName()}</span></p>
                      {settings.replyTo?.trim() && <p className="truncate text-xs text-[rgb(var(--reg-muted))]">{t("notifications.replyTo", { replyTo: settings.replyTo })}</p>}
                      <p className="mt-1 font-semibold">{settings.emailConfirmation ? t("notifications.yourBookingIsConfirmed") : t("notifications.noConfirmationEmail")}</p>
                    </div>
                    <div className="space-y-1 px-4 py-3 text-sm text-[rgb(var(--reg-ink)/0.85)]">
                      <p>{t("notifications.womenSCutBlowDry")}</p>
                      <p className="text-[rgb(var(--reg-muted))]">
                        {settings.emailReminder ? t("notifications.remindHoursBefore", { count: settings.reminderHoursBefore }) : t("notifications.noReminderWillBeSent")}
                      </p>
                    </div>
                  </div>
                </ClientPreview>
              </aside>}
            </div>
          )}
        </div>
        <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={() => setSettings(JSON.parse(savedJson) as NotificationSettings)} />
      </BooqiScope>
    </AppLayout>
  );
}
