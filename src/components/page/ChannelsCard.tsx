import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { channelMessagingService, type MessageLogRow, type ReminderDeliveryRow, type WhatsAppTemplate } from "@/services/channelMessagingService";
import type { NotificationSettings } from "@/services/notificationSettingsService";
import { getLocale, t } from "@/i18n";
import type { Id } from "@/types/id";

const ALL = ["push", "whatsapp", "sms", "email"] as const;
type Channel = (typeof ALL)[number];

const label = (c: Channel) =>
  c === "push" ? t("channels.push") : c === "whatsapp" ? t("channels.whatsappName") : c === "sms" ? t("channels.sms") : t("channels.email");

export function parseOrder(raw: string | undefined): Channel[] {
  const out: Channel[] = [];
  for (const part of (raw ?? "").split(",")) {
    const c = part.trim().toLowerCase() as Channel;
    if ((ALL as readonly string[]).includes(c) && !out.includes(c)) out.push(c);
  }
  return out.length ? out : [...ALL];
}

type Props = {
  businessId: Id;
  settings: NotificationSettings;
  set: <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => void;
};

const sw = "data-[state=checked]:bg-[rgb(var(--reg-brand))]";

/** WhatsApp and AI switches, the reminder channel order, the WhatsApp template and the recent message log. */
export function ChannelsCard({ businessId, settings, set }: Props) {
  const order = parseOrder(settings.channelOrder);
  const [lang, setLang] = useState<"az" | "ru" | "en">(() => (["az", "ru", "en"].includes(getLocale()) ? (getLocale() as "az" | "ru" | "en") : "az"));
  const [template, setTemplate] = useState<WhatsAppTemplate | null>(null);
  const [log, setLog] = useState<{ messages: MessageLogRow[]; reminders: ReminderDeliveryRow[] } | null>(null);

  useEffect(() => {
    channelMessagingService.template(businessId, lang).then(setTemplate).catch(() => setTemplate(null));
  }, [businessId, lang]);
  useEffect(() => {
    channelMessagingService.log(businessId).then(setLog).catch(() => setLog(null));
  }, [businessId]);

  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set("channelOrder", next.join(","));
  };

  const row = (id: string, title: string, hint: string, control: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 border-b border-[rgb(var(--reg-line)/0.6)] py-3 last:border-0">
      <label htmlFor={id} className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-[rgb(var(--reg-muted))]">{hint}</span>
      </label>
      {control}
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
        {row("n-wa", t("channels.whatsapp"), settings.whatsappAvailable ? t("channels.whatsappHint") : t("channels.whatsappOff"),
          <Switch id="n-wa" className={sw} checked={!!settings.whatsappEnabled} onCheckedChange={(v) => set("whatsappEnabled", v)} />)}
        {row("n-ai", t("channels.aiTitle"), settings.aiReceptionistAvailable ? t("channels.aiHint") : t("channels.aiOff"),
          <Switch id="n-ai" className={sw} checked={!!settings.aiReceptionistEnabled} disabled={!settings.aiReceptionistAvailable}
            onCheckedChange={(v) => set("aiReceptionistEnabled", v)} />)}
      </section>

      <section className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
        <h2 className="text-base font-extrabold">{t("channels.orderTitle")}</h2>
        <p className="mb-3 text-xs text-[rgb(var(--reg-muted))]">{t("channels.orderHint")}</p>
        <ol className="space-y-2">
          {order.map((c, i) => (
            <li key={c} className="flex items-center gap-3 rounded-xl bg-[rgb(var(--reg-brand-soft)/0.5)] px-3 py-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-bold">{i + 1}</span>
              <span className="flex-1 text-sm font-semibold">{label(c)}</span>
              <button type="button" aria-label={t("channels.moveUp")} disabled={i === 0} onClick={() => move(i, -1)}
                className={cn("rounded-lg p-1.5", i === 0 ? "opacity-30" : "hover:bg-white")}><ArrowUp className="h-4 w-4" /></button>
              <button type="button" aria-label={t("channels.moveDown")} disabled={i === order.length - 1} onClick={() => move(i, 1)}
                className={cn("rounded-lg p-1.5", i === order.length - 1 ? "opacity-30" : "hover:bg-white")}><ArrowDown className="h-4 w-4" /></button>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold">{t("channels.templateTitle")}</h2>
          <div className="flex gap-1" role="tablist">
            {(["az", "ru", "en"] as const).map((l) => (
              <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)}
                className={cn("rounded-lg px-2.5 py-1 text-xs font-bold uppercase", lang === l ? "bg-[rgb(var(--reg-brand))] text-white" : "bg-[rgb(var(--reg-brand-soft))]")}>{l}</button>
            ))}
          </div>
        </div>
        <p className="mb-3 text-xs text-[rgb(var(--reg-muted))]">{t("channels.templateHint")}</p>
        {template && (
          <>
            <p className="rounded-2xl rounded-tl-sm bg-[#dcf8c6] px-4 py-3 text-sm text-[#111]">{template.preview}</p>
            {/* UI2-HUBA-028: the preview above has sample values; the raw {{n}} text is only for copying to Meta. */}
            <details className="mt-2 text-xs text-[rgb(var(--reg-muted))]" data-testid="wa-raw-template">
              <summary className="cursor-pointer font-semibold">{t("channels.templateRaw")}</summary>
              <p className="mt-1 break-words font-mono text-[11px]">{template.body}</p>
              <p className="mt-1">{t("channels.templateParams")}</p>
              <button type="button" className="mt-1 font-bold underline" onClick={() => { void navigator.clipboard?.writeText(template.body).then(() => toast.success(t("channels.templateCopied"))).catch(() => undefined); }}>
                {t("channels.templateCopy")}
              </button>
            </details>
            <p className="mt-2 text-xs text-[rgb(var(--reg-muted))]">
              {t("channels.templateName", { name: template.name })} · {t("channels.templateBalance", { count: template.balance })}
            </p>
          </>
        )}
      </section>

      <section className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
        <h2 className="mb-2 text-base font-extrabold">{t("channels.logTitle")}</h2>
        {log && log.messages.length === 0 && log.reminders.length === 0 && (
          <p className="text-sm text-[rgb(var(--reg-muted))]">{t("channels.logEmpty")}</p>
        )}
        <ul className="divide-y divide-[rgb(var(--reg-line)/0.6)] text-sm">
          {(log?.messages ?? []).slice(0, 10).map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate"><b>{m.channel}</b> · {m.recipient} · {m.body}</span>
              <span className="shrink-0 text-xs text-[rgb(var(--reg-muted))]">
                {m.channel === "SMS" ? `${t("channels.logSegments", { count: m.segments })} · ` : ""}{m.status}{m.error ? ` (${m.error})` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
