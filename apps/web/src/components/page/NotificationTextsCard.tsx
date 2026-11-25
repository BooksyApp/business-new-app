import { useEffect, useState } from "react";
import { toast } from "sonner";

import { primaryBtn } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Id } from "@/types/id";
import {
  notificationSettingsService,
  type NotificationTextKind,
  type NotificationTextLocale,
  type NotificationTexts,
} from "@/services/notificationSettingsService";

const KINDS: NotificationTextKind[] = ["CONFIRMATION", "REMINDER", "CANCELLATION"];
const LOCALES: Array<{ code: NotificationTextLocale; name: string }> = [
  { code: "az", name: "AZ" },
  { code: "en", name: "EN" },
  { code: "ru", name: "RU" },
];
const MAX = 500;

function kindLabel(kind: NotificationTextKind): string {
  switch (kind) {
    case "CONFIRMATION":
      return t("notifications.textsConfirmation");
    case "REMINDER":
      return t("notifications.textsReminder");
    case "CANCELLATION":
      return t("notifications.textsCancellation");
  }
}

/** FG-W3-11: one custom paragraph per booking email kind and language, saved on its own. */
export function NotificationTextsCard({ businessId }: { businessId: Id }) {
  const [texts, setTexts] = useState<NotificationTexts | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    notificationSettingsService
      .getTexts(businessId)
      .then((r) => alive && setTexts(r))
      .catch(() => toast.error(t("notifications.textsError")));
    return () => {
      alive = false;
    };
  }, [businessId]);

  const setText = (kind: NotificationTextKind, locale: NotificationTextLocale, value: string) =>
    setTexts((prev) => (prev ? { ...prev, [kind]: { ...prev[kind], [locale]: value } } : prev));

  const save = async () => {
    if (!texts) return;
    setSaving(true);
    try {
      setTexts(await notificationSettingsService.saveTexts(businessId, texts));
      toast.success(t("notifications.textsSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("notifications.textsError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
      <h2 className="text-base font-extrabold">{t("notifications.textsTitle")}</h2>
      <p className="mb-4 mt-1 text-sm text-[rgb(var(--reg-muted))]">{t("notifications.textsHint")}</p>
      {!texts ? (
        <div className="h-32 animate-pulse rounded-2xl bg-[rgb(var(--reg-line)/0.3)]" aria-busy />
      ) : (
        <div className="space-y-6">
          {KINDS.map((kind) => (
            <div key={kind} className="space-y-3">
              <h3 className="text-sm font-bold">{kindLabel(kind)}</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {LOCALES.map((loc) => {
                  const id = `nt-${kind}-${loc.code}`;
                  const value = texts[kind][loc.code];
                  return (
                    <Field key={id} label={loc.name} htmlFor={id} hint={`${value.length}/${MAX}`}>
                      <textarea
                        id={id}
                        rows={3}
                        maxLength={MAX}
                        className={cn(fieldCls, "min-h-[88px] py-2")}
                        value={value}
                        placeholder={t("notifications.textsPlaceholder")}
                        onChange={(e) => setText(kind, loc.code, e.target.value)}
                      />
                    </Field>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <Button type="button" className={primaryBtn} disabled={saving} onClick={() => void save()}>
              {t("notifications.textsSave")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
