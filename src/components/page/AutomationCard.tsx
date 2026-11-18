import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { primaryBtn } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { t as tr, getLocale } from "@/i18n";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaignTemplates";
import { marketingAutomationService, type MarketingAutomation } from "@/services/campaignService";
import type { Id } from "@/types/id";

/** FG-W2-08: two switches, their timing, and the editable text (prefilled from the W2-07 templates). */
export function AutomationCard({ businessId }: { businessId: Id }) {
  const [form, setForm] = useState<MarketingAutomation | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const loc = getLocale();
    const tpl = (id: "birthday" | "winBack") => CAMPAIGN_TEMPLATES.find((x) => x.id === id)!;
    marketingAutomationService
      .get(businessId)
      .then((d) =>
        setForm({
          ...d,
          birthdaySubject: d.birthdaySubject ?? tpl("birthday").subject[loc],
          birthdayBody: d.birthdayBody ?? tpl("birthday").body[loc],
          winbackSubject: d.winbackSubject ?? tpl("winBack").subject[loc],
          winbackBody: d.winbackBody ?? tpl("winBack").body[loc],
        }),
      )
      .catch(() => setForm(null));
  }, [businessId]);

  if (!form) return null;
  const set = (patch: Partial<MarketingAutomation>) => setForm({ ...form, ...patch });

  const save = async () => {
    if ((form.birthdayEnabled && !form.birthdayBody?.trim()) || (form.winbackEnabled && !form.winbackBody?.trim())) {
      toast.error(tr("marketing.autoNeedText"));
      return;
    }
    setBusy(true);
    try {
      const { sentLast30Days: _ignored, ...body } = form;
      const saved = await marketingAutomationService.save(businessId, body);
      setForm({ ...form, sentLast30Days: saved.sentLast30Days });
      toast.success(tr("marketing.autoSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("marketing.autoSaveFail"));
    } finally {
      setBusy(false);
    }
  };

  const block = (
    on: boolean, onToggle: (v: boolean) => void, label: string, daysLabel: string, days: number,
    onDays: (n: number) => void, min: number, max: number,
    subject: string | null, onSubject: (s: string) => void, body: string | null, onBody: (s: string) => void,
  ) => (
    <div className="space-y-3 rounded-2xl p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
      <label className="flex items-center justify-between gap-3 text-sm font-medium">
        {label}
        <Switch checked={on} onCheckedChange={onToggle} aria-label={label} />
      </label>
      {on && (
        <>
          <label className="block text-xs text-muted-foreground">
            {daysLabel}
            <input type="number" min={min} max={max} value={days} className={fieldCls}
              onChange={(e) => onDays(Math.min(max, Math.max(min, Number(e.target.value) || min)))} />
          </label>
          <label className="block text-xs text-muted-foreground">
            {tr("marketing.autoSubject")}
            <input value={subject ?? ""} className={fieldCls} onChange={(e) => onSubject(e.target.value)} />
          </label>
          <label className="block text-xs text-muted-foreground">
            {tr("marketing.autoText")}
            <Textarea rows={4} value={body ?? ""} onChange={(e) => onBody(e.target.value)} />
          </label>
        </>
      )}
    </div>
  );

  return (
    <section className="space-y-4 rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
      <div>
        <h3 className="text-base font-semibold">{tr("marketing.autoTitle")}</h3>
        <p className="text-sm text-muted-foreground">{tr("marketing.autoHint")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {block(form.birthdayEnabled, (v) => set({ birthdayEnabled: v }), tr("marketing.autoBirthday"), tr("marketing.autoBirthdayDays"),
          form.birthdayDaysBefore, (n) => set({ birthdayDaysBefore: n }), 0, 30,
          form.birthdaySubject, (s) => set({ birthdaySubject: s }), form.birthdayBody, (s) => set({ birthdayBody: s }))}
        {block(form.winbackEnabled, (v) => set({ winbackEnabled: v }), tr("marketing.autoWinback"), tr("marketing.autoWinbackDays"),
          form.winbackDaysAfter, (n) => set({ winbackDaysAfter: n }), 14, 365,
          form.winbackSubject, (s) => set({ winbackSubject: s }), form.winbackBody, (s) => set({ winbackBody: s }))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{tr("marketing.autoSent30")}: <b>{form.sentLast30Days}</b></span>
        <Button className={primaryBtn} disabled={busy} onClick={save}>{tr("marketing.autoSave")}</Button>
      </div>
    </section>
  );
}
