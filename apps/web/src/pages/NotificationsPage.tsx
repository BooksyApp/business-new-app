import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { Btn, Field, FormGrid, Skeleton, Toggle } from "@/components/bz";
import { BzSaveBar, SettingsFrame } from "@/components/bz/p3-Settings";
import { ClientPreview } from "@/components/page/kit";
import { salonName } from "@/components/page/kitStyles";
import {
  notificationSettingsService,
  type NotificationSettings,
} from "@/services/notificationSettingsService";
import { getCurrentBusinessId } from "@/config/api";
import { NotificationTextsCard } from "@/components/page/NotificationTextsCard";
import { ChannelsCard } from "@/components/page/ChannelsCard";
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
    const rt = (settings.replyTo ?? "").trim();
    if (rt && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rt)) { toast.error(t("notifications.replyToInvalid")); return; }
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
  const toggle = (label: string, hint: string, key: string, checked: boolean, onChange: (v: boolean) => void) => (
    <Toggle key={key} title={label} help={hint} checked={checked} onChange={onChange} />
  );

  return (
    <AppLayout>
      <SettingsFrame
        title={section === "email" ? t("setup.emailReminders") : section === "sms-push" ? t("setup.smsPush") : t("notifications.notifications")}
        sub={section === "email" ? t("setup.emailSub") : section === "sms-push" ? t("setup.smsPushSub") : t("notifications.whatYourCustomersHearFrom")}
        right={
          <Btn kind="v" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? t("common.saving") : dirty ? t("common.saveChanges") : t("common.saved")}
          </Btn>
        }
      >
        {loading || !settings ? (
          <Skeleton />
        ) : (
          <>
            {showEmail && (
              <>
                {EMAIL_ROWS.map((r) => toggle(r.label, r.hint, `n-${r.key}`, Boolean(settings[r.key]), (v) => set(r.key, v as NotificationSettings[typeof r.key])))}
                <Field label={t("notifications.reminderSentThisManyHours")} hint={t("notifications.betweenAndAWeek")}>
                  <input id="n-hours" type="number" min={1} max={168} value={settings.reminderHoursBefore} onChange={(e) => set("reminderHoursBefore", Number(e.target.value))} />
                </Field>

                {toggle(t("notifications.salonAlerts"), t("notifications.salonAlertsHint"), "n-salon-alerts", settings.salonAlerts !== false, (v) => set("salonAlerts", v))}
                <FormGrid cols={2}>
                  <Field label={t("notifications.fromName")} hint={t("notifications.emptyUsesYourBusinessName")}>
                    <input id="n-from" value={settings.senderName ?? ""} onChange={(e) => set("senderName", e.target.value)} placeholder={t("notifications.yourSalonSName")} />
                  </Field>
                  <Field label={t("notifications.replyToAddress")} hint={t("notifications.whereRepliesLand")}>
                    <input id="n-reply" type="email" value={settings.replyTo ?? ""} onChange={(e) => set("replyTo", e.target.value)} placeholder={t("notifications.helloYoursalonCom")} />
                  </Field>
                </FormGrid>

                <NotificationTextsCard businessId={businessId} />

                <ClientPreview where={t("notifications.theirInbox")}>
                  <div className="overflow-hidden rounded-2xl bg-white">
                    <div className="border-b border-[rgb(var(--reg-line)/0.7)] px-4 py-3 text-sm">
                      <p><span className="text-[rgb(var(--reg-muted))]">{t("common.fromSender")}{" "}</span><span className="font-bold">{settings.senderName?.trim() || salonName()}</span></p>
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
              </>
            )}

            {/* Said plainly rather than shown as a switch that would do nothing: these
                channels exist in the backend but need a provider configured. */}
            {showSms && (
              <>
                {toggle("SMS", settings.smsAvailable ? t("notifications.textMessagesAlongsideEmail") : t("notifications.noSmsProviderIsConnected"), "n-sms", settings.smsEnabled, (v) => set("smsEnabled", v))}
                {toggle(t("notifications.push"), settings.pushAvailable ? t("notifications.pushNotificationsToTheCustomer") : t("notifications.noPushProviderIsConnected"), "n-push", settings.pushEnabled, (v) => set("pushEnabled", v))}
                {businessId && <ChannelsCard businessId={businessId} settings={settings} set={set} />}
              </>
            )}
          </>
        )}
        <BzSaveBar dirty={dirty} saving={saving} onSave={() => void save()} onDiscard={() => setSettings(JSON.parse(savedJson) as NotificationSettings)} />
      </SettingsFrame>
    </AppLayout>
  );
}
